#!/usr/bin/env node
// Cardoso Hub — Exportador do Monday.com (READ-ONLY)
// ---------------------------------------------------------------------------
// Puxa TUDO do seu Monday via API e salva em JSON local (./monday-dump/).
// Não altera nada — nem no Monday, nem no hub. É só leitura.
//
// COMO RODAR (no terminal, dentro da pasta do projeto):
//   MONDAY_TOKEN="seu_token_aqui" node scripts/monday-export.mjs
//
// Onde pegar o token: Monday → foto do perfil → Developers → My access tokens
// (ou Admin → API). O token é pessoal e enxerga o que a sua conta enxerga.
//
// Opcionais:
//   MONDAY_API_VERSION=2024-01   (versão da API; padrão 2024-01)
//   MONDAY_BOARD_IDS=123,456     (só esses quadros; padrão = todos)
//
// No fim ele imprime um RESUMO (quadros, nº de itens, colunas, quanto de
// histórico veio) — me manda esse resumo que eu monto o importador certo.
// ---------------------------------------------------------------------------

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TOKEN = process.env.MONDAY_TOKEN;
const API_VERSION = process.env.MONDAY_API_VERSION || '2024-01';
const ONLY_BOARDS = (process.env.MONDAY_BOARD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const OUT_DIR = join(process.cwd(), 'monday-dump');

if (!TOKEN) {
  console.error('\n❌ Falta o token. Rode assim:\n   MONDAY_TOKEN="seu_token" node scripts/monday-export.mjs\n');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(query, variables = {}, tries = 0) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN, 'API-Version': API_VERSION },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) {
    // rate limit — espera e tenta de novo
    const wait = 8000 * (tries + 1);
    console.warn(`   ⏳ rate limit, aguardando ${wait / 1000}s…`);
    await sleep(wait);
    if (tries < 5) return gql(query, variables, tries + 1);
  }
  const json = await res.json().catch(() => ({}));
  if (json.errors) {
    const msg = JSON.stringify(json.errors);
    // erro de complexidade → espera e tenta de novo com menos
    if (/complexity/i.test(msg) && tries < 4) {
      await sleep(10000);
      return gql(query, variables, tries + 1);
    }
    throw new Error(msg);
  }
  return json.data;
}

async function safeGql(label, query, variables) {
  try {
    return await gql(query, variables);
  } catch (e) {
    console.warn(`   ⚠️  ${label} falhou: ${String(e.message).slice(0, 200)}`);
    return null;
  }
}

async function getAllBoards() {
  const boards = [];
  let page = 1;
  for (;;) {
    const data = await gql(
      `query ($page:Int){ boards (limit: 50, page: $page, state: all) { id name state board_kind } }`,
      { page },
    );
    const batch = data?.boards ?? [];
    boards.push(...batch);
    if (batch.length < 50) break;
    page += 1;
    await sleep(400);
  }
  return boards;
}

async function getBoardMeta(id) {
  const data = await gql(
    `query ($id:[ID!]) {
       boards (ids: $id) {
         id name state description
         groups { id title color position }
         columns { id title type settings_str }
         owners { id name email }
       }
     }`,
    { id: [id] },
  );
  return data?.boards?.[0] ?? null;
}

async function getBoardItems(id) {
  const items = [];
  const ITEM_Q = `
    id name state created_at updated_at
    group { id title }
    creator { id name email }
    column_values { id text value type }
    subitems { id name column_values { id text value type } }
    updates (limit: 100) { id text_body body created_at creator { id name email } replies { id text_body created_at creator { name } } }
  `;
  // primeira página
  let data = await gql(
    `query ($id:[ID!]) { boards (ids: $id) { items_page (limit: 25) { cursor items { ${ITEM_Q} } } } }`,
    { id: [id] },
  );
  let pageData = data?.boards?.[0]?.items_page;
  while (pageData) {
    items.push(...(pageData.items ?? []));
    if (!pageData.cursor) break;
    await sleep(400);
    data = await gql(
      `query ($cursor:String) { next_items_page (limit: 25, cursor: $cursor) { cursor items { ${ITEM_Q} } } }`,
      { cursor: pageData.cursor },
    );
    pageData = data?.next_items_page;
  }
  return items;
}

async function getActivityLogs(id) {
  // Log de atividades — retenção limitada pelo plano; pode vir vazio ou falhar.
  const logs = [];
  let page = 1;
  for (;;) {
    const data = await safeGql(
      'activity_logs',
      `query ($id:[ID!], $page:Int){ boards (ids: $id) { activity_logs (limit: 100, page: $page) { id event data entity created_at user_id } } }`,
      { id: [id], page },
    );
    const batch = data?.boards?.[0]?.activity_logs ?? [];
    logs.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    await sleep(500);
  }
  return logs;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

async function main() {
  console.log(`\n🔎 Exportando do Monday (API ${API_VERSION})…\n`);
  await mkdir(OUT_DIR, { recursive: true });

  // usuários (pra mapear autores depois)
  const usersData = await safeGql('users', `query { users (limit: 500) { id name email } }`);
  const users = usersData?.users ?? [];
  await writeFile(join(OUT_DIR, 'users.json'), JSON.stringify(users, null, 2));
  console.log(`👤 ${users.length} usuários salvos.\n`);

  let boards = await getAllBoards();
  if (ONLY_BOARDS.length) boards = boards.filter((b) => ONLY_BOARDS.includes(String(b.id)));
  console.log(`📋 ${boards.length} quadros encontrados.\n`);

  const summary = [];
  for (const b of boards) {
    process.stdout.write(`→ ${b.name} (${b.id}) … `);
    const meta = await getBoardMeta(b.id);
    await sleep(300);
    const items = await getBoardItems(b.id);
    await sleep(300);
    const activity = await getActivityLogs(b.id);

    const updatesCount = items.reduce((n, it) => n + (it.updates?.length ?? 0), 0);
    const subitemsCount = items.reduce((n, it) => n + (it.subitems?.length ?? 0), 0);

    const full = { board: meta ?? b, items, activity_logs: activity };
    await writeFile(join(OUT_DIR, `board-${b.id}-${slug(b.name)}.json`), JSON.stringify(full, null, 2));

    const row = {
      id: b.id,
      name: b.name,
      state: b.state,
      groups: (meta?.groups ?? []).map((g) => g.title),
      columns: (meta?.columns ?? []).map((c) => `${c.title} [${c.type}]`),
      items: items.length,
      subitems: subitemsCount,
      updates: updatesCount,
      activity_logs: activity.length,
    };
    summary.push(row);
    console.log(`${items.length} itens · ${updatesCount} comentários · ${activity.length} eventos de histórico`);
    await sleep(500);
  }

  await writeFile(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n================= RESUMO =================');
  for (const r of summary) {
    console.log(`\n📌 ${r.name}  (id ${r.id}, ${r.state})`);
    console.log(`   Grupos:   ${r.groups.join(' · ') || '—'}`);
    console.log(`   Colunas:  ${r.columns.join(' · ') || '—'}`);
    console.log(`   Itens: ${r.items} · Subitens: ${r.subitems} · Comentários: ${r.updates} · Histórico: ${r.activity_logs}`);
  }
  console.log('\n=========================================');
  console.log(`\n✅ Pronto. Tudo salvo em: ${OUT_DIR}`);
  console.log('   Me mande o conteúdo de monday-dump/summary.json (não tem dado sensível — só nomes de quadros/colunas e contagens).');
  console.log('   Com isso eu escrevo o importador certo para o hub.\n');
}

main().catch((e) => {
  console.error('\n❌ Erro:', e.message);
  console.error('Se for erro de permissão/versão da API, me mande a mensagem que eu ajusto.\n');
  process.exit(1);
});
