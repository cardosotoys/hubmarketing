import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { SocialPlanDeadline, SocialPlanItem, SocialStrategyNote, SocialTopic } from '../../types/database';
import { BrandGuide } from './Brief';
import { MES_ABREV, addDays, addMonths, brShort, monthName, parseYmd, pieceState, slug, todayISO, ymOf } from './shared';

/* Estratégia e cronograma: o andamento de cada frente (das próprias peças) e os marcos comerciais
 * que o conteúdo precisa cumprir, com feito/andamento/pendente e o cronograma dos meses. */

type Bucket = 'pub' | 'pronta' | 'aprov' | 'ajuste' | 'prod';
const BUCKETS: { k: Bucket; label: string }[] = [
  { k: 'pub', label: 'Agendada ou publicada' }, { k: 'pronta', label: 'Pronta para agendar' },
  { k: 'aprov', label: 'Em aprovação' }, { k: 'ajuste', label: 'Com ajuste' }, { k: 'prod', label: 'Produção ou rascunho' },
];
function bucketOf(label: string): Bucket {
  if (label === 'Publicada' || label === 'Agendada') return 'pub';
  if (label === 'Pronta para agendar') return 'pronta';
  if (label.startsWith('Ajuste')) return 'ajuste';
  if (label.startsWith('Aguardando')) return 'aprov';
  return 'prod';
}
const area = (resp: string) => (resp.includes('+') ? 'mix' : /^Digital/i.test(resp) ? 'dig' : 'com');

export default function StrategyView({ live, byTopic, topicById, deadlines, notes, canMark, isPriv, meId, onChanged }: {
  live: SocialPlanItem[];
  byTopic: Map<string, SocialPlanItem[]>;
  topicById: Map<string, SocialTopic>;
  deadlines: SocialPlanDeadline[];
  notes: SocialStrategyNote[];
  canMark: boolean;
  isPriv: boolean;
  meId: string | null;
  onChanged: () => Promise<void> | void;
}) {
  const hoje = todayISO();
  const [month, setMonth] = useState(() => ymOf(hoje));
  const [msg, setMsg] = useState('');
  const [nm, setNm] = useState({ marco: '', dm: '', limite: addDays(hoje, 30), acao: '', resp: 'Digital' });
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg((c) => (c === m ? '' : c)), 2600); };

  // frentes do mês: peças agrupadas pelo tema/frente do assunto
  const frentes = useMemo(() => {
    const m = new Map<string, { front: string; brand: Set<string>; first: string; n: Record<Bucket, number>; total: number; topics: Set<string> }>();
    live.filter((x) => x.pub_date.startsWith(month)).forEach((x) => {
      const key = x.week_theme || 'Sem frente';
      const sibs = x.topic_id ? byTopic.get(x.topic_id) ?? [] : [];
      const st = pieceState(x, sibs.find((s) => s.link_kind === 'matriz'), x.topic_id ? topicById.get(x.topic_id) : null, false);
      const f = m.get(key) ?? { front: key, brand: new Set(), first: x.pub_date, n: { pub: 0, pronta: 0, aprov: 0, ajuste: 0, prod: 0 }, total: 0, topics: new Set() };
      f.brand.add(x.brand); f.first = f.first < x.pub_date ? f.first : x.pub_date; f.n[bucketOf(st.label)]++; f.total++;
      if (x.topic_id) f.topics.add(x.topic_id);
      m.set(key, f);
    });
    return [...m.values()].sort((a, b) => a.first.localeCompare(b.first));
  }, [live, byTopic, topicById, month]);
  const tot = frentes.reduce((acc, f) => { BUCKETS.forEach((b) => { acc[b.k] += f.n[b.k]; }); acc.all += f.total; return acc; }, { pub: 0, pronta: 0, aprov: 0, ajuste: 0, prod: 0, all: 0 } as Record<Bucket | 'all', number>);

  // cronograma
  const comData = deadlines.filter((d) => d.limite);
  const grupos = [...new Set(comData.map((d) => d.marco))].map((marco) => ({ marco, ms: comData.filter((d) => d.marco === marco).sort((a, b) => a.limite!.localeCompare(b.limite!)) }))
    .sort((a, b) => a.ms[0].limite!.localeCompare(b.ms[0].limite!));
  const startYm = ymOf(hoje);
  const lastYm = comData.length ? ymOf(comData.map((d) => d.limite!).sort().slice(-1)[0]) : startYm;
  const months: string[] = [];
  for (let y = startYm; y <= lastYm && months.length < 12; y = addMonths(y, 1)) months.push(y);
  const t0 = parseYmd(`${months[0]}-01`).getTime();
  const t1 = parseYmd(`${addMonths(months[months.length - 1], 1)}-01`).getTime();
  const pos = (iso: string) => Math.max(0, Math.min(100, ((parseYmd(iso).getTime() - t0) / (t1 - t0)) * 100));
  const visiveis = grupos.filter((g) => g.ms.some((m) => m.limite! >= `${months[0]}-01`));
  const proximos = comData.filter((d) => d.limite! >= addDays(hoje, -12) && d.limite! <= addDays(hoje, 45)).sort((a, b) => a.limite!.localeCompare(b.limite!));

  const mark = async (d: SocialPlanDeadline, status: 'pendente' | 'andamento' | 'feito') => {
    const { error } = await supabase.from('social_plan_deadlines').update({ status, status_by: meId, status_at: new Date().toISOString() }).eq('id', d.id);
    if (error) flash(error.message.includes('status') ? 'Rode a migration 0113 para marcar o andamento.' : error.message);
    else { flash('Andamento atualizado.'); await onChanged(); }
  };
  const addMarco = async () => {
    if (!nm.marco.trim() || !nm.acao.trim() || !nm.limite) { flash('Preencha a data comercial, a ação e o dia limite.'); return; }
    const ord = Math.max(0, ...deadlines.map((d) => d.ord)) + 1;
    const { error } = await supabase.from('social_plan_deadlines').insert({ marco: nm.marco.trim(), dm: nm.dm.trim(), limite: nm.limite, acao: nm.acao.trim(), resp: nm.resp.trim(), ord });
    if (error) flash(error.message); else { flash('Marco adicionado.'); setNm((x) => ({ ...x, acao: '', dm: '' })); await onChanged(); }
  };

  const estrategia = notes.filter((n) => n.section === 'estrategia').sort((a, b) => a.ord - b.ord);
  const pendencias = notes.filter((n) => n.section === 'pendencia').sort((a, b) => a.ord - b.ord);
  const togglePend = async (n: SocialStrategyNote) => {
    const { error } = await supabase.from('social_strategy_notes').update({ done: !n.done, updated_by: meId, updated_at: new Date().toISOString() }).eq('ext_key', n.ext_key);
    if (error) flash(error.message); else await onChanged();
  };

  return (
    <div className="sp-strat">
      {estrategia.length > 0 && (
        <div className="sp-central-grid" style={{ marginBottom: 14 }}>
          <section className="sp-box">
            <h3>Estratégia do período</h3>
            <dl className="sp-kv coc-strat-kv">{estrategia.map((n) => <div key={n.ext_key} style={{ display: 'contents' }}><dt>{n.item}</dt><dd>{n.value}</dd></div>)}</dl>
          </section>
          <section className="sp-box">
            <h3>Pendências <small>{pendencias.filter((n) => !n.done).length} em aberto</small></h3>
            {pendencias.map((n) => (
              <label key={n.ext_key} className={`coc-pend ${n.done ? 'done' : ''}`}>
                <input type="checkbox" checked={n.done} disabled={!canMark} onChange={() => togglePend(n)} />
                <span><b>{n.item}.</b> {n.value}</span>
              </label>
            ))}
            {!canMark && <p className="sp-calhint">O gerente ou a diretoria marcam o que foi resolvido.</p>}
          </section>
        </div>
      )}
      {notes.some((n) => n.section === 'guia') && (
        <div className="coc-guides">
          {['Playmi', 'Tópi', 'Cardoso'].map((b) => <div key={b} className="sp-box"><BrandGuide brand={b} notes={notes.filter((n) => n.section === 'guia')} defaultOpen /></div>)}
        </div>
      )}
      {notes.some((n) => n.section === 'formato') && (
        <section className="sp-box" style={{ marginBottom: 14 }}>
          <h3>Formatos e medidas</h3>
          <table className="coc-ftable"><thead><tr><th>Formato</th><th>Medida</th><th>Observação</th></tr></thead>
            <tbody>{notes.filter((n) => n.section === 'formato').sort((a, b) => a.ord - b.ord).map((n) => <tr key={n.ext_key}><td>{n.item}</td><td>{n.value}</td><td>{n.note}</td></tr>)}</tbody></table>
        </section>
      )}
      <div className="sp-central-grid">
        <section className="sp-box">
          <h3>
            <span>Frentes de {monthName(month).toLowerCase()}</span>
            <span className="sp-calnav">
              <button className="sp-ebtn" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
              <button className="sp-ebtn" onClick={() => setMonth(addMonths(month, 1))}>›</button>
            </span>
          </h3>
          {tot.all > 0 && (
            <p className="sp-calhint" style={{ marginTop: 0 }}>
              {tot.all} peças no mês · <b>{Math.round(((tot.pub + tot.pronta) / tot.all) * 100)}%</b> prontas ou no ar · {tot.aprov} em aprovação · {tot.ajuste} com ajuste
            </p>
          )}
          {frentes.length ? frentes.map((f) => {
            const prontas = f.n.pub + f.n.pronta;
            return (
              <div className="sp-frente" key={f.front}>
                <div className="sp-frente-h">
                  <b>{[...f.brand].map((b) => <span key={b} className={`sp-dot b-${slug(b)}`} />)} {f.front}</b>
                  <span>{[...f.brand].join(' · ')} · {f.topics.size} assunto{f.topics.size === 1 ? '' : 's'} · {f.total} peças · {prontas} prontas</span>
                </div>
                <div className="sp-bar">{BUCKETS.map((b) => f.n[b.k] ? <i key={b.k} className={`s-${b.k}`} style={{ width: `${(f.n[b.k] / f.total) * 100}%` }} title={`${b.label}: ${f.n[b.k]}`} /> : null)}</div>
              </div>
            );
          }) : <p className="sp-calhint">Nenhuma peça neste mês.</p>}
          <div className="sp-legend" style={{ marginTop: 10 }}>{BUCKETS.map((b) => <span key={b.k}><i className={`sw s-${b.k}`} />{b.label}</span>)}</div>
        </section>

        <section className="sp-box">
          <h3>Marcos do período <small>{canMark ? 'marque o que foi feito' : 'o gerente marca o andamento'}</small></h3>
          {proximos.length ? proximos.map((d) => {
            const st = d.status ?? 'pendente';
            const passou = d.limite! < hoje && st !== 'feito';
            return (
              <div className="sp-crow" key={d.id}>
                <div className="sp-cwhen">{d.dm || '—'}<small>{brShort(d.limite!)}</small></div>
                <div className="sp-cmain static"><b>{d.acao}</b><span>{d.marco}{d.resp ? ` · ${d.resp}` : ''}{passou ? ' · passou do dia' : ''}</span></div>
                {canMark ? (
                  <span className="sp-seg">
                    {(['feito', 'andamento', 'pendente'] as const).map((s) => (
                      <button key={s} aria-pressed={st === s} onClick={() => mark(d, s)}>{s === 'feito' ? 'Feito' : s === 'andamento' ? 'Andamento' : passou ? 'A confirmar' : 'Pendente'}</button>
                    ))}
                  </span>
                ) : <span className={`sp-state t-${st === 'feito' ? 'ok' : passou ? 'red' : st === 'andamento' ? 'warn' : ''}`}>{st === 'feito' ? 'Feito' : st === 'andamento' ? 'Andamento' : passou ? 'A confirmar' : 'Pendente'}</span>}
              </div>
            );
          }) : <p className="sp-calhint">Nenhum marco entre 12 dias atrás e os próximos 45 dias.</p>}
          {msg && <div className="sp-saved">{msg}</div>}
        </section>
      </div>

      <section className="sp-box" style={{ marginTop: 14 }}>
        <h3>Cronograma {MES_ABREV[Number(months[0].slice(5)) - 1]}/{months[0].slice(2, 4)} a {MES_ABREV[Number(months[months.length - 1].slice(5)) - 1]}/{months[months.length - 1].slice(2, 4)} <small>losango = marco · cor = área</small></h3>
        <div className="sp-gantt">
          <div className="sp-gtable" style={{ gridTemplateColumns: `200px repeat(${months.length}, minmax(0, 1fr))` }}>
            <div className="sp-gh">Data comercial</div>
            {months.map((m) => <div className="sp-gh" key={m}>{MES_ABREV[Number(m.slice(5)) - 1]}/{m.slice(2, 4)}</div>)}
            {visiveis.map((g) => {
              const a0 = g.ms[0].limite!, a1 = g.ms[g.ms.length - 1].limite!;
              return (
                <div className="sp-grow" key={g.marco} style={{ display: 'contents' }}>
                  <div className="sp-glabel">{g.marco}</div>
                  <div className="sp-gtrack" style={{ gridColumn: `2 / span ${months.length}` }}>
                    <span className="sp-gspan" style={{ left: `${pos(a0)}%`, width: `${Math.max(0, pos(a1) - pos(a0))}%` }} />
                    {g.ms.map((m) => (
                      <span key={m.id} className={`sp-gms ${m.status === 'feito' ? 'done' : area(m.resp)}`} style={{ left: `${pos(m.limite!)}%` }}
                        title={`${m.dm} · ${brShort(m.limite!)} · ${m.acao}${m.status === 'feito' ? ' · feito' : ''}`} />
                    ))}
                    <span className="sp-gtoday" style={{ left: `${pos(hoje)}%` }} title="Hoje" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sp-legend"><span><i className="sw g-dig" />Digital</span><span><i className="sw g-com" />Comercial</span><span><i className="sw g-mix" />Áreas juntas</span><span><i className="sw g-done" />Feito</span><span><i className="sw g-today" />Hoje</span></div>
        {isPriv && (
          <div className="sp-adder" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,.5fr) minmax(0,.8fr) minmax(0,2fr) minmax(0,1fr) auto' }}>
            <label className="sp-erow"><span>Data comercial</span><input id="nm-marco" list="sp-marcos" value={nm.marco} onChange={(e) => setNm((x) => ({ ...x, marco: e.target.value }))} />
              <datalist id="sp-marcos">{grupos.map((g) => <option key={g.marco} value={g.marco} />)}</datalist></label>
            <label className="sp-erow"><span>D-</span><input id="nm-dm" placeholder="D-20" value={nm.dm} onChange={(e) => setNm((x) => ({ ...x, dm: e.target.value }))} /></label>
            <label className="sp-erow"><span>Dia limite</span><input id="nm-lim" type="date" value={nm.limite} onChange={(e) => setNm((x) => ({ ...x, limite: e.target.value }))} /></label>
            <label className="sp-erow"><span>Ação</span><input id="nm-acao" value={nm.acao} onChange={(e) => setNm((x) => ({ ...x, acao: e.target.value }))} /></label>
            <label className="sp-erow"><span>Área</span><input id="nm-resp" value={nm.resp} onChange={(e) => setNm((x) => ({ ...x, resp: e.target.value }))} /></label>
            <button className="sp-ebtn" onClick={addMarco}>+ Marco</button>
          </div>
        )}
      </section>
    </div>
  );
}
