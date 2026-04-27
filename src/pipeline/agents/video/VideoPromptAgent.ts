import OpenAI from 'openai';
import { getOpenAIKey, GPT4O_MINI_PRICING } from '../../../config.js';
import { keyManager } from '../../../services/KeyManager.js';

const VEO3_SYSTEM_BASE = `You are an elite, award-winning Creative Director & Veo 3.1 Prompt Engineer.
You specialize in high-converting short-form video ads for the Angolan market.

═══════════════════════════════════════════════════
ABSOLUTE LANGUAGE RULES (NEVER VIOLATE):
═══════════════════════════════════════════════════
- All narration, scripts, and social copy MUST be in NATIVE ANGOLAN PORTUGUESE (pt-AO).
- PROHIBITED (pt-BR): "cara", "legal", "show", "galera", "mano", "oi", "né", "bacana", "você" (overuse), "tudo bem?"
- PROHIBITED (pt-PT): "fixe", "miúdo", "rapariga", "bué", "gira", "porreiro"
- Correct pt-AO expressions: "Olá!", "Como vai?", "O que é que tá acontecer?", "Muito bom!", "Experimenta", "Confere"
- Voice tone MUST match the talent's visual profile.

═══════════════════════════════════════════════════
VEO 3.1 JSON OUTPUT RULES:
═══════════════════════════════════════════════════
- Return a single, valid, minified JSON object — NO markdown, NO backticks, NO extra text.
- All descriptions for the Veo model must be in ENGLISH (the AI model reads English best).
- All narration scripts (narration_pt_AO) MUST be in pt-AO.
- Product consistency: explicitly reference "the exact product from the reference image".

Required JSON structure:
{
  "veo_structured_prompt": {
    "product_reference": {
      "name": "string",
      "visual_description": "string - detailed English description for Veo3 to maintain visual consistency"
    },
    "talent": {
      "appearance": "string - Young Black/mixed-race Angolan (specify gender), premium attire",
      "energy": "string - e.g. Energetic, warm, trust-building",
      "voice_tone": "string - matches appearance. E.g: Youthful, deep, enthusiastic"
    },
    "setting": {
      "location": "string - e.g. Modern Luanda apartment, premium bathroom",
      "lighting": "string - e.g. Soft cinematic studio lighting, warm tones"
    },
    "camera": {
      "style": "string - e.g. iPhone 15 Pro, 4K vertical, UGC handheld",
      "movement": "string - e.g. Slow push-in on product, then pull-back to talent"
    },
    "shots": [
      {
        "timecode": "00:00-00:04",
        "action": "string - English scene description",
        "narration_pt_AO": "string - Exact Angolan Portuguese script"
      },
      {
        "timecode": "00:04-00:08",
        "action": "string - English scene description with CTA",
        "narration_pt_AO": "string - Exact Angolan Portuguese CTA"
      }
    ],
    "audio": {
      "music": "string - e.g. Afrobeats instrumental, soft and premium",
      "sfx": "string - optional sound effects"
    },
    "aspect_ratio": "string",
    "duration_seconds": 8,
    "format": "string"
  },
  "copy": "string - social media caption in strict pt-AO",
  "hashtags": "string - 3-5 relevant hashtags"
}`;

/**
 * CV-05 — VideoPromptAgent (Master Router)
 * Generates premium Veo 3 structured JSON prompts for all video styles.
 */
export class VideoPromptAgent {
    static async generate(params: {
        analysis: string;
        userPrompt: string;
        aspectRatio: string;
        seed: number;
        useBrandColors?: boolean;
        brandColors?: any;
        style?: string;
    }): Promise<any> {
        console.log(`[VideoPromptAgent] 🎬 Gerando prompt estruturado para Veo 3.1...`);
        
        const apiKeyObj = await getOpenAIKey();
        if (!apiKeyObj) {
            throw new Error('[VideoPromptAgent] No working OpenAI API key available.');
        }

        const openai = new OpenAI({ apiKey: apiKeyObj.key_secret });

        try {
            let userMessage = `PRODUCT ANALYSIS REPORT:\n${params.analysis}\n\nUSER BRIEF: "${params.userPrompt}"\nASPECT RATIO: ${params.aspectRatio}\nSEED: ${params.seed}`;

            if (params.useBrandColors && params.brandColors) {
                userMessage += `\nBRAND COLORS: ${JSON.stringify(params.brandColors)} — Incorporate into talent attire and setting where appropriate.`;
            }

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: VEO3_SYSTEM_BASE },
                    { role: "user", content: userMessage }
                ],
                response_format: { type: "json_object" },
                temperature: 0.8,
                max_tokens: 2000
            });

            if (response.usage) {
                await keyManager.logUsage(
                    apiKeyObj.id, 'openai', 'VideoPromptAgent',
                    response.usage.prompt_tokens, response.usage.completion_tokens,
                    (response.usage.prompt_tokens * 0.0000025) + (response.usage.completion_tokens * 0.00001)
                );
            }

            return JSON.parse(response.choices[0]?.message?.content || '{}');
        } catch (error: any) {
            console.error('[VideoPromptAgent] Error:', error.message);
            if (error.status === 401 || error.status === 429 || error.message.includes('API key')) {
                await keyManager.reportFailure(apiKeyObj.id, error.message);
            }
            throw error;
        }
    }
}
