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

export default function DrivePlayer({ url, vertical, poster, title, className = '' }: {
  url: string | null | undefined;
  vertical: boolean;
  poster?: React.ReactNode;     // o que aparece atrás enquanto não há imagem (cartaz da marca etc.)
  title?: string;
  className?: string;
}) {
  const tgt = driveTarget(url);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setOpen(false); setBroken(false); }, [url]);
  if (!tgt || !url) return <div className={`dp ${vertical ? 'v' : 'q'} ${className}`}>{poster}</div>;
  const thumb = tgt.kind === 'file' && !broken ? `https://drive.google.com/thumbnail?id=${tgt.id}&sz=w1000` : null;
  return (
    <div className={`dp ${vertical ? 'v' : 'q'} ${className}`}>
      {poster}
      {thumb && <img src={thumb} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
      <button type="button" className={`dp-play ${tgt.kind}`} onClick={() => setOpen(true)}>
        {tgt.kind === 'file' ? <><span aria-hidden>▶</span>Reproduzir</> : <><span aria-hidden>▦</span>Ver arquivos</>}
      </button>
      {open && <Lightbox url={url} kind={tgt.kind} id={tgt.id} vertical={vertical} title={title} onClose={() => setOpen(false)} />}
    </div>
  );
}
