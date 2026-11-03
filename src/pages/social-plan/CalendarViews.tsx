import { useState } from 'react';
import type { SocialPlanItem, SocialTopic } from '../../types/database';
import {
  KIND_LABEL, addDays, addMonths, brShort, dowIndex, driveThumb, effective, hhmm, mondayOf, monthName, pieceState, slug, todayISO, ymOf, parseYmd,
  type ChannelMap,
} from './shared';

type Props = {
  rows: SocialPlanItem[];
  chans: ChannelMap;
  onOpen: (id: string) => void;
  hasComment: Set<string>;
  byTopic?: Map<string, SocialPlanItem[]>;
  topicById?: Map<string, SocialTopic>;
};

/* Peça principal = vai para o feed/canal com arte própria; Stories, WhatsApp e reaproveitamentos são apoio. */
const isApoio = (x: SocialPlanItem, chans: ChannelMap) => {
  const ch = x.channel_id ? chans.get(x.channel_id) : undefined;
  if (x.link_kind === 'matriz') return false;
  return x.link_kind === 'reaproveita' || /Stor/i.test(x.piece_type) || ch?.network === 'WhatsApp';
};
function arteDe(x: SocialPlanItem, byTopic?: Map<string, SocialPlanItem[]>) {
  const sibs = x.topic_id && byTopic ? byTopic.get(x.topic_id) ?? [] : [];
  const matriz = sibs.find((s) => s.link_kind === 'matriz');
  const eff = effective(x, matriz);
  return { thumb: driveThumb(eff.slides[0] ?? eff.creative), slides: eff.slides.length, matriz };
}
const SIT_TONE: Record<string, string> = { ok: 'ok', sky: 'done', warn: 'warn', red: 'red', '': '' };

/* Cartão de post no calendário: a arte em cima, hora, marca, título, onde sai e a situação. */
function PostCard({ x, chans, onOpen, hasComment, hl, setHl, byTopic, topicById }: {
  x: SocialPlanItem; chans: ChannelMap; onOpen: (id: string) => void; hasComment: Set<string>;
  hl: string | null; setHl: (id: string | null) => void; byTopic?: Map<string, SocialPlanItem[]>; topicById?: Map<string, SocialTopic>;
}) {
  const { thumb, slides, matriz } = arteDe(x, byTopic);
  const ch = x.channel_id ? chans.get(x.channel_id) : undefined;
  const st = pieceState(x, matriz, x.topic_id ? topicById?.get(x.topic_id) : null, !!ch?.future);
  const vertical = /Reels|Shorts|TikTok/.test(`${x.piece_type} ${ch?.name ?? ''}`);
  const dim = hl && x.topic_id !== hl ? 'dim' : hl && x.topic_id === hl ? 'lit' : '';
  return (
    <button type="button" className={`cv-post b-${slug(x.brand)} ${thumb ? '' : 'noart'} ${dim}`} onClick={() => onOpen(x.id)}
      onMouseEnter={() => setHl(x.topic_id)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(x.topic_id)} onBlur={() => setHl(null)}>
      <span className="cv-art">
        {thumb ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="cv-noart">Sem arte</span>}
        <span className="cv-time">{hhmm(x.pub_time) || '—'}</span>
        {vertical && thumb && <span className="cv-kind">▶</span>}
        {slides > 1 && <span className="cv-kind">{slides}</span>}
      </span>
      <span className="cv-info">
        <span className="cv-brand"><i className={`sp-dot b-${slug(x.brand)}`} />{x.brand}{hasComment.has(x.id) ? ' · 💬' : ''}</span>
        <span className="cv-title">{x.product || x.pauta}</span>
        <span className="cv-where">{shortChan(x, chans)}</span>
        <span className={`coc-sit ${SIT_TONE[st.tone]}`}>{st.label}</span>
      </span>
    </button>
  );
}

/* Linha de apoio (Stories, Status, reaproveitamento): miniatura pequena e uma linha. */
function ApoioRow({ x, chans, onOpen, hl, setHl, byTopic }: {
  x: SocialPlanItem; chans: ChannelMap; onOpen: (id: string) => void; hl: string | null; setHl: (id: string | null) => void; byTopic?: Map<string, SocialPlanItem[]>;
}) {
  const { thumb } = arteDe(x, byTopic);
  const dim = hl && x.topic_id !== hl ? 'dim' : hl && x.topic_id === hl ? 'lit' : '';
  return (
    <button type="button" className={`cv-apoio b-${slug(x.brand)} ${dim}`} onClick={() => onOpen(x.id)}
      onMouseEnter={() => setHl(x.topic_id)} onMouseLeave={() => setHl(null)}>
      {thumb ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <i className={`sp-dot b-${slug(x.brand)}`} />}
      <span><b>{hhmm(x.pub_time) || '—'}</b> {shortChan(x, chans)}<small>{x.product || x.pauta}</small></span>
    </button>
  );
}

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

export function MonthView({ rows, chans, onOpen, hasComment, byTopic }: Props) {
  const months = [...new Set(rows.map((x) => ymOf(x.pub_date)))].sort();
  const hoje = ymOf(todayISO());
  const [ym, setYm] = useState(() => (months.includes(hoje) ? hoje : months[0] ?? hoje));
  const [hl, setHl] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null); // celular: o dia tocado abre a agenda embaixo
  const first = `${ym}-01`;
  const start = addDays(first, -dowIndex(first));
  const [Y, M] = ym.split('-').map(Number);
  const dias = new Date(Y, M, 0).getDate();
  const total = Math.ceil((dowIndex(first) + dias) / 7) * 7;
  const doMes = rows.filter((x) => x.pub_date.startsWith(ym));
  const today = todayISO();
  const cells = Array.from({ length: total }, (_, i) => addDays(start, i));
  // dia aberto na agenda do celular: o tocado, senão hoje (se for deste mês), senão o primeiro com peça
  const diaSel = dia && dia.startsWith(ym) ? dia : (today.startsWith(ym) ? today : doMes.map((x) => x.pub_date).sort()[0] ?? first);
  const doDia = rows.filter((x) => x.pub_date === diaSel).sort(byTime);
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
            <div key={iso} className={`${cls}${diaSel === iso ? ' sel' : ''}`} onClick={() => { if (!out) setDia(iso); }}>
              <div className="sp-dnum"><b>{parseYmd(iso).getDate()}</b>{its.length ? <span>{its.length}</span> : null}</div>
              {!out && its.length > 0 && <span className="sp-mdots" aria-hidden>{its.slice(0, 4).map((x) => <i key={x.id} className={`b-${slug(x.brand)}`} />)}</span>}
              {!out && (() => {
                const main = its.filter((x) => !isApoio(x, chans));
                const extra = its.length - main.length;
                return (
                  <div className="cv-mthumbs">
                    {main.map((x) => {
                      const { thumb } = arteDe(x, byTopic);
                      return (
                        <button type="button" key={x.id} className={`cv-mthumb b-${slug(x.brand)} ${thumb ? '' : 'noart'} ${hl && x.topic_id !== hl ? 'dim' : ''}`}
                          title={`${hhmm(x.pub_time) || ''} ${x.product || x.pauta} · ${shortChan(x, chans)}`}
                          onClick={(e) => { e.stopPropagation(); onOpen(x.id); }} onMouseEnter={() => setHl(x.topic_id)} onMouseLeave={() => setHl(null)}>
                          {thumb ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{hhmm(x.pub_time)}</span>}
                        </button>
                      );
                    })}
                    {extra > 0 && <span className="cv-mextra">+{extra} apoio</span>}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
      <div className="sp-magenda">
        <h3>{['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][dowIndex(diaSel)]}, {brShort(diaSel)}</h3>
        {doDia.length ? doDia.map((x) => <Pill key={x.id} x={x} chans={chans} onOpen={onOpen} hasComment={hasComment} hl={null} setHl={() => {}} />)
          : <span className="sp-wempty">Nada sai neste dia.</span>}
      </div>
    </div>
  );
}

export function WeekView({ rows, chans, onOpen, hasComment, byTopic, topicById }: Props) {
  const [mon, setMon] = useState(() => mondayOf(todayISO()));
  const [hl, setHl] = useState<string | null>(null);
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const naSemana = rows.filter((x) => x.pub_date >= days[0] && x.pub_date <= days[6]);
  const principais = naSemana.filter((x) => !isApoio(x, chans));
  const porMarca = ['Playmi', 'Tópi', 'Cardoso'].map((b) => ({ b, n: principais.filter((x) => x.brand === b).length }));
  return (
    <div className="cv-week-wrap">
      <div className="cv-head">
        <div className="cv-head-t">
          <button type="button" className="cv-arrow" aria-label="Semana anterior" onClick={() => setMon(addDays(mon, -7))}>‹</button>
          <div><b>Semana de {brShort(days[0])} a {brShort(days[6])}</b>
            <span>{principais.length} posts · {naSemana.length - principais.length} de apoio (Stories, WhatsApp)</span></div>
          <button type="button" className="cv-arrow" aria-label="Próxima semana" onClick={() => setMon(addDays(mon, 7))}>›</button>
          {mon !== mondayOf(today) && <button type="button" className="cv-today" onClick={() => setMon(mondayOf(today))}>Hoje</button>}
        </div>
        <div className="cv-brands">{porMarca.map(({ b, n }) => <span key={b}><i className={`sp-dot b-${slug(b)}`} />{b} <b>{n}</b></span>)}</div>
      </div>
      <div className="cv-week">
        {days.map((iso, i) => {
          const its = rows.filter((x) => x.pub_date === iso).sort(byTime);
          const main = its.filter((x) => !isApoio(x, chans));
          const apoio = its.filter((x) => isApoio(x, chans));
          return (
            <section key={iso} className={`cv-day ${iso === today ? 'today' : ''} ${i >= 5 ? 'wknd' : ''} ${its.length ? '' : 'free'}`}>
              <header><span>{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i]}</span><b>{parseYmd(iso).getDate()}</b>{iso === today && <em>hoje</em>}</header>
              {main.map((x) => <PostCard key={x.id} x={x} chans={chans} onOpen={onOpen} hasComment={hasComment} hl={hl} setHl={setHl} byTopic={byTopic} topicById={topicById} />)}
              {apoio.length > 0 && <div className="cv-apoios">{apoio.map((x) => <ApoioRow key={x.id} x={x} chans={chans} onOpen={onOpen} hl={hl} setHl={setHl} byTopic={byTopic} />)}</div>}
              {!its.length && <span className="cv-free">Livre</span>}
            </section>
          );
        })}
      </div>
      <p className="sp-calhint">Passe o mouse numa peça para acender os outros destinos do mesmo assunto.</p>
    </div>
  );
}
