import { VideoPromptAgent } from './VideoPromptAgent.js';
export class UrbanStyleAgent {
    static async generate(params: any): Promise<any> {
        console.log(`[UrbanStyleAgent] 🏙️ Gerando prompt urban via VideoPromptAgent master...`);
        return VideoPromptAgent.generate({ ...params, style: 'urban-style' });
    }
}
