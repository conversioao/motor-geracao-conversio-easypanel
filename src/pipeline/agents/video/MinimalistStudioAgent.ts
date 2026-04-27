import { VideoPromptAgent } from './VideoPromptAgent.js';
export class MinimalistStudioAgent {
    static async generate(params: any): Promise<any> {
        console.log(`[MinimalistStudioAgent] 🎞️ Gerando prompt minimalista via VideoPromptAgent master...`);
        return VideoPromptAgent.generate({ ...params, style: 'minimalist-studio' });
    }
}
