/**
 * patch_engine.cjs
 * Aplica as 3 correções cirúrgicas no Engine:
 *   1. api.ts - extrai apiKey do body e passa ao pipeline
 *   2. api.ts - corrige BACKEND_URL fallback de localhost para Easypanel
 *   3. src/pipeline/nodes/KieAiNode.ts - image_input → image_urls para nano-banana-pro
 * Executa: node patch_engine.cjs
 */
const fs = require('fs');
const path = require('path');

let errorCount = 0;

function applyPatch(filePath, patches) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    for (const { name, find, replace } of patches) {
        if (!content.includes(find)) {
            console.error(`  ❌ [${name}] Pattern NOT found in ${path.basename(filePath)}`);
            errorCount++;
            continue;
        }
        const count = content.split(find).length - 1;
        if (count > 1) {
            console.warn(`  ⚠️  [${name}] Pattern found ${count}x — replacing first only`);
            content = content.replace(find, replace);
        } else {
            content = content.split(find).join(replace);
        }
        console.log(`  ✅ [${name}] Applied`);
    }
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  💾 Saved: ${path.basename(filePath)}\n`);
    } else {
        console.log(`  ⚠️  No changes made to ${path.basename(filePath)}\n`);
    }
}

// ─── PATCH 1 & 2: Engine api.ts ───────────────────────────────────────────────
console.log('📝 Patching deploy_generation_engine/src/api.ts...');

const ENGINE_API = path.join(__dirname, 'src', 'api.ts');

applyPatch(ENGINE_API, [
    {
        name: 'Extract injectedApiKey from body',
        find: `        userId, userPrompt, productImageUrl, coreId, coreName, \r\n        style, aspectRatio, generationId, modelId, resolution \r\n    } = req.body;\r\n\r\n    console.log(\`[ENGINE] 🚀 Received internal image generation request: \${generationId}\`);\r\n    \r\n    // Return immediately to Backend\r\n    res.json({ success: true, message: 'Geração iniciada no motor.' });\r\n\r\n    try {\r\n        // Run pipeline\r\n        await ImagePipeline.run({\r\n            userId,\r\n            userPrompt,\r\n            productImageUrl,\r\n            coreId,\r\n            coreName,\r\n            style,\r\n            aspectRatio,\r\n            generationId\r\n        });`,
        replace: `        userId, userPrompt, productImageUrl, coreId, coreName, \r\n        style, aspectRatio, generationId, modelId, resolution,\r\n        apiKey: injectedApiKey\r\n    } = req.body;\r\n\r\n    console.log(\`[ENGINE] 🚀 Received internal image generation request: \${generationId}\`);\r\n    console.log(\`[ENGINE] 🔑 ApiKey from backend: \${injectedApiKey ? injectedApiKey.substring(0, 10) + '...' : 'NOT PROVIDED - using DB/ENV fallback'}\`);\r\n    \r\n    // Return immediately to Backend\r\n    res.json({ success: true, message: 'Image generation started', generationId });\r\n\r\n    try {\r\n        // Run pipeline (pass injected key so engine can skip DB lookup)\r\n        await ImagePipeline.run({\r\n            userId,\r\n            userPrompt,\r\n            productImageUrl,\r\n            coreId,\r\n            coreName,\r\n            style,\r\n            aspectRatio,\r\n            generationId,\r\n            apiKey: injectedApiKey\r\n        });`
    },
    {
        name: 'Fix BACKEND_URL success fallback',
        find: `        const backendUrl = (process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://localhost:3003').replace(/[, ]/g, '');\r\n        const internalSecret = process.env.INTERNAL_SECRET;\r\n\r\n        // Fetch final status from DB`,
        replace: `        const backendUrl = (process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://conversio-backend-app:3003').replace(/[, ]/g, '');\r\n        const internalSecret = process.env.INTERNAL_SECRET;\r\n\r\n        // Fetch final status from DB`
    },
    {
        name: 'Fix BACKEND_URL error fallback',
        find: `        console.error(\`[ENGINE] ❌ Generation \${generationId} failed:\`, error.message);\r\n        const backendUrl = (process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://localhost:3003').replace(/[, ]/g, '');`,
        replace: `        console.error(\`[ENGINE] ❌ Generation \${generationId} failed:\`, error.message);\r\n        const backendUrl = (process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://conversio-backend-app:3003').replace(/[, ]/g, '');`
    }
]);

// ─── PATCH 3: KieAiNode.ts — image_input → image_urls for nano-banana-pro ─────
console.log('📝 Patching deploy_generation_engine/src/pipeline/nodes/KieAiNode.ts...');

const KIEAI_ENGINE = path.join(__dirname, 'src', 'pipeline', 'nodes', 'KieAiNode.ts');

applyPatch(KIEAI_ENGINE, [
    {
        name: 'Fix nano-banana-pro image_input → image_urls',
        find: `        } else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\r\n            input = {\r\n                prompt: params.prompt,\r\n                image_input: params.imageUrls || [],\r\n                aspect_ratio: params.aspectRatio || '1:1',\r\n                resolution: (params.resolution || '1k').toUpperCase(),\r\n                output_format: 'jpg'\r\n            };`,
        replace: `        } else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\r\n            input = {\r\n                prompt: params.prompt,\r\n                image_urls: params.imageUrls || [],\r\n                aspect_ratio: params.aspectRatio || '1:1',\r\n                resolution: (params.resolution || '1k').toUpperCase(),\r\n                output_format: 'jpg'\r\n            };`
    }
]);

// ─── PATCH 4: backend KieAiNode.ts — same fix ─────────────────────────────────
console.log('📝 Patching backend/src/pipeline/nodes/KieAiNode.ts...');

const KIEAI_BACKEND = path.join(__dirname, '..', 'backend', 'src', 'pipeline', 'nodes', 'KieAiNode.ts');

if (fs.existsSync(KIEAI_BACKEND)) {
    applyPatch(KIEAI_BACKEND, [
        {
            name: 'Fix nano-banana-pro image_input → image_urls (backend)',
            find: `        } else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\r\n            input = {\r\n                prompt: params.prompt,\r\n                image_input: params.imageUrls || [],\r\n                aspect_ratio: params.aspectRatio || '1:1',\r\n                resolution: (params.resolution || '1k').toUpperCase(),\r\n                output_format: 'jpg'\r\n            };`,
            replace: `        } else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\r\n            input = {\r\n                prompt: params.prompt,\r\n                image_urls: params.imageUrls || [],\r\n                aspect_ratio: params.aspectRatio || '1:1',\r\n                resolution: (params.resolution || '1k').toUpperCase(),\r\n                output_format: 'jpg'\r\n            };`
        }
    ]);
} else {
    console.log('  ⚠️  Backend KieAiNode.ts not found, skipping.\n');
}

// ─── PATCH 5: ImagePipeline.ts — accept apiKey param and use it ───────────────
console.log('📝 Patching deploy_generation_engine/src/pipeline/ImagePipeline.ts...');

const PIPELINE_ENGINE = path.join(__dirname, 'src', 'pipeline', 'ImagePipeline.ts');

applyPatch(PIPELINE_ENGINE, [
    {
        name: 'Add apiKey to PipelineOptions interface',
        find: `    generationId: string; // The ID of the record already created in DB\r\n}`,
        replace: `    generationId: string; // The ID of the record already created in DB\r\n    apiKey?: string; // Optional: pre-fetched KIE.ai key from backend\r\n}`
    },
    {
        name: 'Use injected apiKey with fallback to DB/ENV',
        find: `            // Get working API Key for KIE.ai\r\n            const { keyManager } = await import('../services/KeyManager.js');\r\n            const kieAiKey = await keyManager.getWorkingKey('kie');\r\n            const kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\r\n            const keyId = kieAiKey?.id || null;`,
        replace: `            // Get working API Key for KIE.ai (prefer injected key from backend, fallback to DB/ENV)\r\n            const { keyManager } = await import('../services/KeyManager.js');\r\n            let kieKey = options.apiKey || null;\r\n            let keyId: number | null = null;\r\n            if (!kieKey) {\r\n                const kieAiKey = await keyManager.getWorkingKey('kie');\r\n                kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\r\n                keyId = kieAiKey?.id || null;\r\n            }\r\n            console.log(\`[ImagePipeline] 🔑 Using KIE key: \${kieKey ? kieKey.substring(0, 10) + '...' : 'MISSING!'}\`);`
    }
]);

// ─── PATCH 6: backend ImagePipeline.ts — same fix ─────────────────────────────
console.log('📝 Patching backend/src/pipeline/ImagePipeline.ts...');

const PIPELINE_BACKEND = path.join(__dirname, '..', 'backend', 'src', 'pipeline', 'ImagePipeline.ts');

if (fs.existsSync(PIPELINE_BACKEND)) {
    applyPatch(PIPELINE_BACKEND, [
        {
            name: 'Add apiKey to PipelineOptions interface (backend)',
            find: `    generationId: string; // The ID of the record already created in DB\r\n}`,
            replace: `    generationId: string; // The ID of the record already created in DB\r\n    apiKey?: string; // Optional: pre-fetched KIE.ai key from backend\r\n}`
        },
        {
            name: 'Use injected apiKey with fallback (backend)',
            find: `            // Get working API Key for KIE.ai\r\n            const { keyManager } = await import('../services/KeyManager.js');\r\n            const kieAiKey = await keyManager.getWorkingKey('kie');\r\n            const kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\r\n            const keyId = kieAiKey?.id || null;`,
            replace: `            // Get working API Key for KIE.ai (prefer injected key from backend, fallback to DB/ENV)\r\n            const { keyManager } = await import('../services/KeyManager.js');\r\n            let kieKey = options.apiKey || null;\r\n            let keyId: number | null = null;\r\n            if (!kieKey) {\r\n                const kieAiKey = await keyManager.getWorkingKey('kie');\r\n                kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\r\n                keyId = kieAiKey?.id || null;\r\n            }\r\n            console.log(\`[ImagePipeline] 🔑 Using KIE key: \${kieKey ? kieKey.substring(0, 10) + '...' : 'MISSING!'}\`);`
        }
    ]);
}

// ─── Summary ───────────────────────────────────────────────────────────────────
if (errorCount === 0) {
    console.log('🎉 All patches applied successfully!');
} else {
    console.error(`\n⚠️  ${errorCount} patch(es) failed. Review manually.`);
}
