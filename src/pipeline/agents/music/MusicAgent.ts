import OpenAI from 'openai';
import { getOpenAIKey, GPT4O_MINI_PRICING } from '../../../config.js';
import { keyManager } from '../../../services/KeyManager.js';

export interface MusicOutput {
    prompt: string; // The lyrics / meta-tags for Suno
    title: string;
    style: string;
}

export class MusicAgent {
    static async generate(params: {
        description: string;
        style: string;
        instrumental: boolean;
        seed?: number;
    }): Promise<MusicOutput> {
        console.log(`[MusicAgent] Generating music prompt for style: ${params.style}`);

        const apiKeyObj = await getOpenAIKey();
        if (!apiKeyObj) {
            throw new Error('[MusicAgent] No working OpenAI API key available.');
        }

        const openai = new OpenAI({ apiKey: apiKeyObj.key_secret });

        const instrumentalRule = params.instrumental
            ? `INSTRUMENTAL ONLY. DO NOT generate lyrics. Describe the flow of the instruments, mood, and build-ups using Suno meta-tags (e.g., [Intro], [Drop], [Guitar Solo]).`
            : `WITH VOCALS. Generate lyrics in Angolan Portuguese (pt-AO). Include structure tags like [Verse], [Chorus], [Bridge].`;

        try {
            const systemMessage = `You are a professional music producer and lyricist creating prompts for Suno V4.
Your goal is to transform a user's basic description into a highly structured Suno prompt.

USER REQUEST:
- Description: ${params.description}
- Style: ${params.style}
- Type: ${params.instrumental ? 'Instrumental' : 'Vocal'}

RULES FOR SUNO PROMPTS:
1. Max 2-3 verses, 1-2 choruses. Keep it concise.
2. ${instrumentalRule}
3. If lyrics are included, make them catchy, emotive, and culturally relevant to Angola if applicable.
4. Enhance the "style" description with specific musical terms (e.g., instead of just "Pop", use "Upbeat Synth-Pop, 120bpm, energetic bassline").

RESPOND ONLY IN JSON FORMAT:
{
    "prompt": "<The full lyrics with meta-tags OR the instrumental structural description>",
    "title": "<A catchy title for the song, max 4 words>",
    "style": "<Enhanced style description for Suno>"
}`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: "Generate the Suno prompt structure now." }
                ],
                response_format: { type: "json_object" }
            });

            // Log usage
            if (response.usage) {
                await keyManager.logUsage(
                    apiKeyObj.id,
                    'openai',
                    'MusicAgent',
                    response.usage.prompt_tokens,
                    response.usage.completion_tokens,
                    (response.usage.prompt_tokens * GPT4O_MINI_PRICING.input) + (response.usage.completion_tokens * GPT4O_MINI_PRICING.output)
                );
            }

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('[MusicAgent] No content generated.');

            const parsed = JSON.parse(content) as MusicOutput;
            
            console.log(`[MusicAgent] ✅ Music prompt generated successfully.`);
            return parsed;

        } catch (error: any) {
            console.error('[MusicAgent] Error:', error.message);
            
            if (error.status === 401 || error.status === 429 || error.message.includes('API key')) {
                await keyManager.reportFailure(apiKeyObj.id, error.message);
            }
            
            throw error;
        }
    }
}
