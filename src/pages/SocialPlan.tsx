import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import { fetchReactions, toggleReaction, type ReactionMap } from '../lib/reactions';
import type { Profile, SocialChannel, SocialPlanItem, SocialPlanComment, SocialPlanDeadline, SocialTopic } from '../types/database';
import { KIND_LABEL, destLabel, effective, hhmm, inQueue1, inQueue2, licBlocked, ownGate1, ownGate2, pieceState, slug } from './social-plan/shared';
import { decide, gateOwner, setStage } from './social-plan/actions';
import ApprovalView from './social-plan/ApprovalView';
import CentralView from './social-plan/CentralView';
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

// cores dos guias de marca (idênticas ao documento)
const COR_LINHA: Record<string, string> = {
  'Play & Drive': '#2163C4', 'Play & Imagine': '#ED6199', 'Play & Ride': '#70BD8F',
  'Play & Learn': '#BF91D1', 'Play & Collect': '#E87821', 'Play & Molto': '#00B2C7',
  'Veículos': '#EA5C18', 'Faz de conta · Chef': '#F3D22A', 'Faz de conta · Festa': '#ED6199',
  'Didáticos': '#2EBADA', 'Carrinhos de boneca': '#EA5C18', 'Blocos': '#2EBADA',
  'Primeira infância e musicais': '#F3D22A', 'Praia e verão': '#2EBADA', 'Jogos e ar livre': '#EA5C18',
  'Baús e organização': '#F3D22A',
};
const COR_DATA: Record<string, string> = {
  'Dia das Crianças': '#DA3A2F', 'Black Friday': '#0E3041', 'Natal': '#70BD8F',
  'Volta às aulas': '#00B2C7', 'Reposição de temporada': '#E87821',
};
const COR_CARDOSO = '#0A2530';
function corTema(t: string) {
  const nome = t.includes(' · ') ? t.split(' · ').slice(1).join(' · ') : t;
  for (const k in COR_DATA) if (nome.startsWith(k)) return COR_DATA[k];
  if (nome.startsWith('Play & Collect')) return COR_LINHA['Play & Collect'];
  if (COR_LINHA[nome]) return COR_LINHA[nome];
  return COR_CARDOSO;
}

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

type View = 'central' | 'aprovacao' | 'cal' | 'assuntos' | 'feed' | 'lista' | 'prazos';
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [commentItemIds, setCommentItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('central');
  const [calMode, setCalMode] = useState<CalMode>('semana');
  const [f, setF] = useState<Filters>(emptyFilters);
  const [selId, setSelId] = useState<string | null>(null);
  const [topicSheet, setTopicSheet] = useState<{ id: string | null } | null>(null);
  const [approverId, setApproverId] = useState<string | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    const [it, tp, ch, ar, dl, pf, cm, st] = await Promise.all([
      supabase.from('social_plan_items').select('*').eq('archived', false).order('pub_date'),
      supabase.from('social_topics').select('*'),
      supabase.from('social_channels').select('*').order('ord'),
      supabase.from('social_plan_items').select('id, merged_into').eq('archived', true),
      supabase.from('social_plan_deadlines').select('*').order('ord'),
      supabase.from('profiles').select('*').order('name'),
      supabase.from('social_plan_comments').select('item_id'),
      supabase.from('social_plan_settings').select('approver_id').eq('id', 1).single(),
    ]);
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
    setApproverId((st.data as { approver_id: string | null } | null)?.approver_id ?? null);
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

  const pass = useCallback((x: SocialPlanItem) => {
    if (reviewOnly && !(x.awaiting_review && x.approver_id === profile?.id)) return false;
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
    () => (profile?.id ? live.filter((x) => x.awaiting_review && x.approver_id === profile.id) : []),
    [live, profile?.id],
  );
  const isPriv = profile?.role === 'diretoria' || profile?.role === 'administrador';
  const canDecide = isPriv || (!!profile?.id && profile.id === approverId);
  const filaN = useMemo(() => live.filter((x) => inQueue1(x) || inQueue2(x)).length, [live]);
  const approverName = profiles.find((p) => p.id === approverId)?.name ?? null;

  const setApprover = async (id: string) => {
    setApproverId(id || null);
    await supabase.from('social_plan_settings').update({ approver_id: id || null, updated_at: new Date().toISOString() }).eq('id', 1);
  };

  const kpi = useMemo(() => ({
    total: live.length,
    assuntos: new Set(live.map((x) => x.topic_id)).size,
    reap: live.filter((x) => x.link_kind !== 'matriz').length,
    sku: new Set(live.map((x) => x.product)).size,
    ok: live.filter((x) => x.status === 'aprovada').length,
    aj: live.filter((x) => x.status === 'ajuste').length,
    guardadas: items.length - live.length,
  }), [live, items.length]);

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash((c) => (c === m ? '' : c)), 2600); };
  const selected = selId ? items.find((x) => x.id === selId) ?? null : null;
  const sheetTopic = topicSheet?.id ? topicById.get(topicSheet.id) ?? null : null;

  if (loading) return <Loading />;

  return (
    <div className="sp">
      {/* ---------- cabeçalho ---------- */}
      <header className="sp-header">
        <div className="sp-headtop">
          <p className="sp-eyebrow">Centro de Operações de Conteúdo</p>
          <div className="sp-headactions">
            {isPriv && (
              <label className="sp-approversel" title="Quem aprova as peças do Social">
                <span>Aprovação →</span>
                <select value={approverId ?? ''} onChange={(e) => setApprover(e.target.value)}>
                  <option value="">ninguém definido</option>
                  {profiles.filter((p) => !p.disabled).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <button className="sp-new" onClick={() => openTopic(null)}>+ Novo assunto</button>
          </div>
        </div>
        <h1 className="sp-h1">Conteúdo de <em>Cardoso</em>, <em>Playmi</em> e <em>Tópi</em>,<br />do assunto ao último destino</h1>
        <p className="sp-sub">
          Cada assunto nasce uma vez, com pauta e estratégia, e se desdobra em destinos: a matriz, os reaproveitamentos
          (mesma peça em outro canal ou dia) e as adaptações (legenda própria, como do Instagram para o LinkedIn ou o WhatsApp).
        </p>
        <div className="sp-linhas">
          {['#70BD8F', '#BF91D1', '#ED6199', '#2163C4', '#E87821', '#00B2C7', '#EA5C18', '#F3D22A', '#2EBADA', '#DA3A2F'].map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </div>
        <div className="sp-kpis">
          <div className="sp-kpi"><b>{kpi.assuntos}</b><span>assuntos</span></div>
          <div className="sp-kpi"><b>{kpi.total}</b><span>destinos</span></div>
          <div className="sp-kpi"><b>{kpi.reap}</b><span>reaproveitamentos e adaptações</span></div>
          <div className="sp-kpi"><b>{kpi.sku}</b><span>produtos citados</span></div>
          <div className="sp-kpi" style={{ borderColor: '#CFE6DA' }}><b style={{ color: '#2E9E6B' }}>{kpi.ok}</b><span>aprovadas</span></div>
          <div className="sp-kpi" style={{ borderColor: '#F0E0BC' }}><b style={{ color: '#B07C2B' }}>{kpi.aj}</b><span>com ajuste</span></div>
          {kpi.guardadas > 0 && <div className="sp-kpi"><b>{kpi.guardadas}</b><span>guardadas · canal futuro</span></div>}
        </div>
        {myReviews.length > 0 && (
          <div className="sp-reviewbanner">
            <span>🔔 <b>{myReviews.length}</b> peça(s) esperando a sua aprovação</span>
            <button className={reviewOnly ? 'on' : ''} onClick={() => setReviewOnly((v) => !v)}>
              {reviewOnly ? 'Mostrar todas' : 'Ver só as minhas'}
            </button>
          </div>
        )}
        <nav className="sp-views" role="tablist">
          {([['central', 'Central'], ['aprovacao', 'Aprovação'], ['cal', 'Calendário'], ['assuntos', 'Assuntos'], ['feed', 'Prévia do feed'], ['lista', 'Lista'], ['prazos', 'Prazos comerciais']] as [View, string][]).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{label}{v === 'aprovacao' && filaN > 0 ? <span className="sp-tabcnt">{filaN}</span> : null}</button>
          ))}
        </nav>
      </header>

      {/* ---------- filtros ---------- */}
      {!['prazos', 'central', 'aprovacao'].includes(view) && (
        <div className="sp-filters">
          <div className="sp-frow">
            <FGroup label="Marca"><Chips vals={['Playmi', 'Tópi', 'Cardoso']} sel={f.marca} onClick={(v) => toggle('marca', v)} tone="marca" /></FGroup>
            <FGroup label="Rede"><Chips vals={['Instagram', 'Facebook', 'TikTok', 'YouTube Shorts', 'Pinterest', 'LinkedIn', 'WhatsApp', 'Google Meu Negócio']} sel={f.rede} onClick={(v) => toggle('rede', v)} /></FGroup>
            <FGroup label="Tipo de peça"><Chips vals={['Reels', 'Feed', 'Stories', 'LinkedIn', 'Pin']} sel={f.tipo} onClick={(v) => toggle('tipo', v)} tone="red" /></FGroup>
            <FGroup label="Produção"><Chips vals={['Original', 'Apoio', 'Reaproveitamento']} sel={f.origem} onClick={(v) => toggle('origem', v)} /></FGroup>
            <FGroup label="Mês"><Chips vals={meses} sel={f.mes} onClick={(v) => toggle('mes', v)} /></FGroup>
            <FGroup label="Aprovação"><Chips vals={['Pendente', 'Aprovada', 'Com ajuste', 'Com comentário']} sel={f.status} onClick={(v) => toggle('status', v)} /></FGroup>
            <FGroup label="Buscar">
              <div className="sp-searchwrap">
                <span aria-hidden>🔍</span>
                <input type="search" placeholder="produto, SKU, pauta, legenda…" value={f.q}
                  onChange={(e) => setF((p) => ({ ...p, q: e.target.value.toLowerCase().trim() }))} />
              </div>
            </FGroup>
            <div className="sp-fmeta">
              <span className="sp-count"><b>{rows.length}</b> de {live.length}</span>
              <button className="sp-clear" onClick={clearFilters}>limpar filtros</button>
            </div>
          </div>
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
        {view === 'assuntos' && <AssuntosView topics={shownTopics} byTopic={byTopic} chans={chans} onOpenTopic={openTopic} />}
        {view === 'feed' && <FeedView rows={rows} onOpen={openItem} hasComment={commentItemIds} />}
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

      {topicSheet && (
        <TopicSheet
          key={topicSheet.id ?? 'novo'}
          topic={sheetTopic}
          items={sheetTopic ? byTopic.get(sheetTopic.id) ?? [] : []}
          channels={channels}
          chans={chans}
          me={profile}
          isPriv={isPriv}
          fronts={fronts}
          onClose={closeTopic}
          onOpenItem={openItem}
          onSaved={async (tid) => {
            closeTopic();
            await load();
            showFlash(tid ? 'Assunto salvo' : 'Assunto excluído');
          }}
        />
      )}
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

/* ---------------- prévia do feed ---------------- */
function FeedView({ rows, onOpen, hasComment }: { rows: SocialPlanItem[]; onOpen: (id: string) => void; hasComment: Set<string> }) {
  const feed = rows.filter((x) => (x.piece_type === 'Reels' || x.piece_type === 'Feed') && x.origin === 'Original' && x.network === 'Instagram');
  if (!feed.length) return <Vazio msg="Nenhum post de feed com esses filtros. A prévia mostra apenas criativos originais publicados no Instagram." />;
  return (
    <div className="sp-feedwrap">
      {['Playmi', 'Tópi', 'Cardoso'].map((marca) => {
        const its = feed.filter((x) => x.brand === marca).sort((a, b) => a.pub_date.localeCompare(b.pub_date));
        if (!its.length) return null;
        const nodes: React.ReactNode[] = [];
        let temaAtual: string | null = null;
        its.forEach((x) => {
          if (x.week_theme !== temaAtual) {
            temaAtual = x.week_theme;
            nodes.push(<div key={`rl${x.id}`} className="sp-rowlabel"><i style={{ background: corTema(x.week_theme) }} />{x.week_theme}</div>);
          }
          const c = corTema(x.week_theme);
          const s = stMark(x.status);
          nodes.push(
            <div key={x.id} className={`sp-cellf ${s ? 'st-' + s : ''}`} style={{ background: `${c}14`, borderTop: `3px solid ${c}` }} onClick={() => onOpen(x.id)}>
              <div className="tag" style={{ color: c }}>{x.format}{hasComment.has(x.id) ? ' · ✎' : ''}</div>
              <div className="nm">{x.product}</div>
              <div className="dt">{x.pub_date.slice(8, 10)}/{x.pub_date.slice(5, 7)}{s ? <span className="mk" style={{ color: s === 'ok' ? '#2E9E6B' : '#B07C2B' }}> {s === 'ok' ? '✓' : '!'}</span> : null}</div>
            </div>,
          );
        });
        return (
          <div className="sp-feedcol" key={marca}>
            <h3>{marca}</h3>
            <p className="note">{its.length} posts de feed no Instagram · cada fileira é uma semana</p>
            <div className="sp-fgrid">{nodes}</div>
          </div>
        );
      })}
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
function DetailSheet({ item, siblings, topic, chans, me, profiles, approverId, approverName, canDecide, focusComments, onClose, onOpen, onEditTopic, onChanged }: {
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
  const iAmApprover = me?.id === item.approver_id;

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


  return (
    <div className="sp-sheet on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-panel">
        <button className="close" aria-label="Fechar" onClick={onClose}>×</button>
        <div className="sp-tags">
          <span className={`sp-badge b-${slug(item.brand)}`}>{item.brand}</span>
          <span className={`sp-kind k-${item.link_kind}`}>{KIND_LABEL[item.link_kind]}</span>
          {item.status === 'aprovada' && <span className="sp-badge" style={{ background: '#EAF6F0', color: '#1E7A50' }}>Aprovada</span>}
          {item.status === 'ajuste' && <span className="sp-badge" style={{ background: '#FDF5E4', color: '#8A6113' }}>Com ajuste</span>}
        </div>

        <h3 className="sp-panel-h3">{topic?.title || item.pauta}</h3>
        <dl>
          <Field dt="Quando" dd={`${brFmt(item.pub_date)} · ${item.weekday}${item.pub_time ? ` · ${hhmm(item.pub_time)}` : ' · sem horário'}`} />
          <Field dt="Onde" dd={destLabel(item, chans)} />
          <Field dt="Produto" dd={item.product} />
          <Field dt="SKU" dd={item.sku} mono />
          <Field dt="Frente" dd={item.week_theme} />
          <Field dt="Objetivo" dd={item.objective} />
          {topic?.strategy ? <Field dt="Estratégia" dd={topic.strategy} /> : null}
          <Field dt="Chamada" dd={item.cta} />
          <Field dt="Uso de mídia" dd={item.media_use} />
        </dl>
        <div className="sp-field"><dt>Legenda{item.link_kind === 'reaproveita' ? ' (da matriz)' : ''}</dt>
          <dd>{eff.caption ? <div className="sp-caption">{eff.caption}</div> : '—'}</dd></div>
        <div className="sp-field"><dt>Criativo{item.link_kind !== 'matriz' && !item.creative_changed ? ' (da matriz)' : ''}</dt>
          <dd>{eff.creative ? <a className="sp-linkbtn" href={eff.creative} target="_blank" rel="noreferrer">Abrir no Drive ↗</a> : '—'}</dd></div>
        {topic?.licensed && <p className="sp-relnote">Produto licenciado · {topic.licensor_ok ? 'aprovado pelo licenciador' : 'aguardando aprovação do licenciador'}</p>}

        {topic && (
          <div className="sp-childbox">
            <span className="sp-flabel">Outros destinos deste assunto</span>
            <div className="sp-childlist">
              {others.length ? others.map((c) => (
                <button key={c.id} className="sp-childchip" onClick={() => onOpen(c.id)}>
                  {destLabel(c, chans).replace(/^[^·]+· /, '')} · {c.pub_date.slice(8, 10)}/{c.pub_date.slice(5, 7)}{stMark(c.status) === 'ok' ? ' ✓' : stMark(c.status) === 'aj' ? ' !' : ''}
                </button>
              )) : <span className="sp-relnote" style={{ margin: 0 }}>Só esta peça por enquanto.</span>}
            </div>
          </div>
        )}
        <div className="sp-detail-actions">
          {topic && <button className="sp-ebtn prim" onClick={() => onEditTopic(topic.id)}>✎ Editar assunto e destinos</button>}
        </div>

        {/* ---------- aprovação ---------- */}
        <div className="sp-aprov">
          <h4>Aprovação</h4>

          {/* linha de "enviar para aprovação" / estado de espera */}
          {item.awaiting_review ? (
            <div className="sp-reviewrow wait">
              <span>⏳ Aguardando aprovação{item.approver_id ? ` de ${profiles.find((p) => p.id === item.approver_id)?.name ?? 'aprovador'}` : ''}{iAmApprover ? ' — é você!' : ''}</span>
              <button className="sp-ebtn" onClick={cancelReview}>Cancelar</button>
            </div>
          ) : (
            <div className="sp-reviewrow">
              <button className="sp-ebtn prim" onClick={sendForReview} disabled={!approverId}>➦ Enviar para aprovação{approverName ? ` (${approverName})` : ''}</button>
              {!approverId && <span className="sp-reviewhint">Defina o aprovador no topo da página.</span>}
            </div>
          )}

          <p className="sp-statenow">Situação: <span className={`sp-state t-${state.tone}`}>{state.label}</span></p>
          {([1, 2] as const).map((g) => {
            const cur = g === 1 ? item.status : item.creative_status;
            const own = g === 1 ? ownGate1(item) : ownGate2(item);
            const lbl = cur === 'aprovada' ? 'aprovada' : cur === 'ajuste' ? 'com ajuste' : 'pendente';
            const semCriativo = g === 2 && !effective(item, matriz).creative;
            return (
              <div className="sp-gaterow" key={g}>
                <div><b>Etapa {g} · {g === 1 ? 'Pauta e legenda' : 'Criativo final'}</b> <span className={`sp-gst g-${cur}`}>{lbl}</span>
                  {!own && <span className="sp-inherit"> · segue a matriz{matriz ? <> (<button className="sp-linkbtn" onClick={() => onOpen(matriz.id)}>abrir</button>)</> : null}</span>}</div>
                {own && canDecide && (
                  <div className="sp-abtns">
                    <button className="sp-abtn ok" aria-pressed={cur === 'aprovada'} disabled={semCriativo || (g === 2 && item.status !== 'aprovada')}
                      title={semCriativo ? 'Falta o link do criativo' : g === 2 && item.status !== 'aprovada' ? 'Aprove a etapa 1 antes' : ''}
                      onClick={() => toggleGate(g, 'aprovada')}>Aprovar</button>
                    <button className="sp-abtn aj" aria-pressed={cur === 'ajuste'} onClick={() => toggleGate(g, 'ajuste')}>Pedir ajuste</button>
                  </div>
                )}
              </div>
            );
          })}
          {topic?.licensed && <p className="sp-inherit">Licenciado · {licBlocked(topic) ? 'falta marcar “aprovado pelo licenciador” no assunto, e sem isso não agenda' : 'aprovado pelo licenciador'}</p>}
          <div className="sp-abtns" style={{ marginTop: 10 }}>
            {item.stage === 'agendado' ? <>
              <button className="sp-abtn ok" onClick={() => markStage('publicado', 'marcada como publicada')}>Marcar publicada</button>
              <button className="sp-abtn zero" onClick={() => markStage('producao', 'saiu do agendamento')}>desfazer agendamento</button>
            </> : item.stage === 'publicado' ? (
              <button className="sp-abtn zero" onClick={() => markStage('agendado', 'voltou para agendada')}>desfazer publicação</button>
            ) : (
              <button className="sp-abtn" disabled={!state.ready} title={state.ready ? '' : 'Só agenda depois das duas etapas (e do licenciador, se for o caso)'}
                onClick={() => markStage('agendado', 'marcada como agendada')}>Marcar agendada</button>
            )}
          </div>
          {flash && <div className="sp-saved">{flash}</div>}
        </div>

        {/* ---------- comentários + menção ---------- */}
        <div className="sp-comments" ref={commentsRef}>
          <h4>Comentários e correções</h4>
          {threads.length === 0 && <p className="sp-nocmt">Sem comentários ainda. Aprove, peça ajuste ou marque alguém abaixo.</p>}
          {threads.map((c) => renderCmt(c, false))}

          <div className="sp-composer">
            {replyTo && (
              <div className="sp-replybar">Respondendo a <b>{replyTo.author}</b>
                <button onClick={() => setReplyTo(null)}>✕</button></div>
            )}
            <textarea placeholder="Escreva um comentário ou o que precisa mudar nesta peça…" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="sp-mentions">
              <span className="sp-flabel">Marcar / solicitar</span>
              <div className="sp-mchips">
                {active.map((p) => (
                  <button key={p.id} className={`sp-mchip ${mentionIds.includes(p.id) ? 'on' : ''}`} onClick={() => toggleMention(p.id)}>@{p.name}</button>
                ))}
              </div>
            </div>
            <div className="sp-composer-actions">
              <button className="sp-abtn" onClick={() => postComment('comment')} disabled={!text.trim() && !mentionIds.length}>Comentar</button>
              <button className="sp-abtn aj" onClick={() => postComment('adjust')}>Enviar como pedido de ajuste</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ dt, dd, mono }: { dt: string; dd: string; mono?: boolean }) {
  return <div className="sp-field"><dt>{dt}</dt><dd className={mono ? 'mono' : ''}>{dd || '—'}</dd></div>;
}
