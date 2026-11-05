// Cardoso Marketing Hub — recebe o saldo de estoque do Guarani (integração automática).
//
// Quem chama: o programa/rotina que lê o Guarani (API do Guarani, script no servidor da Cardoso,
// n8n, etc.), quantas vezes quiser — a cada 5 minutos é o recomendado durante a Black.
//
// POST /functions/v1/black-estoque
//   header  x-chave: <segredo ESTOQUE_GUARANI_CHAVE>
//   body JSON  { "itens": [ { "codigo": "0275", "pecas": 1520 }, ... ] }
//   ou CSV     (Content-Type: text/csv) com as colunas codigo;pecas  (aceita "estoque", "saldo", "quantidade")
// Resposta: { linhas, em }
//
// Publicar com "Verify JWT" DESLIGADO (a proteção é a chave) e criar o segredo ESTOQUE_GUARANI_CHAVE
// em Edge Functions → Secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const chave = Deno.env.get('ESTOQUE_GUARANI_CHAVE') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const numero = (v: unknown) => {
  const s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
};

function lerCsv(txt: string) {
  const linhas = txt.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const norm = (s: string) => s.trim().replace(/^"|"$/g, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const head = linhas[0].split(sep).map(norm);
  const iCod = head.findIndex((h) => ['codigo', 'cod', 'produto', 'sku', 'referencia', 'ref'].includes(h));
  const iQtd = head.findIndex((h) => ['pecas', 'estoque', 'saldo', 'quantidade', 'qtd', 'disponivel'].includes(h));
  if (iCod < 0 || iQtd < 0) return null;
  return linhas.slice(1).map((l) => {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    return { codigo: c[iCod], pecas: numero(c[iQtd]) };
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'use POST' }, 405);
  if (!chave || !iguais(req.headers.get('x-chave') ?? '', chave)) return json({ erro: 'chave' }, 401);

  let itens: { codigo: string; pecas: number | null }[] | null;
  const tipo = req.headers.get('content-type') ?? '';
  try {
    if (tipo.includes('json')) {
      const b = await req.json();
      itens = (Array.isArray(b) ? b : b?.itens ?? []).map((x: Record<string, unknown>) => ({
        codigo: String(x.codigo ?? x.sku ?? '').trim(), pecas: numero(x.pecas ?? x.estoque ?? x.saldo ?? x.quantidade),
      }));
    } else {
      itens = lerCsv(await req.text());
      if (itens === null) return json({ erro: 'colunas', esperado: 'codigo;pecas' }, 400);
    }
  } catch {
    return json({ erro: 'formato' }, 400);
  }

  const linhas = itens.filter((x) => x.codigo && x.pecas !== null);
  if (!linhas.length) return json({ erro: 'vazio' }, 400);

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('estoque_guarani_atualizar', { p_linhas: linhas, p_origem: 'integracao' });
  if (error) return json({ erro: error.message }, 500);
  return json(data);
});
