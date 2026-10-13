import { useState } from 'react';
import type { SocialPlanItem } from '../../types/database';
import {
  KIND_LABEL, addDays, addMonths, brShort, dowIndex, hhmm, mondayOf, monthName, slug, todayISO, ymOf, parseYmd,
  type ChannelMap,
} from './shared';

type Props = {
  rows: SocialPlanItem[];
  chans: ChannelMap;
  onOpen: (id: string) => void;
  hasComment: Set<string>;
};

const stMark = (s: SocialPlanItem['status']) => (s === 'aprovada' ? 'ok' : s === 'ajuste' ? 'aj' : '');
const byTime = (a: SocialPlanItem, b: SocialPlanItem) =>
  (a.pub_time ?? '99').localeCompare(b.pub_time ?? '99') || a.brand.localeCompare(b.brand);
const shortChan = (x: SocialPlanItem, chans: ChannelMap) => {
  const ch = x.channel_id ? chans.get(x.channel_id) : undefined;
  if (!ch) return x.network;
  const nome = ch.name.replace('WhatsApp · ', 'WA ').replace('YouTube · playlist ', 'YT ').replace(' · post nativo', '');
  return `${nome}${ch.formats.length && x.piece_type ? ' ' + x.piece_type : ''}${x.mirror_facebook ? ' + FB' : ''}`;
};

/* Pílula de uma peça no calendário. Passar o mouse acende os outros destinos do mesmo assunto. */
function Pill({ x, chans, onOpen, hasComment, hl, setHl, compact }: {
  x: SocialPlanItem; chans: ChannelMap; onOpen: (id: string) => void; hasComment: Set<string>;
  hl: string | null; setHl: (id: string | null) => void; compact?: boolean;
}) {
  const s = stMark(x.status);
  const dim = hl && x.topic_id !== hl ? 'dim' : hl && x.topic_id === hl ? 'lit' : '';
  return (
    <button type="button"
      className={`sp-pill b-${slug(x.brand)} k-${x.link_kind} ${s ? 'st-' + s : ''} ${dim}`}
      onClick={() => onOpen(x.id)}
      onMouseEnter={() => setHl(x.topic_id)} onMouseLeave={() => setHl(null)}
      onFocus={() => setHl(x.topic_id)} onBlur={() => setHl(null)}>
      <div className="row">
        <span className="sp-time">{hhmm(x.pub_time) || '—'}</span>
        <b>{x.product || x.pauta}</b>
        {s ? <span className={`sp-stt ${s}`} /> : null}
      </div>
      <i>{shortChan(x, chans)}{compact ? '' : ` · ${KIND_LABEL[x.link_kind]}`}{hasComment.has(x.id) ? ' · 💬' : ''}</i>
    </button>
  );
}

export function MonthView({ rows, chans, onOpen, hasComment }: Props) {
  const months = [...new Set(rows.map((x) => ymOf(x.pub_date)))].sort();
  const hoje = ymOf(todayISO());
  const [ym, setYm] = useState(() => (months.includes(hoje) ? hoje : months[0] ?? hoje));
  const [hl, setHl] = useState<string | null>(null);
  const first = `${ym}-01`;
  const start = addDays(first, -dowIndex(first));
  const [Y, M] = ym.split('-').map(Number);
  const dias = new Date(Y, M, 0).getDate();
  const total = Math.ceil((dowIndex(first) + dias) / 7) * 7;
  const doMes = rows.filter((x) => x.pub_date.startsWith(ym));
  const today = todayISO();
  const cells = Array.from({ length: total }, (_, i) => addDays(start, i));
  return (
    <div className="sp-month">
      <div className="sp-mhead">
        <h2>{monthName(ym)}</h2><span>{doMes.length} publicações</span>
        <div className="sp-calnav">
          <button className="sp-ebtn" onClick={() => setYm(addMonths(ym, -1))}>‹ Mês anterior</button>
          <button className="sp-ebtn" onClick={() => setYm(hoje)} disabled={ym === hoje}>Hoje</button>
          <button className="sp-ebtn" onClick={() => setYm(addMonths(ym, 1))}>Próximo mês ›</button>
        </div>
      </div>
      <div className="sp-dow">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="sp-grid">
        {cells.map((iso) => {
          const its = rows.filter((x) => x.pub_date === iso).sort(byTime);
          const out = !iso.startsWith(ym);
          const cls = ['sp-day', dowIndex(iso) >= 5 ? 'wknd' : '', its.length ? '' : 'empty', out ? 'out' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
          return (
            <div key={iso} className={cls}>
              <div className="sp-dnum"><b>{parseYmd(iso).getDate()}</b>{its.length ? <span>{its.length}</span> : null}</div>
              {!out && its.map((x) => <Pill key={x.id} x={x} chans={chans} onOpen={onOpen} hasComment={hasComment} hl={hl} setHl={setHl} compact />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({ rows, chans, onOpen, hasComment }: Props) {
  const [mon, setMon] = useState(() => mondayOf(todayISO()));
  const [hl, setHl] = useState<string | null>(null);
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const n = rows.filter((x) => x.pub_date >= days[0] && x.pub_date <= days[6]).length;
  return (
    <div className="sp-month">
      <div className="sp-mhead">
        <h2>Semana de {brShort(days[0])} a {brShort(days[6])}</h2><span>{n} publicações</span>
        <div className="sp-calnav">
          <button className="sp-ebtn" onClick={() => setMon(addDays(mon, -7))}>‹ Semana anterior</button>
          <button className="sp-ebtn" onClick={() => setMon(mondayOf(today))} disabled={mon === mondayOf(today)}>Hoje</button>
          <button className="sp-ebtn" onClick={() => setMon(addDays(mon, 7))}>Próxima semana ›</button>
        </div>
      </div>
      <div className="sp-week">
        {days.map((iso, i) => {
          const its = rows.filter((x) => x.pub_date === iso).sort(byTime);
          return (
            <div key={iso} className={`sp-wday ${iso === today ? 'today' : ''} ${i >= 5 ? 'wknd' : ''}`}>
              <div className="sp-wdhead"><span>{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i]}</span><b>{parseYmd(iso).getDate()}</b></div>
              {its.length ? its.map((x) => <Pill key={x.id} x={x} chans={chans} onOpen={onOpen} hasComment={hasComment} hl={hl} setHl={setHl} />)
                : <span className="sp-wempty">Sem peças</span>}
            </div>
          );
        })}
      </div>
      <p className="sp-calhint">Passe o mouse numa peça para acender os outros destinos do mesmo assunto.</p>
    </div>
  );
}
