import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/* Criativo do Drive dentro do Hub. A capa fica no lugar; ▶ abre uma tela própria de reprodução
 * (tela cheia no celular, janela centralizada no computador), porque o player do Drive precisa de
 * largura para os controles — espremido num quadro estreito ele corta o vídeo.
 * Arquivo → player do Drive (/preview). Pasta → grade de arquivos da pasta. */

export function driveTarget(url: string | null | undefined): { kind: 'file' | 'folder'; id: string } | null {
  if (!url) return null;
  const folder = url.match(/\/folders\/([\w-]{10,})/);
  if (folder) return { kind: 'folder', id: folder[1] };
  const file = url.match(/\/file\/d\/([\w-]{10,})/) ?? url.match(/[?&]id=([\w-]{10,})/) ?? url.match(/\/d\/([\w-]{10,})/);
  return file ? { kind: 'file', id: file[1] } : null;
}

function Lightbox({ url, kind, id, vertical, title, onClose }: {
  url: string; kind: 'file' | 'folder'; id: string; vertical: boolean; title?: string; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  const src = kind === 'file' ? `https://drive.google.com/file/d/${id}/preview` : `https://drive.google.com/embeddedfolderview?id=${id}#grid`;
  return createPortal(
    <div className="dp-lb" role="dialog" aria-label={title ?? 'Criativo'} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dp-lb-bar">
        <b>{title ?? (kind === 'file' ? 'Criativo' : 'Arquivos da pasta')}</b>
        <a href={url} target="_blank" rel="noreferrer">Abrir no Drive ↗</a>
        <button type="button" onClick={onClose} aria-label="Fechar">×</button>
      </div>
      <div className={`dp-lb-stage ${kind} ${vertical ? 'v' : 'q'}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <iframe src={src} title={title ?? 'Criativo no Drive'} allow="autoplay; fullscreen" allowFullScreen />
      </div>
    </div>,
    document.body,
  );
}

export function driveThumbOf(url: string | null | undefined, w = 1000) {
  const t = driveTarget(url);
  return t?.kind === 'file' ? `https://drive.google.com/thumbnail?id=${t.id}&sz=w${w}` : null;
}

export default function DrivePlayer({ url, vertical, poster, title, className = '', playLabel = 'Reproduzir', still = false }: {
  url: string | null | undefined;
  vertical: boolean;
  poster?: React.ReactNode;     // o que aparece atrás enquanto não há imagem (cartaz da marca etc.)
  title?: string;
  className?: string;
  playLabel?: string;
  still?: boolean;              // arte parada (feed/carrossel): sem o botão grande no meio; clicar amplia
}) {
  const tgt = driveTarget(url);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setOpen(false); setBroken(false); }, [url]);
  if (!tgt || !url) return <div className={`dp ${vertical ? 'v' : 'q'} ${className}`}>{poster}</div>;
  const thumb = tgt.kind === 'file' && !broken ? `https://drive.google.com/thumbnail?id=${tgt.id}&sz=w1000` : null;
  const lb = open && <Lightbox url={url} kind={tgt.kind} id={tgt.id} vertical={vertical} title={title} onClose={() => setOpen(false)} />;
  if (still && tgt.kind === 'file') {
    return (
      <div className={`dp still ${vertical ? 'v' : 'q'} ${className}`}>
        {poster}
        {thumb && <img src={thumb} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} onClick={() => setOpen(true)} />}
        <button type="button" className="dp-zoom" aria-label="Ampliar" title="Ampliar" onClick={() => setOpen(true)}>⤢</button>
        {lb}
      </div>
    );
  }
  return (
    <div className={`dp ${vertical ? 'v' : 'q'} ${className}`}>
      {poster}
      {thumb && <img src={thumb} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
      <button type="button" className={`dp-play ${tgt.kind}`} onClick={() => setOpen(true)}>
        {tgt.kind === 'file' ? <><span aria-hidden>▶</span>{playLabel}</> : <><span aria-hidden>▦</span>Ver arquivos</>}
      </button>
      {lb}
    </div>
  );
}

/* Criativo com lâminas (carrossel): passa de lâmina com as setas, os pontinhos ou arrastando o dedo,
 * como no Instagram. Com uma lâmina só, é o DrivePlayer normal. A lâmina aberta pode vir de fora
 * (index/onIndex), para a tira de miniaturas ao lado ficar em sincronia. */
export function CreativeMedia({ urls, vertical, poster, title, className = '', still = false, index, onIndex }: {
  urls: string[];
  vertical: boolean;
  poster?: React.ReactNode;
  title?: string;
  className?: string;
  still?: boolean;
  index?: number;
  onIndex?: (i: number) => void;
}) {
  const [own, setOwn] = useState(0);
  const [x0, setX0] = useState<number | null>(null);
  const n = urls.length;
  const i = Math.min(index ?? own, Math.max(0, n - 1));
  const setI = (v: number) => { setOwn(v); onIndex?.(v); };
  useEffect(() => { setOwn(0); }, [urls.join('|')]);
  if (n <= 1) return <DrivePlayer url={urls[0] ?? null} vertical={vertical} poster={poster} title={title} className={className} still={still} />;
  const go = (d: number) => setI(Math.min(n - 1, Math.max(0, i + d)));
  return (
    <div className={`dp-car ${still ? 'still' : ''} ${className}`}
      onTouchStart={(e) => setX0(e.touches[0].clientX)}
      onTouchEnd={(e) => { if (x0 !== null) { const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } setX0(null); }}>
      <DrivePlayer key={urls[i]} url={urls[i]} vertical={vertical} poster={poster} title={`${title ?? 'Carrossel'} · lâmina ${i + 1} de ${n}`} playLabel="Ampliar lâmina" still={still} />
      <span className="dp-car-n">{i + 1}/{n}</span>
      {i > 0 && <button type="button" className="dp-car-a l" aria-label="Lâmina anterior" onClick={() => go(-1)}>‹</button>}
      {i < n - 1 && <button type="button" className="dp-car-a r" aria-label="Próxima lâmina" onClick={() => go(1)}>›</button>}
      <span className="dp-car-dots" aria-hidden>{urls.map((u, k) => <i key={u + k} className={k === i ? 'on' : ''} />)}</span>
    </div>
  );
}
