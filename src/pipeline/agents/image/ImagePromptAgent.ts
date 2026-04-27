import OpenAI from 'openai';
import { getOpenAIKey, GPT4O_MINI_PRICING } from '../../../config.js';
import { keyManager } from '../../../services/KeyManager.js';

export interface AdOutput {
    prompt: string;
    title: string;
    copy: string;
    hashtags: string;
    metadata?: any;
}

/**
 * ImagePromptAgent — Master router for image ad generation (Generation Engine).
 * Routes to the correct specialized agent based on coreId:
 *   - 'impact-ads-pro' → ImpactAdsProAgent (CV-03)
 *   - 'ugc-realistic'  → UGCRealisticAgent (CV-02)
 *   - default          → General brand visual prompt
 */
export class PromptAgent {
    static async generate(params: {
        analysis: string;
        userPrompt: string;
        coreId?: string;
        core: string;
        style: string;
        useBrandColors?: boolean;
        brandColors?: any;
        currentIndex?: number;
        totalItems?: number;
        contextAntiRepeticao?: string;
        includeText?: boolean;
        seed: number;
        modelId?: string;
    }): Promise<AdOutput> {
        console.log(`[ImagePromptAgent] Routing to agent for core: ${params.core} (ID: ${params.coreId})`);

        if (params.coreId === 'impact-ads-pro') {
            const { ImpactAdsProAgent } = await import('./ImpactAdsProAgent.js');
            return ImpactAdsProAgent.generate({
                analysis: params.analysis,
                userPrompt: params.userPrompt,
                style: params.style,
                useBrandColors: params.useBrandColors || false,
                brandColors: params.brandColors,
                currentIndex: params.currentIndex,
                totalItems: params.totalItems,
                contextAntiRepeticao: params.contextAntiRepeticao,
                includeText: params.includeText,
                seed: params.seed,
            });
        }

        if (params.coreId === 'ugc-realistic') {
            const { UGCRealisticAgent } = await import('./UGCRealisticAgent.js');
            return UGCRealisticAgent.generate({
                analysis: params.analysis,
                userPrompt: params.userPrompt,
                style: params.style,
                useBrandColors: params.useBrandColors,
                brandColors: params.brandColors,
                includeText: params.includeText,
                seed: params.seed,
            });
        }

        if (params.coreId === 'boutique-fashion') {
            const { BoutiqueFashionAgent } = await import('./BoutiqueFashionAgent.js');
            return BoutiqueFashionAgent.generate({
                analysis: params.analysis,
                userPrompt: params.userPrompt,
                style: params.style,
                useBrandColors: params.useBrandColors,
                brandColors: params.brandColors,
                includeText: params.includeText,
                seed: params.seed,
            });
        }

        // General brand visual fallback
        console.log(`[ImagePromptAgent] Using general brand visual prompt for core: ${params.core}`);
        
        const apiKeyObj = await getOpenAIKey();
        if (!apiKeyObj) {
            throw new Error('[ImagePromptAgent] No working OpenAI API key available.');
        }

        const openai = new OpenAI({ apiKey: apiKeyObj.key_secret });
        try {
            const systemMessage = `Você é um especialista em criação de anúncios visuais de alto impacto para o mercado Angolano.
REGRAS VISUAIS:
- PESSOAS: sempre negras/morenas com traços angolanos.
- CORES DA MARCA: ${params.useBrandColors ? `Use as cores da marca: ${JSON.stringify(params.brandColors)}. Aplique-as sutilmente no cenário, iluminação ou vestuário.` : 'Use cores naturais e vibrantes adequadas ao estilo.'}
- TEXTO NA IMAGEM: ${params.includeText ? 'SIM, inclua pequenos textos promocionais ou etiquetas elegantes em Português (Angola) se for apropriado ao estilo.' : 'NÃO inclua texto na imagem.'}
- IDIOMA: Português de Angola (pt-AO).
- PRODUTO: ${params.analysis}
- CORE: ${params.core} | ESTILO: ${params.style}
- INSTRUÇÕES DO USUÁRIO: ${params.userPrompt || "Crie um anúncio criativo seguindo o estilo."}

RESPONDA EM JSON: { "prompt": "prompt técnico em inglês", "title": "título curto", "copy": "copy para legenda", "hashtags": "#tag1 #tag2" }`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: `Gere o anúncio para: ${params.userPrompt || 'estilo ' + params.style}` }
                ],
                response_format: { type: "json_object" }
            });

            // Log usage for cost tracking
            if (response.usage) {
                await keyManager.logUsage(
                    apiKeyObj.id, 
                    'openai', 
                    'ImagePromptAgent', 
                    response.usage.prompt_tokens, 
                    response.usage.completion_tokens,
                    (response.usage.prompt_tokens * GPT4O_MINI_PRICING.input) + (response.usage.completion_tokens * GPT4O_MINI_PRICING.output)
                );
            }

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('[ImagePromptAgent] No content generated.');
            return JSON.parse(content) as AdOutput;
        } catch (error: any) {
            console.error('[ImagePromptAgent] Error in fallback generation:', error.message);
            
            // Report failure to trigger failover
            if (error.status === 401 || error.status === 429 || error.message.includes('API key')) {
                await keyManager.reportFailure(apiKeyObj.id, error.message);
            }
            
            throw error;
        }
    }
}
