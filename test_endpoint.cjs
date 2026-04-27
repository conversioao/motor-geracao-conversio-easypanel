const axios = require('axios');

async function test() {
    const apiKey = '26cda1f14cae98401c5915e892999068';
    const variants = ['V4', 'V5', 'suno/v4', 'suno-v4', 'suno-v3.5', 'V3_5'];
    const url = 'https://api.kie.ai/api/v1/generate';

    for (const v of variants) {
        console.log(`\nTesting ${v} with ${url}`);
        try {
            const payload = {
                model: v,
                prompt: 'Happy upbeat jingle',
                style: 'pop',
                customMode: false,
                instrumental: true,
                callBackUrl: 'https://webhook.site/dummy'
            };
            
            const res = await axios.post(url, payload, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 10000
            });
            console.log(`  ✅ SUCCESS:`, JSON.stringify(res.data));
        } catch (err) {
            console.log(`  ❌ FAILED: ${err.response?.status} - ${err.response?.data?.msg || err.message}`);
        }
    }
}

test();
