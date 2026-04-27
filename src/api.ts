// ─── GLOBAL ERROR HANDLERS ───────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
    console.error('CRITICAL: Uncaught Exception - Server might be in unstable state!');
    console.error('Stack:', error.stack || error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at Promise:', promise);
    console.error('Reason:', reason instanceof Error ? reason.stack : reason);
});

import express from 'express';
import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

// ─── PERFORMANCE OPTIMIZATIONS ───────────────────────────────────────────────────
http.globalAgent.maxSockets = Infinity;
https.globalAgent.maxSockets = Infinity;
// @ts-ignore
http.globalAgent.keepAlive = true;
// @ts-ignore
https.globalAgent.keepAlive = true;

import { query } from './db.js';
import { getConfig } from './config.js';
import { keyManager } from './services/KeyManager.js';
import { validateInternalSecret } from './middleware.js';
import { ImagePipeline } from './pipeline/ImagePipeline.js';
import { KieAiNode } from './pipeline/nodes/KieAiNode.js';
import { runMonitorAgent as MonitorAgent } from './services/monitorAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const SERVICE_TYPE = process.env.SERVICE_TYPE || 'ENGINE';
const PORT = process.env.PORT || 3010;
const BACKEND_URL = (process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://localhost:3003').replace(/[, ]/g, '');
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

app.use(express.json());
app.use(cors());

// ─── Global System Log Emitter (Internal for Engine) ─────────────────────────
export const systemLogEmitter = new EventEmitter();
systemLogEmitter.setMaxListeners(100);

export const emitSystemLog = (agent: string, message: string, status: 'info' | 'success' | 'warning' | 'error' = 'info', metadata: any = {}) => {
    const logEntry = { agent, message, status, metadata, timestamp: new Date().toISOString() };
    systemLogEmitter.emit('log', logEntry);
    
    // Also send log to backend if needed, or just DB
    query(`INSERT INTO agent_logs (agent_name, action, result, metadata) VALUES ($1, $2, $3, $4)`, 
        [agent, message.substring(0, 100), status === 'success' ? 'success' : (status === 'error' ? 'error' : 'info'), JSON.stringify(metadata)]
    ).catch(() => {});

// Forward to backend logs endpoint
    if (INTERNAL_SECRET) {
        axios.post(`${BACKEND_URL}/api/internal/logs`, logEntry, {
            headers: { 'X-Internal-Secret': INTERNAL_SECRET }
        }).catch(() => {});
    }
};

// Real-time SSE logs stream for backend proxy
app.get('/api/internal/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onLog = (logEntry: any) => {
        try {
            res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
        } catch (err) {
            // connection dropped
        }
    };

    systemLogEmitter.on('log', onLog);

    req.on('close', () => {
        systemLogEmitter.off('log', onLog);
    });
});

// Health Check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'GENERATION_ENGINE', port: PORT, timestamp: new Date().toISOString() });
});

// ─── Generation Endpoints ───────────────────────────────────────────────────

// 1. Image Generation
app.post('/api/internal/generate/image', validateInternalSecret, async (req, res) => {
    const options = req.body;
    console.log(`[Engine] 🖼️ Received image generation task: ${options.generationId}`);
    emitSystemLog('Engine', `🖼️ A iniciar tarefa de Imagem (${options.modelId || 'flux'})...`, 'info', { generationId: options.generationId, aspectRatio: options.aspectRatio });
    
    res.json({ success: true, message: 'Image generation started' });

    try {
        const result = await ImagePipeline.run(options);
        
        // Call backend callback
        emitSystemLog('Engine', `✅ Imagem gerada com sucesso! Sincronizando...`, 'success', { generationId: options.generationId, url: result.imageUrl });

        await axios.post(`${BACKEND_URL}/api/internal/generation-callback`, {
            generationId: options.generationId,
            status: 'completed',
            imageUrl: result.imageUrl,
            pipeline_status: 'Concluído',
            pipeline_progress: 100
        }, {
            headers: { 'X-Internal-Secret': INTERNAL_SECRET }
        }).catch(err => console.error(`[Engine] Callback failed:`, err.message));

    } catch (err: any) {
        console.error(`[Engine] ❌ Image pipeline failed:`, err.message);
        emitSystemLog('Engine', `❌ Falha na geração de Imagem: ${err.message}`, 'error', { generationId: options.generationId });
        await axios.post(`${BACKEND_URL}/api/internal/generation-callback`, {
            generationId: options.generationId,
            status: 'failed',
            pipeline_status: 'Falhou',
            error: err.message
        }, {
            headers: { 'X-Internal-Secret': INTERNAL_SECRET }
        }).catch(() => {});
    }
});

// 2. Video Generation
app.post('/api/internal/generate/video', validateInternalSecret, async (req, res) => {
    const { userId, userPrompt, productImageUrl, coreId, coreName, modelId, aspectRatio, generationId, useBrandColors, brandColors } = req.body;
    console.log(`[Engine] 🎬 Received video generation task: ${generationId}`);
    emitSystemLog('Engine', `🎬 A iniciar tarefa de Vídeo (${modelId})...`, 'info', { generationId, aspectRatio });
    
    res.json({ success: true, message: 'Video generation started' });

    try {
        // Build prompt with video analysis if image is provided
        let finalPrompt = userPrompt || '';
        let generatedData: any = {};

        if (productImageUrl) {
            try {
                const { VideoAnalysisAgent } = await import('./pipeline/agents/video/VideoAnalysisAgent.js');
                const analysis = await VideoAnalysisAgent.analyze(productImageUrl, userPrompt || '');
                
                const { VideoPromptAgent } = await import('./pipeline/agents/video/VideoPromptAgent.js');
                const { SeedSystem } = await import('./pipeline/utils/SeedSystem.js');
                const seed = SeedSystem.generateSeed();
                generatedData = await VideoPromptAgent.generate({
                    analysis,
                    userPrompt: userPrompt || '',
                    aspectRatio: aspectRatio || '16:9',
                    seed,
                    useBrandColors,
                    brandColors
                });
                
                // Veo 3 expects the full structured JSON in the prompt field
                if (generatedData.veo_structured_prompt) {
                    finalPrompt = JSON.stringify(generatedData.veo_structured_prompt);
                } else {
                    finalPrompt = generatedData.veo_prompt || finalPrompt;
                }
            } catch (promptErr: any) {
                console.warn(`[Engine] Video prompt generation failed:`, promptErr.message);
            }
        }

        const kieKeyObj = await keyManager.getWorkingKey('kie');
        const kieKey = kieKeyObj?.key_secret || await getConfig('KIE_AI_API_KEY');

        const taskId = await KieAiNode.createTask({
            model: modelId || 'google/veo-3.1-generate',
            prompt: finalPrompt,
            imageUrls: productImageUrl ? [productImageUrl] : [],
            aspectRatio: aspectRatio || '16:9',
            apiKey: kieKey
        });

        const resultUrl = await KieAiNode.pollJobStatus(taskId, 15, 15, kieKey, true);

        // Call backend callback
        emitSystemLog('Engine', `✅ Vídeo gerado com sucesso! Sincronizando com o backend...`, 'success', { generationId, url: resultUrl });

        await axios.post(`${BACKEND_URL}/api/internal/generation-callback`, {
            generationId,
            status: 'completed',
            videoUrls: [resultUrl],
            result_url: resultUrl,
            pipeline_status: 'Concluído',
            pipeline_progress: 100,
            json_result: {
                title: 'Vídeo UGC',
                lyrics: generatedData.copy || null,
                hashtags: generatedData.hashtags || null
            }
        }, {
            headers: { 'X-Internal-Secret': INTERNAL_SECRET }
        });

    } catch (err: any) {
        console.error(`[Engine] ❌ Video pipeline failed:`, err.message);
        emitSystemLog('Engine', `❌ Falha na geração do vídeo: ${err.message}`, 'error', { generationId });
        await axios.post(`${BACKEND_URL}/api/internal/generation-callback`, {
            generationId,
            status: 'failed',
            error: err.message
        }, {
            headers: { 'X-Internal-Secret': INTERNAL_SECRET }
        }).catch(() => {});
    }
});

// 3. Audio/Music Generation
app.post('/api/internal/generate/audio', validateInternalSecret, async (req, res) => {
    const { userId, generationId, prompt, userPrompt, style, model, instrumental } = req.body;
    console.log(`[Engine] 🎵 Received audio generation task: ${generationId}`);
    emitSystemLog('Engine', `🎵 A iniciar tarefa de Áudio (${model || 'suno'})...`, 'info', { generationId, style });
    
    res.json({ success: true, message: 'Audio generation started' });

    try {
        const { MusicAgent } = await import('./pipeline/agents/music/MusicAgent.js');
        const musicData = await MusicAgent.generate({
            description: prompt || userPrompt || '',
            style: style || 'Pop',
            instrumental: !!instrumental
        });

        const kieKeyObj = await keyManager.getWorkingKey('kie');
        const kieKey = kieKeyObj?.key_secret || await getConfig('KIE_AI_API_KEY');

        const taskId = await KieAiNode.createTask({
            model: model || 'suno/v4',
            prompt: musicData.prompt,
            style: musicData.style,
            title: musicData.title,
            instrumental: !!instrumental,
            apiKey: kieKey
        });

        const resultUrl = await KieAiNode.pollJobStatus(taskId, 10, 15, kieKey, false, true);

        emitSystemLog('Engine', `✅ Faixa de Áudio gerada com sucesso! Sincronizando...`, 'success', { generationId, title: musicData.title });

        await axios.post(`${BACKEND_URL}/api/internal/generation-callback`, {
            generationId,
            status: 'completed',
            audio_url: resultUrl,
            audio_urls: [resultUrl],
            pipeline_status: 'Concluído',
            pipeline_progress: 100,
            json_result: {
                title: musicData.title,
                lyrics: musicData.prompt
            }
        }, {
            headers: { 'X-Internal-Secret': INTERNAL_SECRET }
        });

    } catch (err: any) {
        console.error(`[Engine] ❌ Audio pipeline failed:`, err.message);
        emitSystemLog('Engine', `❌ Falha na geração de Áudio: ${err.message}`, 'error', { generationId });
        await axios.post(`${BACKEND_URL}/api/internal/generation-callback`, {
            generationId,
            status: 'failed',
            error: err.message
        }, {
            headers: { 'X-Internal-Secret': INTERNAL_SECRET }
        }).catch(() => {});
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`[Generation Engine] 🚀 Running on http://localhost:${PORT}`);
    console.log(`[Generation Engine] 🔗 Backend URL: ${BACKEND_URL}`);
    
    if (SERVICE_TYPE === 'ENGINE') {
        setTimeout(() => {
            try {
                MonitorAgent();
                console.log('[SYSTEM] Monitor Agent initiated.');
            } catch (err) {
                console.error('[CRITICAL] Failed to start Monitor Agent:', err);
            }
        }, 5000);
    }
});
