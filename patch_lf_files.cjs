/**
 * patch_lf_files.cjs
 * Aplica patches nos ficheiros com LF (KieAiNode.ts e ImagePipeline.ts)
 */
const fs = require('fs');
const path = require('path');

let errorCount = 0;

function applyPatch(filePath, patches) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    for (const { name, find, replace } of patches) {
        if (!content.includes(find)) {
            console.error(`  ❌ [${name}] NOT FOUND in ${path.basename(filePath)}`);
            // Show context for debugging
            const lines = find.split('\n');
            const firstLine = lines[0].trim();
            const idx = content.indexOf(firstLine);
            if (idx >= 0) {
                console.log(`    ℹ️  First line found at char ${idx}: "${firstLine}"`);
                console.log(`    Context: "${content.substring(idx, idx + 200)}"`);
            }
            errorCount++;
            continue;
        }
        content = content.split(find).join(replace);
        console.log(`  ✅ [${name}] Applied`);
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  💾 Saved: ${path.basename(filePath)}\n`);
    } else {
        console.log(`  ⚠️  No changes: ${path.basename(filePath)}\n`);
    }
}

// ─── KieAiNode.ts (LF endings) ───────────────────────────────────────────────
console.log('📝 Patching KieAiNode.ts (LF)...');

// Helper: read file to see exact content around the target
const kieFile = path.join(__dirname, 'src', 'pipeline', 'nodes', 'KieAiNode.ts');
const kieContent = fs.readFileSync(kieFile, 'utf8');

// Find the exact block
const marker = "} else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2')";
const markerIdx = kieContent.indexOf(marker);
if (markerIdx >= 0) {
    console.log(`  Found marker at char ${markerIdx}`);
    const block = kieContent.substring(markerIdx, markerIdx + 250);
    console.log(`  Block: ${JSON.stringify(block)}`);
}

applyPatch(kieFile, [
    {
        name: 'Fix nano-banana-pro image_input → image_urls (LF)',
        find: "} else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\n            input = {\n                prompt: params.prompt,\n                image_input: params.imageUrls || [],\n                aspect_ratio: params.aspectRatio || '1:1',\n                resolution: (params.resolution || '1k').toUpperCase(),\n                output_format: 'jpg'\n            };",
        replace: "} else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\n            input = {\n                prompt: params.prompt,\n                image_urls: params.imageUrls || [],\n                aspect_ratio: params.aspectRatio || '1:1',\n                resolution: (params.resolution || '1k').toUpperCase(),\n                output_format: 'jpg'\n            };"
    }
]);

// ─── ImagePipeline.ts (LF endings) ───────────────────────────────────────────
console.log('📝 Patching ImagePipeline.ts (LF)...');

const pipeFile = path.join(__dirname, 'src', 'pipeline', 'ImagePipeline.ts');
const pipeContent = fs.readFileSync(pipeFile, 'utf8');

// Debug: show the area around generationId line
const genMarker = 'generationId: string;';
const genIdx = pipeContent.indexOf(genMarker);
if (genIdx >= 0) {
    console.log(`  generationId block: ${JSON.stringify(pipeContent.substring(genIdx, genIdx + 100))}`);
}

const keyMarker = '// Get working API Key for KIE.ai';
const keyIdx = pipeContent.indexOf(keyMarker);
if (keyIdx >= 0) {
    console.log(`  Key block: ${JSON.stringify(pipeContent.substring(keyIdx, keyIdx + 250))}`);
}

applyPatch(pipeFile, [
    {
        name: 'Add apiKey to PipelineOptions interface (LF)',
        find: "    generationId: string; // The ID of the record already created in DB\n}",
        replace: "    generationId: string; // The ID of the record already created in DB\n    apiKey?: string; // Optional: pre-fetched KIE.ai key injected by backend\n}"
    },
    {
        name: 'Use injected apiKey with DB/ENV fallback (LF)',
        find: "            // Get working API Key for KIE.ai\n            const { keyManager } = await import('../services/KeyManager.js');\n            const kieAiKey = await keyManager.getWorkingKey('kie');\n            const kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\n            const keyId = kieAiKey?.id || null;",
        replace: "            // Get working API Key for KIE.ai (prefer injected key, fallback to DB/ENV)\n            const { keyManager } = await import('../services/KeyManager.js');\n            let kieKey = options.apiKey || null;\n            let keyId: number | null = null;\n            if (!kieKey) {\n                const kieAiKey = await keyManager.getWorkingKey('kie');\n                kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\n                keyId = kieAiKey?.id || null;\n            }\n            console.log(`[ImagePipeline] 🔑 Using KIE key: ${kieKey ? kieKey.substring(0, 10) + '...' : 'MISSING!'}`);"
    }
]);

// ─── Same patches for backend copies ─────────────────────────────────────────
const backendKie = path.join(__dirname, '..', 'backend', 'src', 'pipeline', 'nodes', 'KieAiNode.ts');
const backendPipe = path.join(__dirname, '..', 'backend', 'src', 'pipeline', 'ImagePipeline.ts');

console.log('📝 Patching backend/src/pipeline/nodes/KieAiNode.ts...');
applyPatch(backendKie, [
    {
        name: 'Fix nano-banana-pro image_input → image_urls (backend LF)',
        find: "} else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\n            input = {\n                prompt: params.prompt,\n                image_input: params.imageUrls || [],\n                aspect_ratio: params.aspectRatio || '1:1',\n                resolution: (params.resolution || '1k').toUpperCase(),\n                output_format: 'jpg'\n            };",
        replace: "} else if (modelName === 'nano-banana-pro' || modelName === 'nano-banana-2') {\n            input = {\n                prompt: params.prompt,\n                image_urls: params.imageUrls || [],\n                aspect_ratio: params.aspectRatio || '1:1',\n                resolution: (params.resolution || '1k').toUpperCase(),\n                output_format: 'jpg'\n            };"
    }
]);

console.log('📝 Patching backend/src/pipeline/ImagePipeline.ts...');
applyPatch(backendPipe, [
    {
        name: 'Add apiKey to PipelineOptions (backend LF)',
        find: "    generationId: string; // The ID of the record already created in DB\n}",
        replace: "    generationId: string; // The ID of the record already created in DB\n    apiKey?: string; // Optional: pre-fetched KIE.ai key injected by backend\n}"
    },
    {
        name: 'Use injected apiKey with DB/ENV fallback (backend LF)',
        find: "            // Get working API Key for KIE.ai\n            const { keyManager } = await import('../services/KeyManager.js');\n            const kieAiKey = await keyManager.getWorkingKey('kie');\n            const kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\n            const keyId = kieAiKey?.id || null;",
        replace: "            // Get working API Key for KIE.ai (prefer injected key, fallback to DB/ENV)\n            const { keyManager } = await import('../services/KeyManager.js');\n            let kieKey = options.apiKey || null;\n            let keyId: number | null = null;\n            if (!kieKey) {\n                const kieAiKey = await keyManager.getWorkingKey('kie');\n                kieKey = kieAiKey?.key_secret || await getConfig('KIE_AI_API_KEY');\n                keyId = kieAiKey?.id || null;\n            }\n            console.log(`[ImagePipeline] 🔑 Using KIE key: ${kieKey ? kieKey.substring(0, 10) + '...' : 'MISSING!'}`);"
    }
]);

// ─── Summary ──────────────────────────────────────────────────────────────────
if (errorCount === 0) {
    console.log('🎉 All patches applied successfully!');
} else {
    console.error(`\n⚠️  ${errorCount} patch(es) failed.`);
    process.exit(1);
}
