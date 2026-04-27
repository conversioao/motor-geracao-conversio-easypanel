import { VideoPromptAgent } from './VideoPromptAgent.js';

// UGCVideoAgent — Routes through master VideoPromptAgent
export class UGCVideoAgent {
    static async generate(params: {
        analysis: string;
        userPrompt: string;
        aspectRatio: string;
        seed: number;
        useBrandColors?: boolean;
        brandColors?: any;
    }): Promise<any> {
        console.log(`[UGCVideoAgent] 🎬 Gerando prompt UGC via VideoPromptAgent master...`);
        return VideoPromptAgent.generate({ ...params, style: 'ugc' });
    }
}
