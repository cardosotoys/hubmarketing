import { useEffect, useState } from 'react';

/* Toca o criativo do Drive dentro do Hub (player do próprio Drive, embutido).
 * Arquivo → capa + ▶ Reproduzir → vídeo/imagem no lugar. Pasta → grade de arquivos da pasta.
 * Funciona para quem tem acesso ao arquivo no Drive (ou se ele estiver "qualquer pessoa com o link"). */

export function driveTarget(url: string | null | undefined): { kind: 'file' | 'folder'; id: string } | null {
  if (!url) return null;
  const folder = url.match(/\/folders\/([\w-]{10,})/);
  if (folder) return { kind: 'folder', id: folder[1] };
  const file = url.match(/\/file\/d\/([\w-]{10,})/) ?? url.match(/[?&]id=([\w-]{10,})/) ?? url.match(/\/d\/([\w-]{10,})/);
  return file ? { kind: 'file', id: file[1] } : null;
}

export default function DrivePlayer({ url, vertical, poster, autoOpen = false, className = '' }: {
  url: string | null | undefined;
  vertical: boolean;
  poster?: React.ReactNode;     // o que aparece atrás enquanto não toca (cartaz da marca etc.)
  autoOpen?: boolean;
  className?: string;
}) {
  const tgt = driveTarget(url);
  const [open, setOpen] = useState(autoOpen);
  const [broken, setBroken] = useState(false);
  // trocou de peça: volta para a capa
  useEffect(() => { setOpen(autoOpen); setBroken(false); }, [url, autoOpen]);
  if (!tgt) return <div className={`dp ${vertical ? 'v' : 'q'} ${className}`}>{poster}</div>;

  if (open) {
    const src = tgt.kind === 'file'
      ? `https://drive.google.com/file/d/${tgt.id}/preview`
      : `https://drive.google.com/embeddedfolderview?id=${tgt.id}#grid`;
    return (
      <div className={`dp on ${tgt.kind} ${vertical ? 'v' : 'q'} ${className}`}>
        <iframe src={src} title="Criativo no Drive" allow="autoplay; fullscreen" allowFullScreen />
        <button type="button" className="dp-x" onClick={() => setOpen(false)} aria-label="Fechar o player">×</button>
      </div>
    );
  }
  const thumb = tgt.kind === 'file' && !broken ? `https://drive.google.com/thumbnail?id=${tgt.id}&sz=w1000` : null;
  return (
    <div className={`dp ${vertical ? 'v' : 'q'} ${className}`}>
      {poster}
      {thumb && <img src={thumb} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
      <button type="button" className={`dp-play ${tgt.kind}`} onClick={() => setOpen(true)}>
        {tgt.kind === 'file' ? <><span aria-hidden>▶</span>Reproduzir aqui</> : <><span aria-hidden>▦</span>Ver arquivos da pasta</>}
      </button>
    </div>
  );
}
