import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/* Miniaturas das fotos (0109). A tela mostra a miniatura quando ela existe para aquele endereço
 * de foto original; senão cai na original. Gerar é feito no navegador, uma vez por foto. */

const BUCKET = 'product-images';
const MAX = 640;

let cache: Map<string, string> | null = null;
let pending: Promise<Map<string, string>> | null = null;
const listeners = new Set<() => void>();

async function loadThumbs(): Promise<Map<string, string>> {
  if (cache) return cache;
  if (!pending) {
    pending = (async () => {
      const m = new Map<string, string>();
      // a tabela pode não existir antes da 0109: sem miniatura, usa a original
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('media_thumbs').select('source_url, thumb_url').range(from, from + 999);
        if (error || !data) break;
        (data as { source_url: string; thumb_url: string }[]).forEach((r) => m.set(r.source_url, r.thumb_url));
        if (data.length < 1000) break;
      }
      cache = m;
      return m;
    })();
  }
  return pending;
}

function remember(source: string, thumb: string) {
  (cache ??= new Map()).set(source, thumb);
  listeners.forEach((fn) => fn());
}

/** Devolve a função que troca o endereço da original pelo da miniatura, quando houver. */
export function useThumbs() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    if (!cache) loadThumbs().then(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return (url: string | null | undefined) => (url ? cache?.get(url) ?? url : '');
}

export async function thumbStatus(urls: string[]) {
  const m = await loadThumbs();
  return urls.filter((u) => u && !m.has(u));
}

async function sha1(s: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function canvasBlob(c: HTMLCanvasElement, type: string, q: number) {
  return new Promise<Blob | null>((res) => c.toBlob(res, type, q));
}

/** Reduz para até 640 px no lado maior. O formato se confere nos bytes: o Safari pode
 *  devolver PNG quando se pede WebP, então nesse caso cai para JPEG. */
export async function makeThumb(src: Blob): Promise<{ blob: Blob; ext: 'webp' | 'jpg'; width: number }> {
  const bmp = await createImageBitmap(src);
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const webp = await canvasBlob(c, 'image/webp', 0.82);
  if (webp) {
    const head = new Uint8Array(await webp.slice(0, 12).arrayBuffer());
    const isWebp = String.fromCharCode(...head.slice(0, 4)) === 'RIFF' && String.fromCharCode(...head.slice(8, 12)) === 'WEBP';
    if (isWebp) return { blob: webp, ext: 'webp', width: w };
  }
  // JPEG não tem transparência: fundo branco antes de exportar
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const jpg = await canvasBlob(c, 'image/jpeg', 0.84);
  if (!jpg) throw new Error('O navegador não conseguiu gerar a miniatura.');
  return { blob: jpg, ext: 'jpg', width: w };
}

/** Gera e guarda a miniatura de uma foto já publicada. `file` evita baixar a original de novo. */
export async function ensureThumb(sourceUrl: string, file?: Blob): Promise<string> {
  const m = await loadThumbs();
  const have = m.get(sourceUrl);
  if (have) return have;
  let src = file;
  if (!src) {
    const r = await fetch(sourceUrl);
    if (!r.ok) throw new Error(`não abriu a foto (${r.status})`);
    src = await r.blob();
  }
  const { blob, ext, width } = await makeThumb(src);
  const path = `thumbs/${await sha1(sourceUrl)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg', cacheControl: '31536000', upsert: false,
  });
  // já existe no bucket (rodada anterior interrompida): reaproveita o arquivo
  if (upErr && !/exists|duplicate/i.test(upErr.message)) throw new Error(upErr.message);
  const thumbUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: dbErr } = await supabase.from('media_thumbs').upsert({ source_url: sourceUrl, thumb_url: thumbUrl, width, bytes: blob.size });
  if (dbErr) throw new Error(dbErr.message);
  remember(sourceUrl, thumbUrl);
  return thumbUrl;
}
