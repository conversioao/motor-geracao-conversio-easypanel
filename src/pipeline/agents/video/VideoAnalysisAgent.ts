import OpenAI from 'openai';
import { getOpenAIKey, GPT4O_MINI_PRICING } from '../../../config.js';
import { keyManager } from '../../../services/KeyManager.js';

/**
 * CV-04 — VideoAnalysisAgent
 * High-depth Vision analysis for Video campaigns in Angola
 */
export class VideoAnalysisAgent {
    static async analyze(imageUrl: string, userPrompt: string): Promise<string> {
        console.log(`[VideoAnalysisAgent] 🔍 Analisando produto para campanha de vídeo...`);

        const apiKeyObj = await getOpenAIKey();
        if (!apiKeyObj) {
            return JSON.stringify({ error: 'No working OpenAI API key available.' });
        }

        const openai = new OpenAI({ apiKey: apiKeyObj.key_secret });

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Product Analyst for video marketing campaigns targeting Angola.
Analyze the uploaded product image and provide a highly detailed technical report to be used by a video director.
Cover: product name, exact colors, packaging material, textures, logo placement, size impression, target audience feel, emotional mood, and key visual selling points.
Be precise and objective. This report will be used to maintain 100% visual consistency in the generated video.`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Campaign description from user: "${userPrompt}". Analyze the product in this reference image in detail.` },
                            { type: "image_url", image_url: { url: imageUrl } },
                        ],
                    },
                ],
                max_tokens: 1500,
            });

            if (response.usage) {
                await keyManager.logUsage(
                    apiKeyObj.id, 'openai', 'VideoAnalysisAgent',
                    response.usage.prompt_tokens, response.usage.completion_tokens,
                    (response.usage.prompt_tokens * GPT4O_MINI_PRICING.input) + (response.usage.completion_tokens * GPT4O_MINI_PRICING.output)
                );
            }

            return response.choices[0]?.message?.content || '{}';
        } catch (error: any) {
            console.error('[VideoAnalysisAgent] Error:', error.message);
            if (error.status === 401 || error.status === 429 || error.message.includes('API key')) {
                await keyManager.reportFailure(apiKeyObj.id, error.message);
            }
            return JSON.stringify({ error: error.message });
        }
    }
}
