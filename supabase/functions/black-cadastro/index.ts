// Cardoso Marketing Hub — Cardoso Black: consulta do CNPJ e pré-cadastro do lojista (/black).
//
// POST { acao: 'consulta', cnpj }
//   → confere o dígito do CNPJ, vê se já existe cadastro, consulta a Receita (BrasilAPI, pública e gratuita)
//     e procura a empresa na carteira (black_carteira). Devolve só o que o lojista pode ver:
//     razão social, fantasia, cidade/UF e o representante — nunca a situação comercial.
// POST { acao: 'inscrever', cnpj, comprador, email, celular, canais, senha, lgpd, rep }
//   → refaz a consulta AQUI (o nome da empresa nunca vem do navegador, para ninguém se passar por cliente)
//     e grava pela função black_registrar_inscricao, que decide aprovado / em análise.
//
// Usa a SUPABASE_SERVICE_ROLE_KEY (padrão das Edge Functions) só para chamar as duas funções do banco
// que não são públicas. Publicar com "Verify JWT" ligado: o site chama pelo supabase.functions.invoke.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

function cnpjValido(c: string) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((s, d, i) => s + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

// DDDs de cada estado (para o aviso de celular de outro estado)
const DDD: Record<string, number[]> = {
  SP: [11, 12, 13, 14, 15, 16, 17, 18, 19], RJ: [21, 22, 24], ES: [27, 28], MG: [31, 32, 33, 34, 35, 37, 38],
  PR: [41, 42, 43, 44, 45, 46], SC: [47, 48, 49], RS: [51, 53, 54, 55], DF: [61], GO: [62, 64], TO: [63],
  MT: [65, 66], MS: [67], AC: [68], RO: [69], BA: [71, 73, 74, 75, 77], SE: [79], PE: [81, 87], AL: [82],
  PB: [83], RN: [84], CE: [85, 88], PI: [86, 89], PA: [91, 93, 94], AM: [92, 97], RR: [95], AP: [96], MA: [98, 99],
};
// provedores de e-mail temporário mais comuns
const DESCARTAVEL = ['mailinator.', 'tempmail', 'temp-mail', '10minutemail', 'guerrillamail', 'yopmail', 'trashmail',
  'sharklasers', 'getnada', 'dispostable', 'maildrop', 'throwaway', 'fakeinbox', 'emailondeck', 'mohmal', 'minuteinbox'];
const MARKETPLACE: Record<string, RegExp> = {
  ml: /mercadolivre|mercadolibre|meli|^[\w.\- ]{3,}$/i, amz: /amazon|amzn|^[\w.\- &]{3,}$/i, shp: /shopee|^[\w.\- ]{3,}$/i,
  mgl: /magazineluiza|magalu|^[\w.\- ]{3,}$/i,
};
function linkValido(canal: string, v: string) {
  const s = v.trim();
  if (s.length < 3) return false;
  if (canal === 'site') return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(s);
  if (canal === 'out') return s.length >= 3;
  const re = MARKETPLACE[canal];
  return re ? re.test(s) : true;
}

type Receita = { razao: string; fantasia: string; cidade: string; uf: string; ativa: boolean };
const cacheReceita = new Map<string, { em: number; dado: Receita | null }>();

// null = a Receita não respondeu (fora do ar); 'inexistente' = o CNPJ não existe
async function consultaReceita(cnpj: string): Promise<Receita | null | 'inexistente'> {
  const c = cacheReceita.get(cnpj);
  if (c && Date.now() - c.em < 30 * 60_000) return c.dado;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: ctrl.signal, headers: { 'User-Agent': 'cardoso-black/1.0' } });
    clearTimeout(t);
    if (r.status === 404) return 'inexistente';
    if (!r.ok) return null;
    const o = await r.json();
    const dado: Receita = {
      razao: String(o.razao_social ?? '').trim(),
      fantasia: String(o.nome_fantasia ?? '').trim(),
      cidade: String(o.municipio ?? '').trim(),
      uf: String(o.uf ?? '').trim().toUpperCase(),
      ativa: String(o.descricao_situacao_cadastral ?? 'ATIVA').toUpperCase() === 'ATIVA',
    };
    const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());
    dado.cidade = titulo(dado.cidade);
    cacheReceita.set(cnpj, { em: Date.now(), dado });
    return dado;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const acao = String(body.acao ?? '');
    const cnpj = digitos(body.cnpj);
    if (!cnpjValido(cnpj)) return json({ erro: 'cnpj_invalido' });

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: ja } = await sb.rpc('black_ja_inscrito', { p_cnpj: cnpj });
    if (ja) return json({ erro: 'ja_inscrito', status: ja });

    const receita = await consultaReceita(cnpj);
    if (receita === 'inexistente') return json({ erro: 'cnpj_nao_encontrado' });

    if (acao === 'consulta') {
      if (!receita) return json({ empresa: null, receita_fora: true });
      const { data: cart } = await sb.rpc('black_carteira_match', { p_razao: receita.razao, p_uf: receita.uf, p_cnpj: cnpj });
      const achou = Array.isArray(cart) && cart.length > 0 ? cart[0] : null;
      return json({
        empresa: { razao: receita.razao, fantasia: receita.fantasia || achou?.fantasia || '', cidade: receita.cidade, uf: receita.uf, ativa: receita.ativa },
        carteira: achou ? { representante: achou.representante } : null,
      });
    }

    if (acao === 'inscrever') {
      const comprador = String(body.comprador ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const celular = String(body.celular ?? '').trim();
      const senha = String(body.senha ?? '');
      const canais = typeof body.canais === 'object' && body.canais ? body.canais : {};
      const erros: string[] = [];
      if (comprador.length < 3) erros.push('comprador');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.push('email');
      if (digitos(celular).length < 10) erros.push('celular');
      if (!Object.keys(canais).length || Object.values(canais).some((v) => !String(v ?? '').trim())) erros.push('canais');
      if (senha.length < 6) erros.push('senha');
      if (body.lgpd !== true) erros.push('lgpd');
      if (erros.length) return json({ erro: 'campos', campos: erros });

      // Receita fora do ar: grava com o nome digitado, mas sem checar a carteira (cai em análise)
      const confiavel = !!receita;
      // checagem antifraude por regras: o banco junta com carteira, e-mail e celular repetidos
      const alertas: string[] = [];
      if (receita && !receita.ativa) alertas.push('receita_inativa');
      const dominio = email.split('@')[1] ?? '';
      if (DESCARTAVEL.some((d) => dominio.includes(d))) alertas.push('email_descartavel');
      if (Object.entries(canais).some(([k, v]) => !linkValido(k, String(v ?? '')))) alertas.push('link_invalido');
      const ddd = Number(digitos(celular).slice(0, 2));
      const ufRef = receita ? receita.uf : String(body.uf ?? '').toUpperCase();
      if (DDD[ufRef] && !DDD[ufRef].includes(ddd)) alertas.push('ddd_outra_uf');
      const r = receita || { razao: String(body.razao ?? '').trim(), fantasia: '', cidade: String(body.cidade ?? '').trim(), uf: String(body.uf ?? '').trim().toUpperCase(), ativa: true };
      const limpa: Record<string, string> = {};
      for (const [k, v] of Object.entries(canais)) limpa[String(k).slice(0, 20)] = String(v ?? '').trim().slice(0, 300);

      const { data, error } = await sb.rpc('black_registrar_inscricao', {
        p_cnpj: cnpj, p_razao: r.razao, p_fantasia: r.fantasia, p_cidade: r.cidade, p_uf: r.uf,
        p_rep_link: String(body.rep ?? '').trim().slice(0, 60),
        p_comprador: comprador.slice(0, 120), p_email: email.slice(0, 160), p_celular: celular.slice(0, 30),
        p_canais: limpa, p_senha: senha, p_confiavel: confiavel, p_alertas: alertas,
      });
      if (error) return json({ erro: 'banco', detalhe: error.message }, 500);
      return json(data);
    }

    return json({ erro: 'acao' }, 400);
  } catch (e) {
    return json({ erro: 'interno', detalhe: (e as Error).message }, 500);
  }
});
