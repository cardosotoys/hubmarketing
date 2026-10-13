import { useState } from 'react';
import type { CommercialBanner } from '../../types/database';
import { BannerArt } from './ComercialView';
import NetworkPreview from './NetworkPreview';
import { addDays, addMonths, brShort, dowIndex, driveThumb, monthName, parseYmd, slug, type PreviewItem } from './shared';

/* O cenário final, igual para o link sem login e para a prévia dentro do Hub.
 * Recebe só o que a função final_view (0112) devolve: nada de andamento, ajuste ou comentário. */

export type FinalPiece = {
  id: string; date: string; time: string | null; brand: string; account: string; channel: string; network: string;
  format: string; mirror_facebook: boolean; kind: string; title: string; product: string;
  caption: string | null; creative: string | null; stage: string;
  grid?: 'reels' | 'carrossel' | 'post';   // como aparece no grid do Instagram
};
export type FinalMaterial = {
  id: string; kind: 'foto' | 'video' | 'kit' | 'documento'; name: string; drive_url: string;
  product_code: string | null; product_name: string | null; subject: string; brand: string; image: string;
};
export type FinalData = {
  ok: boolean; label?: string; today: string; from: string; to: string;
  pieces: FinalPiece[]; banners: (Pick<CommercialBanner, 'id' | 'seal' | 'title' | 'subtitle' | 'cta' | 'starts_on' | 'ends_on' | 'art_url'>)[];
  materials: FinalMaterial[];
};

const KIND: Record<FinalMaterial['kind'], string> = { foto: 'Fotos', video: 'Vídeos', kit: 'Kits', documento: 'Documentos' };
const stageLabel = (s: string) => (s === 'publicado' ? 'Publicada' : s === 'agendado' ? 'Agendada' : 'Aprovada');
const vertical = (p: FinalPiece) => /Stories|Reels|Shorts|Vídeo|TikTok|Status/.test(`${p.format} ${p.channel}`);

export default function FinalBoard({ data, month, onMonth }: { data: FinalData; month: string; onMonth: (ym: string) => void }) {
  const [sec, setSec] = useState<'redes' | 'cal' | 'comercial'>('redes');
  return (
    <div className="sp-final">
      <div className="sp-final-bar">
        <div className="sp-gates" role="tablist">
          <button role="tab" aria-selected={sec === 'redes'} onClick={() => setSec('redes')}>Redes sociais</button>
          <button role="tab" aria-selected={sec === 'cal'} onClick={() => setSec('cal')}>Calendário</button>
          <button role="tab" aria-selected={sec === 'comercial'} onClick={() => setSec('comercial')}>Área comercial</button>
        </div>
        {sec === 'cal' && (
          <div className="sp-calnav">
            <button className="sp-ebtn" onClick={() => onMonth(addMonths(month, -1))}>‹</button>
            <b className="sp-final-month">{monthName(month)}</b>
            <button className="sp-ebtn" onClick={() => onMonth(addMonths(month, 1))}>›</button>
          </div>
        )}
      </div>
      {sec === 'redes' && <Redes pieces={data.pieces} />}
      {sec === 'cal' && <Mes pieces={data.pieces} month={month} today={data.today} />}
      {sec === 'comercial' && <Comercial data={data} />}
    </div>
  );
}

function Tile({ p }: { p: FinalPiece }) {
  const img = driveThumb(p.creative);
  return (
    <div className="sp-ft">
      <div className={`sp-ft-art ${vertical(p) ? 'v' : 'q'}`}>
        {img && <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
        <span className="lab">{p.channel}{p.format ? ` · ${p.format}` : ''}{p.mirror_facebook ? ' + Facebook' : ''}</span>
        <span className="pn">{p.product || p.title}</span>
      </div>
      <div className="sp-ft-b">
        <span className="sp-ft-when">{brShort(p.date)}{p.time ? ` · ${p.time}` : ''} · {stageLabel(p.stage)}</span>
        {p.caption && <span className="sp-ft-c">{p.caption.length > 160 ? `${p.caption.slice(0, 160)}…` : p.caption}</span>}
        {p.creative && <a className="sp-linkbtn" href={p.creative} target="_blank" rel="noreferrer">Ver o criativo ↗</a>}
      </div>
    </div>
  );
}

function Redes({ pieces }: { pieces: FinalPiece[] }) {
  const items: PreviewItem[] = pieces.map((p) => ({
    id: p.id, date: p.date, time: p.time, brand: p.brand, account: p.account, channel: p.channel, network: p.network,
    format: p.format, mirror: p.mirror_facebook, product: p.product, title: p.title, caption: p.caption, creative: p.creative,
    cta: '', ready: true, status: stageLabel(p.stage), grid: p.grid ?? (p.format === 'Reels' ? 'reels' : 'post'),
  }));
  return <NetworkPreview items={items} readyToggle={false} />;
}

function Mes({ pieces, month, today }: { pieces: FinalPiece[]; month: string; today: string }) {
  const [sel, setSel] = useState<FinalPiece | null>(null);
  const first = `${month}-01`;
  const start = addDays(first, -dowIndex(first));
  const [Y, M] = month.split('-').map(Number);
  const total = Math.ceil((dowIndex(first) + new Date(Y, M, 0).getDate()) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => addDays(start, i));
  return (
    <div className="sp-month" style={{ marginTop: 12 }}>
      <div className="sp-dow">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="sp-grid">
        {cells.map((iso) => {
          const out = !iso.startsWith(month);
          const its = out ? [] : pieces.filter((p) => p.date === iso);
          return (
            <div key={iso} className={`sp-day ${out ? 'out' : ''} ${its.length ? '' : 'empty'} ${iso === today ? 'today' : ''}`}>
              <div className="sp-dnum"><b>{parseYmd(iso).getDate()}</b>{its.length ? <span>{its.length}</span> : null}</div>
              {its.map((p) => (
                <button type="button" key={p.id} className={`sp-pill b-${slug(p.brand)}`} onClick={() => setSel(p)}>
                  <div className="row"><span className="sp-time">{p.time || '—'}</span><b>{p.product || p.title}</b></div>
                  <i>{p.channel}{p.format ? ` ${p.format}` : ''}</i>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {sel && (
        <div className="sp-sheet on" onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          <div className="sp-panel">
            <button className="close" aria-label="Fechar" onClick={() => setSel(null)}>×</button>
            <h3 className="sp-panel-h3">{sel.title}</h3>
            <Tile p={sel} />
            {sel.caption && <div className="sp-caption" style={{ marginTop: 12 }}>{sel.caption}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Comercial({ data }: { data: FinalData }) {
  const [quando, setQuando] = useState(data.today);
  const [bi, setBi] = useState(0);
  const datas = [...new Set([data.today, ...data.banners.map((b) => b.starts_on).filter((d) => d > data.today)])].sort().slice(0, 5);
  const bs = data.banners.filter((b) => b.starts_on <= quando && b.ends_on >= quando);
  const cur = bs[Math.min(bi, Math.max(0, bs.length - 1))];
  const groups = new Map<string, FinalMaterial[]>();
  data.materials.forEach((m) => { const k = m.product_code ?? `s:${m.subject}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(m); });
  return (
    <>
      <div className="sp-frow" style={{ margin: '12px 0', alignItems: 'center' }}>
        <span className="sp-flabel">Ver como estará em</span>
        <div className="sp-chips">
          {datas.map((d) => <button key={d} className="sp-chip" aria-pressed={quando === d} onClick={() => { setQuando(d); setBi(0); }}>{d === data.today ? 'Hoje' : brShort(d)}</button>)}
        </div>
      </div>
      <div className="sp-portal">
        <div className="sp-pt-top"><b>Cardoso</b><span>Área comercial · Conteúdos</span></div>
        {cur ? (
          <div className="sp-pt-hero">
            <BannerArt b={cur} big />
            {bs.length > 1 && <div className="sp-pt-dots">{bs.map((b, i) => <button key={b.id} aria-label={`Banner ${i + 1}`} aria-pressed={b.id === cur.id} onClick={() => setBi(i)} />)}</div>}
          </div>
        ) : <div className="sp-pt-empty">Nenhum banner no ar em {brShort(quando)}.</div>}
        <h4 className="sp-sech" style={{ margin: '4px 0 0' }}>Conteúdos</h4>
        {groups.size ? (
          <div className="sp-pt-grid">
            {[...groups.entries()].map(([k, ms]) => (
              <div className="sp-pt-card" key={k}>
                <div className="sp-pt-img">{ms[0].image ? <img loading="lazy" decoding="async" src={ms[0].image} alt="" /> : <span>{ms[0].brand}</span>}</div>
                <div className="sp-pt-b">
                  <span className="sp-pt-ref">{ms[0].product_code ? `REF ${ms[0].product_code}` : 'Campanha'}</span>
                  <b>{ms[0].product_name ?? ms[0].subject}</b>
                  <span className="sp-pt-f">{[...new Set(ms.map((m) => KIND[m.kind]))].join(' · ')}</span>
                  <span className="sp-pt-links">{ms.map((m) => <a key={m.id} className="sp-linkbtn" href={m.drive_url} target="_blank" rel="noreferrer">{m.name}</a>)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="sp-pt-empty">Nenhum material liberado ainda.</div>}
      </div>
    </>
  );
}
