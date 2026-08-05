#!/usr/bin/env node
// Cardoso Hub — Importador do dump do Monday → módulo "Monday" (arquivo)
// ---------------------------------------------------------------------------
// Lê ./monday-dump/*.json e popula as tabelas monday_boards / monday_items /
// monday_updates / monday_activity no Supabase, preservando datas e autores.
// NÃO mexe em nada do resto do hub — é só o arquivo, pra você depois decidir
// onde encaixar cada coisa.
//
// SEGURO: por padrão é DRY-RUN (só conta). Só grava com --commit.
//
// COMO RODAR (dentro da pasta do projeto):
//   1) Supabase → Settings → API: Project URL e a service_role key
//   2) Teste:
//      SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="ey..." \
//        node scripts/monday-import.mjs
//   3) Gravar:
//      SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/monday-import.mjs --commit
//
//   Reimportar é seguro: cada quadro é apagado e recriado (não duplica).
// ---------------------------------------------------------------------------

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DUMP_DIR = join(process.cwd(), 'monday-dump');
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Falta SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API).\n');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function tsToIso(ticks) {
  const seconds = Number(ticks) / 1e7;
  if (!isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}
function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<img[^>]*>/gi, '[imagem]')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
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

async function importBoard(file, monUsersById) {
  const raw = JSON.parse(await readFile(join(DUMP_DIR, file), 'utf8'));
  const board = raw.board;
  const items = raw.items || [];
  const activity = raw.activity_logs || [];
  const colTitleById = new Map((board.columns || []).map((c) => [c.id, c.title]));

  const upCount = items.reduce((n, it) => n + (it.updates?.length ?? 0), 0);
  console.log(`\n📦 ${board.name}  (${items.length} itens, ${upCount} comentários, ${activity.length} eventos)`);

  // 1) apaga versão anterior deste quadro (reimport seguro) e cria o board
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

  // 2) itens (com colunas legíveis enriquecidas com título)
  const itemRows = items.map((it, i) => ({
    board_id: boardId,
    monday_id: String(it.id),
    name: it.name || '(sem título)',
    group_id: it.group?.id || '',
    group_title: it.group?.title || '',
    creator_name: it.creator?.name || '',
    monday_created_at: it.created_at || null,
    column_values: (it.column_values || [])
      .filter((c) => c.text || c.value)
      .map((c) => ({ id: c.id, title: colTitleById.get(c.id) || c.id, type: c.type, text: c.text ?? '' })),
    subitems: (it.subitems || []).map((s) => ({
      name: s.name,
      status: (s.column_values || []).find((x) => x.type === 'status')?.text || '',
    })),
    position: i,
  }));
  const insertedItems = await insertMany('monday_items', itemRows, true);
  const itemIdByMonday = new Map();
  items.forEach((it, i) => itemIdByMonday.set(String(it.id), insertedItems[i]?.id));

  // 3) comentários (updates)
  const updateRows = [];
  for (const it of items) {
    const iid = itemIdByMonday.get(String(it.id));
    for (const up of it.updates || []) {
      updateRows.push({
        item_id: iid,
        author_name: up.creator?.name || '',
        body: ((up.text_body && up.text_body.trim()) || htmlToText(up.body) || '[anexo/imagem]').slice(0, 8000),
        monday_created_at: up.created_at || null,
      });
    }
  }
  await insertMany('monday_updates', updateRows);

  // 4) histórico (activity_logs) — eventos relevantes, com data e autor originais
  const KEEP = /create_pulse|update_column_value|create_update|move_pulse|delete_pulse|create_subitem|update_name/i;
  const actRows = [];
  for (const ev of activity) {
    if (!KEEP.test(ev.event)) continue;
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
  const monUsers = JSON.parse(await readFile(join(DUMP_DIR, 'users.json'), 'utf8'));
  const monUsersById = new Map(monUsers.map((u) => [String(u.id), u]));
  const summary = JSON.parse(await readFile(join(DUMP_DIR, 'summary.json'), 'utf8'));
  const metaById = new Map(summary.map((s) => [String(s.id), s]));

  const files = (await readdir(DUMP_DIR)).filter((f) => f.startsWith('board-') && f.endsWith('.json'));
  const toImport = files.filter((f) => {
    const id = f.match(/board-(\d+)-/)?.[1];
    const meta = metaById.get(String(id));
    if (ONLY.length && !ONLY.includes(id)) return false;
    if (!meta || meta.state !== 'active') return false;
    if (/^Subelementos de /i.test(meta.name)) return false; // subitens vêm inline no quadro-pai
    if ((meta.items ?? 0) === 0) return false;
    return true;
  });

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
