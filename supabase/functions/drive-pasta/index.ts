// Cardoso Marketing Hub — o que tem em cada pasta de Redes Sociais do Drive compartilhado.
//
// O Aldair organizou o material final das redes no Drive compartilhado CARDOSO, uma pasta por canal e formato:
//   <MARCA>/Redes Sociais/Instagram - Reels | Instagram - Post | Instagram - Carrossel | Instagram - Story |
//                         Youtube - Shorts | WhatsApp - Status | WhatsApp - Canais | Google Meu Negócio | Pinterest | Linkedin
// O Hub chama esta função ao abrir o seletor de criativo de uma peça e mostra os arquivos da pasta para ele só escolher,
// em vez de copiar e colar link. A leitura é feita pela conta de serviço hub-drive (Leitor no Drive compartilhado), com a
// chave no Secret GOOGLE_SERVICE_ACCOUNT_JSON. Só lê: não cria, não move, não apaga nada no Drive.
//
// Também abre a pasta de cada produto (Cardoso Black → Mídias): { produto: '0301' } procura a pasta "REF. 0301 - …"
// na pasta Produtos do Drive compartilhado e já abre em "04. Material Visual"; { produto, folderId } navega dentro dela.
//
// Segurança: só atende usuário logado no Hub, e só abre pastas que ficam dentro das três pastas de marca abaixo
// (Redes Sociais) ou dentro da pasta do produto pedido.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// pastas das marcas no Drive compartilhado CARDOSO
const RAIZ: Record<string, string> = {
  Cardoso: '1e6GgFTnFKyCLktQrNsIf-XzWnlZt2c1a',
  Playmi: '1S8DleQzyeKnfnDEYhwU9M9TCI_HIfT_w',
  'Tópi': '1_KXT5daIWw18x4D2b22q5DU6d2SwbNeG',
};
const REDES = 'redes sociais';
const FOLDER = 'application/vnd.google-apps.folder';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

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

type DriveFile = {
  id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string; createdTime?: string;
  thumbnailLink?: string; size?: string; imageMediaMetadata?: { width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
};

async function drive<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await googleToken();
  const qs = new URLSearchParams({ supportsAllDrives: 'true', ...params });
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  const out = await res.json();
  if (!res.ok) throw new Error(`Drive: ${out.error?.message ?? res.status}`);
  return out as T;
}

async function children(folderId: string, onlyFolders = false): Promise<DriveFile[]> {
  const all: DriveFile[] = [];
  let pageToken = '';
  do {
    const r = await drive<{ files: DriveFile[]; nextPageToken?: string }>('files', {
      q: `'${folderId}' in parents and trashed = false${onlyFolders ? ` and mimeType = '${FOLDER}'` : ''}`,
      includeItemsFromAllDrives: 'true', pageSize: '200', orderBy: 'folder,modifiedTime desc',
      fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime, createdTime, thumbnailLink, size, imageMediaMetadata(width, height), videoMediaMetadata(width, height, durationMillis))',
      ...(pageToken ? { pageToken } : {}),
    });
    all.push(...r.files);
    pageToken = r.nextPageToken ?? '';
  } while (pageToken && all.length < 1000);
  return all;
}

// sobe pelos pais até achar a pasta da marca; devolve o caminho a partir de "Redes Sociais"
async function insideBrand(folderId: string, rootId: string): Promise<string[] | null> {
  const path: string[] = [];
  let cur = folderId;
  for (let i = 0; i < 8; i++) {
    if (cur === rootId) return path.reverse();
    const f = await drive<DriveFile>(`files/${cur}`, { fields: 'id, name, parents' });
    path.push(f.name);
    if (!f.parents?.length) return null;
    cur = f.parents[0];
  }
  return null;
}

const itemDe = (f: DriveFile) => ({
  id: f.id, nome: f.name, tipo: f.mimeType === FOLDER ? 'pasta' : f.mimeType.startsWith('video/') ? 'video' : f.mimeType.startsWith('image/') ? 'imagem' : 'outro',
  mime: f.mimeType, alterado: f.modifiedTime ?? null, criado: f.createdTime ?? null,
  miniatura: f.thumbnailLink ? f.thumbnailLink.replace(/=s\d+$/, '=s400') : null,
  largura: f.imageMediaMetadata?.width ?? f.videoMediaMetadata?.width ?? null,
  altura: f.imageMediaMetadata?.height ?? f.videoMediaMetadata?.height ?? null,
  duracao: f.videoMediaMetadata?.durationMillis ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000) : null,
});

// ---------- pasta do produto: pasta "Produtos" do Drive compartilhado (uma pasta "REF. <código> - …" por produto) ----------
// As pastas de REF ficam todas direto nesta pasta; o Hub só aceita pastas que são filhas dela.
const PRODUTOS = '11Y4hP06QVavCZug_E-x7L01t6CM_WVyv';
const numRef = (s: string) => s.match(/ref\.?\s*0*(\d{2,6})/i)?.[1] ?? null;
let refsCache: { lista: DriveFile[]; exp: number } | null = null;

async function acharProduto(codigo: string): Promise<DriveFile | null> {
  const alvo = codigo.replace(/\D/g, '').replace(/^0+/, '');
  if (!alvo) return null;
  if (!refsCache || refsCache.exp < Date.now()) refsCache = { lista: await children(PRODUTOS, true), exp: Date.now() + 5 * 60_000 };
  const achados = refsCache.lista.filter((f) => numRef(f.name) === alvo);
  // se houver mais de uma, prefere a que começa com "REF"
  return achados.find((f) => /^\s*ref/i.test(f.name)) ?? achados[0] ?? null;
}

async function pastaDoProduto(codigo: string, folderId?: string) {
  const prod = await acharProduto(codigo);
  if (!prod) return json({ error: `Não achei a pasta "REF. ${codigo}" na pasta de Produtos do Drive.`, pastas: [] }, 404);
  const subs = (await children(prod.id, true)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const pastas = subs.map((f) => ({ id: f.id, nome: f.name }));
  let alvo: { id: string; nome: string; caminho: string[] };
  if (folderId) {
    const caminho = folderId === prod.id ? [] : await insideBrand(folderId, prod.id);
    if (!caminho) return json({ error: 'Essa pasta não fica dentro da pasta do produto.', pastas }, 403);
    alvo = { id: folderId, nome: caminho[caminho.length - 1] ?? prod.name, caminho: caminho.length ? caminho : [prod.name] };
  } else {
    const mv = subs.find((f) => /material visual/.test(norm(f.name)));
    alvo = mv ? { id: mv.id, nome: mv.name, caminho: [mv.name] } : { id: prod.id, nome: prod.name, caminho: [prod.name] };
  }
  const itens = (await children(alvo.id)).filter((f) => !/^(desktop\.ini|thumbs\.db|\.ds_store)$/i.test(f.name) && !f.name.startsWith('.')).map(itemDe);
  return json({ pastas, pasta: alvo, itens, produto: { id: prod.id, nome: prod.name } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // só usuário logado no Hub
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: 'Entre no Hub para ver as pastas do Drive.' }, 401);

    const { marca, pasta, folderId, arquivo, produto } = (await req.json()) as { marca?: string; pasta?: string; folderId?: string; arquivo?: string; produto?: string };
    if (produto) return await pastaDoProduto(String(produto), folderId);
    const rootId = marca ? RAIZ[marca] : undefined;
    if (!rootId) return json({ error: `Marca desconhecida: ${marca ?? '(vazia)'}` }, 400);

    const redes = (await children(rootId, true)).find((f) => norm(f.name) === REDES);
    if (!redes) return json({ error: `Não achei a pasta "Redes Sociais" dentro de ${marca} no Drive.`, pastas: [] }, 404);
    const canais = (await children(redes.id, true)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const pastas = canais.map((f) => ({ id: f.id, nome: f.name }));

    // o próprio arquivo (o vídeo, para escolher o quadro da capa no navegador); só de dentro de Redes Sociais da marca
    if (arquivo) {
      const f = await drive<DriveFile>(`files/${arquivo}`, { fields: 'id, name, mimeType, parents, size' });
      if (!f.parents?.length || !(await insideBrand(f.parents[0], redes.id))) return json({ error: 'Esse arquivo não fica dentro de Redes Sociais da marca.' }, 403);
      if (f.mimeType === FOLDER || f.mimeType.startsWith('application/vnd.google-apps')) return json({ error: 'Isso não é um arquivo de vídeo ou imagem.' }, 400);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${arquivo}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await googleToken()}` } });
      if (!res.ok) return json({ error: `O Drive não entregou o arquivo (${res.status}).` }, 502);
      return new Response(res.body, { headers: { ...cors, 'Content-Type': 'application/octet-stream', 'X-Mime': f.mimeType, 'Access-Control-Expose-Headers': 'X-Mime' } });
    }

    let alvo: { id: string; nome: string; caminho: string[] } | null = null;
    if (folderId) {
      const caminho = await insideBrand(folderId, redes.id);
      if (!caminho) return json({ error: 'Essa pasta não fica dentro de Redes Sociais da marca.', pastas }, 403);
      alvo = { id: folderId, nome: caminho[caminho.length - 1] ?? 'Redes Sociais', caminho };
    } else if (pasta) {
      const achou = canais.find((f) => norm(f.name) === norm(pasta));
      if (!achou) return json({ error: `Não achei a pasta "${pasta}" em ${marca}/Redes Sociais.`, pastas }, 404);
      alvo = { id: achou.id, nome: achou.name, caminho: [achou.name] };
    }
    if (!alvo) return json({ pastas, itens: [] });

    const itens = (await children(alvo.id)).map((f) => ({
      id: f.id, nome: f.name, tipo: f.mimeType === FOLDER ? 'pasta' : f.mimeType.startsWith('video/') ? 'video' : f.mimeType.startsWith('image/') ? 'imagem' : 'outro',
      mime: f.mimeType, alterado: f.modifiedTime ?? null, criado: f.createdTime ?? null,
      miniatura: f.thumbnailLink ? f.thumbnailLink.replace(/=s\d+$/, '=s400') : null,
      largura: f.imageMediaMetadata?.width ?? f.videoMediaMetadata?.width ?? null,
      altura: f.imageMediaMetadata?.height ?? f.videoMediaMetadata?.height ?? null,
      duracao: f.videoMediaMetadata?.durationMillis ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000) : null,
    }));
    return json({ pastas, pasta: alvo, itens });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
