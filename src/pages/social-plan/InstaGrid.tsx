import { useState } from 'react';
import { brShort, driveThumb, slug } from './shared';

/* Grade do perfil do Instagram: 3 colunas, tiles 3:4, a mais nova primeiro (como no app),
 * ícone de Reels e de Carrossel no canto. A imagem é a prévia do criativo no Drive. */

export type GridTile = {
  id: string; date: string; time: string | null; account: string; kind: 'reels' | 'carrossel' | 'post';
  product: string; title: string; caption: string | null; creative: string | null; ready: boolean; status: string;
};

const ACCOUNTS: { a: string; label: string }[] = [{ a: 'Playmi', label: 'Playmi' }, { a: 'Tópi', label: 'Tópi' }, { a: 'Cardoso', label: 'Cardoso' }];

function Icon({ kind }: { kind: GridTile['kind'] }) {
  if (kind === 'post') return null;
  return (
    <span className="ig-ico" aria-label={kind === 'reels' ? 'Reels' : 'Carrossel'}>
      {kind === 'reels' ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2" /><path d="M10 8.5v7l6-3.5z" fill="#fff" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><rect x="7" y="3" width="14" height="14" rx="3" fill="none" stroke="#fff" strokeWidth="2" /><path d="M4 7v11a3 3 0 0 0 3 3h11" fill="none" stroke="#fff" strokeWidth="2" /></svg>
      )}
    </span>
  );
}

function Tile({ t, onOpen }: { t: GridTile; onOpen?: (id: string) => void }) {
  const img = driveThumb(t.creative);
  const [broken, setBroken] = useState(false);
  return (
    <button type="button" className={`ig-tile b-${slug(t.account)} ${t.ready ? '' : 'pending'}`} onClick={() => onOpen?.(t.id)}
      title={`${brShort(t.date)}${t.time ? ' ' + t.time : ''} · ${t.title}`}>
      {img && !broken
        ? <img src={img} alt={t.product} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span className="ig-ph"><b>{t.product || t.title}</b><small>{t.creative ? 'criativo no Drive' : 'sem criativo ainda'}</small></span>}
      <Icon kind={t.kind} />
      <span className="ig-date">{brShort(t.date)}</span>
      {!t.ready && <span className="ig-flag">{t.status}</span>}
    </button>
  );
}

export default function InstaGrid({ tiles, onOpen, readyToggle = true, note }: {
  tiles: GridTile[]; onOpen?: (id: string) => void; readyToggle?: boolean; note?: string;
}) {
  const [acc, setAcc] = useState('Playmi');
  const [soPronto, setSoPronto] = useState(false);
  const [limit, setLimit] = useState(30);
  const mine = tiles.filter((t) => t.account === acc && (!soPronto || t.ready))
    .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
  const shown = mine.slice(0, limit);
  return (
    <div className="ig-wrap">
      <div className="ig-bar">
        <div className="sp-gates" role="tablist">
          {ACCOUNTS.map((x) => (
            <button key={x.a} role="tab" aria-selected={acc === x.a} onClick={() => { setAcc(x.a); setLimit(30); }}>
              {x.label} <b>{tiles.filter((t) => t.account === x.a && (!soPronto || t.ready)).length}</b>
            </button>
          ))}
        </div>
        {readyToggle && <label className="sp-check" style={{ margin: 0 }}><input id="ig-ready" type="checkbox" checked={soPronto} onChange={(e) => setSoPronto(e.target.checked)} /> Só o que está pronto</label>}
      </div>
      <div className="ig-phone">
        <div className="ig-profile">
          <span className={`ig-avatar b-${slug(acc)}`}>{acc[0]}</span>
          <div className="ig-stats">
            <b>{acc}</b>
            <span><b>{mine.length}</b> publicações no plano</span>
          </div>
        </div>
        <div className="ig-tabs"><span className="on">▦</span><span>▷</span></div>
        {shown.length ? (
          <div className="ig-grid">{shown.map((t) => <Tile key={t.id} t={t} onOpen={onOpen} />)}</div>
        ) : <p className="ig-empty">{soPronto ? 'Nada pronto ainda nesta conta.' : 'Nenhuma publicação de feed nesta conta.'}</p>}
        {mine.length > limit && <button className="sp-ebtn ig-more" onClick={() => setLimit((l) => l + 30)}>Ver mais publicações</button>}
      </div>
      <p className="sp-calhint">{note ?? 'A ordem é a do Instagram: a publicação mais nova fica no canto de cima. A imagem vem do link do criativo no Drive; sem link, aparece o nome do produto.'}</p>
    </div>
  );
}
