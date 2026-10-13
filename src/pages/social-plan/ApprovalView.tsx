import { useState } from 'react';
import type { SocialPlanItem, SocialTopic } from '../../types/database';
import { decide } from './actions';
import { BRIEF_ETAPA1, BRIEF_ETAPA2, BriefRead } from './Brief';
import { KIND_LABEL, brShort, destLabel, driveThumb, hhmm, inQueue1, inQueue2, licBlocked, slug, type ChannelMap } from './shared';

/* Fila de aprovação: uma peça por vez, na ordem em que saem.
 * Etapa 1 = pauta e legenda; etapa 2 = criativo final. Só aparece quem tem decisão própria. */
export default function ApprovalView({ live, byTopic, topicById, chans, meId, canDecide, approverName, onOpen, onChanged }: {
  live: SocialPlanItem[];
  byTopic: Map<string, SocialPlanItem[]>;
  topicById: Map<string, SocialTopic>;
  chans: ChannelMap;
  meId: string | null;
  canDecide: boolean;
  approverName: string | null;
  onOpen: (id: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [gate, setGate] = useState<1 | 2>(1);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const ord = (a: SocialPlanItem, b: SocialPlanItem) => (a.pub_date + (a.pub_time ?? '')).localeCompare(b.pub_date + (b.pub_time ?? ''));
  const q1 = live.filter(inQueue1).sort(ord);
  const q2 = live.filter(inQueue2).sort(ord);
  const queue = (gate === 1 ? q1 : q2).filter((x) => !skip.has(x.id));
  const cur = queue[0];

  const act = async (d: 'aprovada' | 'ajuste') => {
    if (!cur) return;
    if (d === 'ajuste' && !note.trim()) { setMsg('Escreva o que precisa mudar.'); return; }
    setBusy(true); setMsg('');
    try {
      await decide(cur, gate, d, meId, note);
      setNote(''); setAdjusting(false);
      setMsg(d === 'aprovada' ? 'Aprovada. Próxima peça.' : 'Ajuste enviado para quem editou a peça.');
      await onChanged();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };

  const tabs = (
    <div className="sp-gates" role="tablist">
      <button role="tab" aria-selected={gate === 1} onClick={() => { setGate(1); setAdjusting(false); }}>Etapa 1 · Pauta e legenda <b>{q1.length}</b></button>
      <button role="tab" aria-selected={gate === 2} onClick={() => { setGate(2); setAdjusting(false); }}>Etapa 2 · Criativo final <b>{q2.length}</b></button>
    </div>
  );
  const head = (
    <p className="sp-calhint" style={{ marginTop: 0 }}>
      Aprovador: <b>{approverName ?? 'ninguém definido no topo da página'}</b>. Uma peça por vez, na ordem em que saem.
      {gate === 1 ? ' Só entram peças com legenda escrita.' : ' Só entram peças com a legenda aprovada e o criativo no Drive.'}
    </p>
  );
  if (!cur) return <>{tabs}{head}<div className="sp-empty"><b>Nada esperando nesta etapa</b>{skip.size ? 'Você pulou algumas peças. Recarregue a página para vê-las de novo.' : 'Quando uma peça entrar na fila, ela aparece aqui.'}</div></>;

  const sibs = cur.topic_id ? byTopic.get(cur.topic_id) ?? [] : [];
  const matriz = sibs.find((x) => x.link_kind === 'matriz');
  const topic = cur.topic_id ? topicById.get(cur.topic_id) ?? null : null;
  const leva = sibs.filter((x) => x.id !== cur.id && (x.link_kind === 'reaproveita' || (gate === 2 && cur.link_kind === 'matriz' && x.link_kind === 'adapta' && !x.creative_changed)));
  const creative = cur.creative_url;
  const thumb = driveThumb(creative);
  const lim = cur.channel_id ? chans.get(cur.channel_id)?.caption_limit : null;
  const cap = cur.caption ?? '';
  const pos = (gate === 1 ? q1 : q2).findIndex((x) => x.id === cur.id) + 1;
  const total = gate === 1 ? q1.length : q2.length;

  return (
    <>
      {tabs}{head}
      <div className="sp-appr">
        <div className="sp-appr-art">
          {thumb ? <img src={thumb} alt="Prévia do criativo no Drive" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
          <div className="sp-appr-ph">
            <span>{destLabel(cur, chans)}</span>
            <b>{cur.product || cur.pauta}</b>
            {creative
              ? <a className="sp-linkbtn" href={creative} target="_blank" rel="noreferrer">Abrir o criativo no Drive ↗</a>
              : <em>{gate === 1 ? 'Na etapa 1 se avalia a pauta e a legenda. O criativo vem depois.' : 'Sem criativo.'}</em>}
          </div>
        </div>
        <div className="sp-appr-info">
          <div className="sp-appr-prog"><span>{pos} de {total} · sai {brShort(cur.pub_date)}{cur.pub_time ? ` às ${hhmm(cur.pub_time)}` : ' · sem horário'}</span><i style={{ width: `${(pos / total) * 100}%` }} /></div>
          <h3 className="sp-panel-h3">{topic?.title || cur.pauta}</h3>
          <dl className="sp-kv">
            <dt>Destino</dt><dd><span className={`sp-badge b-${slug(cur.brand)}`}>{cur.brand}</span> {destLabel(cur, chans)} <span className={`sp-kind k-${cur.link_kind}`}>{KIND_LABEL[cur.link_kind]}</span></dd>
            {cur.week_theme && <><dt>Frente</dt><dd>{cur.week_theme}</dd></>}
            {cur.objective && <><dt>Objetivo</dt><dd>{cur.objective}</dd></>}
            {topic?.strategy && <><dt>Por que agora</dt><dd>{topic.strategy}</dd></>}
            {(cur.cta || cur.media_use) && <><dt>CTA · mídia</dt><dd>{[cur.cta, cur.media_use].filter(Boolean).join(' · ')}</dd></>}
            {leva.length > 0 && <><dt>Leva junto</dt><dd>{leva.map((x) => `${destLabel(x, chans).replace(/^[^·]+· /, '')} ${brShort(x.pub_date)}`).join(' · ')}</dd></>}
            {licBlocked(topic) && <><dt>Licenciado</dt><dd>Depois desta aprovação ainda falta o licenciador.</dd></>}
          </dl>
          <BriefRead brief={topic?.brief} keys={gate === 1 ? BRIEF_ETAPA1 : BRIEF_ETAPA2} title={gate === 1 ? 'Briefing: por que e para quem' : 'Briefing: o que a arte precisa ter'} />
          <h4 className="sp-sech" style={{ margin: '14px 0 6px' }}>Legenda {lim ? <small>{cap.length} / {lim} caracteres</small> : null}</h4>
          <div className={`sp-caption ${lim && cap.length > lim ? 'over' : ''}`}>{cap || '—'}</div>
          {matriz && cur.link_kind === 'adapta' && matriz.caption && <p className="sp-inherit">Legenda da matriz: “{matriz.caption.slice(0, 140)}{matriz.caption.length > 140 ? '…' : ''}”</p>}

          {!canDecide && <p className="sp-inherit" style={{ marginTop: 12 }}>Só o aprovador (ou a diretoria) decide. Você pode comentar na peça.</p>}
          {canDecide && (adjusting ? (
            <div style={{ marginTop: 12 }}>
              <label className="sp-erow"><span>O que precisa mudar</span>
                <textarea id="appr-note" rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: trocar o CTA, cortar a segunda frase" /></label>
              <div className="sp-abtns">
                <button className="sp-abtn aj" disabled={busy} onClick={() => act('ajuste')}>Enviar pedido de ajuste</button>
                <button className="sp-abtn zero" onClick={() => { setAdjusting(false); setNote(''); }}>cancelar</button>
              </div>
            </div>
          ) : (
            <div className="sp-abtns" style={{ marginTop: 14 }}>
              <button className="sp-abtn ok" disabled={busy} onClick={() => act('aprovada')}>Aprovar</button>
              <button className="sp-abtn aj" disabled={busy} onClick={() => setAdjusting(true)}>Pedir ajuste</button>
              <button className="sp-abtn" onClick={() => setSkip((s) => new Set(s).add(cur.id))}>Pular</button>
              <button className="sp-abtn zero" onClick={() => onOpen(cur.id)}>abrir peça e comentários</button>
            </div>
          ))}
          {msg && <div className="sp-saved">{msg}</div>}
        </div>
      </div>
    </>
  );
}
