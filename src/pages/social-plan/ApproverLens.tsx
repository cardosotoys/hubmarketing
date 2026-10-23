import { useState } from 'react';
import type { SocialPlanItem, SocialTopic } from '../../types/database';
import { decide } from './actions';
import { CreativeMedia } from './DrivePlayer';
import NetworkPreview from './NetworkPreview';
import { DOW, brShort, dowIndex, hhmm, inQueue1, inQueue2, licBlocked, previewItems, slug, type ChannelMap } from './shared';

/* Modo aprovador: quem só aprova vê o post como vai sair, a legenda, o porquê e onde ele vai.
 * Nada da construção (briefing, roteiro, direção de arte, vínculos, etapas) — isso é de quem cria.
 * As duas etapas viram uma fila só, em linguagem simples: "ideia e legenda" ou "arte final".
 * A segunda aba mostra como tudo fica em cada rede; tocar num post que espera decisão leva para ele. */

type Card = { item: SocialPlanItem; gate: 1 | 2 };

export default function ApproverLens({ live, byTopic, topicById, chans, meId, canDecide, approverName, meName, onExit, onChanged }: {
  live: SocialPlanItem[];
  byTopic: Map<string, SocialPlanItem[]>;
  topicById: Map<string, SocialTopic>;
  chans: ChannelMap;
  meId: string | null;
  canDecide: boolean;
  approverName: string | null;
  meName?: string | null;
  onExit?: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(0);
  const [tab, setTab] = useState<'aprovar' | 'redes'>('aprovar');
  const [focus, setFocus] = useState<string | null>(null);

  const when = (x: SocialPlanItem) => x.pub_date + (x.pub_time ?? '');
  const all: Card[] = [
    ...live.filter(inQueue1).map((item) => ({ item, gate: 1 as const })),
    ...live.filter(inQueue2).map((item) => ({ item, gate: 2 as const })),
  ].sort((a, b) => when(a.item).localeCompare(when(b.item)));
  const queue = all.filter((c) => !skip.has(c.item.id));
  const card = (focus && queue.find((c) => c.item.id === focus)) || queue[0];
  const first = (meName ?? '').split(' ')[0];

  const act = async (d: 'aprovada' | 'ajuste') => {
    if (!card) return;
    if (d === 'ajuste' && !note.trim()) { setMsg('Conte em uma frase o que precisa mudar.'); return; }
    setBusy(true); setMsg('');
    try {
      await decide(card.item, card.gate, d, meId, note);
      setFocus(null); setNote(''); setAdjusting(false); setDone((n) => n + 1);
      setMsg(d === 'aprovada' ? 'Aprovado ✓' : 'Ajuste enviado para quem está criando.');
      await onChanged();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };

  const top = (
    <header className="al-top">
      <div>
        <small>Cardoso Hub · Conteúdo</small>
        <b>{first ? `Olá, ${first}` : 'Para aprovar'}</b>
      </div>
      <span className="al-left">{queue.length ? <><b>{queue.length}</b> {queue.length === 1 ? 'post espera' : 'posts esperam'} você</> : 'Tudo em dia'}</span>
      {onExit && <button className="al-exit" onClick={onExit}>Centro completo</button>}
      <nav className="al-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'aprovar'} onClick={() => setTab('aprovar')}>Para aprovar{queue.length ? <span>{queue.length}</span> : null}</button>
        <button role="tab" aria-selected={tab === 'redes'} onClick={() => setTab('redes')}>Como fica nas redes</button>
      </nav>
    </header>
  );

  if (tab === 'redes') {
    const abrir = (id: string) => {
      if (!queue.some((c) => c.item.id === id)) return;
      setFocus(id); setAdjusting(false); setNote(''); setMsg(''); setTab('aprovar');
      window.scrollTo({ top: 0 });
    };
    return (
      <div className="al">
        {top}
        <p className="al-hint">Os posts do plano como vão aparecer em cada rede. Tocar num post que espera você leva direto para a aprovação dele.</p>
        <NetworkPreview items={previewItems(live, byTopic, topicById, chans)} onOpen={abrir} />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="al">
        {top}
        <div className="al-empty">
          <span aria-hidden>✓</span>
          <b>Nada esperando a sua aprovação</b>
          <p>{done ? `Você decidiu ${done} ${done === 1 ? 'post' : 'posts'} agora. ` : ''}{skip.size ? 'Os que você pulou voltam quando recarregar a página.' : 'Quando um post ficar pronto para você, ele aparece aqui.'}</p>
        </div>
      </div>
    );
  }

  const { item: cur, gate } = card;
  const topic = cur.topic_id ? topicById.get(cur.topic_id) ?? null : null;
  const brief = topic?.brief ?? {};
  const ch = cur.channel_id ? chans.get(cur.channel_id) : undefined;
  const sibs = cur.topic_id ? byTopic.get(cur.topic_id) ?? [] : [];
  // o que sai junto com esta decisão: o próprio post, o espelho no Facebook e os reaproveitamentos
  const juntos = sibs.filter((x) => x.id !== cur.id && (x.link_kind === 'reaproveita' || (gate === 2 && cur.link_kind === 'matriz' && x.link_kind === 'adapta' && !x.creative_changed)));
  const onde = [cur, ...juntos].sort((a, b) => when(a).localeCompare(when(b)));
  const rede = (x: SocialPlanItem) => {
    const c = x.channel_id ? chans.get(x.channel_id) : undefined;
    const nome = c ? (c.account === 'Cardoso' || c.account === x.brand ? c.name : `${c.account} · ${c.name}`) : (x.channel ?? '');
    return `${nome}${x.piece_type && !nome.includes(x.piece_type) ? ` · ${x.piece_type}` : ''}`;
  };
  const vertical = /Reels|Stories|Shorts|TikTok|Status/.test(`${cur.piece_type} ${ch?.name ?? ''}`);
  const titulo = topic?.title || cur.pauta;
  const porque = brief.meta || cur.objective;
  const contexto = topic?.strategy || brief.porque;
  const conta = (ch?.account ?? cur.brand).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pos = all.length - queue.length + 1;

  return (
    <div className="al">
      {top}
      <div className="al-prog" aria-hidden>{all.map((c, i) => <i key={c.item.id} className={i < pos - 1 ? 'on' : i === pos - 1 ? 'cur' : ''} />)}</div>

      <div className="al-body">
        {/* o post, do jeito que vai aparecer */}
        <section className={`al-stage b-${slug(cur.brand)}`}>
          <div className={`al-post ${vertical ? 'v' : 'q'}`}>
            <div className="al-post-head">
              <span className={`al-ava b-${slug(cur.brand)}`}>{cur.brand[0]}</span>
              <span><b>{conta}</b><small>{ch?.network ?? cur.network ?? ''}{cur.piece_type ? ` · ${cur.piece_type}` : ''}</small></span>
            </div>
            <CreativeMedia urls={cur.creative_slides?.length ? cur.creative_slides : cur.creative_url ? [cur.creative_url] : []} vertical={vertical} title={titulo} className={`al-media b-${slug(cur.brand)}`} poster={(
              <div className="al-poster">
                <b>{brief.texto_arte || cur.product || titulo}</b>
                {!cur.creative_url && <em>A arte é feita depois que você aprovar a ideia e a legenda.</em>}
              </div>
            )} />
            <div className="al-cap">
              <b>{conta}</b> {cur.caption}
            </div>
          </div>
        </section>

        {/* decisão: o que é, onde vai, por quê */}
        <section className="al-side">
          <p className={`al-what g${gate}`}>{gate === 1 ? 'Aprovar a ideia e a legenda' : 'Aprovar a arte final'}</p>
          <h2 className="al-title">{titulo}</h2>

          <div className="al-block">
            <h3>Onde vai sair</h3>
            <ul className="al-where">
              {onde.map((x) => (
                <li key={x.id}>
                  <span className="al-when"><b>{brShort(x.pub_date)}</b><small>{DOW[dowIndex(x.pub_date)].slice(0, 3)}{x.pub_time ? ` · ${hhmm(x.pub_time)}` : ''}</small></span>
                  <span className="al-net">{rede(x)}{x.mirror_facebook && (x.channel_id ? chans.get(x.channel_id)?.mirror : x.network === 'Instagram') ? <small>e no Facebook, igual</small> : null}</span>
                </li>
              ))}
            </ul>
          </div>

          {(porque || contexto) && (
            <div className="al-block">
              <h3>Por que este post</h3>
              {porque && <p className="al-why">{porque}</p>}
              {contexto && contexto !== porque && <p className="al-ctx">{contexto}</p>}
              {brief.publico && <p className="al-ctx"><b>Fala com:</b> {brief.publico}</p>}
            </div>
          )}

          {licBlocked(topic) && <p className="al-note">Produto licenciado: depois de você, o licenciador ainda precisa aprovar.</p>}
          {msg && <p className="al-msg">{msg}</p>}

          {canDecide ? (
            <div className={`al-bar ${adjusting ? 'adj' : ''}`}>
              {adjusting ? (
                <>
                  <textarea rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que precisa mudar? Ex.: trocar a chamada do fim, deixar a legenda mais curta" />
                  <div className="al-row">
                    <button className="al-btn ghost" onClick={() => { setAdjusting(false); setNote(''); setMsg(''); }}>Voltar</button>
                    <button className="al-btn warn" disabled={busy} onClick={() => act('ajuste')}>Enviar ajuste</button>
                  </div>
                </>
              ) : (
                <div className="al-row">
                  <button className="al-btn ghost" onClick={() => { setSkip((s) => new Set(s).add(cur.id)); setFocus(null); setMsg(''); }}>Depois</button>
                  <button className="al-btn" disabled={busy} onClick={() => { setAdjusting(true); setMsg(''); }}>Pedir ajuste</button>
                  <button className="al-btn pri" disabled={busy} onClick={() => act('aprovada')}>Aprovar</button>
                </div>
              )}
            </div>
          ) : <p className="al-note">Esta é a tela de quem aprova. Só {approverName ?? 'o aprovador'} decide por aqui.</p>}
        </section>
      </div>
    </div>
  );
}
