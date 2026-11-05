// Cardoso Marketing Hub — Cardoso Black: foto e vídeo da ficha do produto (/black/p/<código>) sem login.
//
// O lojista abre a ficha pelo QR da live, sem conta Google. Esta função busca o arquivo no Drive com a conta
// de serviço hub-drive (só leitura), igual à drive-baixar, e entrega para a página. Só entrega um arquivo quando
// black_midia_liberada confirma que ele é material LIBERADO (banco de materiais) de um produto ativo da Black.
// Assim nenhum arquivo do Drive precisa ficar "qualquer pessoa com o link".
//
// GET ?id=<id do arquivo>                  → o arquivo para exibir (imagem ou vídeo, com Range para o player)
// GET ?id=<id do arquivo>&modo=miniatura   → a miniatura do Drive
//
// Publicar com "Verify JWT" desligado: a página usa o endereço direto em <img> e <video>.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const FOLDER = 'application/vnd.google-apps.folder';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length' };
const texto = (msg: string, status: number) =>
  new Response(msg, { status, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });

// ---------- token do Google pela conta de serviço (JWT RS256 assinado aqui mesmo) ----------
let cache: { token: string; exp: number } | null = null;

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// a chave pode chegar sem as chaves { } das pontas, entre aspas ou em base64, conforme o jeito que foi colada no painel
function lerChave(raw: string): { client_email: string; private_key: string } {
  const t = raw.trim();
  const semAspas = t.replace(/^(['"`])([\s\S]*)\1$/, '$2').trim();
  const tentativas = [t, `{${t}}`, `{${t.replace(/,\s*$/, '')}}`, semAspas, `{${semAspas}}`];
  try { tentativas.push(atob(t)); } catch { /* não é base64 */ }
  for (const x of tentativas) {
    try {
      const o = JSON.parse(x);
      if (o?.client_email && o?.private_key) return o;
    } catch { /* tenta a próxima forma */ }
  }
  throw new Error(`O Secret GOOGLE_SERVICE_ACCOUNT_JSON não está no formato do arquivo JSON da conta de serviço (começa com "${t.slice(0, 1)}", ${t.length} caracteres). Cole o arquivo inteiro, do { ao }.`);
}

async function googleToken(): Promise<string> {
  if (cache && cache.exp > Date.now() + 60_000) return cache.token;
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('Falta o Secret GOOGLE_SERVICE_ACCOUNT_JSON no Supabase.');
  const sa = lerChave(raw);
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claim}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64url(sig)}` }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(`Google recusou a conta de serviço: ${out.error_description ?? out.error ?? res.status}`);
  cache = { token: out.access_token, exp: Date.now() + out.expires_in * 1000 };
  return cache.token;
}

async function drive(path: string, params: Record<string, string>) {
  const token = await googleToken();
  const qs = new URLSearchParams({ supportsAllDrives: 'true', ...params });
  return fetch(`https://www.googleapis.com/drive/v3/${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
}


async function drive(path: string, params: Record<string, string>, extra: Record<string, string> = {}) {
  const token = await googleToken();
  const qs = new URLSearchParams({ supportsAllDrives: 'true', ...params });
  return fetch(`https://www.googleapis.com/drive/v3/${path}?${qs}`, { headers: { Authorization: `Bearer ${token}`, ...extra } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'range' } });
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? '';
    const miniatura = url.searchParams.get('modo') === 'miniatura';

    const sb = createClient(supabaseUrl, anonKey);
    const { data: pode, error } = await sb.rpc('black_midia_liberada', { p_file: id });
    if (error) return texto('Não consegui conferir o arquivo agora.', 500);
    if (!pode) return texto('Arquivo não liberado para a ficha da Black.', 403);

    const metaRes = await drive(`files/${id}`, { fields: 'id, name, mimeType, size, thumbnailLink' });
    const meta = await metaRes.json();
    if (!metaRes.ok) return texto(`O Drive não entregou o arquivo: ${meta.error?.message ?? metaRes.status}`, 502);
    if (meta.mimeType === FOLDER) return texto('Isso é uma pasta.', 400);

    if (miniatura) {
      if (!meta.thumbnailLink) return texto('Sem miniatura.', 404);
      const thumb = await fetch(String(meta.thumbnailLink).replace(/=s\d+$/, '=s800'), { headers: { Authorization: `Bearer ${await googleToken()}` } });
      if (!thumb.ok) return texto('Sem miniatura.', 404);
      return new Response(thumb.body, { headers: { ...cors, 'Content-Type': thumb.headers.get('Content-Type') ?? 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
    }

    if (String(meta.mimeType).startsWith('application/vnd.google-apps')) return texto('Documento do Google não abre direto.', 400);
    const range = req.headers.get('Range');
    const arq = await drive(`files/${id}`, { alt: 'media' }, range ? { Range: range } : {});
    if (!arq.ok && arq.status !== 206) return texto(`O Drive não entregou o arquivo (${arq.status}).`, 502);
    const headers: Record<string, string> = {
      ...cors,
      'Content-Type': meta.mimeType ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    };
    for (const h of ['Content-Range', 'Content-Length']) { const v = arq.headers.get(h); if (v) headers[h] = v; }
    return new Response(arq.body, { status: arq.status === 206 ? 206 : 200, headers });
  } catch (e) {
    return texto((e as Error).message, 500);
  }
});
