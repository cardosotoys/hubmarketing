import { useState } from 'react';
import type { SocialPlanDeadline, SocialPlanItem, SocialTopic } from '../../types/database';
import { setStage } from './actions';
import {
  KIND_LABEL, addDays, brShort, destLabel, effective, hhmm, inQueue1, inQueue2, ownGate1, parseYmd, pieceState,
  slug, todayISO, DOW, MES_NOME, dowIndex, type ChannelMap,
} from './shared';

/* Central do dia: o que sai, o que trava e o que vence. Copiar legenda, abrir o criativo e
 * marcar agendada/publicada — o agendamento em si continua no mLabs e nos apps das redes. */
export default function CentralView({ live, byTopic, topicById, chans, deadlines, meId, onOpen, onOpenTopic, onGoApproval, onChanged }: {
  live: SocialPlanItem[];
  byTopic: Map<string, SocialPlanItem[]>;
  topicById: Map<string, SocialTopic>;
  chans: ChannelMap;
  deadlines: SocialPlanDeadline[];
  meId: string | null;
  onOpen: (id: string) => void;
  onOpenTopic: (id: string) => void;
  onGoApproval: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [msg, setMsg] = useState('');
  const hoje = todayISO();
  const fimSemana = addDays(hoje, 6);
  const ctx = (x: SocialPlanItem) => {
    const sibs = x.topic_id ? byTopic.get(x.topic_id) ?? [] : [];
    const matriz = sibs.find((s) => s.link_kind === 'matriz');
    const topic = x.topic_id ? topicById.get(x.topic_id) ?? null : null;
    return { matriz, topic, state: pieceState(x, matriz, topic, false), eff: effective(x, matriz) };
  };
  const ord = (a: SocialPlanItem, b: SocialPlanItem) => (a.pub_date + (a.pub_time ?? '99')).localeCompare(b.pub_date + (b.pub_time ?? '99'));

  const semana = live.filter((x) => x.pub_date >= hoje && x.pub_date <= fimSemana);
  const prox = live.filter((x) => x.pub_date >= hoje && x.pub_date <= addDays(hoje, 2)).sort(ord);
  const risco = live.filter((x) => x.pub_date >= hoje && x.pub_date <= addDays(hoje, 3) && !ctx(x).state.ready).sort(ord);
  const semLegenda = live.filter((x) => ownGate1(x) && !x.caption?.trim() && x.pub_date >= hoje && x.pub_date <= addDays(hoje, 14) && x.stage !== 'agendado' && x.stage !== 'publicado');
  const q1 = live.filter(inQueue1).length;
  const q2 = live.filter(inQueue2).length;
  const marcos = deadlines.filter((d) => d.limite && d.limite >= hoje && d.limite <= addDays(hoje, 30)).sort((a, b) => a.limite!.localeCompare(b.limite!));

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg((c) => (c === m ? '' : c)), 2400); };
  const copy = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); flash('Legenda copiada'); } catch { flash('Não deu para copiar. Abra a peça e copie a legenda de lá.'); }
  };
  const stage = async (x: SocialPlanItem, s: SocialPlanItem['stage'], ok: string) => {
    try { await setStage(x, s, meId); flash(ok); await onChanged(); } catch (e) { flash((e as Error).message); }
  };
  const d = parseYmd(hoje);
  const marcoHoje = deadlines.find((m) => m.limite === hoje);

  return (
    <div className="sp-central">
      <div className="sp-mhead">
        <h2>{DOW[dowIndex(hoje)]}, {d.getDate()} de {MES_NOME[d.getMonth()].toLowerCase()}</h2>
        {marcoHoje && <span>{marcoHoje.marco} · {marcoHoje.dm} · {marcoHoje.acao}</span>}
      </div>
      <div className="sp-kpis sp-central-kpis">
        <div className="sp-kpi"><b>{semana.length}</b><span>saem nos próximos 7 dias</span></div>
        <button className="sp-kpi sp-kpi-btn" onClick={onGoApproval}><b>{q1}</b><span>esperando etapa 1 · legenda</span></button>
        <button className="sp-kpi sp-kpi-btn" onClick={onGoApproval}><b>{q2}</b><span>esperando etapa 2 · criativo</span></button>
        <div className={`sp-kpi ${risco.length ? 'alert' : ''}`}><b>{risco.length}</b><span>em risco: saem em até 3 dias e não estão prontas</span></div>
      </div>
      {msg && <div className="sp-saved" style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="sp-central-grid">
        <section className="sp-box">
          <h3>Próximas 48 horas <small>copie, abra o criativo e marque quando agendar</small></h3>
          {prox.length ? prox.map((x) => {
            const { state, eff } = ctx(x);
            return (
              <div className="sp-crow" key={x.id}>
                <div className="sp-cwhen">{hhmm(x.pub_time) || '—'}<small>{brShort(x.pub_date)}</small></div>
                <button className="sp-cmain" onClick={() => onOpen(x.id)}>
                  <b><span className={`sp-dot b-${slug(x.brand)}`} /> {x.product || x.pauta}</b>
                  <span>{destLabel(x, chans)} · <span className={`sp-kind k-${x.link_kind}`}>{KIND_LABEL[x.link_kind]}</span></span>
                </button>
                <span className={`sp-state t-${state.tone}`}>{state.label}</span>
                <div className="sp-cacts">
                  <button className="sp-ebtn" disabled={!eff.caption} onClick={() => copy(eff.caption ?? '')}>Copiar legenda</button>
                  {eff.creative ? <a className="sp-ebtn" href={eff.creative} target="_blank" rel="noreferrer">Abrir criativo</a> : <button className="sp-ebtn" disabled>Abrir criativo</button>}
                  {x.stage === 'agendado'
                    ? <button className="sp-ebtn prim" onClick={() => stage(x, 'publicado', 'Marcada como publicada')}>Marcar publicada</button>
                    : x.stage === 'publicado'
                      ? <button className="sp-ebtn" onClick={() => stage(x, 'agendado', 'Voltou para agendada')}>Publicada ✓</button>
                      : <button className="sp-ebtn prim" disabled={!state.ready} title={state.ready ? '' : 'Só agenda depois das duas etapas (e do licenciador, se for o caso)'}
                          onClick={() => stage(x, 'agendado', 'Marcada como agendada')}>Marcar agendada</button>}
                </div>
              </div>
            );
          }) : <p className="sp-calhint">Nada sai nas próximas 48 horas.</p>}
        </section>

        <div className="sp-central-side">
          <section className="sp-box">
            <h3>Em risco <small>{risco.length} peça{risco.length === 1 ? '' : 's'}</small></h3>
            {risco.length ? risco.map((x) => {
              const { state } = ctx(x);
              return (
                <div className="sp-crow" key={x.id}>
                  <button className="sp-cmain" onClick={() => onOpen(x.id)}>
                    <b>{x.product || x.pauta}</b>
                    <span>{destLabel(x, chans)} · sai {brShort(x.pub_date)}{x.pub_time ? ` ${hhmm(x.pub_time)}` : ''}</span>
                  </button>
                  <span className={`sp-state t-${state.tone}`}>{state.label}</span>
                  {x.topic_id && <button className="sp-linkbtn" onClick={() => onOpenTopic(x.topic_id!)}>assunto</button>}
                </div>
              );
            }) : <p className="sp-calhint">Tudo dentro do prazo.</p>}
            {semLegenda.length > 0 && <p className="sp-inherit" style={{ marginTop: 8 }}>{semLegenda.length} peça{semLegenda.length === 1 ? '' : 's'} dos próximos 14 dias ainda sem legenda: elas não entram na fila de aprovação.</p>}
          </section>
          <section className="sp-box">
            <h3>Marcos comerciais <small>próximos 30 dias</small></h3>
            {marcos.length ? marcos.map((m) => (
              <div className="sp-crow" key={m.id}>
                <div className="sp-cwhen">{m.dm}<small>{brShort(m.limite!)}</small></div>
                <div className="sp-cmain static"><b>{m.acao}</b><span>{m.marco}{m.resp ? ` · ${m.resp}` : ''}</span></div>
              </div>
            )) : <p className="sp-calhint">Nenhum marco nos próximos 30 dias.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
