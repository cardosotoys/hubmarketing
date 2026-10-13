import { useState } from 'react';
import InstaGrid from './InstaGrid';
import { brShort, driveThumb, slug, type PreviewItem } from './shared';

/* Prévia por rede: cada canal com a cara dele. Instagram = grid do perfil; as outras redes,
 * no formato em que o conteúdo realmente aparece (linha do tempo, canal, mural, conversa…). */

type Net = { k: string; label: string; match: (p: PreviewItem) => boolean };
const NETS: Net[] = [
  { k: 'ig', label: 'Instagram', match: (p) => p.network === 'Instagram' && p.format !== 'Stories' },
  { k: 'st', label: 'Stories', match: (p) => p.network === 'Instagram' && p.format === 'Stories' },
  { k: 'fb', label: 'Facebook', match: (p) => p.network === 'Facebook' || (p.network === 'Instagram' && p.mirror) },
  { k: 'li', label: 'LinkedIn', match: (p) => p.network === 'LinkedIn' },
  { k: 'yt', label: 'YouTube', match: (p) => p.network === 'YouTube Shorts' },
  { k: 'pin', label: 'Pinterest', match: (p) => p.network === 'Pinterest' },
  { k: 'tt', label: 'TikTok', match: (p) => p.network === 'TikTok' },
  { k: 'was', label: 'WhatsApp Status', match: (p) => p.network === 'WhatsApp' && /Status/.test(p.channel) },
  { k: 'wac', label: 'WhatsApp Canais', match: (p) => p.network === 'WhatsApp' && !/Status/.test(p.channel) },
  { k: 'gmn', label: 'Google Meu Negócio', match: (p) => p.network === 'Google Meu Negócio' },
];
const newest = (a: PreviewItem, b: PreviewItem) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''));
const oldest = (a: PreviewItem, b: PreviewItem) => -newest(a, b);

function Art({ p, ratio, className = '' }: { p: PreviewItem; ratio: string; className?: string }) {
  const img = driveThumb(p.creative);
  const [broken, setBroken] = useState(false);
  return (
    <div className={`np-art ${className}`} style={{ aspectRatio: ratio }}>
      {img && !broken
        ? <img src={img} alt={p.product} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span className="np-ph"><b>{p.product || p.title}</b><small>{p.creative ? 'criativo no Drive' : 'sem criativo ainda'}</small></span>}
    </div>
  );
}
const Avatar = ({ a }: { a: string }) => <span className={`ig-avatar sm b-${slug(a)}`}>{a[0]}</span>;
const When = ({ p }: { p: PreviewItem }) => <>{brShort(p.date)}{p.time ? ` · ${p.time}` : ''}</>;
const Flag = ({ p }: { p: PreviewItem }) => (p.ready ? null : <span className="np-flag">{p.status}</span>);
function Caption({ text, lines = 3 }: { text: string | null; lines?: number }) {
  const [open, setOpen] = useState(false);
  if (!text) return <p className="np-cap empty">Sem legenda ainda.</p>;
  return (
    <p className={`np-cap ${open ? 'open' : ''}`} style={{ WebkitLineClamp: open ? 'unset' : lines }} onClick={() => setOpen((v) => !v)}>{text}</p>
  );
}

export default function NetworkPreview({ items, onOpen, readyToggle = true, initialNet = 'ig' }: {
  items: PreviewItem[]; onOpen?: (id: string) => void; readyToggle?: boolean; initialNet?: string;
}) {
  const [net, setNet] = useState(initialNet);
  const [soPronto, setSoPronto] = useState(false);
  const base = items.filter((p) => !soPronto || p.ready);
  const cur = NETS.find((n) => n.k === net)!;
  const list = base.filter(cur.match);
  const open = (id: string) => onOpen?.(id);
  return (
    <div className="np">
      <div className="np-bar">
        <div className="np-nets" role="tablist">
          {NETS.map((n) => {
            const c = base.filter(n.match).length;
            return <button key={n.k} role="tab" aria-selected={net === n.k} onClick={() => setNet(n.k)}>{n.label}<b>{c}</b></button>;
          })}
        </div>
        {readyToggle && <label className="sp-check" style={{ margin: 0 }}><input id="np-ready" type="checkbox" checked={soPronto} onChange={(e) => setSoPronto(e.target.checked)} /> Só o que está pronto</label>}
      </div>
      {net === 'ig' && <InstaGrid tiles={list.map((p) => ({ ...p, kind: p.grid }))} onOpen={onOpen} readyToggle={false} />}
      {net === 'st' && <Stories list={list} onOpen={open} />}
      {net === 'fb' && <Timeline list={list} onOpen={open} kind="fb" />}
      {net === 'li' && <Timeline list={list} onOpen={open} kind="li" />}
      {net === 'yt' && <YouTube list={list} onOpen={open} />}
      {net === 'pin' && <Pinterest list={list} onOpen={open} />}
      {net === 'tt' && <TikTok list={list} onOpen={open} />}
      {net === 'was' && <Status list={list} onOpen={open} />}
      {net === 'wac' && <Canais list={list} onOpen={open} />}
      {net === 'gmn' && <Gmn list={list} onOpen={open} />}
    </div>
  );
}

type V = { list: PreviewItem[]; onOpen: (id: string) => void };
const Empty = ({ what }: { what: string }) => <p className="ig-empty">Nada planejado em {what}.</p>;

function Stories({ list, onOpen }: V) {
  const [acc, setAcc] = useState('Playmi');
  const mine = list.filter((p) => p.account === acc).sort(oldest);
  return (
    <div className="np-col">
      <AccountChips list={list} acc={acc} setAcc={setAcc} />
      {mine.length ? <div className="np-stories">{mine.map((p) => (
        <button key={p.id} className="np-story" onClick={() => onOpen(p.id)}>
          <span className="np-story-bar"><i /></span>
          <span className="np-story-head"><Avatar a={p.account} /><b>{p.account}</b><small><When p={p} /></small></span>
          <Art p={p} ratio="9 / 16" /><Flag p={p} />
        </button>))}</div> : <Empty what="Stories" />}
    </div>
  );
}

function Timeline({ list, onOpen, kind }: V & { kind: 'fb' | 'li' }) {
  const [acc, setAcc] = useState(kind === 'li' ? 'Cardoso' : 'Playmi');
  const mine = (kind === 'li' ? list : list.filter((p) => p.account === acc)).sort(newest);
  return (
    <div className="np-col">
      {kind === 'fb' && <AccountChips list={list} acc={acc} setAcc={setAcc} />}
      <div className={`np-feed ${kind}`}>
        {mine.length ? mine.map((p) => (
          <article key={p.id} className="np-post" onClick={() => onOpen(p.id)}>
            <header><Avatar a={p.account} /><div><b>{p.account}</b><small><When p={p} />{kind === 'fb' ? ' · Público' : ' · Página'}</small></div><Flag p={p} /></header>
            <Caption text={p.caption} lines={kind === 'li' ? 3 : 4} />
            <Art p={p} ratio={kind === 'li' ? '1 / 1' : '4 / 5'} />
            <footer>{kind === 'li' ? <><span>Gostei</span><span>Comentar</span><span>Compartilhar</span><span>Enviar</span></> : <><span>Curtir</span><span>Comentar</span><span>Compartilhar</span></>}</footer>
          </article>
        )) : <Empty what={kind === 'li' ? 'LinkedIn' : 'Facebook'} />}
      </div>
    </div>
  );
}

function YouTube({ list, onOpen }: V) {
  const [pl, setPl] = useState('Playmi');
  const mine = list.filter((p) => p.channel.includes(pl)).sort(newest);
  return (
    <div className="np-col wide">
      <div className="np-yt-head"><Avatar a="Cardoso" /><div><b>Cardoso</b><small>Playlists: Playmi e Tópi</small></div></div>
      <div className="sp-gates" role="tablist">{['Playmi', 'Tópi'].map((x) => <button key={x} role="tab" aria-selected={pl === x} onClick={() => setPl(x)}>Playlist {x} <b>{list.filter((p) => p.channel.includes(x)).length}</b></button>)}</div>
      {mine.length ? <div className="np-yt">{mine.map((p) => (
        <button key={p.id} className={`np-yt-item ${p.format === 'Vídeo' ? 'video' : 'short'}`} onClick={() => onOpen(p.id)}>
          <Art p={p} ratio={p.format === 'Vídeo' ? '16 / 9' : '9 / 16'} /><Flag p={p} />
          <b>{p.title}</b><small><When p={p} /> · {p.format || 'Shorts'}</small>
        </button>))}</div> : <Empty what={`a playlist ${pl}`} />}
    </div>
  );
}

function Pinterest({ list, onOpen }: V) {
  const mine = [...list].sort(newest);
  return mine.length ? (
    <div className="np-pins">{mine.map((p, i) => (
      <button key={p.id} className="np-pin" onClick={() => onOpen(p.id)}>
        <Art p={p} ratio={i % 3 === 1 ? '1 / 1' : '2 / 3'} /><Flag p={p} />
        <b>{p.title}</b><small><When p={p} /></small>
      </button>))}</div>
  ) : <Empty what="Pinterest" />;
}

function TikTok({ list, onOpen }: V) {
  const mine = [...list].sort(newest);
  return (
    <div className="np-col">
      <div className="np-yt-head"><Avatar a="Tópi" /><div><b>Tópi</b><small>{mine.length} vídeos no plano</small></div></div>
      {mine.length ? <div className="np-tt">{mine.map((p) => (
        <button key={p.id} className="np-tt-item" onClick={() => onOpen(p.id)}>
          <Art p={p} ratio="9 / 16" /><span className="ig-date">{brShort(p.date)}</span><Flag p={p} />
        </button>))}</div> : <Empty what="TikTok" />}
    </div>
  );
}

function Status({ list, onOpen }: V) {
  const mine = [...list].sort(oldest);
  return mine.length ? (
    <div className="np-stories">{mine.map((p) => (
      <button key={p.id} className="np-story wa" onClick={() => onOpen(p.id)}>
        <span className="np-story-bar"><i /></span>
        <span className="np-story-head"><Avatar a="Cardoso" /><b>Cardoso</b><small><When p={p} /></small></span>
        <Art p={p} ratio="9 / 16" />
        {p.caption && <span className="np-wa-cap">{p.caption}</span>}<Flag p={p} />
      </button>))}</div>
  ) : <Empty what="WhatsApp Status" />;
}

function Canais({ list, onOpen }: V) {
  const canais = [...new Set(list.map((p) => p.channel))].sort();
  const [c, setC] = useState(canais[0] ?? '');
  const sel = canais.includes(c) ? c : canais[0];
  const mine = list.filter((p) => p.channel === sel).sort(oldest);
  let lastDay = '';
  return (
    <div className="np-col">
      <div className="sp-chips" style={{ marginBottom: 10 }}>{canais.map((x) => <button key={x} className="sp-chip" aria-pressed={x === sel} onClick={() => setC(x)}>{x.replace('WhatsApp · ', '')}</button>)}</div>
      {sel ? (
        <div className="np-chat">
          <div className="np-chat-head"><Avatar a="Cardoso" /><div><b>{sel.replace('WhatsApp · ', '')}</b><small>Canal da Cardoso</small></div></div>
          <div className="np-chat-body">
            {mine.map((p) => {
              const sep = p.date !== lastDay ? (lastDay = p.date, <span key={`d${p.id}`} className="np-chat-day">{brShort(p.date)}</span>) : null;
              return [sep, (
                <button key={p.id} className="np-bubble" onClick={() => onOpen(p.id)}>
                  {p.creative && <Art p={p} ratio="4 / 5" />}
                  <span className="np-bubble-t">{p.caption || <em>Sem texto ainda.</em>}</span>
                  <span className="np-bubble-time">{p.time ?? ''}</span><Flag p={p} />
                </button>
              )];
            })}
          </div>
        </div>
      ) : <Empty what="canais do WhatsApp" />}
    </div>
  );
}

function Gmn({ list, onOpen }: V) {
  const mine = [...list].sort(newest);
  return (
    <div className="np-col">
      <div className="np-yt-head"><Avatar a="Cardoso" /><div><b>Cardoso</b><small>Google Meu Negócio · Atualizações</small></div></div>
      {mine.length ? <div className="np-gmn">{mine.map((p) => (
        <article key={p.id} className="np-gmn-item" onClick={() => onOpen(p.id)}>
          <Art p={p} ratio="4 / 3" /><Flag p={p} />
          <Caption text={p.caption} lines={4} />
          <small><When p={p} /></small>
          {p.cta && <span className="np-gmn-btn">{p.cta}</span>}
        </article>))}</div> : <Empty what="Google Meu Negócio" />}
    </div>
  );
}

function AccountChips({ list, acc, setAcc }: { list: PreviewItem[]; acc: string; setAcc: (a: string) => void }) {
  return (
    <div className="sp-gates" role="tablist">
      {['Playmi', 'Tópi', 'Cardoso'].map((a) => <button key={a} role="tab" aria-selected={acc === a} onClick={() => setAcc(a)}>{a} <b>{list.filter((p) => p.account === a).length}</b></button>)}
    </div>
  );
}
