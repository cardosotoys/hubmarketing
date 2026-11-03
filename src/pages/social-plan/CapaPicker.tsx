import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import DrivePicker from './DrivePicker';
import { driveTarget } from './DrivePlayer';
import { capaThumb } from './shared';

/* Capa da peça no grid do perfil, como "Editar capa" do Instagram: um quadro do vídeo ou uma imagem.
 * O quadro é tirado aqui no navegador (o vídeo vem do Drive pela função drive-pasta) e vai para o Storage como
 * imagem pequena; a imagem do Drive fica só como link. O grid corta em 3:4, então a moldura mostra esse corte. */

type Marca = 'Cardoso' | 'Playmi' | 'Tópi';
const BUCKET = 'product-images';
const MAX = 800;   // lado maior da capa guardada: nítida no grid e leve para a cota do Supabase

async function baixarVideo(marca: Marca, id: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-pasta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ marca, arquivo: id }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(j?.error ?? `Não consegui trazer o vídeo (${res.status}).`);
  }
  const mime = res.headers.get('X-Mime') ?? '';
  if (mime && !mime.startsWith('video/')) throw new Error('O criativo desta peça não é um vídeo. Use "Imagem do Drive".');
  // .mov com H.264 toca no Chrome quando o blob se apresenta como mp4
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: 'video/mp4' }));
}

function quadro(v: HTMLVideoElement) {
  const scale = Math.min(1, MAX / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
  return new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('O navegador não gerou a imagem.'))), 'image/jpeg', 0.85));
}

export default function CapaPicker({ itemId, marca, pasta, video, atual, hints, onSaved, onClose }: {
  itemId: string;
  marca: Marca; pasta: string;
  video: string | null;            // link do vídeo no Drive (Reels/Shorts); sem vídeo só dá para escolher imagem
  atual: string | null;
  hints: { title?: string; product?: string; sku?: string; date?: string };
  onSaved: (msg: string) => void;
  onClose: () => void;
}) {
  const vid = video ? driveTarget(video) : null;
  const videoId = vid?.kind === 'file' ? vid.id : null;
  const [aba, setAba] = useState<'quadro' | 'drive'>(videoId ? 'quadro' : 'drive');
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (aba !== 'quadro' || !videoId || src) return;
    let vivo = true;
    baixarVideo(marca, videoId).then((u) => { if (vivo) setSrc(u); else URL.revokeObjectURL(u); }).catch((e: Error) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [aba, videoId, marca, src]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const gravar = async (cover_url: string | null, msg: string) => {
    const { error } = await supabase.from('social_plan_items').update({ cover_url }).eq('id', itemId);
    if (error) { setErro(/cover_url/.test(error.message) ? 'Falta rodar o SQL 0156 no Supabase.' : error.message); setSalvando(false); return; }
    onSaved(msg); onClose();
  };
  const usarQuadro = async () => {
    const v = ref.current; if (!v) return;
    setSalvando(true); setErro('');
    try {
      const blob = await quadro(v);
      const path = `capas/${itemId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (error) throw new Error(error.message);
      await gravar(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, 'capa escolhida no vídeo');
    } catch (e) { setErro((e as Error).message); setSalvando(false); }
  };

  if (aba === 'drive') {
    return <DrivePicker marca={marca} pasta={pasta} hints={hints} onClose={onClose}
      onPick={(urls) => { setSalvando(true); void gravar(urls[0], 'capa escolhida no Drive'); }} />;
  }

  const atualThumb = capaThumb(atual);
  return createPortal(
    <div className="dpk" role="dialog" aria-label="Escolher a capa" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dpk-box cpk">
        <header className="dpk-head">
          <div><small>Capa no grid do perfil</small><b>Escolha o quadro do vídeo</b></div>
          <button type="button" className="dpk-x" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="cpk-body">
          <div className="cpk-video">
            {src ? (
              <>
                <video ref={ref} src={src} muted playsInline preload="auto"
                  onLoadedMetadata={(e) => { setDur(e.currentTarget.duration || 0); e.currentTarget.currentTime = 0.1; }}
                  onError={() => setErro('O navegador não abriu este vídeo (formato HEVC/.mov?). Exporte uma capa e use "Imagem do Drive".')} />
                <span className="cpk-crop" aria-hidden />
              </>
            ) : <span className="cpk-load">{erro || 'Trazendo o vídeo do Drive…'}</span>}
          </div>
          <div className="cpk-side">
            <p className="cpk-hint">A parte clara é o que aparece no grid (3:4). Arraste para achar o quadro.</p>
            <input type="range" className="cpk-range" min={0} max={dur || 0} step={0.04} value={t} disabled={!dur}
              onChange={(e) => { const x = Number(e.target.value); setT(x); if (ref.current) ref.current.currentTime = x; }} />
            <span className="cpk-time">{t.toFixed(1)} s{dur ? ` de ${dur.toFixed(1)} s` : ''}</span>
            {atualThumb && <div className="cpk-atual"><span>Capa atual</span><img src={atualThumb} alt="" referrerPolicy="no-referrer" /></div>}
            {erro && src && <p className="cpk-erro">{erro}</p>}
            <div className="cpk-acts">
              <button type="button" className="dpk-ok" disabled={!dur || salvando} onClick={usarQuadro}>{salvando ? 'Salvando…' : 'Usar este quadro'}</button>
              <button type="button" className="sp-linkbtn" onClick={() => setAba('drive')}>Usar uma imagem do Drive</button>
              {atual && <button type="button" className="sp-linkbtn danger" onClick={() => { setSalvando(true); void gravar(null, 'capa removida'); }}>Tirar a capa</button>}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
