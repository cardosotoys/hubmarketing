#!/usr/bin/env node
// Cardoso Hub — Importador do dump do Monday → módulo "Monday" (arquivo)
// ---------------------------------------------------------------------------
// Lê ./monday-dump/*.json e popula monday_boards / monday_items / monday_updates /
// monday_activity no Supabase, preservando datas, autores e URLs (links/imagens/
// arquivos re-hospedados pelo monday-assets.mjs). NÃO mexe no resto do hub.
//
// Por padrão importa SÓ os 4 quadros escolhidos e APAGA os demais do arquivo.
// SEGURO: dry-run por padrão. Só grava com --commit. Reimport é idempotente.
//
//   export SUPABASE_URL="https://xxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//   node scripts/monday-import.mjs            # dry-run
//   node scripts/monday-import.mjs --commit   # grava
// ---------------------------------------------------------------------------

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DUMP_DIR = join(process.cwd(), 'monday-dump');
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
// Só estes quadros ficam no arquivo (o resto é excluído). Sobrescreva com --only=IDs.
const TARGET_BOARDS = ['18408568242', '18404210044', '9901058220', '18403298414'];
const KEEP = ONLY.length ? ONLY : TARGET_BOARDS;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Falta SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API).\n');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let ASSET_MAP = {}; // assetId → URL re-hospedada no hub

function tsToIso(ticks) {
  const seconds = Number(ticks) / 1e7;
  if (!isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}
function mapAsset(url) {
  // troca URL protegida do Monday (/resources/<assetId>/) pela URL re-hospedada, se houver
  const m = String(url || '').match(/\/resources\/(\d+)\//);
  if (m && ASSET_MAP[m[1]]) return ASSET_MAP[m[1]];
  return url;
}
function htmlToText(html) {
  if (!html) return '';
  return String(html)
    // <img> vira a URL re-hospedada (ou a original) em linha própria
    .replace(/<img[^>]*data-asset_id="(\d+)"[^>]*>/gi, (_, id) => `\n${ASSET_MAP[id] || '[imagem]'}\n`)
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, (_, src) => `\n${mapAsset(src)}\n`)
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
async function insertMany(table, rows, returning) {
  if (!rows.length) return [];
  if (!COMMIT) return rows.map((_, i) => ({ id: `dry-${i}` }));
  const out = [];
  for (const c of chunk(rows, 400)) {
    const q = db.from(table).insert(c);
    const { data, error } = returning ? await q.select('id') : await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (returning) out.push(...(data ?? []));
  }
  return out;
}

function suggestDestination(name) {
  if (/embalagem|china|molto|confer[êe]ncia/i.test(name)) return 'Design de Produto → Embalagens';
  if (/redes sociais|m[ií]dia social|calend[aá]rio de conte[uú]do/i.test(name)) return 'Redes Sociais / Campanhas';
  if (/an[uú]ncios/i.test(name)) return 'Campanhas (Anúncios)';
  if (/lead|contato|conta|negocia|cliente|crm|atividade/i.test(name)) return 'CRM';
  if (/demanda/i.test(name)) return 'Demandas / Projetos';
  if (/marca|implementa|final de ano/i.test(name)) return 'Projetos';
  return 'A definir';
}

// col: {id,text,value,type} → adiciona url (link/arquivo re-hospedado) quando houver
function colToEntry(c, colTitleById) {
  const entry = { id: c.id, title: colTitleById.get(c.id) || c.id, type: c.type, text: c.text ?? '' };
  if (c.type === 'link') {
    try { const v = JSON.parse(c.value); if (v?.url) entry.url = v.url; } catch {}
  }
  if (c.type === 'file') {
    // o text costuma ser a URL do Monday; re-mapeia pra URL do hub
    if (c.text && /https?:\/\//.test(c.text)) entry.url = mapAsset(c.text.split(/\s+/)[0]);
    try { const v = JSON.parse(c.value); const a = (v.files || [])[0]; if (a?.assetId && ASSET_MAP[a.assetId]) entry.url = ASSET_MAP[a.assetId]; } catch {}
  }
  return entry;
}

async function importBoard(file, monUsersById) {
  const raw = JSON.parse(await readFile(join(DUMP_DIR, file), 'utf8'));
  const board = raw.board;
  const items = raw.items || [];
  const activity = raw.activity_logs || [];
  const colTitleById = new Map((board.columns || []).map((c) => [c.id, c.title]));

  const upCount = items.reduce((n, it) => n + (it.updates?.length ?? 0), 0);
  console.log(`\n📦 ${board.name}  (${items.length} itens, ${upCount} comentários, ${activity.length} eventos)`);

  let boardId = 'dry-board';
  if (COMMIT) {
    await db.from('monday_boards').delete().eq('monday_id', String(board.id));
    const { data, error } = await db
      .from('monday_boards')
      .insert({
        monday_id: String(board.id),
        name: board.name,
        state: board.state || 'active',
        groups: (board.groups || []).map((g) => ({ id: g.id, title: g.title, position: g.position })),
        columns: (board.columns || []).map((c) => ({ id: c.id, title: c.title, type: c.type })),
        item_count: items.length,
        update_count: upCount,
        activity_count: activity.length,
        suggested_destination: suggestDestination(board.name),
      })
      .select('id')
      .single();
    if (error) throw new Error(`monday_boards: ${error.message}`);
    boardId = data.id;
  }

  const itemRows = items.map((it, i) => ({
    board_id: boardId,
    monday_id: String(it.id),
    name: it.name || '(sem título)',
    group_id: it.group?.id || '',
    group_title: it.group?.title || '',
    creator_name: it.creator?.name || '',
    monday_created_at: it.created_at || null,
    column_values: (it.column_values || []).filter((c) => c.text || c.value).map((c) => colToEntry(c, colTitleById)),
    subitems: (it.subitems || []).map((s) => ({
      name: s.name,
      status: (s.column_values || []).find((x) => x.type === 'status')?.text || '',
    })),
    position: i,
  }));
  const insertedItems = await insertMany('monday_items', itemRows, true);
  const itemIdByMonday = new Map();
  items.forEach((it, i) => itemIdByMonday.set(String(it.id), insertedItems[i]?.id));

  const updateRows = [];
  for (const it of items) {
    const iid = itemIdByMonday.get(String(it.id));
    for (const up of it.updates || []) {
      updateRows.push({
        item_id: iid,
        author_name: up.creator?.name || '',
        body: ((up.text_body && up.text_body.trim()) || htmlToText(up.body) || '[anexo]').slice(0, 8000),
        monday_created_at: up.created_at || null,
      });
    }
  }
  await insertMany('monday_updates', updateRows);

  const KEEP_EV = /create_pulse|update_column_value|create_update|move_pulse|delete_pulse|create_subitem|update_name/i;
  const actRows = [];
  for (const ev of activity) {
    if (!KEEP_EV.test(ev.event)) continue;
    let data = {};
    try { data = ev.data ? JSON.parse(ev.data) : {}; } catch {}
    const pulseId = data.pulse_id ?? data.item_id ?? null;
    const mu = monUsersById.get(String(ev.user_id));
    const col = data.column_title ? `"${data.column_title}"` : '';
    const action =
      ev.event === 'create_pulse' ? 'Item criado' :
      ev.event === 'update_column_value' ? `Alterou ${col}` :
      ev.event === 'create_update' ? 'Comentário' :
      /move_pulse/.test(ev.event) ? 'Movido de grupo' :
      ev.event === 'delete_pulse' ? 'Item excluído' :
      ev.event === 'create_subitem' ? 'Subitem criado' :
      ev.event === 'update_name' ? 'Renomeado' : ev.event;
    actRows.push({
      board_id: boardId,
      item_id: pulseId ? itemIdByMonday.get(String(pulseId)) ?? null : null,
      event: ev.event,
      action_text: action,
      actor_name: mu?.name || '',
      monday_created_at: tsToIso(ev.created_at),
    });
  }
  await insertMany('monday_activity', actRows);

  console.log(`   → ${itemRows.length} itens · ${updateRows.length} comentários · ${actRows.length} eventos` + (COMMIT ? '  ✅ gravado' : '  (dry-run)'));
  return { name: board.name, items: itemRows.length, updates: updateRows.length, activity: actRows.length };
}

async function main() {
  console.log(`\n${COMMIT ? '💾 IMPORTANDO para o módulo Monday (grava)' : '🧪 DRY-RUN (não grava — use --commit)'}\n`);
  try {
    ASSET_MAP = JSON.parse(await readFile(join(DUMP_DIR, 'asset-map.json'), 'utf8'));
    console.log(`🖼  ${Object.keys(ASSET_MAP).length} arquivos re-hospedados carregados do asset-map.json`);
  } catch {
    console.log('⚠️  Sem asset-map.json — rode antes: node scripts/monday-assets.mjs (links de arquivo/imagem ficam sem re-hospedar).');
  }

  const monUsers = JSON.parse(await readFile(join(DUMP_DIR, 'users.json'), 'utf8'));
  const monUsersById = new Map(monUsers.map((u) => [String(u.id), u]));
  const summary = JSON.parse(await readFile(join(DUMP_DIR, 'summary.json'), 'utf8'));
  const metaById = new Map(summary.map((s) => [String(s.id), s]));

  const files = (await readdir(DUMP_DIR)).filter((f) => f.startsWith('board-') && f.endsWith('.json'));
  const toImport = files.filter((f) => {
    const id = f.match(/board-(\d+)-/)?.[1];
    return KEEP.includes(id) && metaById.get(String(id));
  });

  // limpeza: apaga do arquivo qualquer quadro que não esteja na lista mantida
  if (COMMIT) {
    const { data: existing } = await db.from('monday_boards').select('id, monday_id');
    const toDelete = (existing ?? []).filter((b) => !KEEP.includes(String(b.monday_id)));
    if (toDelete.length) {
      await db.from('monday_boards').delete().in('id', toDelete.map((b) => b.id));
      console.log(`🧹 Removidos ${toDelete.length} quadros que não estão na lista mantida.`);
    }
  }

  console.log(`Quadros a importar: ${toImport.length}\n`);
  const results = [];
  for (const f of toImport) {
    try { results.push(await importBoard(f, monUsersById)); }
    catch (e) { console.error(`   ❌ falhou: ${e.message}`); }
  }
  const t = results.reduce((a, r) => ({ i: a.i + r.items, u: a.u + r.updates, h: a.h + r.activity }), { i: 0, u: 0, h: 0 });
  console.log(`\n===== TOTAL =====\n${results.length} quadros · ${t.i} itens · ${t.u} comentários · ${t.h} eventos`);
  console.log(COMMIT ? '\n✅ Pronto. Abra o módulo "Monday" no hub.\n' : '\n🧪 Foi simulação. Rode com --commit para gravar.\n');
}

main().catch((e) => { console.error('\n❌ Erro:', e.message, '\n'); process.exit(1); });
