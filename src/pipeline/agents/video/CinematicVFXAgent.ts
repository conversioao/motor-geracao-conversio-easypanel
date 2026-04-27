import { VideoPromptAgent } from './VideoPromptAgent.js';
export class CinematicVFXAgent {
    static async generate(params: any): Promise<any> {
        console.log(`[CinematicVFXAgent] 🎥 Gerando prompt cinemático via VideoPromptAgent master...`);
        return VideoPromptAgent.generate({ ...params, style: 'cinematic-vfx' });
    }
}
