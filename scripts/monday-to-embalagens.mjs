#!/usr/bin/env node
// Cardoso Hub — Despeja a "Conferência de Embalagens" (Monday) no módulo Embalagens (Teste)
// ---------------------------------------------------------------------------
// Lê o dump da Conferência e cria, na trilha "melhoria_teste":
//  - etapas a partir dos grupos do Monday
//  - demandas (itens) com datas (início/meta/prazo), prioridade, responsável e SKU
//  - checklist a partir dos subitens
//  - comentários (updates + respostas, com links) atribuídos aos usuários reais
//  - histórico (activity_logs) atribuído aos usuários reais, com datas originais
//
// Atribuição de usuários (Monday → hub, por e-mail):
//   Bruna Fernandez    → marketing.embalagens@cardosotoys.com.br
//   Stefany Shumiski   → marketing.operacoes@cardosotoys.com.br
//   Matheus Cardoso    → matheus.cardoso@cardosotoys.com.br
//   Aldair Brás        → marketing.digital@cardosotoys.com.br   (também é o fallback)
//
// SEGURO: dry-run por padrão. Só grava com --commit. Reimport é idempotente
// (apaga o que já existir na trilha melhoria_teste antes de recriar).
//
//   export SUPABASE_URL="https://xxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//   node scripts/monday-to-embalagens.mjs            # dry-run
//   node scripts/monday-to-embalagens.mjs --commit   # grava
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DUMP = join(process.cwd(), 'monday-dump', 'board-18404210044-confer-ncia-de-embalagens.json');
const TRACK = 'melhoria_teste';
const COMMIT = process.argv.includes('--commit');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('\n❌ Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n'); process.exit(1); }
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// colunas do quadro Conferência
const COL = {
  start: 'date_mm1h47zg',   // Data de Inserção do Arquivo → início
  meta: 'date_mm35pywe',    // Meta de finalização → meta
  due: 'date_mm1j7wk',      // Validar até: → prazo final
  correcao: 'date_mm1hnsyr',
  fechado: 'date_mm1hnde3',
  linkAjustado: 'boolean_mm3akeqv',
  prioridade: 'color_mm1haq1m',
  statusAprov: 'color_mm1hmgn6',
  aprovacoes: 'multiple_person_mm1hndk6',
};

function emailForMonday(s) {
  const t = String(s || '').toLowerCase();
  if (/101091466|bruna|vfz\.bruna/.test(t)) return 'marketing.embalagens@cardosotoys.com.br';
  if (/69762654|32383508|stefany|shumiski|gabriela\.satiro/.test(t)) return 'marketing.operacoes@cardosotoys.com.br';
  if (/46640862|matheus/.test(t)) return 'matheus.cardoso@cardosotoys.com.br';
  if (/aldair|marketing\.digital/.test(t)) return 'marketing.digital@cardosotoys.com.br';
  return 'marketing.digital@cardosotoys.com.br'; // fallback: Aldair
}
function priorityFrom(text) {
  const t = (text || '').toLowerCase();
  if (/urgent|urgên|cr[ií]tic/.test(t)) return 'urgent';
  if (/high|alta/.test(t)) return 'high';
  if (/low|baixa/.test(t)) return 'low';
  return 'medium';
}
function tsToIso(ticks) { const s = Number(ticks) / 1e7; return isFinite(s) && s > 0 ? new Date(s * 1000).toISOString() : null; }
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
async function insertMany(table, rows, ret) {
  if (!rows.length) return [];
  if (!COMMIT) return rows.map((_, i) => ({ id: `dry-${i}` }));
  const out = [];
  for (const c of chunk(rows, 400)) {
    const q = db.from(table).insert(c);
    const { data, error } = ret ? await q.select('id') : await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (ret) out.push(...(data ?? []));
  }
  return out;
}

const EMAIL_KEYWORD = {
  'marketing.embalagens@cardosotoys.com.br': ['bruna'],
  'marketing.operacoes@cardosotoys.com.br': ['stefany', 'shumiski'],
  'matheus.cardoso@cardosotoys.com.br': ['matheus'],
  'marketing.digital@cardosotoys.com.br': ['aldair'],
};

async function loadPeople() {
  const emailToId = {};
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.admin: ${error.message}`);
    for (const u of data.users) if (u.email) emailToId[u.email.toLowerCase()] = u.id;
    if (data.users.length < 1000) break;
    page += 1;
  }
  const { data: profs } = await db.from('profiles').select('id, name');
  const nameToId = (profs ?? []).map((p) => [String(p.name || '').toLowerCase(), p.id]);
  const anyId = (profs ?? [])[0]?.id ?? null;
  return { emailToId, nameToId, anyId };
}

// Monday (nome/id/email) → id de perfil no hub. Tenta e-mail; senão nome do perfil; nunca null.
function resolvePerson(mondayNameOrId, people) {
  const email = emailForMonday(mondayNameOrId);
  if (people.emailToId[email]) return people.emailToId[email];
  const kws = EMAIL_KEYWORD[email] || [];
  const hit = people.nameToId.find(([n]) => kws.some((k) => n.includes(k)));
  if (hit) return hit[1];
  return people.anyId;
}

async function main() {
  console.log(`\n${COMMIT ? '💾 IMPORTANDO Conferência → Embalagens (Teste)' : '🧪 DRY-RUN (não grava — use --commit)'}\n`);
  const raw = JSON.parse(await readFile(DUMP, 'utf8'));
  const board = raw.board;
  const items = raw.items || [];
  const activity = raw.activity_logs || [];

  const people = await loadPeople();
  const pid = (mondayNameOrId) => resolvePerson(mondayNameOrId, people);
  for (const [name, email] of [['Bruna', 'marketing.embalagens@cardosotoys.com.br'], ['Stefany', 'marketing.operacoes@cardosotoys.com.br'], ['Matheus', 'matheus.cardoso@cardosotoys.com.br'], ['Aldair', 'marketing.digital@cardosotoys.com.br']]) {
    const byEmail = people.emailToId[email];
    const byName = !byEmail && (people.nameToId.find(([n]) => (EMAIL_KEYWORD[email] || []).some((k) => n.includes(k)))?.[1]);
    console.log(`  ${name.padEnd(8)} ${email}  →  ${byEmail ? 'ok (e-mail)' : byName ? 'ok (nome)' : '⚠️ usará fallback (não é autor no Monday)'}`);
  }

  const { data: products } = await db.from('products').select('id, code');
  const codeToProduct = new Map((products ?? []).map((p) => [String(p.code), p.id]));

  // pessoa (people col value) → profile
  function assigneeFrom(cv) {
    try { const v = JSON.parse(cv.value); const p = (v.personsAndTeams || []).find((x) => x.kind === 'person'); if (p) return pid(String(p.id)); } catch {}
    return null;
  }

  // ---------- limpeza (idempotente) ----------
  if (COMMIT) {
    const { data: oldTasks } = await db.from('tasks').select('id').eq('packaging_track', TRACK);
    const ids = (oldTasks ?? []).map((t) => t.id);
    if (ids.length) {
      for (const c of chunk(ids, 200)) {
        await db.from('activity_log').delete().in('task_id', c);
        await db.from('task_comments').delete().in('task_id', c);
        await db.from('task_checklist_items').delete().in('task_id', c);
      }
      await db.from('tasks').delete().eq('packaging_track', TRACK);
    }
    await db.from('stages').delete().eq('packaging_track', TRACK);
    console.log(`🧹 Limpou ${ids.length} demandas antigas da trilha de teste.\n`);
  }

  // ---------- etapas (grupos) ----------
  const groups = board.groups || [];
  const stageRows = groups.map((g, i) => ({ project_id: null, packaging_track: TRACK, name: g.title, position: i + 1, is_final: /aprovad|conclu|finaliz/i.test(g.title) }));
  stageRows.push({ project_id: null, packaging_track: TRACK, name: 'Sem grupo', position: groups.length + 1, is_final: false });
  const stages = await insertMany('stages', stageRows, true);
  const stageByGroup = new Map(groups.map((g, i) => [g.title, stages[i]?.id]));
  const fallbackStage = stages[groups.length]?.id;

  // ---------- demandas (itens) ----------
  const byId = (it, id) => (it.column_values || []).find((c) => c.id === id);
  const taskRows = items.map((it, i) => {
    const notes = [];
    const linkAj = byId(it, COL.linkAjustado)?.text === 'v' ? 'sim' : '';
    if (linkAj) notes.push('Link ajustado: sim');
    const sAprov = byId(it, COL.statusAprov)?.text; if (sAprov) notes.push(`Status de Aprovação: ${sAprov}`);
    const corr = byId(it, COL.correcao)?.text; if (corr) notes.push(`Data de Correção: ${corr}`);
    const fech = byId(it, COL.fechado)?.text; if (fech) notes.push(`Arquivo fechado em: ${fech}`);
    const code = (it.name.match(/\b(\d{3,4})\b/) || [])[1];
    return {
      project_id: null,
      packaging_track: TRACK,
      stage_id: stageByGroup.get(it.group?.title) ?? fallbackStage,
      product_id: code ? codeToProduct.get(code) ?? null : null,
      title: it.name,
      notes: notes.join('\n'),
      priority: priorityFrom(byId(it, COL.prioridade)?.text),
      assignee_id: (() => { const c = byId(it, COL.aprovacoes); return c?.value ? assigneeFrom(c) : null; })(),
      start_date: byId(it, COL.start)?.text || null,
      target_date: byId(it, COL.meta)?.text || null,
      due_date: byId(it, COL.due)?.text || null,
      updated_by: pid(it.creator?.name || it.creator?.email),
      position: i,
      created_at: it.monday_created_at || it.created_at || undefined,
    };
  });
  const tasks = await insertMany('tasks', taskRows, true);
  const taskByItem = new Map(items.map((it, i) => [String(it.id), tasks[i]?.id]));

  // ---------- checklist (subitens) ----------
  const checklist = [];
  for (const it of items) {
    const tid = taskByItem.get(String(it.id));
    (it.subitems || []).forEach((s, j) => {
      const st = (s.column_values || []).find((c) => c.type === 'status')?.text || '';
      checklist.push({ task_id: tid, label: s.name || '(subitem)', done: /feito|conclu|aprovad/i.test(st), position: j });
    });
  }
  await insertMany('task_checklist_items', checklist);

  // ---------- comentários (updates + respostas) ----------
  const comments = [];
  for (const it of items) {
    const tid = taskByItem.get(String(it.id));
    for (const up of it.updates || []) {
      comments.push({ task_id: tid, author_id: pid(up.creator?.name || up.creator?.email), body: (up.text_body || '[anexo]').slice(0, 8000), mentioned_ids: [], created_at: up.created_at || undefined });
      for (const r of up.replies || []) {
        comments.push({ task_id: tid, author_id: pid(r.creator?.name || r.creator?.email), body: (r.text_body || '[anexo]').slice(0, 8000), mentioned_ids: [], created_at: r.created_at || undefined });
      }
    }
  }
  await insertMany('task_comments', comments);

  // ---------- histórico (activity_logs) ----------
  const KEEP = /create_pulse|update_column_value|create_update|move_pulse|create_subitem|update_name/i;
  const history = [];
  for (const ev of activity) {
    if (!KEEP.test(ev.event)) continue;
    let d = {}; try { d = ev.data ? JSON.parse(ev.data) : {}; } catch {}
    const tid = d.pulse_id ? taskByItem.get(String(d.pulse_id)) : null;
    if (!tid) continue;
    const col = d.column_title ? `"${d.column_title}"` : '';
    const action =
      ev.event === 'create_pulse' ? 'Item criado' :
      ev.event === 'update_column_value' ? `Alterou ${col}` :
      ev.event === 'create_update' ? 'Comentário' :
      /move_pulse/.test(ev.event) ? 'Movido de etapa' :
      ev.event === 'create_subitem' ? 'Subitem criado' :
      ev.event === 'update_name' ? 'Renomeado' : ev.event;
    history.push({ task_id: tid, actor_id: pid(String(ev.user_id)), action_text: action, detail: 'Conferência de Embalagens (Monday) · [import-teste]', created_at: tsToIso(ev.created_at) || undefined });
  }
  await insertMany('activity_log', history);

  console.log(`\n===== RESULTADO =====`);
  console.log(`${stageRows.length} etapas · ${taskRows.length} demandas · ${checklist.length} subitens · ${comments.length} comentários · ${history.length} eventos de histórico`);
  console.log(COMMIT ? '\n✅ Pronto. Abra "Design de Produto → Embalagens (Teste)" no hub.\n' : '\n🧪 Foi simulação. Rode com --commit para gravar.\n');
}

main().catch((e) => { console.error('\n❌ Erro:', e.message, '\n'); process.exit(1); });
