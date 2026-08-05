#!/usr/bin/env node
// Cardoso Hub — "Nova Marca - Implementação" (Monday) → um Projeto no hub
// ---------------------------------------------------------------------------
// Cria o projeto com etapas (grupos), demandas (itens), checklist (subitens),
// comentários (updates + respostas, com links), menções reais e histórico —
// atribuído a Fabiana / Stefany / Matheus, com datas e autores originais.
//
// NÃO mexe no módulo Monday (arquivo). Idempotente: apaga o projeto de mesmo
// nome antes de recriar. Dry-run por padrão; grava com --commit.
//
//   export SUPABASE_URL="https://xxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//   node scripts/monday-to-project-novamarca.mjs            # dry-run
//   node scripts/monday-to-project-novamarca.mjs --commit   # grava
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DUMP = join(process.cwd(), 'monday-dump', 'board-18403298414-nova-marca-implementa-o.json');
const PROJECT_NAME = 'Nova Marca - Implementação';
const COMMIT = process.argv.includes('--commit');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('\n❌ Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n'); process.exit(1); }
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// colunas do quadro Nova Marca
const COL = {
  arte: 'person',                       // Arte [people] → responsável
  compra: 'multiple_person_mm1af7yk',   // Compra/Acompanhamento [people]
  status: 'status',                     // Status
  entregaAprov: 'date4',                // Entrega para aprovação → meta
  aprovacoes: 'multiple_person_mm1at1c2',
  entregaFinal: 'date_mm1aj8er',        // Entrega final → prazo final
};

// Atribuição: Monday (id/nome/email) → e-mail no hub
const USERS = [
  { re: /32431902|fabiana/i, email: 'fabiana.fazoli@cardosotoys.com.br', name: 'Fabiana Fazoli' },
  { re: /69762654|32383508|stefany|shumiski|sshumiski/i, email: 'marketing.operacoes@cardosotoys.com.br', name: 'Stefany Shumiski' },
  { re: /46640862|matheus/i, email: 'matheus.cardoso@cardosotoys.com.br', name: 'Matheus Cardoso' },
];
const FALLBACK_EMAIL = 'matheus.cardoso@cardosotoys.com.br';
function emailForMonday(s) {
  const t = String(s || '').toLowerCase();
  return (USERS.find((u) => u.re.test(t)) || {}).email || FALLBACK_EMAIL;
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
  return emailToId;
}

// garante que um usuário exista (cria a conta se faltar); retorna o id do perfil
async function ensureUser(email, name, emailToId) {
  if (emailToId[email]) return emailToId[email];
  if (!COMMIT) { console.log(`   (dry) criaria conta: ${email}`); return 'dry-user'; }
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data?.user) { console.warn(`   ⚠️ não criou ${email}: ${error?.message}`); return null; }
  const id = data.user.id;
  // o trigger cria o profile; ajusta nome/papel/departamento
  await db.from('profiles').update({ name, role: 'equipe', department: 'coordenacao' }).eq('id', id);
  emailToId[email] = id;
  console.log(`   ➕ conta criada: ${email} (defina a senha via "Esqueci a senha")`);
  return id;
}

async function main() {
  console.log(`\n${COMMIT ? '💾 IMPORTANDO Nova Marca → Projeto' : '🧪 DRY-RUN (não grava — use --commit)'}\n`);
  const raw = JSON.parse(await readFile(DUMP, 'utf8'));
  const board = raw.board;
  const items = raw.items || [];
  const activity = raw.activity_logs || [];

  const emailToId = await loadPeople();
  // garante os 3 usuários
  const memberIds = [];
  for (const u of USERS) { const id = await ensureUser(u.email, u.name, emailToId); if (id) memberIds.push(id); console.log(`  ${u.name.padEnd(16)} ${u.email}  →  ${emailToId[u.email] ? 'ok' : (COMMIT ? '⚠️' : 'dry')}`); }
  const pid = (mondayNameOrId) => emailToId[emailForMonday(mondayNameOrId)] || emailToId[FALLBACK_EMAIL] || null;

  // menções
  const MENTION_RULES = USERS.map((u) => ({ re: new RegExp('@\\s*(' + u.re.source + ')', 'i'), email: u.email }));
  function mentionsIn(text) {
    const t = String(text || ''); const ids = new Set();
    for (const r of MENTION_RULES) if (r.re.test(t) && emailToId[r.email]) ids.add(emailToId[r.email]);
    return [...ids];
  }
  function assigneeFrom(cv) {
    try { const v = JSON.parse(cv.value); const p = (v.personsAndTeams || []).find((x) => x.kind === 'person'); if (p) return pid(String(p.id)); } catch {}
    return null;
  }
  function peopleNames(cv) {
    try { const v = JSON.parse(cv.value); return (v.personsAndTeams || []).length; } catch { return 0; }
  }

  // ---------- limpeza (idempotente) ----------
  if (COMMIT) {
    const { data: existing } = await db.from('projects').select('id').eq('name', PROJECT_NAME);
    for (const p of existing ?? []) {
      const { data: t } = await db.from('tasks').select('id').eq('project_id', p.id);
      const tids = (t ?? []).map((x) => x.id);
      for (const c of chunk(tids, 200)) {
        await db.from('activity_log').delete().in('task_id', c);
        await db.from('task_comments').delete().in('task_id', c);
        await db.from('task_checklist_items').delete().in('task_id', c);
      }
      await db.from('tasks').delete().eq('project_id', p.id);
      await db.from('stages').delete().eq('project_id', p.id);
      await db.from('project_members').delete().eq('project_id', p.id);
      await db.from('activity_log').delete().eq('project_id', p.id);
      await db.from('comments').delete().eq('project_id', p.id);
      await db.from('checklist_items').delete().eq('project_id', p.id);
      await db.from('project_files').delete().eq('project_id', p.id);
      await db.from('projects').delete().eq('id', p.id);
    }
    console.log(`🧹 Limpou ${(existing ?? []).length} projeto(s) anterior(es) de mesmo nome.\n`);
  }

  // ---------- projeto ----------
  const { data: brands } = await db.from('brands').select('id, key');
  const brandId = (brands ?? []).find((b) => b.key === 'cardoso')?.id ?? (brands ?? [])[0]?.id;
  let projectId = 'dry-project';
  if (COMMIT) {
    const { data, error } = await db.from('projects').insert({
      brand_id: brandId, name: PROJECT_NAME, sub: 'Importado do Monday', status: 'active',
      priority: 'high', category: 'Implementação de Marca', created_by: pid('fabiana'),
    }).select('id').single();
    if (error) throw new Error(`projects: ${error.message}`);
    projectId = data.id;
    await insertMany('project_members', [...new Set(memberIds)].map((uid) => ({ project_id: projectId, user_id: uid, role_label: '' })));
  }

  // ---------- etapas (grupos) ----------
  const groups = board.groups || [];
  const stageRows = groups.map((g, i) => ({ project_id: projectId, name: g.title, position: i + 1, is_final: /aprovad|conclu|finaliz|entregu/i.test(g.title) }));
  stageRows.push({ project_id: projectId, name: 'Sem grupo', position: groups.length + 1, is_final: false });
  const stages = await insertMany('stages', stageRows, true);
  const stageByGroup = new Map(groups.map((g, i) => [g.title, stages[i]?.id]));
  const fallbackStage = stages[groups.length]?.id;

  // ---------- demandas (itens) ----------
  const byId = (it, id) => (it.column_values || []).find((c) => c.id === id);
  const taskRows = items.map((it, i) => {
    const notes = [];
    const st = byId(it, COL.status)?.text; if (st) notes.push(`Status (Monday): ${st}`);
    const compra = byId(it, COL.compra); if (compra && peopleNames(compra)) notes.push(`Compra/Acompanhamento: ${compra.text}`);
    const aprov = byId(it, COL.aprovacoes); if (aprov?.text) notes.push(`Aprovações: ${aprov.text}`);
    const arte = byId(it, COL.arte);
    return {
      project_id: projectId,
      stage_id: stageByGroup.get(it.group?.title) ?? fallbackStage,
      title: it.name,
      notes: notes.join('\n'),
      priority: 'medium',
      assignee_id: (arte?.value && assigneeFrom(arte)) || (byId(it, COL.aprovacoes)?.value && assigneeFrom(byId(it, COL.aprovacoes))) || null,
      target_date: byId(it, COL.entregaAprov)?.text || null,
      due_date: byId(it, COL.entregaFinal)?.text || null,
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
      const stt = (s.column_values || []).find((c) => c.type === 'status')?.text || '';
      checklist.push({ task_id: tid, label: s.name || '(subitem)', done: /feito|conclu|aprovad/i.test(stt), position: j });
    });
  }
  await insertMany('task_checklist_items', checklist);

  // ---------- comentários (updates + respostas) ----------
  const comments = [];
  for (const it of items) {
    const tid = taskByItem.get(String(it.id));
    for (const up of it.updates || []) {
      comments.push({ task_id: tid, author_id: pid(up.creator?.name || up.creator?.email), body: (up.text_body || '[anexo]').slice(0, 8000), mentioned_ids: mentionsIn(up.text_body), created_at: up.created_at || undefined });
      for (const r of up.replies || []) {
        comments.push({ task_id: tid, author_id: pid(r.creator?.name || r.creator?.email), body: (r.text_body || '[anexo]').slice(0, 8000), mentioned_ids: mentionsIn(r.text_body), created_at: r.created_at || undefined });
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
    const col = d.column_title ? `"${d.column_title}"` : '';
    const action =
      ev.event === 'create_pulse' ? 'Item criado' :
      ev.event === 'update_column_value' ? `Alterou ${col}` :
      ev.event === 'create_update' ? 'Comentário' :
      /move_pulse/.test(ev.event) ? 'Movido de etapa' :
      ev.event === 'create_subitem' ? 'Subitem criado' :
      ev.event === 'update_name' ? 'Renomeado' : ev.event;
    history.push({ project_id: projectId, task_id: tid || null, actor_id: pid(String(ev.user_id)), action_text: action, detail: 'Nova Marca (Monday)', created_at: tsToIso(ev.created_at) || undefined });
  }
  await insertMany('activity_log', history);

  const mentionTotal = comments.reduce((n, c) => n + (c.mentioned_ids?.length ? 1 : 0), 0);
  console.log(`\n===== RESULTADO =====`);
  console.log(`Projeto "${PROJECT_NAME}" · ${memberIds.length} membros · ${stageRows.length} etapas · ${taskRows.length} demandas · ${checklist.length} subitens`);
  console.log(`${comments.length} comentários (${mentionTotal} com menção) · ${history.length} eventos de histórico`);
  console.log(COMMIT ? '\n✅ Pronto. Abra "Projetos" no hub.\n' : '\n🧪 Foi simulação. Rode com --commit para gravar.\n');
}

main().catch((e) => { console.error('\n❌ Erro:', e.message, '\n'); process.exit(1); });
