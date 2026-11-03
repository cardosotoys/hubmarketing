import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import DrivePicker from './DrivePicker';
import { driveTarget } from './DrivePlayer';
import { capaThumb } from './shared';

/* Capa da peça no grid do perfil, como "Editar capa" do Instagram: um quadro do vídeo ou uma imagem,
 * e a altura do corte 3:4 (nem sempre o que importa está no centro). O quadro é tirado aqui no navegador
 * (o vídeo vem do Drive pela função drive-pasta) e vai para o Storage como imagem pequena; a imagem do Drive
 * fica só como link. A altura do corte vale para todas as miniaturas (calendário, mural, grid). */

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

/* A mídia inteira com a janela 3:4 por cima; arrastar a janela sobe e desce o corte.
 * y é o mesmo número do object-position: 0 = topo, 100 = base. */
function Corte({ ratio, y, onY, children }: { ratio: number; y: number; onY: (y: number) => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const frameH = Math.min(100, (4 / 3) * ratio * 100);   // altura da janela em % da mídia
  const livre = 100 - frameH;
  const arrastar = (e: React.PointerEvent) => {
    if (livre <= 0 || !box.current) return;
    const el = box.current;
    const h = el.getBoundingClientRect().height;
    const y0 = e.clientY; const v0 = y;
    el.setPointerCapture(e.pointerId);
    const mover = (ev: PointerEvent) => onY(Math.max(0, Math.min(100, Math.round(v0 + ((ev.clientY - y0) / h) * 100 / livre * 100))));
    const soltar = () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); };
    el.addEventListener('pointermove', mover); el.addEventListener('pointerup', soltar);
  };
  return (
    <div ref={box} className="cpk-media" style={{ aspectRatio: String(ratio) }} onPointerDown={arrastar}>
      {children}
      <span className="cpk-crop" style={{ height: `${frameH}%`, top: `${(livre * y) / 100}%` }} aria-hidden>
        {livre > 0 && <i>↕</i>}
      </span>
    </div>
  );
}

export default function CapaPicker({ itemId, marca, pasta, video, atual, atualY, hints, onSaved, onClose }: {
  itemId: string;
  marca: Marca; pasta: string;
  video: string | null;            // link do vídeo no Drive (Reels/Shorts); sem vídeo só dá para escolher imagem
  atual: string | null;            // capa já escolhida
  atualY: number | null;
  hints: { title?: string; product?: string; sku?: string; date?: string };
  onSaved: (msg: string) => void;
  onClose: () => void;
}) {
  const vid = video ? driveTarget(video) : null;
  const videoId = vid?.kind === 'file' ? vid.id : null;
  // quadro: escolhe no vídeo; drive: lista do Drive; imagem: ajusta o corte de uma imagem (a atual ou a recém-escolhida)
  const [aba, setAba] = useState<'quadro' | 'drive' | 'imagem'>(videoId ? 'quadro' : atual ? 'imagem' : 'drive');
  const [imagem, setImagem] = useState<string | null>(atual);
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const [y, setY] = useState(atualY ?? 50);
  const [ratio, setRatio] = useState(9 / 16);
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
    const { error } = await supabase.from('social_plan_items').update({ cover_url, cover_y: cover_url ? y : 50 }).eq('id', itemId);
    if (error) { setErro(/cover_/.test(error.message) ? 'Falta rodar o SQL 0156 no Supabase.' : error.message); setSalvando(false); return; }
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
      onPick={(urls) => { setImagem(urls[0]); setY(50); setRatio(4 / 5); setAba('imagem'); }} />;
  }

  const thumb = capaThumb(imagem);
  return createPortal(
    <div className="dpk" role="dialog" aria-label="Escolher a capa" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dpk-box cpk">
        <header className="dpk-head">
          <div><small>Capa no grid do perfil</small><b>{aba === 'quadro' ? 'Escolha o quadro e a altura do corte' : 'Ajuste a altura do corte'}</b></div>
          <button type="button" className="dpk-x" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="cpk-body">
          <div className="cpk-video">
            {aba === 'quadro' ? (src ? (
              <Corte ratio={ratio} y={y} onY={setY}>
                <video ref={ref} src={src} muted playsInline preload="auto"
                  onLoadedMetadata={(e) => { const v = e.currentTarget; setDur(v.duration || 0); if (v.videoWidth) setRatio(v.videoWidth / v.videoHeight); v.currentTime = 0.1; }}
                  onError={() => setErro('O navegador não abriu este vídeo (formato HEVC/.mov?). Exporte uma capa e use "Imagem do Drive".')} />
              </Corte>
            ) : <span className="cpk-load">{erro || 'Trazendo o vídeo do Drive…'}</span>)
            : thumb ? (
              <Corte ratio={ratio} y={y} onY={setY}>
                <img src={thumb} alt="" referrerPolicy="no-referrer" draggable={false}
                  onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setRatio(i.naturalWidth / i.naturalHeight); }} />
              </Corte>
            ) : <span className="cpk-load">Sem imagem.</span>}
          </div>
          <div className="cpk-side">
            <p className="cpk-hint">A janela clara é o que aparece no grid (3:4). Arraste a janela para cima ou para baixo.</p>
            {aba === 'quadro' && (
              <>
                <label className="cpk-lbl">Quadro do vídeo
                  <input type="range" className="cpk-range" min={0} max={dur || 0} step={0.04} value={t} disabled={!dur}
                    onChange={(e) => { const x = Number(e.target.value); setT(x); if (ref.current) ref.current.currentTime = x; }} />
                </label>
                <span className="cpk-time">{t.toFixed(1)} s{dur ? ` de ${dur.toFixed(1)} s` : ''}</span>
              </>
            )}
            <label className="cpk-lbl">Altura do corte
              <input type="range" className="cpk-range" min={0} max={100} step={1} value={y} onChange={(e) => setY(Number(e.target.value))} />
            </label>
            {aba === 'imagem' && thumb && (
              <div className="cpk-prev"><span>No grid</span>
                <div className="cpk-tile"><img src={thumb} alt="" referrerPolicy="no-referrer" style={{ objectPosition: `50% ${y}%` }} /></div>
              </div>
            )}
            {erro && (src || aba !== 'quadro') && <p className="cpk-erro">{erro}</p>}
            <div className="cpk-acts">
              {aba === 'quadro'
                ? <button type="button" className="dpk-ok" disabled={!dur || salvando} onClick={usarQuadro}>{salvando ? 'Salvando…' : 'Usar este quadro'}</button>
                : <button type="button" className="dpk-ok" disabled={!imagem || salvando} onClick={() => { setSalvando(true); void gravar(imagem, 'capa salva'); }}>{salvando ? 'Salvando…' : 'Salvar a capa'}</button>}
              <button type="button" className="sp-linkbtn" onClick={() => setAba('drive')}>Usar uma imagem do Drive</button>
              {aba === 'imagem' && videoId && <button type="button" className="sp-linkbtn" onClick={() => setAba('quadro')}>Escolher no vídeo</button>}
              {aba === 'quadro' && atual && <button type="button" className="sp-linkbtn" onClick={() => { setImagem(atual); setY(atualY ?? 50); setAba('imagem'); }}>Só ajustar a capa atual</button>}
              {atual && <button type="button" className="sp-linkbtn danger" onClick={() => { setSalvando(true); void gravar(null, 'capa removida'); }}>Tirar a capa</button>}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
