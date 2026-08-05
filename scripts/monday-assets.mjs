#!/usr/bin/env node
// Cardoso Hub — Baixa os arquivos/imagens do Monday e re-hospeda no Supabase Storage
// ---------------------------------------------------------------------------
// Varre os 4 quadros escolhidos no dump, junta os IDs de asset, pede ao Monday a
// URL pública temporária de cada um, baixa e sobe pro bucket "monday-assets"
// (público) no Supabase. Gera monday-dump/asset-map.json (assetId → URL do hub),
// que o monday-import.mjs usa pra deixar os links/imagens funcionando pra sempre.
//
// COMO RODAR (na pasta do projeto):
//   export MONDAY_TOKEN="seu_token_do_monday"
//   export SUPABASE_URL="https://xxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//   node scripts/monday-assets.mjs
// ---------------------------------------------------------------------------

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DUMP_DIR = join(process.cwd(), 'monday-dump');
const BUCKET = 'monday-assets';
const TARGET_BOARDS = ['18408568242', '18404210044', '9901058220', '18403298414'];

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!MONDAY_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Falta MONDAY_TOKEN, SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function gql(query) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: MONDAY_TOKEN, 'API-Version': '2024-01' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function safeName(assetId, name) {
  const clean = String(name || `${assetId}`).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-60);
  return `${assetId}-${clean}`;
}

async function main() {
  // 1) coleta os asset ids dos 4 quadros
  const files = (await readdir(DUMP_DIR)).filter((f) => f.startsWith('board-') && f.endsWith('.json'));
  const assetIds = new Set();
  for (const f of files) {
    const id = f.match(/board-(\d+)-/)?.[1];
    if (!TARGET_BOARDS.includes(id)) continue;
    const raw = await readFile(join(DUMP_DIR, f), 'utf8');
    (raw.match(/\/resources\/(\d+)\//g) || []).forEach((m) => assetIds.add(m.match(/\d+/)[0]));
    (raw.match(/data-asset_id=\\?"(\d+)/g) || []).forEach((m) => assetIds.add(m.match(/\d+/)[0]));
  }
  const ids = [...assetIds];
  console.log(`\n🔎 ${ids.length} arquivos a re-hospedar.\n`);
  if (ids.length === 0) { console.log('Nada a fazer.'); return; }

  // 2) bucket público
  const { error: bErr } = await db.storage.createBucket(BUCKET, { public: true });
  if (bErr && !/already exists/i.test(bErr.message)) console.warn('bucket:', bErr.message);

  // 3) pega as URLs públicas temporárias no Monday
  const data = await gql(`query { assets (ids: [${ids.join(',')}]) { id name public_url } }`);
  const assets = data?.assets ?? [];

  // 4) baixa e sobe
  const map = {};
  for (const a of assets) {
    try {
      const r = await fetch(a.public_url);
      if (!r.ok) { console.warn(`   ⚠️ ${a.id} download ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const path = safeName(a.id, a.name);
      const contentType = r.headers.get('content-type') || 'application/octet-stream';
      const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType, upsert: true });
      if (error) { console.warn(`   ⚠️ ${a.id} upload: ${error.message}`); continue; }
      const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
      map[String(a.id)] = pub.publicUrl;
      console.log(`   ✅ ${a.name || a.id}  (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.warn(`   ⚠️ ${a.id}: ${e.message}`);
    }
  }

  await writeFile(join(DUMP_DIR, 'asset-map.json'), JSON.stringify(map, null, 2));
  console.log(`\n✅ ${Object.keys(map).length}/${ids.length} re-hospedados. Mapa salvo em monday-dump/asset-map.json`);
  console.log('   Agora rode: node scripts/monday-import.mjs --commit\n');
}

main().catch((e) => { console.error('\n❌ Erro:', e.message, '\n'); process.exit(1); });
