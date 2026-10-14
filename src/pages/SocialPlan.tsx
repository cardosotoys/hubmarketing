import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import { fetchReactions, toggleReaction, type ReactionMap } from '../lib/reactions';
import type { Profile, SocialChannel, SocialPlanItem, SocialPlanComment, SocialPlanDeadline, SocialStrategyNote, SocialTopic } from '../types/database';
import { Linkify } from './social-plan/Brief';
import DrivePlayer from './social-plan/DrivePlayer';
import { KIND_LABEL, destLabel, effective, previewItems, hhmm, inQueue1, inQueue2, ownGate1, ownGate2, pieceState, slug } from './social-plan/shared';
import { decide, gateOwner, setStage } from './social-plan/actions';
import ApprovalView from './social-plan/ApprovalView';
import ApproverLens from './social-plan/ApproverLens';
import CentralView from './social-plan/CentralView';
import MateriaisView from './social-plan/MateriaisView';
import ComercialView from './social-plan/ComercialView';
import { useCommercial } from './social-plan/useCommercial';
import FinalTab from './social-plan/FinalTab';
import NetworkPreview from './social-plan/NetworkPreview';
import StrategyView from './social-plan/StrategyView';
import { MonthView, WeekView } from './social-plan/CalendarViews';
import AssuntosView from './social-plan/AssuntosView';
import TopicSheet from './social-plan/TopicSheet';

/* ------------------------------------------------------------------ *
 * Centro de Operações de Conteúdo — planejamento de mídias digitais.
 * Um ASSUNTO (social_topics) tem vários DESTINOS (social_plan_items):
 * canal, dia, hora, legenda, criativo e o vínculo com a matriz.
 * Aprovação/ajuste, comentários em thread com menção e notificação
 * que abre direto na peça continuam por destino.
 * ------------------------------------------------------------------ */

const stMark = (s: SocialPlanItem['status']) => (s === 'aprovada' ? 'ok' : s === 'ajuste' ? 'aj' : '');
const brFmt = (iso: string) => iso.split('-').reverse().join('/');
const timeAgo = (iso: string) => {
  const d = new Date(iso).getTime(), diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

type View = 'central' | 'aprovacao' | 'cal' | 'assuntos' | 'materiais' | 'comercial' | 'final' | 'estrategia' | 'feed' | 'lista' | 'prazos';
type CalMode = 'semana' | 'mes';
type Filters = {
  marca: Set<string>; rede: Set<string>; tipo: Set<string>; origem: Set<string>;
  mes: Set<string>; status: Set<string>; q: string;
};
const emptyFilters = (): Filters => ({
  marca: new Set(), rede: new Set(), tipo: new Set(), origem: new Set(), mes: new Set(), status: new Set(), q: '',
});

export default function SocialPlan() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<SocialPlanItem[]>([]);
  const [topics, setTopics] = useState<SocialTopic[]>([]);
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [merged, setMerged] = useState<Map<string, string>>(new Map());
  const [deadlines, setDeadlines] = useState<SocialPlanDeadline[]>([]);
  const [notes, setNotes] = useState<SocialStrategyNote[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [commentItemIds, setCommentItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('central');
  const [calMode, setCalMode] = useState<CalMode>('semana');
  const [f, setF] = useState<Filters>(emptyFilters);
  const [selId, setSelId] = useState<string | null>(null);
  const [topicSheet, setTopicSheet] = useState<{ id: string | null } | null>(null);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [flash, setFlash] = useState('');
  const [moreF, setMoreF] = useState(false);
  // escolha entre modo aprovador e Centro completo fica guardada neste navegador
  const [lensPref, setLensPrefState] = useState<boolean | null>(() => {
    try { const v = localStorage.getItem('coc-lens'); return v === null ? null : v === '1'; } catch { return null; }
  });
  const setLensPref = (v: boolean) => {
    setLensPrefState(v);
    try { localStorage.setItem('coc-lens', v ? '1' : '0'); } catch { /* sem armazenamento: vale só nesta visita */ }
  };
  const com = useCommercial(view === 'materiais' || view === 'comercial' || view === 'final');

  const load = useCallback(async () => {
    const [it, tp, ch, ar, dl, pf, cm, st, nt] = await Promise.all([
      supabase.from('social_plan_items').select('*').eq('archived', false).order('pub_date'),
      supabase.from('social_topics').select('*'),
      supabase.from('social_channels').select('*').order('ord'),
      supabase.from('social_plan_items').select('id, merged_into').eq('archived', true),
      supabase.from('social_plan_deadlines').select('*').order('ord'),
      supabase.from('profiles').select('*').order('name'),
      supabase.from('social_plan_comments').select('item_id'),
      supabase.from('social_plan_settings').select('*').eq('id', 1).single(),
      supabase.from('social_strategy_notes').select('*').order('ord'),
    ]);
    setNotes((nt.data as SocialStrategyNote[]) ?? []);
    // antes da migration 0108 a coluna archived não existe: cai no modo antigo em vez de esvaziar a tela
    let itData = it.data as SocialPlanItem[] | null;
    if (it.error) itData = ((await supabase.from('social_plan_items').select('*').order('pub_date')).data as SocialPlanItem[]) ?? [];
    setItems((itData ?? []).map((x) => ({ ...x, link_kind: x.link_kind ?? 'matriz', creative_status: x.creative_status ?? 'pendente' })));
    setTopics((tp.data as SocialTopic[]) ?? []);
    setChannels((ch.data as SocialChannel[]) ?? []);
    setMerged(new Map(((ar.data as { id: string; merged_into: string | null }[]) ?? []).filter((x) => x.merged_into).map((x) => [x.id, x.merged_into!])));
    setDeadlines((dl.data as SocialPlanDeadline[]) ?? []);
    setProfiles((pf.data as Profile[]) ?? []);
    setCommentItemIds(new Set(((cm.data as { item_id: string }[]) ?? []).map((c) => c.item_id)));
    // um ou mais aprovadores (0117); antes dela só existe approver_id
    const sd = st.data as { approver_id: string | null; approver_ids?: string[] | null } | null;
    setApproverIds(sd?.approver_ids?.length ? sd.approver_ids : sd?.approver_id ? [sd.approver_id] : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // realtime: peça, assunto ou comentário novo reflete sozinho
  useEffect(() => {
    const ch = supabase
      .channel('social-plan')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_plan_items' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_topics' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_plan_comments' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const chans = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const byTopic = useMemo(() => {
    const m = new Map<string, SocialPlanItem[]>();
    items.forEach((x) => { if (x.topic_id) (m.get(x.topic_id) ?? m.set(x.topic_id, []).get(x.topic_id)!).push(x); });
    return m;
  }, [items]);
  const isFuture = useCallback((x: SocialPlanItem) => !!(x.channel_id && chans.get(x.channel_id)?.future), [chans]);

  // deep-link ?item=ID → abre a peça (vindo da notificação); Facebook espelho antigo cai na peça do Instagram
  useEffect(() => {
    const raw = params.get('item');
    const id = raw && merged.has(raw) ? merged.get(raw)! : raw;
    if (id && items.some((x) => x.id === id)) setSelId(id);
    const tid = params.get('assunto');
    if (tid && topicById.has(tid)) setTopicSheet({ id: tid });
  }, [params, items, merged, topicById]);

  const openItem = (id: string) => {
    setTopicSheet(null);
    setSelId(id);
    const p = new URLSearchParams(params);
    p.set('item', id); p.delete('assunto');
    setParams(p, { replace: true });
  };
  const closeSheet = () => {
    setSelId(null);
    const p = new URLSearchParams(params);
    p.delete('item'); p.delete('focus');
    setParams(p, { replace: true });
  };
  const openTopic = (id: string | null) => {
    setSelId(null);
    setTopicSheet({ id });
    const p = new URLSearchParams(params);
    p.delete('item'); p.delete('focus');
    if (id) p.set('assunto', id); else p.delete('assunto');
    setParams(p, { replace: true });
  };
  const closeTopic = () => {
    setTopicSheet(null);
    const p = new URLSearchParams(params);
    p.delete('assunto');
    setParams(p, { replace: true });
  };

  const toggle = (key: keyof Filters, v: string) => {
    setF((prev) => {
      const set = new Set(prev[key] as Set<string>);
      if (set.has(v)) set.delete(v); else set.add(v);
      return { ...prev, [key]: set };
    });
  };
  const clearFilters = () => setF(emptyFilters());
  const extraN = f.rede.size + f.tipo.size + f.origem.size + f.mes.size + f.status.size;

  const pass = useCallback((x: SocialPlanItem) => {
    if (reviewOnly && !(x.awaiting_review && !!profile?.id && approverIds.includes(profile.id))) return false;
    if (f.marca.size && !f.marca.has(x.brand)) return false;
    if (f.rede.size && !f.rede.has(x.network)) return false;
    if (f.tipo.size && !f.tipo.has(x.piece_type)) return false;
    if (f.origem.size && !f.origem.has(x.origin)) return false;
    if (f.mes.size && !f.mes.has(x.month_label)) return false;
    if (f.status.size) {
      const rot = x.status === 'aprovada' ? 'Aprovada' : x.status === 'ajuste' ? 'Com ajuste' : 'Pendente';
      let bate = f.status.has(rot);
      if (f.status.has('Com comentário') && commentItemIds.has(x.id)) bate = true;
      if (!bate) return false;
    }
    if (f.q) {
      const blob = `${x.pauta} ${x.sku} ${x.product} ${x.week_theme} ${x.objective} ${x.format} ${x.caption ?? ''}`.toLowerCase();
      if (!blob.includes(f.q)) return false;
    }
    return true;
  }, [f, commentItemIds, reviewOnly, profile?.id]);

  // peças em canal futuro (ex.: TikTok da Playmi) ficam guardadas: só aparecem no assunto
  const live = useMemo(() => items.filter((x) => !isFuture(x)), [items, isFuture]);
  const rows = useMemo(() => live.filter(pass), [live, pass]);
  const shownTopics = useMemo(() => {
    const ids = new Set(rows.map((x) => x.topic_id));
    return topics.filter((t) => ids.has(t.id));
  }, [rows, topics]);
  const meses = useMemo(() => {
    const m = new Map<string, string>();
    live.forEach((x) => { if (x.month_label) m.set(x.pub_date.slice(0, 7), x.month_label); });
    return [...m.entries()].sort().map(([, v]) => v);
  }, [live]);
  const fronts = useMemo(() => [...new Set(topics.map((t) => t.front).filter(Boolean))].sort(), [topics]);

  const myReviews = useMemo(
    () => (profile?.id && approverIds.includes(profile.id) ? live.filter((x) => x.awaiting_review) : []),
    [live, profile?.id, approverIds],
  );
  const isPriv = profile?.role === 'diretoria' || profile?.role === 'administrador';
  // qualquer aprovador decide: o primeiro que aprovar ou pedir ajuste resolve o post
  const isApprover = !!profile?.id && approverIds.includes(profile.id);
  const canDecide = isPriv || isApprover;
  const approverId = approverIds[0] ?? null;
  const filaN = useMemo(() => live.filter((x) => inQueue1(x) || inQueue2(x)).length, [live]);
  const approverList = approverIds.map((id) => profiles.find((p) => p.id === id)?.name).filter(Boolean) as string[];
  // um aprovador: nome inteiro; vários: só os primeiros nomes ("Fabiana ou João")
  const approverName = !approverList.length ? null : approverList.length === 1 ? approverList[0] : approverList.map((n) => n.split(' ')[0]).join(' ou ');

  const toggleApprover = async (id: string) => {
    const next = approverIds.includes(id) ? approverIds.filter((x) => x !== id) : [...approverIds, id];
    setApproverIds(next);
    const now = new Date().toISOString();
    const { error } = await supabase.from('social_plan_settings').update({ approver_ids: next, approver_id: next[0] ?? null, updated_at: now }).eq('id', 1);
    if (error) {
      // sem a 0117 só cabe um aprovador
      await supabase.from('social_plan_settings').update({ approver_id: next[next.length - 1] ?? null, updated_at: now }).eq('id', 1);
      setApproverIds(next.length ? [next[next.length - 1]] : []);
      showFlash('Para ter mais de um aprovador, rode a migration 0117 no Supabase.');
    }
  };



  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash((c) => (c === m ? '' : c)), 2600); };
  const selected = selId ? items.find((x) => x.id === selId) ?? null : null;
  const sheetTopic = topicSheet?.id ? topicById.get(topicSheet.id) ?? null : null;

  const topicEditor = (inline: boolean) => topicSheet && (
    <TopicSheet
      key={topicSheet.id ?? 'novo'}
      inline={inline}
      topic={sheetTopic}
      items={sheetTopic ? byTopic.get(sheetTopic.id) ?? [] : []}
      channels={channels}
      chans={chans}
      me={profile}
      isPriv={isPriv}
      fronts={fronts}
      notes={notes}
      onClose={closeTopic}
      onOpenItem={openItem}
      onSaved={async (tid) => {
        await load();
        if (inline && tid) openTopic(tid); else closeTopic();
        showFlash(tid ? 'Assunto salvo' : 'Assunto excluído');
      }}
    />
  );

  if (loading) return <Loading />;

  // o aprovador entra direto no modo aprovador (qualquer perfil); pode trocar pelo botão e a escolha fica guardada
  const lens = lensPref ?? isApprover;
  if (lens) {
    return (
      <div className="sp al-shell">
        <ApproverLens live={live} byTopic={byTopic} topicById={topicById} chans={chans} meId={profile?.id ?? null}
          canDecide={canDecide} approverName={approverName} meName={profile?.name ?? null} onExit={() => setLensPref(false)} onChanged={load} />
      </div>
    );
  }

  return (
    <div className="sp">
      {/* ---------- cabeçalho (casca do protótipo: faixa Azul Universo com as abas) ---------- */}
      <header className="coc-head">
        <div className="coc-top">
          <div className="coc-brand">
            <div className="coc-logo">C</div>
            <div><small>Cardoso Hub · Marketing</small><b>Centro de Operações de Conteúdo</b></div>
          </div>
          <div className="coc-actions">
            {isPriv && (
              <div className="coc-approver" title="Quem aprova as peças e libera materiais e banners. Com mais de um, qualquer um decide.">
                <span>{approverList.length > 1 ? 'Aprovadores' : 'Aprovador'}</span>
                <button type="button" className="coc-apick" aria-expanded={pickOpen} onClick={() => setPickOpen((v) => !v)}>
                  {approverList.length ? `${approverList[0].split(' ')[0]}${approverList.length > 1 ? ` +${approverList.length - 1}` : ''}` : 'ninguém definido'} ▾
                </button>
                {pickOpen && (
                  <>
                    <div className="coc-apick-bg" onClick={() => setPickOpen(false)} />
                    <div className="coc-apick-pop" role="listbox" aria-multiselectable>
                      <p>Qualquer um deles aprova. O primeiro que decidir resolve o post.</p>
                      {profiles.filter((p) => !p.disabled).map((p) => (
                        <label key={p.id}>
                          <input type="checkbox" checked={approverIds.includes(p.id)} onChange={() => toggleApprover(p.id)} />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button className="coc-lens" onClick={() => setLensPref(true)} title="A tela de quem só aprova: o post, a legenda, o porquê e onde vai sair">Ver como aprovador</button>
            <button className="coc-new" onClick={() => { setView('assuntos'); openTopic(null); }}>Novo assunto</button>
          </div>
        </div>
        <nav className="coc-tabs" role="tablist">
          {([['central', 'Central'], ['aprovacao', 'Aprovação'], ['cal', 'Calendário'], ['assuntos', 'Assuntos'], ['materiais', 'Banco de materiais'], ['comercial', 'Área comercial'], ['final', 'Visão final'], ['estrategia', 'Estratégia e cronograma'], ['feed', 'Prévia por rede'], ['lista', 'Lista'], ['prazos', 'Prazos comerciais']] as [View, string][]).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{label}{v === 'aprovacao' && filaN > 0 ? <span className="coc-cnt">{filaN}</span> : null}</button>
          ))}
        </nav>
      </header>
      {myReviews.length > 0 && (
        <div className="sp-reviewbanner coc-review">
          <span><b>{myReviews.length}</b> peça(s) esperando a sua aprovação</span>
          <button className={reviewOnly ? 'on' : ''} onClick={() => setReviewOnly((v) => !v)}>
            {reviewOnly ? 'Mostrar todas' : 'Ver só as minhas'}
          </button>
        </div>
      )}

      {/* ---------- filtros ---------- */}
      {!['prazos', 'central', 'aprovacao', 'materiais', 'comercial', 'final', 'estrategia'].includes(view) && (
        <div className="sp-filters coc-filters">
          <div className="coc-frow">
            <div className="sp-searchwrap">
              <span aria-hidden>🔍</span>
              <input type="search" placeholder="produto, SKU, pauta, legenda…" value={f.q}
                onChange={(e) => setF((p) => ({ ...p, q: e.target.value.toLowerCase().trim() }))} />
            </div>
            <Chips vals={['Playmi', 'Tópi', 'Cardoso']} sel={f.marca} onClick={(v) => toggle('marca', v)} tone="marca" />
            <button className={`sp-clear ${moreF ? 'on' : ''}`} onClick={() => setMoreF((v) => !v)}>
              {moreF ? 'Menos filtros' : 'Mais filtros'}{extraN ? ` (${extraN})` : ''}
            </button>
            <div className="sp-fmeta">
              <span className="sp-count"><b>{rows.length}</b> de {live.length} destinos</span>
              {(extraN > 0 || f.marca.size > 0 || !!f.q) && <button className="sp-clear" onClick={clearFilters}>limpar</button>}
            </div>
          </div>
          {moreF && (
            <div className="sp-frow coc-fmore">
              <FGroup label="Rede"><Chips vals={['Instagram', 'Facebook', 'TikTok', 'YouTube Shorts', 'Pinterest', 'LinkedIn', 'WhatsApp', 'Google Meu Negócio']} sel={f.rede} onClick={(v) => toggle('rede', v)} /></FGroup>
              <FGroup label="Tipo de peça"><Chips vals={['Reels', 'Feed', 'Stories', 'LinkedIn', 'Pin']} sel={f.tipo} onClick={(v) => toggle('tipo', v)} tone="red" /></FGroup>
              <FGroup label="Produção"><Chips vals={['Original', 'Apoio', 'Reaproveitamento']} sel={f.origem} onClick={(v) => toggle('origem', v)} /></FGroup>
              {view !== 'assuntos' && <FGroup label="Mês"><Chips vals={meses} sel={f.mes} onClick={(v) => toggle('mes', v)} /></FGroup>}
              <FGroup label="Aprovação"><Chips vals={['Pendente', 'Aprovada', 'Com ajuste', 'Com comentário']} sel={f.status} onClick={(v) => toggle('status', v)} /></FGroup>
            </div>
          )}
        </div>
      )}

      <main className="sp-main">
        {flash && <div className="sp-saved" style={{ marginBottom: 12 }}>{flash}</div>}
        {view === 'central' && (
          <CentralView live={live} byTopic={byTopic} topicById={topicById} chans={chans} deadlines={deadlines} meId={profile?.id ?? null}
            onOpen={openItem} onOpenTopic={openTopic} onGoApproval={() => setView('aprovacao')} onChanged={load} />
        )}
        {view === 'aprovacao' && (
          <ApprovalView live={live} byTopic={byTopic} topicById={topicById} chans={chans} meId={profile?.id ?? null}
            canDecide={canDecide} approverName={approverName} onOpen={openItem} onChanged={load} />
        )}
        {view === 'materiais' && (com.loaded
          ? <MateriaisView materials={com.materials} products={com.products} board={com.board} profiles={profiles} meId={profile?.id ?? null}
              canRelease={canDecide} error={com.error} onChanged={async () => { await com.reload(); await load(); }} onOpenTopic={openTopic} />
          : <Loading />)}
        {view === 'comercial' && (com.loaded
          ? <ComercialView materials={com.materials} banners={com.banners} board={com.board} products={com.products} profiles={profiles}
              deadlines={deadlines} canRelease={canDecide} error={com.error} onChanged={com.reload} />
          : <Loading />)}
        {view === 'final' && (com.loaded
          ? <FinalTab live={live} byTopic={byTopic} topicById={topicById} chans={chans} banners={com.banners} materials={com.materials} products={com.products} />
          : <Loading />)}
        {view === 'estrategia' && (
          <StrategyView live={live} byTopic={byTopic} topicById={topicById} deadlines={deadlines} notes={notes} canMark={canDecide} isPriv={isPriv}
            meId={profile?.id ?? null} onChanged={load} />
        )}
        {view === 'cal' && (
          <>
            <div className="sp-calmode" role="tablist">
              <button role="tab" aria-selected={calMode === 'semana'} onClick={() => setCalMode('semana')}>Semana</button>
              <button role="tab" aria-selected={calMode === 'mes'} onClick={() => setCalMode('mes')}>Mês</button>
            </div>
            {calMode === 'semana'
              ? <WeekView rows={rows} chans={chans} onOpen={openItem} hasComment={commentItemIds} />
              : <MonthView rows={rows} chans={chans} onOpen={openItem} hasComment={commentItemIds} />}
          </>
        )}
        {view === 'assuntos' && (
          <AssuntosView topics={shownTopics} byTopic={byTopic} chans={chans} selectedId={topicSheet?.id ?? null} onSelect={openTopic} onBack={closeTopic}
            editor={topicSheet ? topicEditor(true) : null} />
        )}
        {view === 'feed' && <NetworkPreview items={previewItems(rows, byTopic, topicById, chans)} onOpen={openItem} />}
        {view === 'lista' && <ListView rows={rows} onOpen={openItem} hasComment={commentItemIds} />}
        {view === 'prazos' && <PrazosView deadlines={deadlines} />}

        {(view === 'cal' || view === 'assuntos') && (
          <div className="sp-legend">
            <span><i className="sw k-matriz" />Matriz: a peça principal do assunto</span>
            <span><i className="sw k-reaproveita" />Reaproveita: mesma legenda e criativo</span>
            <span><i className="sw k-adapta" />Adapta: legenda própria</span>
            <span><i style={{ background: '#EAF6F0', border: '1px solid #2E9E6B' }} />Aprovada</span>
            <span><i style={{ background: '#FDF5E4', border: '1px solid #E0A02B' }} />Com ajuste</span>
          </div>
        )}
      </main>

      {selected && (
        <DetailSheet
          key={selected.id}
          item={selected}
          siblings={selected.topic_id ? byTopic.get(selected.topic_id) ?? [] : []}
          topic={selected.topic_id ? topicById.get(selected.topic_id) ?? null : null}
          chans={chans}
          me={profile}
          profiles={profiles}
          approverId={approverId}
          approverName={approverName}
          canDecide={canDecide}
          focusComments={params.get('focus') === 'comments'}
          onClose={closeSheet}
          onOpen={openItem}
          onEditTopic={openTopic}
          onChanged={load}
        />
      )}

      {topicSheet && view !== 'assuntos' && topicEditor(false)}
    </div>
  );
}

/* ---------------- filtros ---------------- */
function FGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="sp-fgroup"><span className="sp-flabel">{label}</span>{children}</div>;
}
function Chips({ vals, sel, onClick, tone }: { vals: string[]; sel: Set<string>; onClick: (v: string) => void; tone?: string }) {
  return (
    <div className="sp-chips">
      {vals.map((v) => (
        <button key={v} className="sp-chip" data-v={v} data-tone={tone} aria-pressed={sel.has(v)} onClick={() => onClick(v)}>{v}</button>
      ))}
    </div>
  );
}

/* ---------------- lista ---------------- */
function ListView({ rows, onOpen, hasComment }: { rows: SocialPlanItem[]; onOpen: (id: string) => void; hasComment: Set<string> }) {
  if (!rows.length) return <Vazio />;
  return (
    <table className="sp-table">
      <thead><tr>
        <th>Data</th><th>Marca</th><th>Rede</th><th>Tipo</th><th>Formato</th><th>Produto</th><th>SKU</th><th>Pauta</th><th>Objetivo</th>
      </tr></thead>
      <tbody>
        {rows.map((x) => {
          const o = x.origin === 'Reaproveitamento' ? 'o-reap' : x.origin === 'Apoio' ? 'o-apoio' : '';
          const s = stMark(x.status);
          return (
            <tr key={x.id} className={`${o} ${s ? 'st-' + s : ''}`} onClick={() => onOpen(x.id)}>
              <td className="mono">{x.pub_date.slice(8, 10)}/{x.pub_date.slice(5, 7)}<br />{x.weekday.slice(0, 3)}{x.pub_time ? ` · ${x.pub_time.slice(0, 5)}` : ''}</td>
              <td><span className={`sp-badge b-${slug(x.brand)}`}>{x.brand}</span></td>
              <td className="mono">{x.network}</td>
              <td><span className={`sp-badge t-${slug(x.piece_type)}`}>{x.piece_type}</span></td>
              <td>{x.format}</td>
              <td><b>{x.product}</b></td>
              <td className="mono">{x.sku}</td>
              <td>{x.pauta}</td>
              <td>{x.objective}{hasComment.has(x.id) ? <div className="sp-listcmt">💬 tem comentário</div> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ---------------- prazos ---------------- */
function PrazosView({ deadlines }: { deadlines: SocialPlanDeadline[] }) {
  const grupos: Record<string, SocialPlanDeadline[]> = {};
  deadlines.forEach((p) => { (grupos[p.marco] = grupos[p.marco] || []).push(p); });
  if (!deadlines.length) return <Vazio msg="Sem prazos cadastrados." />;
  return (
    <>
      {Object.entries(grupos).map(([marco, its]) => (
        <div className="sp-tlmarco" key={marco}>
          <h3>{marco}</h3>
          <div className="when">a contagem regressiva abaixo termina no dia do marco</div>
          {its.map((p) => {
            const urg = parseInt(String(p.dm).replace(/\D/g, '')) <= 15;
            return (
              <div className="sp-tlrow" key={p.id}>
                <span className={`dm ${urg ? 'urg' : ''}`}>{p.dm}</span>
                <span className="lim">{p.limite ? brFmt(p.limite) : '—'}</span>
                <span>{p.acao}</span>
                <span className="resp">{p.resp}</span>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Vazio({ msg }: { msg?: string }) {
  return (
    <div className="sp-empty">
      <b>Nada por aqui com esses filtros</b>
      {msg || 'Ajuste ou limpe os filtros para ver as publicações.'}
    </div>
  );
}

/* ================= painel do destino (aprovação + comentários) ================= */
export function DetailSheet({ item, siblings, topic, chans, me, profiles, approverId, approverName, canDecide, focusComments, onClose, onOpen, onEditTopic, onChanged }: {
  item: SocialPlanItem;
  siblings: SocialPlanItem[];
  topic: SocialTopic | null;
  chans: Map<string, SocialChannel>;
  me: Profile | null;
  profiles: Profile[];
  approverId: string | null;
  approverName: string | null;
  canDecide: boolean;
  focusComments: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onEditTopic: (id: string) => void;
  onChanged: () => void;
}) {
  const [comments, setComments] = useState<(SocialPlanComment & { author: { name: string } | null })[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [text, setText] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [flash, setFlash] = useState('');
  const commentsRef = useRef<HTMLDivElement>(null);
  const active = profiles.filter((p) => !p.disabled);

  const matriz = siblings.find((x) => x.link_kind === 'matriz');
  const eff = effective(item, matriz);
  const others = siblings.filter((x) => x.id !== item.id).sort((a, b) => (a.pub_date + (a.pub_time ?? '')).localeCompare(b.pub_date + (b.pub_time ?? '')));

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('social_plan_comments')
      .select('*, author:profiles(name)')
      .eq('item_id', item.id)
      .order('created_at');
    const list = (data as (SocialPlanComment & { author: { name: string } | null })[]) ?? [];
    setComments(list);
    setReactions(await fetchReactions('social_plan', list.map((c) => c.id), me?.id));
  }, [item.id, me?.id]);

  const like = async (cid: string) => {
    if (!me) return;
    const cur = reactions.get(cid) ?? { count: 0, mine: false };
    // otimista
    setReactions((prev) => { const m = new Map(prev); m.set(cid, { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine }); return m; });
    await toggleReaction('social_plan', cid, me.id, cur.mine);
  };

  const saveCommentEdit = async (cid: string) => {
    const body = editText.trim();
    if (!body) return;
    await supabase.from('social_plan_comments').update({ body, edited_at: new Date().toISOString() }).eq('id', cid);
    setEditingId(null); setEditText(''); await loadComments();
  };

  useEffect(() => { loadComments(); }, [loadComments]);
  useEffect(() => {
    if (focusComments) setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' }), 250);
  }, [focusComments]);

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash((c) => (c === m ? '' : c)), 2200); };

  // decisão de uma etapa: vai para a peça dona dela (quem reaproveita decide na matriz)
  const setGate = async (gate: 1 | 2, next: SocialPlanItem['status'], note?: string) => {
    try {
      await decide(gateOwner(item, gate, matriz), gate, next, me?.id ?? null, note);
      showFlash(next === 'aprovada' ? `etapa ${gate} aprovada` : next === 'ajuste' ? 'ajuste pedido' : 'voltou para pendente');
    } catch (e) { showFlash((e as Error).message); }
    onChanged();
  };
  const toggleGate = (gate: 1 | 2, target: SocialPlanItem['status']) => {
    const cur = gate === 1 ? item.status : item.creative_status;
    setGate(gate, cur === target ? 'pendente' : target);
  };
  const state = pieceState(item, matriz, topic, false);
  const markStage = async (s: SocialPlanItem['stage'], ok: string) => {
    try { await setStage(item, s, me?.id ?? null); showFlash(ok); } catch (e) { showFlash((e as Error).message); }
    onChanged();
  };

  // enviar para aprovação: atribui ao aprovador oficial e o notifica (via trigger)
  const sendForReview = async () => {
    if (!approverId) return;
    await supabase.from('social_plan_items').update({
      awaiting_review: true, approver_id: approverId, review_by: me?.id ?? null, review_at: new Date().toISOString(),
    }).eq('id', item.id);
    showFlash(`enviado para ${approverName ?? 'aprovação'}`); onChanged();
  };
  const cancelReview = async () => {
    await supabase.from('social_plan_items').update({ awaiting_review: false }).eq('id', item.id);
    showFlash('aprovação cancelada'); onChanged();
  };

  const postComment = async (kind: SocialPlanComment['kind']) => {
    const raw = text.trim();
    if (!raw && kind === 'comment') return;
    if (!me) return;
    const tags = mentionIds.map((id) => `@${profiles.find((p) => p.id === id)?.name ?? ''}`).join(' ');
    let body = raw;
    if (kind === 'adjust' && !body) body = 'Pediu ajuste nesta peça.';
    if (tags) body = `${tags} ${body}`.trim();
    await supabase.from('social_plan_comments').insert({
      item_id: item.id, author_id: me.id, body, kind, mentioned_ids: mentionIds, parent_id: replyTo?.id ?? null,
    });
    setText(''); setMentionIds([]); setReplyTo(null);
    if (kind === 'adjust' && ownGate1(item)) await setGate(1, 'ajuste');
    await loadComments();
    onChanged();
    showFlash(kind === 'adjust' ? 'ajuste registrado' : 'comentário enviado');
  };

  const toggleMention = (id: string) =>
    setMentionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const threads = comments.filter((c) => !c.parent_id);
  const repliesOf = (pid: string) => comments.filter((c) => c.parent_id === pid);

  const renderCmt = (c: SocialPlanComment & { author: { name: string } | null }, isReply: boolean) => {
    const r = reactions.get(c.id) ?? { count: 0, mine: false };
    const mine = c.author_id === me?.id;
    const isEd = editingId === c.id;
    return (
      <div key={c.id} className={`sp-cmt ${isReply ? 'reply' : c.kind}`}>
        <div className="sp-cmt-head">
          <b>{c.author?.name ?? 'Alguém'}</b>
          {!isReply && c.kind === 'adjust' && <span className="sp-cmt-tag aj">ajuste</span>}
          {!isReply && c.kind === 'approve' && <span className="sp-cmt-tag ok">aprovou</span>}
          <span className="sp-cmt-when">{timeAgo(c.created_at)}{c.edited_at ? ' · editado' : ''}</span>
        </div>
        {isEd ? (
          <div className="sp-cmt-edit">
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
            <div className="sp-composer-actions">
              <button className="sp-abtn" onClick={() => saveCommentEdit(c.id)} disabled={!editText.trim()}>Salvar</button>
              <button className="sp-reply" onClick={() => { setEditingId(null); setEditText(''); }}>cancelar</button>
            </div>
          </div>
        ) : (
          <div className="sp-cmt-body">{c.body}</div>
        )}
        <div className="sp-cmt-actions">
          <button className={`sp-like ${r.mine ? 'on' : ''}`} onClick={() => like(c.id)} title="Curtir / li">👍{r.count > 0 ? ` ${r.count}` : ''}</button>
          {!isReply && <button className="sp-reply" onClick={() => setReplyTo({ id: c.id, author: c.author?.name ?? 'Alguém' })}>responder</button>}
          {mine && !isEd && <button className="sp-reply" onClick={() => { setEditingId(c.id); setEditText(c.body); }}>editar</button>}
        </div>
        {!isReply && repliesOf(c.id).map((rp) => renderCmt(rp, true))}
      </div>
    );
  };


  const brief = topic?.brief ?? {};
  const ch = item.channel_id ? chans.get(item.channel_id) : undefined;
  const vertical = /Reels|Stories|Shorts|TikTok|Status/.test(`${item.piece_type} ${ch?.name ?? ''}`);
  const lim = ch?.caption_limit ?? null;
  const [openCmts, setOpenCmts] = useState(focusComments);
  const brandK = slug(item.brand);
  const titulo = topic?.title || item.pauta;
  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(eff.caption ?? ''); showFlash('Legenda copiada'); } catch { showFlash('Não deu para copiar aqui'); }
  };
  const quando = `${item.weekday ? item.weekday.slice(0, 3) + ', ' : ''}${brFmt(item.pub_date)}${item.pub_time ? ` às ${hhmm(item.pub_time)}` : ''}`;

  // roteiro "0–3 s: texto" → linha do tempo
  const roteiro = (brief.estrutura ?? '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => {
    const k = s.indexOf(':');
    return k > 0 && k < 16 ? { t: s.slice(0, k).trim(), d: s.slice(k + 1).trim() } : { t: '', d: s };
  });
  // direção visual: cores (#hex), fontes (Títulos/Textos) e o resto em texto
  const dv = brief.direcao_visual ?? '';
  const cores = dv.split('·').map((s) => s.trim()).map((s) => { const m = s.match(/#[0-9A-Fa-f]{6}/); return m ? { n: s.replace(m[0], '').trim(), hex: m[0] } : null; }).filter(Boolean) as { n: string; hex: string }[];
  const fontes = dv.split('·').map((s) => s.trim()).filter((s) => /^(Títulos|Textos):/i.test(s));
  const dvTexto = dv.split('·').map((s) => s.trim()).filter((s) => s && !/#[0-9A-Fa-f]{6}/.test(s) && !/^(Títulos|Textos):/i.test(s)).join(' · ');
  // obrigatório / evitar → lista com ✓ e ✕
  const regras = (brief.obrigatorio_evitar ?? '').split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => ({ s, nao: /^(sem |não |nunca |evitar)/i.test(s) }));

  // caminho da aprovação
  type Passo = { k: string; label: string; st: 'feito' | 'agora' | 'ajuste' | 'depois' | 'herda'; sub: string };
  const passos: Passo[] = [];
  const g1 = item.status, g2 = item.creative_status;
  passos.push({ k: 'g1', label: 'Pauta e legenda', st: !ownGate1(item) ? 'herda' : g1 === 'aprovada' ? 'feito' : g1 === 'ajuste' ? 'ajuste' : 'agora', sub: !ownGate1(item) ? 'segue a matriz' : g1 === 'aprovada' ? 'aprovada' : g1 === 'ajuste' ? 'ajuste pedido' : 'esperando aprovação' });
  passos.push({ k: 'g2', label: 'Criativo final', st: !ownGate2(item) ? 'herda' : g2 === 'aprovada' ? 'feito' : g2 === 'ajuste' ? 'ajuste' : g1 === 'aprovada' ? 'agora' : 'depois', sub: !ownGate2(item) ? 'segue a matriz' : g2 === 'aprovada' ? 'aprovado' : g2 === 'ajuste' ? 'ajuste pedido' : !eff.creative ? 'falta o link do criativo' : g1 === 'aprovada' ? 'esperando aprovação' : 'depois da pauta' });
  if (topic?.licensed) passos.push({ k: 'lic', label: 'Licenciador', st: topic.licensor_ok ? 'feito' : (g1 === 'aprovada' && g2 === 'aprovada') ? 'agora' : 'depois', sub: topic.licensor_ok ? 'aprovado' : 'marcar no assunto quando o licenciador aprovar' });
  passos.push({ k: 'ag', label: 'Agendamento', st: item.stage === 'agendado' || item.stage === 'publicado' ? 'feito' : state.ready ? 'agora' : 'depois', sub: item.stage === 'publicado' ? 'publicada' : item.stage === 'agendado' ? 'agendada' : state.ready ? 'pronta para agendar' : 'depois das aprovações' });

  const Media = ({ big }: { big?: boolean }) => (
    <div className={`pv-media b-${brandK} ${vertical ? 'v' : 'q'} ${big ? 'big' : ''}`}>
      <DrivePlayer url={eff.creative} vertical={vertical} poster={(
        <div className="pv-poster">
          <span>{item.brand}</span>
          <b>{brief.texto_arte || item.product || titulo}</b>
          {brief.gancho && <em>{brief.gancho}</em>}
        </div>
      )} />
    </div>
  );

  return (
    <div className="pv" role="dialog" aria-label={titulo}>
      <header className={`pv-head b-${brandK}`}>
        <div className="pv-head-l">
          <span className={`pv-brand b-${brandK}`} title={item.brand}>{item.brand[0]}</span>
          <div>
            <h2>{titulo}</h2>
            <p><b>{quando}</b> · {destLabel(item, chans)}{item.product ? ` · ${item.product}` : ''} · <span className={`pv-kind k-${item.link_kind}`}>{KIND_LABEL[item.link_kind]}</span></p>
          </div>
        </div>
        <div className="pv-head-r">
          <span className={`pv-state t-${state.tone}`}>{state.label}</span>
          <button className="pv-close" aria-label="Fechar" onClick={onClose}>×</button>
        </div>
      </header>

      <div className="pv-body">
        {/* ---------- 1. como vai aparecer ---------- */}
        <section className={`pv-stage b-${brandK}`}>
          <div className={`pv-phone ${vertical ? 'v' : 'q'}`}>
            {vertical ? (
              <>
                <Media big />
                <div className="pv-reel-ui">
                  <div className="pv-reel-who"><i className={`b-${brandK}`}>{item.brand[0]}</i><b>{item.brand.toLowerCase()}</b></div>
                  {eff.caption && <p>{eff.caption.split('\n')[0]}</p>}
                </div>
              </>
            ) : (
              <div className="pv-post">
                <div className="pv-post-h"><i className={`b-${brandK}`}>{item.brand[0]}</i><b>{item.brand.toLowerCase()}</b><span>{ch?.name ?? item.network}</span></div>
                <Media />
                <div className="pv-post-c">{eff.caption ? <p><b>{item.brand.toLowerCase()}</b> {eff.caption.split('\n').slice(0, 3).join(' ')}</p> : <p className="pv-dim">Sem legenda ainda.</p>}</div>
              </div>
            )}
          </div>
          <div className="pv-stage-actions">
            {eff.creative ? <a href={eff.creative} target="_blank" rel="noreferrer">Abrir criativo no Drive ↗</a> : <span>Criativo ainda sem link</span>}
            {eff.caption && <button onClick={copyCaption}>Copiar legenda</button>}
          </div>
          {eff.caption && (
            <details className="pv-fullcap">
              <summary>Legenda completa {lim ? <small>{eff.caption.length}/{lim}</small> : null}</summary>
              <p>{eff.caption}</p>
            </details>
          )}
        </section>

        {/* ---------- 2. o briefing, lido como uma página ---------- */}
        <article className="pv-doc">
          <p className="pv-kicker">Por que esta peça existe</p>
          <h3 className="pv-headline">{brief.meta || item.objective || titulo}</h3>
          {(topic?.strategy || brief.porque) && <p className="pv-lede">{topic?.strategy || brief.porque}</p>}

          <div className="pv-facts">
            {brief.publico && <div><span>Para quem</span><p>{brief.publico}</p></div>}
            {brief.mensagem && <div><span>O que dizer</span><p>{brief.mensagem}</p></div>}
            {brief.medicao && <div><span>Como medir</span><p>{brief.medicao}</p></div>}
            {(item.cta || item.media_use) && <div><span>Chamada</span><p>{item.cta}{item.media_use ? <small>{item.media_use}</small> : null}</p></div>}
          </div>

          {Object.keys(brief).length > 0 && (
            <>
              <div className="pv-sep"><span>Como fazer a arte</span>{brief.formato_medida && <b>{brief.formato_medida}</b>}</div>
              {brief.gancho && <blockquote className={`pv-quote b-${brandK}`}>{brief.gancho}</blockquote>}
              {brief.texto_arte && <p className="pv-onart"><span>Texto na arte</span>{brief.texto_arte}</p>}

              {roteiro.length > 0 && (
                <div className="pv-timeline">
                  {roteiro.map((r, i) => (
                    <div key={i} className="pv-tl-step">
                      <span className={`pv-tl-bar b-${brandK}`} style={{ opacity: 0.45 + (0.55 * (i + 1)) / roteiro.length }} />
                      <b>{r.t || `Parte ${i + 1}`}</b>
                      <p>{r.d}</p>
                    </div>
                  ))}
                </div>
              )}

              {(cores.length > 0 || fontes.length > 0 || dvTexto) && (
                <div className="pv-visual">
                  {cores.length > 0 && <div className="pv-swatches">{cores.map((c) => <span key={c.hex} title={`${c.n} ${c.hex}`}><i style={{ background: c.hex }} />{c.n || c.hex}</span>)}</div>}
                  {fontes.length > 0 && <div className="pv-fonts">{fontes.map((f) => <span key={f}>{f}</span>)}</div>}
                  {dvTexto && <p>{dvTexto}</p>}
                </div>
              )}

              {regras.length > 0 && (
                <ul className="pv-rules">{regras.map((r) => <li key={r.s} className={r.nao ? 'no' : 'yes'}>{r.s}</li>)}</ul>
              )}

              <div className="pv-foot">
                {brief.derivadas && <p><span>Derivadas</span>{brief.derivadas}</p>}
                {(brief.material_base || brief.material_status) && <p><span>Material</span>{brief.material_status && !(brief.material_base ?? '').startsWith(brief.material_status) && <>{brief.material_status}. </>}{brief.material_base && <Linkify text={brief.material_base} />}</p>}
                {(brief.prazo_pauta || brief.prazo_criativo || brief.prazo_obs) && <p><span>Prazos</span>{[brief.prazo_pauta && `pauta até ${brief.prazo_pauta}`, brief.prazo_criativo && `criativo até ${brief.prazo_criativo}`, brief.prazo_obs].filter(Boolean).join(' · ')}</p>}
              </div>
            </>
          )}
        </article>

        {/* ---------- 3. o caminho até publicar ---------- */}
        <aside className="pv-side">
          <p className="pv-kicker">Caminho até publicar</p>
          <ol className="pv-path">
            {passos.map((ps) => (
              <li key={ps.k} className={ps.st}>
                <i />
                <div>
                  <b>{ps.label}</b>
                  <small>{ps.sub}{ps.st === 'herda' && matriz ? <> · <button className="pv-link" onClick={() => onOpen(matriz.id)}>abrir a matriz</button></> : null}</small>
                  {(ps.k === 'g1' || ps.k === 'g2') && ps.st !== 'herda' && canDecide && (ps.st === 'agora' || ps.st === 'ajuste') && (
                    <div className="pv-acts">
                      <button className="pv-btn pri" disabled={ps.k === 'g2' && !eff.creative} onClick={() => toggleGate(ps.k === 'g1' ? 1 : 2, 'aprovada')}>Aprovar</button>
                      {ps.st !== 'ajuste' && <button className="pv-btn" onClick={() => toggleGate(ps.k === 'g1' ? 1 : 2, 'ajuste')}>Pedir ajuste</button>}
                    </div>
                  )}
                  {(ps.k === 'g1' || ps.k === 'g2') && ps.st === 'feito' && canDecide && (
                    <button className="pv-link" onClick={() => toggleGate(ps.k === 'g1' ? 1 : 2, 'aprovada')}>desfazer</button>
                  )}
                  {ps.k === 'ag' && (
                    item.stage === 'agendado' ? <div className="pv-acts"><button className="pv-btn pri" onClick={() => markStage('publicado', 'Marcada como publicada')}>Marcar publicada</button><button className="pv-link" onClick={() => markStage('producao', 'Saiu do agendamento')}>desfazer</button></div>
                      : item.stage === 'publicado' ? <button className="pv-link" onClick={() => markStage('agendado', 'Voltou para agendada')}>desfazer</button>
                      : state.ready ? <div className="pv-acts"><button className="pv-btn pri" onClick={() => markStage('agendado', 'Marcada como agendada')}>Marcar agendada</button></div> : null
                  )}
                </div>
              </li>
            ))}
          </ol>
          {!canDecide && !item.awaiting_review && <button className="pv-btn pri wide" onClick={sendForReview} disabled={!approverId}>Pedir aprovação{approverName && !approverName.includes(' ou ') ? ` a ${approverName.split(' ')[0]}` : ''}</button>}
          {item.awaiting_review && <p className="pv-note">Aguardando {approverName ?? 'o aprovador'}{canDecide ? ' (você pode decidir)' : ''} · <button className="pv-link" onClick={cancelReview}>cancelar</button></p>}
          {flash && <p className="pv-flash">{flash}</p>}

          {topic && (
            <>
              <p className="pv-kicker" style={{ marginTop: 26 }}>Também sai em</p>
              {others.length ? (
                <ul className="pv-dests">{others.map((c) => (
                  <li key={c.id}><button onClick={() => onOpen(c.id)}>
                    <span className="pv-dests-d">{brFmt(c.pub_date).slice(0, 5)}</span>
                    <span className="pv-dests-c">{destLabel(c, chans).replace(/^[^·]+· /, '')}</span>
                    <i className={`pc-dot s-${stMark(c.status) || 'pend'}`} />
                  </button></li>
                ))}</ul>
              ) : <p className="pv-dim">Só aqui, por enquanto.</p>}
              <button className="pv-link strong" onClick={() => onEditTopic(topic.id)}>Editar assunto e destinos →</button>
            </>
          )}

          <div className="pv-cmts sp-comments" ref={commentsRef}>
            <button className="pv-cmts-t" onClick={() => setOpenCmts((v) => !v)} aria-expanded={openCmts}>
              Comentários <span>{threads.length}</span><em>{openCmts ? 'fechar' : 'abrir'}</em>
            </button>
            {openCmts && (
              <>
                {threads.map((c) => renderCmt(c, false))}
                <div className="sp-composer">
                  {replyTo && <div className="sp-replybar">Respondendo a <b>{replyTo.author}</b><button onClick={() => setReplyTo(null)}>✕</button></div>}
                  <textarea placeholder="Escreva um comentário ou o que precisa mudar…" value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="sp-mchips">{active.map((p) => <button key={p.id} className={`sp-mchip ${mentionIds.includes(p.id) ? 'on' : ''}`} onClick={() => toggleMention(p.id)}>@{p.name}</button>)}</div>
                  <div className="sp-composer-actions">
                    <button className="pv-btn pri" onClick={() => postComment('comment')} disabled={!text.trim() && !mentionIds.length}>Comentar</button>
                    <button className="pv-btn" onClick={() => postComment('adjust')}>Enviar como ajuste</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
