import { useState } from 'react';
import type { SocialPlanItem, SocialTopic } from '../../types/database';
import { decide } from './actions';
import { CreativeMedia } from './DrivePlayer';
import { BRIEF_ETAPA1, BRIEF_ETAPA2, BriefRead } from './Brief';
import { KIND_LABEL, brShort, destLabel, hhmm, inQueue1, inQueue2, licBlocked, slug, type ChannelMap } from './shared';

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
  const lim = cur.channel_id ? chans.get(cur.channel_id)?.caption_limit : null;
  const cap = cur.caption ?? '';
  const pos = (gate === 1 ? q1 : q2).findIndex((x) => x.id === cur.id) + 1;
  const total = gate === 1 ? q1.length : q2.length;

  const ch = cur.channel_id ? chans.get(cur.channel_id) : undefined;
  const vertical = /Reels|Stories|Shorts|TikTok|Status/.test(`${cur.piece_type} ${ch?.name ?? ''}`);
  const brief = topic?.brief ?? {};
  const temBrief = (gate === 1 ? BRIEF_ETAPA1 : BRIEF_ETAPA2).some((k) => brief[k]);
  const titulo = topic?.title || cur.pauta;

  return (
    <>
      {tabs}{head}
      <div className="ap">
        <div className="ap-art">
          <CreativeMedia urls={cur.creative_slides?.length ? cur.creative_slides : creative ? [creative] : []} vertical={vertical} title={titulo} className={`ap-media b-${slug(cur.brand)}`} poster={(
            <div className="ap-poster">
              <span>{cur.brand}</span>
              <b>{brief.texto_arte || cur.product || titulo}</b>
              {!creative && <em>{gate === 1 ? 'Na etapa 1 se avalia a pauta e a legenda. O criativo vem depois.' : 'Sem criativo.'}</em>}
            </div>
          )} />
        </div>

        <div className="ap-info">
          <div className="ap-prog"><i style={{ width: `${(pos / total) * 100}%` }} /></div>
          <p className="ap-count"><b>{pos}</b> de {total} · sai {brShort(cur.pub_date)}{cur.pub_time ? ` às ${hhmm(cur.pub_time)}` : ''}</p>
          <h3 className="ap-title">{titulo}</h3>
          <p className="ap-where">
            <span className={`sp-badge b-${slug(cur.brand)}`}>{cur.brand}</span>
            <span>{destLabel(cur, chans).replace(/^[^·]+· /, '')}</span>
            <span className={`sp-kind k-${cur.link_kind}`}>{KIND_LABEL[cur.link_kind]}</span>
          </p>
          {leva.length > 0 && (
            <p className="ap-leva">Leva junto: {leva.map((x) => `${destLabel(x, chans).replace(/^[^·]+· /, '')} ${brShort(x.pub_date)}`).join(' · ')}</p>
          )}
          {licBlocked(topic) && <p className="ap-warn">Produto licenciado: depois desta aprovação ainda falta o licenciador.</p>}

          <section className="ap-sec ap-cap">
            <h4>Legenda {lim ? <small className={cap.length > lim ? 'over' : ''}>{cap.length}/{lim}</small> : null}</h4>
            <p>{cap || '—'}</p>
            {matriz && cur.link_kind === 'adapta' && matriz.caption && <p className="ap-dim">Legenda da matriz: “{matriz.caption.slice(0, 140)}{matriz.caption.length > 140 ? '…' : ''}”</p>}
          </section>

          <details className="ap-sec" open={gate === 1}>
            <summary>Por que esta peça existe</summary>
            {(brief.meta || cur.objective) && <p className="ap-lead">{brief.meta || cur.objective}</p>}
            {(topic?.strategy || brief.porque) && <p>{topic?.strategy || brief.porque}</p>}
            <dl className="ap-dl">
              {brief.publico && <><dt>Para quem</dt><dd>{brief.publico}</dd></>}
              {brief.mensagem && <><dt>O que dizer</dt><dd>{brief.mensagem}</dd></>}
              {(cur.cta || cur.media_use) && <><dt>Chamada</dt><dd>{[cur.cta, cur.media_use].filter(Boolean).join(' · ')}</dd></>}
              {cur.week_theme && <><dt>Frente</dt><dd>{cur.week_theme}</dd></>}
            </dl>
          </details>

          {temBrief && gate === 2 && (
            <details className="ap-sec" open>
              <summary>O que a arte precisa ter</summary>
              <BriefRead brief={brief} keys={BRIEF_ETAPA2} title="" />
            </details>
          )}

          {!canDecide && <p className="ap-dim" style={{ marginTop: 12 }}>Só o aprovador (ou a diretoria) decide. Você pode comentar na peça.</p>}
          {msg && <p className="ap-msg">{msg}</p>}

          {canDecide && (
            <div className={`ap-bar ${adjusting ? 'adj' : ''}`}>
              {adjusting ? (
                <>
                  <textarea id="appr-note" rows={2} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que precisa mudar? Ex.: trocar o CTA, cortar a segunda frase" />
                  <div className="ap-bar-row">
                    <button className="ap-btn ghost" onClick={() => { setAdjusting(false); setNote(''); }}>Cancelar</button>
                    <button className="ap-btn warn" disabled={busy} onClick={() => act('ajuste')}>Enviar ajuste</button>
                  </div>
                </>
              ) : (
                <div className="ap-bar-row">
                  <button className="ap-btn ghost" onClick={() => setSkip((s) => new Set(s).add(cur.id))}>Pular</button>
                  <button className="ap-btn" disabled={busy} onClick={() => setAdjusting(true)}>Pedir ajuste</button>
                  <button className="ap-btn pri" disabled={busy} onClick={() => act('aprovada')}>Aprovar</button>
                </div>
              )}
            </div>
          )}
          <button className="ap-open" onClick={() => onOpen(cur.id)}>Abrir a peça completa e os comentários →</button>
        </div>
      </div>
    </>
  );
}
