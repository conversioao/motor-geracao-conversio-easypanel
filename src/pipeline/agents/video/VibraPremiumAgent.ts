import { VideoPromptAgent } from './VideoPromptAgent.js';
export class VibraPremiumAgent {
    static async generate(params: any): Promise<any> {
        console.log(`[VibraPremiumAgent] 💎 Gerando prompt premium via VideoPromptAgent master...`);
        return VideoPromptAgent.generate({ ...params, style: 'vibra-premium' });
    }
}
