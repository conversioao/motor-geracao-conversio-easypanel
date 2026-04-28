/**
 * test_kie_live.cjs
 * Testa as chaves KIE.ai e os nomes corretos de modelos em tempo real.
 * Executa: node test_kie_live.cjs
 */
const axios = require('axios');
require('dotenv').config();

const BASE = 'https://api.kie.ai/api/v1';

// ─── CHAVES A TESTAR ───────────────────────────────────────────────────────────
const KEYS = [
  { label: 'KEY_ENV (.env)',  key: process.env.KIE_AI_API_KEY || '26cda1f14cae98401c5915e892999068' },
  { label: 'KEY_OLD',        key: '178b44adfc95ff2a46a6fd4b60092c7a' },
];

// ─── MODELOS A TESTAR ──────────────────────────────────────────────────────────
// O modelo que o backend passa: google/nano-banana-lite → mapeia para google/nano-banana (sem imagens) ou google/nano-banana-edit (com imagens)
// Mas o coreId 'glow-angola' → mapeia para 'nano-banana-pro' (ver ImagePipeline.mapCoreToModel)
// Vamos testar os nomes exatos para descobrir quais funcionam.
const MODELS_TO_TEST = [
  // Nomes usados pelo código actualmente
  { model: 'google/nano-banana',       hasImage: false, label: 'nano-banana (text-to-image)' },
  { model: 'google/nano-banana-edit',  hasImage: true,  label: 'nano-banana-edit (image-to-image)' },
  { model: 'nano-banana-pro',          hasImage: false, label: 'nano-banana-pro (alias)' },
  { model: 'nano-banana-2',            hasImage: false, label: 'nano-banana-2 (alias)' },
  // Possíveis nomes reais na API KIE
  { model: 'google/nano-banana-2',     hasImage: false, label: 'google/nano-banana-2' },
  { model: 'google/nano-banana-pro',   hasImage: false, label: 'google/nano-banana-pro' },
  { model: 'gpt-image-1',             hasImage: false, label: 'gpt-image-1' },
  { model: 'gpt-image-2',             hasImage: false, label: 'gpt-image-2' },
];

// Imagem de teste pública (pequena)
const TEST_IMAGE_URL = 'https://usc1.contabostorage.com/kwikdocsao/temp/1777389967065-unitel-tab-8.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=7c8a457489cbdb0b034d25a256526b7b%2F20260428%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260428T152608Z&X-Amz-Expires=600&X-Amz-Signature=5d8dc78c91b5326136316c5586e81824c2f5d36f99b57d663029f3e70de20ac7&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject';

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function buildPayload(model, hasImage) {
  const input = {
    prompt: 'Anuncio publicitário moderno de tablet Android para o mercado angolano',
    aspect_ratio: '1:1',
    output_format: 'png',
  };
  if (hasImage) {
    input.image_urls = [TEST_IMAGE_URL];
  }
  return { model, input };
}

async function testKey(label, key) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔑 TESTANDO CHAVE: ${label}`);
  console.log(`   ${key ? key.substring(0, 10) + '...' + key.slice(-5) : 'MISSING'}`);
  console.log('═'.repeat(60));

  if (!key) {
    console.log('   ❌ Chave não encontrada!');
    return;
  }

  for (const { model, hasImage, label: mLabel } of MODELS_TO_TEST) {
    const payload = buildPayload(model, hasImage);
    process.stdout.write(`   [${mLabel.padEnd(35)}] → `);
    try {
      const r = await axios.post(`${BASE}/jobs/createTask`, payload, {
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        timeout: 15000
      });
      const code = r.data?.code;
      const msg  = r.data?.msg;
      const taskId = r.data?.data?.taskId;
      if (taskId) {
        console.log(`✅ SUCESSO  taskId=${taskId}  (code=${code})`);
      } else {
        console.log(`⚠️  Sem taskId  code=${code}  msg="${msg}"`);
      }
    } catch (e) {
      const status = e.response?.status;
      const code   = e.response?.data?.code;
      const msg    = e.response?.data?.msg || e.response?.data?.message || e.message;
      if (status === 422) {
        console.log(`❌ 422 MODELO INVÁLIDO: "${msg}"`);
      } else if (status === 401 || status === 403) {
        console.log(`🔒 ${status} AUTH FALHOU: "${msg}"`);
      } else if (status === 500) {
        console.log(`⚠️  500 SERVER ERR: "${msg}"`);
      } else {
        console.log(`❌ HTTP ${status || 'ERR'}: "${msg}"`);
      }
    }
    // Pequeno delay para não rate-limitar
    await new Promise(r => setTimeout(r, 500));
  }
}

async function checkAccountBalance(label, key) {
  if (!key) return;
  try {
    // Tenta endpoint de saldo/perfil
    const r = await axios.get(`${BASE}/account/balance`, {
      headers: { 'Authorization': `Bearer ${key}` },
      timeout: 8000
    });
    console.log(`   💰 Saldo: ${JSON.stringify(r.data?.data || r.data)}`);
  } catch(e) {
    try {
      const r2 = await axios.get(`${BASE}/account/info`, {
        headers: { 'Authorization': `Bearer ${key}` },
        timeout: 8000
      });
      console.log(`   💰 Info: ${JSON.stringify(r2.data?.data || r2.data)}`);
    } catch(e2) {
      console.log(`   ℹ️  Sem endpoint de saldo disponível (${e.response?.status || e.message})`);
    }
  }
}

async function main() {
  console.log('\n🚀 CONVERSIO AI - KIE.ai API Diagnostic Tool');
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log(`🌐 Base URL: ${BASE}`);

  for (const { label, key } of KEYS) {
    await checkAccountBalance(label, key);
    await testKey(label, key);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Diagnóstico concluído.');
  console.log('═'.repeat(60));
  console.log('\n📋 RESUMO DOS PROBLEMAS DETECTADOS NO CÓDIGO:');
  console.log('   1. coreId "glow-angola" → mapeia para "nano-banana-pro" (sem prefixo google/)');
  console.log('      mas a API KIE pode precisar de "google/nano-banana-2" ou outro nome.');
  console.log('   2. O modelo "google/nano-banana-lite" da DB está a ser enviado para a ENGINE');
  console.log('      mas o código mapeia em KieAiNode para "google/nano-banana" (correcto).');
  console.log('   3. Se a chave do .env expirou ou atingiu limite, o KeyManager deve');
  console.log('      fazer fallback para a chave na DB. Verifica se há chaves activas na tabela api_keys.');
}

main().catch(console.error);
