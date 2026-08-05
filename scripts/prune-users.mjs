#!/usr/bin/env node
// Cardoso Hub — Desativa (bane) os acessos que não estão na lista de mantidos.
// ---------------------------------------------------------------------------
// NÃO exclui (excluir travaria por causa das referências / poderia apagar dados).
// Em vez disso, DESATIVA o login (ban) — a pessoa não entra mais, mas todo o
// histórico/comentários/demandas dela continuam intactos. É reversível.
//
//   export SUPABASE_URL="https://xxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//   node scripts/prune-users.mjs           # só LISTA (mantidos x a desativar)
//   node scripts/prune-users.mjs --ban     # desativa os que não estão na lista
//   node scripts/prune-users.mjs --unban-all   # reativa todo mundo (desfaz)
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Falta SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const DO_BAN = process.argv.includes('--ban');
const UNBAN_ALL = process.argv.includes('--unban-all');

// Os únicos acessos que permanecem ATIVOS:
const KEEP = new Set([
  'marketing.embalagens@cardosotoys.com.br',
  'marketing.operacoes@cardosotoys.com.br',
  'matheus.cardoso@cardosotoys.com.br',
  'marketing.digital@cardosotoys.com.br',
]);

const BAN_100Y = '876000h'; // ~100 anos = desativado

async function allUsers() {
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page += 1;
  }
  return users;
}

async function main() {
  const users = await allUsers();
  const keep = users.filter((u) => KEEP.has((u.email || '').toLowerCase()));
  const remove = users.filter((u) => !KEEP.has((u.email || '').toLowerCase()));

  console.log(`\n👥 ${users.length} usuários no total.\n`);
  console.log('✅ MANTIDOS (ativos):');
  keep.forEach((u) => console.log(`   ${u.email}`));
  console.log('\n🚫 A DESATIVAR:');
  remove.forEach((u) => console.log(`   ${u.email}${u.banned_until ? '  (já desativado)' : ''}`));

  // trava de segurança: não deixa desativar todo mundo
  if (keep.length === 0) {
    console.error('\n⛔ Nenhum dos 4 e-mails foi encontrado — abortando pra não trancar o sistema. Confira os e-mails.\n');
    process.exit(1);
  }

  if (UNBAN_ALL) {
    for (const u of users) await db.auth.admin.updateUserById(u.id, { ban_duration: 'none' });
    console.log('\n♻️  Todos reativados.\n');
    return;
  }

  if (!DO_BAN) {
    console.log('\n🧪 Isto foi só a lista. Para desativar de verdade, rode:  node scripts/prune-users.mjs --ban\n');
    return;
  }

  let n = 0;
  for (const u of remove) {
    const { error } = await db.auth.admin.updateUserById(u.id, { ban_duration: BAN_100Y });
    if (error) console.warn(`   ⚠️ ${u.email}: ${error.message}`);
    else { n += 1; console.log(`   ✔ desativado ${u.email}`); }
  }
  console.log(`\n✅ ${n} acessos desativados. (Reverter: node scripts/prune-users.mjs --unban-all)\n`);
}

main().catch((e) => { console.error('\n❌ Erro:', e.message, '\n'); process.exit(1); });
