const axios = require('axios');

async function test() {
    const apiKey = '26cda1f14cae98401c5915e892999068';
    const taskId = '77f0b859ad5144fd329f5ea98a5d4592'; // From V4 test
    const url = `https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`;

    console.log(`\nTesting: ${url}`);
    try {
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 5000
        });
        console.log(`  ✅ SUCCESS:`, JSON.stringify(res.data));
    } catch (err) {
        console.log(`  ❌ FAILED: ${err.response?.status} - ${err.response?.data?.msg || err.message}`);
    }
}

test();
