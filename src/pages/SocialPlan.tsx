import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import { fetchReactions, toggleReaction, type ReactionMap } from '../lib/reactions';
import type { Profile, SocialPlanItem, SocialPlanComment, SocialPlanDeadline } from '../types/database';

/* ------------------------------------------------------------------ *
 * Planejamento de mídias digitais — espelha o "documento vivo" (HTML),
 * agora vivo no hub: aprovação/ajuste, comentários em thread com menção,
 * notificação que abre direto no item e edição de cada peça.
 * ------------------------------------------------------------------ */

const NOME_MES: Record<string, string> = {
  '2026-08': 'Agosto 2026', '2026-09': 'Setembro 2026', '2026-10': 'Outubro 2026', '2026-11': 'Novembro 2026',
  '2026-12': 'Dezembro 2026', '2027-01': 'Janeiro 2027', '2027-02': 'Fevereiro 2027', '2027-03': 'Março 2027',
};
const MESES = ['Ago/26', 'Set/26', 'Out/26', 'Nov/26', 'Dez/26', 'Jan/27', 'Fev/27', 'Mar/27'];
const DOW = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// mapa de reaproveitamento: rede → tipo/formato da peça reaproveitada
const REUSE: Record<string, { type: string; format: string }> = {
  'TikTok': { type: 'Reels', format: 'Reels / Short' },
  'YouTube Shorts': { type: 'Reels', format: 'Reels / Short' },
  'Pinterest': { type: 'Pin', format: 'Pin' },
};
const REUSE_NETS = ['TikTok', 'YouTube Shorts', 'Pinterest'];
// campos de conteúdo que a peça-mãe propaga para os reaproveitamentos ao ser editada
const SHARED_FIELDS = ['pub_date', 'weekday', 'month_label', 'brand', 'product', 'sku', 'pauta', 'week_theme', 'objective', 'cta', 'media_use'] as const;
const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

type View = 'cal' | 'feed' | 'lista' | 'prazos';
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
  const [deadlines, setDeadlines] = useState<SocialPlanDeadline[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [commentItemIds, setCommentItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('cal');
  const [f, setF] = useState<Filters>(emptyFilters);
  const [selId, setSelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [approverId, setApproverId] = useState<string | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);

  const load = useCallback(async () => {
    const [it, dl, pf, cm, st] = await Promise.all([
      supabase.from('social_plan_items').select('*').order('pub_date'),
      supabase.from('social_plan_deadlines').select('*').order('ord'),
      supabase.from('profiles').select('*').order('name'),
      supabase.from('social_plan_comments').select('item_id'),
      supabase.from('social_plan_settings').select('approver_id').eq('id', 1).single(),
    ]);
    setItems((it.data as SocialPlanItem[]) ?? []);
    setDeadlines((dl.data as SocialPlanDeadline[]) ?? []);
    setProfiles((pf.data as Profile[]) ?? []);
    setCommentItemIds(new Set(((cm.data as { item_id: string }[]) ?? []).map((c) => c.item_id)));
    setApproverId((st.data as { approver_id: string | null } | null)?.approver_id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // realtime: item aprovado/editado ou comentário novo reflete sozinho
  useEffect(() => {
    const ch = supabase
      .channel('social-plan')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_plan_items' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_plan_comments' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // deep-link ?item=ID → abre o painel direto na peça (vindo da notificação)
  useEffect(() => {
    const id = params.get('item');
    if (id && items.some((x) => x.id === id)) setSelId(id);
  }, [params, items]);

  const openItem = (id: string) => {
    setSelId(id);
    const p = new URLSearchParams(params);
    p.set('item', id);
    setParams(p, { replace: true });
  };
  const closeSheet = () => {
    setSelId(null);
    const p = new URLSearchParams(params);
    p.delete('item');
    p.delete('focus');
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
      const blob = `${x.pauta} ${x.sku} ${x.product} ${x.week_theme} ${x.objective} ${x.format}`.toLowerCase();
      if (!blob.includes(f.q)) return false;
    }
    return true;
  }, [f, commentItemIds, reviewOnly, profile?.id]);

  const rows = useMemo(() => items.filter(pass), [items, pass]);

  const myReviews = useMemo(
    () => (profile?.id ? items.filter((x) => x.awaiting_review && x.approver_id === profile.id) : []),
    [items, profile?.id],
  );
  const isPriv = profile?.role === 'diretoria' || profile?.role === 'administrador';
  const approverName = profiles.find((p) => p.id === approverId)?.name ?? null;

  const setApprover = async (id: string) => {
    setApproverId(id || null);
    await supabase.from('social_plan_settings').update({ approver_id: id || null, updated_at: new Date().toISOString() }).eq('id', 1);
  };

  const kpi = useMemo(() => ({
    total: items.length,
    orig: items.filter((x) => x.origin === 'Original').length,
    reap: items.filter((x) => x.origin !== 'Original').length,
    sku: new Set(items.map((x) => x.product)).size,
    ok: items.filter((x) => x.status === 'aprovada').length,
    aj: items.filter((x) => x.status === 'ajuste').length,
  }), [items]);

  const selected = selId ? items.find((x) => x.id === selId) ?? null : null;

  if (loading) return <Loading />;

  return (
    <div className="sp">
      {/* ---------- cabeçalho ---------- */}
      <header className="sp-header">
        <div className="sp-headtop">
          <p className="sp-eyebrow">Planejamento de mídias digitais</p>
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
            <button className="sp-new" onClick={() => setCreating(true)}>+ Nova peça</button>
          </div>
        </div>
        <h1 className="sp-h1">Oito meses de conteúdo<br />para <em>Cardoso</em>, <em>Playmi</em> e <em>Tópi</em></h1>
        <p className="sp-sub">
          De 17 de agosto de 2026 a 31 de março de 2027. Cada semana rende três criativos de feed por marca de consumo —
          uma fileira inteira do grid do Instagram — mais os stories de apoio e os reaproveitamentos entre redes.
        </p>
        <div className="sp-linhas">
          {['#70BD8F', '#BF91D1', '#ED6199', '#2163C4', '#E87821', '#00B2C7', '#EA5C18', '#F3D22A', '#2EBADA', '#DA3A2F'].map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </div>
        <div className="sp-kpis">
          <div className="sp-kpi"><b>{kpi.total}</b><span>publicações</span></div>
          <div className="sp-kpi"><b>{kpi.orig}</b><span>criativos novos</span></div>
          <div className="sp-kpi"><b>{kpi.reap}</b><span>reaproveitamentos</span></div>
          <div className="sp-kpi"><b>33</b><span>semanas</span></div>
          <div className="sp-kpi"><b>{kpi.sku}</b><span>produtos citados</span></div>
          <div className="sp-kpi" style={{ borderColor: '#CFE6DA' }}><b style={{ color: '#2E9E6B' }}>{kpi.ok}</b><span>aprovadas</span></div>
          <div className="sp-kpi" style={{ borderColor: '#F0E0BC' }}><b style={{ color: '#B07C2B' }}>{kpi.aj}</b><span>com ajuste</span></div>
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
          {([['cal', 'Calendário'], ['feed', 'Prévia do feed'], ['lista', 'Lista'], ['prazos', 'Prazos comerciais']] as [View, string][]).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{label}</button>
          ))}
        </nav>
      </header>

      {/* ---------- filtros ---------- */}
      {view !== 'prazos' && (
        <div className="sp-filters">
          <div className="sp-frow">
            <FGroup label="Marca"><Chips vals={['Playmi', 'Tópi', 'Cardoso']} sel={f.marca} onClick={(v) => toggle('marca', v)} tone="marca" /></FGroup>
            <FGroup label="Rede"><Chips vals={['Instagram', 'Facebook', 'TikTok', 'YouTube Shorts', 'Pinterest', 'LinkedIn']} sel={f.rede} onClick={(v) => toggle('rede', v)} /></FGroup>
            <FGroup label="Tipo de peça"><Chips vals={['Reels', 'Feed', 'Stories', 'LinkedIn', 'Pin']} sel={f.tipo} onClick={(v) => toggle('tipo', v)} tone="red" /></FGroup>
            <FGroup label="Produção"><Chips vals={['Original', 'Apoio', 'Reaproveitamento']} sel={f.origem} onClick={(v) => toggle('origem', v)} /></FGroup>
            <FGroup label="Mês"><Chips vals={MESES} sel={f.mes} onClick={(v) => toggle('mes', v)} /></FGroup>
            <FGroup label="Aprovação"><Chips vals={['Pendente', 'Aprovada', 'Com ajuste', 'Com comentário']} sel={f.status} onClick={(v) => toggle('status', v)} /></FGroup>
            <FGroup label="Buscar">
              <div className="sp-searchwrap">
                <span aria-hidden>🔍</span>
                <input type="search" placeholder="produto, SKU, pauta…" value={f.q}
                  onChange={(e) => setF((p) => ({ ...p, q: e.target.value.toLowerCase().trim() }))} />
              </div>
            </FGroup>
            <div className="sp-fmeta">
              <span className="sp-count"><b>{rows.length}</b> de {items.length}</span>
              <button className="sp-clear" onClick={clearFilters}>limpar filtros</button>
            </div>
          </div>
        </div>
      )}

      <main className="sp-main">
        {view === 'cal' && <CalView rows={rows} onOpen={openItem} hasComment={commentItemIds} />}
        {view === 'feed' && <FeedView rows={rows} onOpen={openItem} hasComment={commentItemIds} />}
        {view === 'lista' && <ListView rows={rows} onOpen={openItem} hasComment={commentItemIds} />}
        {view === 'prazos' && <PrazosView deadlines={deadlines} />}

        {view !== 'prazos' && (
          <div className="sp-legend">
            <span><i style={{ background: '#fff', border: '1px solid var(--line)' }} />Criativo novo — precisa ser produzido</span>
            <span><i style={{ background: 'var(--amber-bg)', border: '1px solid #F0E3C6' }} />Stories de apoio — usa sobra de gravação</span>
            <span><i style={{ background: 'var(--violet-bg)' }} />Reaproveitamento entre redes</span>
            <span><i style={{ background: '#EAF6F0', border: '1px solid #2E9E6B' }} />Aprovada</span>
            <span><i style={{ background: '#FDF5E4', border: '1px solid #E0A02B' }} />Com ajuste</span>
          </div>
        )}
      </main>

      {selected && (
        <DetailSheet
          key={selected.id}
          item={selected}
          items={items}
          me={profile}
          profiles={profiles}
          approverId={approverId}
          approverName={approverName}
          focusComments={params.get('focus') === 'comments'}
          onClose={closeSheet}
          onOpen={openItem}
          onChanged={load}
        />
      )}

      {creating && (
        <CreateSheet
          me={profile}
          onClose={() => setCreating(false)}
          onCreated={async (id) => { setCreating(false); await load(); openItem(id); }}
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

/* ---------------- calendário ---------------- */
function CalView({ rows, onOpen, hasComment }: { rows: SocialPlanItem[]; onOpen: (id: string) => void; hasComment: Set<string> }) {
  if (!rows.length) return <Vazio />;
  const meses = Object.keys(NOME_MES);
  const porDia: Record<string, SocialPlanItem[]> = {};
  rows.forEach((x) => { (porDia[x.pub_date] = porDia[x.pub_date] || []).push(x); });
  return (
    <>
      {meses.map((ym) => {
        const [Y, M] = ym.split('-').map(Number);
        const doMes = rows.filter((x) => x.pub_date.startsWith(ym));
        if (!doMes.length) return null;
        const dias = new Date(Y, M, 0).getDate();
        const inicio = (new Date(Y, M - 1, 1).getDay() + 6) % 7;
        const cells: React.ReactNode[] = [];
        for (let i = 0; i < inicio; i++) cells.push(<div key={`off${i}`} className="sp-day off" />);
        for (let dia = 1; dia <= dias; dia++) {
          const key = `${Y}-${String(M).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
          const its = porDia[key] || [];
          const dow = (new Date(Y, M - 1, dia).getDay() + 6) % 7;
          const cls = ['sp-day', dow >= 5 ? 'wknd' : '', its.length ? '' : 'empty'].filter(Boolean).join(' ');
          cells.push(
            <div key={key} className={cls}>
              <div className="sp-dnum"><b>{dia}</b>{its.length ? <span>{its.length}</span> : null}</div>
              {its.map((x) => {
                const o = x.origin === 'Reaproveitamento' ? 'o-reap' : x.origin === 'Apoio' ? 'o-apoio' : '';
                const s = stMark(x.status);
                return (
                  <div key={x.id} className={`sp-pill b-${slug(x.brand)} ${o} ${s ? 'st-' + s : ''}`} onClick={() => onOpen(x.id)}>
                    <div className="row"><b>{x.product}</b>{s ? <span className={`sp-stt ${s}`} /> : null}</div>
                    <i>{x.brand} · {x.network} · {x.piece_type}{hasComment.has(x.id) ? ' · 💬' : ''}</i>
                  </div>
                );
              })}
            </div>,
          );
        }
        return (
          <div className="sp-month" key={ym}>
            <div className="sp-mhead"><h2>{NOME_MES[ym]}</h2><span>{doMes.length} publicações</span></div>
            <div className="sp-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
            <div className="sp-grid">{cells}</div>
          </div>
        );
      })}
    </>
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
              <td className="mono">{x.pub_date.slice(8, 10)}/{x.pub_date.slice(5, 7)}<br />{x.weekday.slice(0, 3)}</td>
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

/* ================= painel de detalhe (aprovação + comentários + edição) ================= */
type EditForm = Pick<SocialPlanItem, 'pub_date' | 'brand' | 'network' | 'piece_type' | 'format' | 'origin' | 'pauta' | 'product' | 'sku' | 'week_theme' | 'objective' | 'cta' | 'media_use' | 'channel'>;

function DetailSheet({ item, items, me, profiles, approverId, approverName, focusComments, onClose, onOpen, onChanged }: {
  item: SocialPlanItem;
  items: SocialPlanItem[];
  me: Profile | null;
  profiles: Profile[];
  approverId: string | null;
  approverName: string | null;
  focusComments: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [comments, setComments] = useState<(SocialPlanComment & { author: { name: string } | null })[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [text, setText] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(() => pick(item));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const commentsRef = useRef<HTMLDivElement>(null);
  const active = profiles.filter((p) => !p.disabled);

  const children = items.filter((x) => x.parent_item_id === item.id);
  const parent = item.parent_item_id ? items.find((x) => x.id === item.parent_item_id) ?? null : null;
  const reuseTaken = new Set(children.map((c) => c.network));
  const reuseAvail = item.network === 'Instagram' && item.origin !== 'Reaproveitamento'
    ? REUSE_NETS.filter((n) => !reuseTaken.has(n)) : [];
  const [reuseSel, setReuseSel] = useState<Set<string>>(() => {
    if (item.network !== 'Instagram' || item.origin === 'Reaproveitamento') return new Set();
    const base = item.piece_type === 'Reels' ? ['TikTok', 'YouTube Shorts'] : item.piece_type === 'Feed' ? ['Pinterest'] : [];
    return new Set(base.filter((n) => !reuseTaken.has(n)));
  });

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
  useEffect(() => { setForm(pick(item)); }, [item]);
  useEffect(() => {
    if (focusComments) setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' }), 250);
  }, [focusComments]);

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash((c) => (c === m ? '' : c)), 2200); };

  // aprovar / pedir ajuste / voltar a pendente — decisão do aprovador encerra a espera
  const setStatus = async (target: SocialPlanItem['status']) => {
    const next = item.status === target ? 'pendente' : target;
    const patch: Record<string, unknown> = { status: next, status_by: me?.id ?? null, status_at: new Date().toISOString() };
    if (next === 'aprovada' || next === 'ajuste') patch.awaiting_review = false;
    await supabase.from('social_plan_items').update(patch).eq('id', item.id);
    showFlash(next === 'aprovada' ? 'aprovada' : next === 'ajuste' ? 'ajuste pedido' : 'voltou para pendente');
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
    if (kind === 'adjust') await setStatus('ajuste');
    await loadComments();
    onChanged();
    showFlash(kind === 'adjust' ? 'ajuste registrado' : 'comentário enviado');
  };

  const saveEdit = async () => {
    setSaving(true);
    const { weekday, month_label } = derive(form.pub_date);
    await supabase.from('social_plan_items').update({ ...form, weekday, month_label, updated_by: me?.id ?? null }).eq('id', item.id);
    // propaga os campos compartilhados para os reaproveitamentos vinculados
    if (children.length) {
      const shared: Record<string, unknown> = { weekday, month_label };
      for (const k of SHARED_FIELDS) shared[k] = (form as Record<string, unknown>)[k] ?? (k === 'weekday' ? weekday : k === 'month_label' ? month_label : undefined);
      await supabase.from('social_plan_items').update(shared).in('id', children.map((c) => c.id));
    }
    setSaving(false); setEditing(false); showFlash(children.length ? 'peça e reaproveitamentos atualizados' : 'peça atualizada'); onChanged();
  };

  const duplicate = async () => {
    const clone = { ...pick(item), pauta: item.pauta ? `${item.pauta} (cópia)` : '' };
    const { weekday, month_label } = derive(clone.pub_date);
    const { data } = await supabase.from('social_plan_items')
      .insert({ ...clone, weekday, month_label, status: 'pendente', updated_by: me?.id ?? null }).select('id').single();
    onChanged();
    if (data) onOpen((data as { id: string }).id);
  };

  const remove = async () => {
    if (!window.confirm('Excluir esta peça? Esta ação não pode ser desfeita.')) return;
    if (children.length && window.confirm(`Esta peça tem ${children.length} reaproveitamento(s) vinculado(s). Excluir também?`)) {
      await supabase.from('social_plan_items').delete().in('id', children.map((c) => c.id));
    }
    await supabase.from('social_plan_items').delete().eq('id', item.id);
    onClose(); onChanged();
  };

  const generateReuse = async (nets: string[]) => {
    if (!nets.length) return;
    const { weekday, month_label } = derive(item.pub_date);
    const base = { ...pick(item), weekday, month_label, status: 'pendente' as const, updated_by: me?.id ?? null };
    const extras = nets.map((net) => ({
      ...base, origin: 'Reaproveitamento', network: net, channel: net,
      piece_type: REUSE[net].type, format: REUSE[net].format, parent_item_id: item.id,
    }));
    await supabase.from('social_plan_items').insert(extras);
    showFlash(`+${nets.length} reaproveitamento(s)`); onChanged();
  };


  const toggleMention = (id: string) =>
    setMentionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const o = item.origin;
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
          <span className={`sp-badge t-${slug(item.piece_type)}`}>{item.piece_type}</span>
          <span className="sp-badge" style={{ background: '#EFEAE1', color: '#6B655C' }}>{o}</span>
          {item.status === 'aprovada' && <span className="sp-badge" style={{ background: '#EAF6F0', color: '#1E7A50' }}>Aprovada</span>}
          {item.status === 'ajuste' && <span className="sp-badge" style={{ background: '#FDF5E4', color: '#8A6113' }}>Com ajuste</span>}
        </div>

        {!editing ? (
          <>
            <h3 className="sp-panel-h3">{item.pauta}</h3>
            <dl>
              <Field dt="Quando" dd={`${brFmt(item.pub_date)} · ${item.weekday}`} />
              <Field dt="Onde" dd={item.channel} />
              <Field dt="Formato" dd={item.format} />
              <Field dt="Produto" dd={item.product} />
              <Field dt="SKU" dd={item.sku} mono />
              <Field dt="Semana e tema" dd={item.week_theme} />
              <Field dt="Objetivo" dd={item.objective} />
              <Field dt="Chamada" dd={item.cta} />
              <Field dt="Uso de mídia" dd={item.media_use} />
            </dl>
            {parent && (
              <p className="sp-relnote">↳ Reaproveitamento de <button className="sp-linkbtn" onClick={() => onOpen(parent.id)}>{parent.product || parent.pauta || 'peça-mãe'}</button> ({parent.network})</p>
            )}
            {children.length > 0 && (
              <div className="sp-childbox">
                <span className="sp-flabel">Reaproveitamentos desta peça</span>
                <div className="sp-childlist">
                  {children.map((c) => (
                    <button key={c.id} className="sp-childchip" onClick={() => onOpen(c.id)}>
                      {c.network}{stMark(c.status) === 'ok' ? ' ✓' : stMark(c.status) === 'aj' ? ' !' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {reuseAvail.length > 0 && (
              <div className="sp-reusebox" style={{ marginTop: 12 }}>
                <span className="sp-flabel">Gerar reaproveitamento em</span>
                <div className="sp-mchips" style={{ marginTop: 6 }}>
                  {reuseAvail.map((net) => (
                    <button key={net} type="button" className={`sp-mchip ${reuseSel.has(net) ? 'on' : ''}`}
                      onClick={() => setReuseSel((prev) => { const s = new Set(prev); s.has(net) ? s.delete(net) : s.add(net); return s; })}>
                      {reuseSel.has(net) ? '✓ ' : '+ '}{net}
                    </button>
                  ))}
                </div>
                <button className="sp-ebtn prim" style={{ marginTop: 8 }} disabled={!reuseSel.size}
                  onClick={() => { generateReuse([...reuseSel]); setReuseSel(new Set()); }}>
                  Gerar {reuseSel.size || ''} peça(s)
                </button>
              </div>
            )}
            <div className="sp-detail-actions">
              <button className="sp-ebtn" onClick={() => setEditing(true)}>✎ Editar</button>
              <button className="sp-ebtn" onClick={duplicate}>⧉ Duplicar</button>
              <button className="sp-ebtn danger" onClick={remove}>🗑 Excluir</button>
            </div>
          </>
        ) : (
          <EditPanel form={form} setForm={setForm} onSave={saveEdit} onCancel={() => { setEditing(false); setForm(pick(item)); }} saving={saving} />
        )}

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

          <div className="sp-abtns" style={{ marginTop: 10 }}>
            <button className="sp-abtn ok" aria-pressed={item.status === 'aprovada'} onClick={() => setStatus('aprovada')}>Aprovar</button>
            <button className="sp-abtn aj" aria-pressed={item.status === 'ajuste'} onClick={() => setStatus('ajuste')}>Pedir ajuste</button>
            {item.status !== 'pendente' && <button className="sp-abtn zero" onClick={() => setStatus('pendente')}>voltar para pendente</button>}
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

function EditPanel({ form, setForm, onSave, onCancel, saving, createMode, extra }: {
  form: EditForm; setForm: React.Dispatch<React.SetStateAction<EditForm>>; onSave: () => void; onCancel: () => void; saving: boolean; createMode?: boolean; extra?: React.ReactNode;
}) {
  const upd = (k: keyof EditForm, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const sel = (k: keyof EditForm, opts: string[]) => (
    <select value={form[k]} onChange={(e) => upd(k, e.target.value)}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <div className="sp-edit">
      <h3 className="sp-panel-h3">{createMode ? 'Nova peça' : 'Editar peça'}</h3>
      <ERow label="Pauta (título)"><textarea rows={2} value={form.pauta} onChange={(e) => upd('pauta', e.target.value)} /></ERow>
      <div className="sp-egrid">
        <ERow label="Data"><input type="date" value={form.pub_date} onChange={(e) => upd('pub_date', e.target.value)} /></ERow>
        <ERow label="Marca">{sel('brand', ['Playmi', 'Tópi', 'Cardoso'])}</ERow>
        <ERow label="Rede">{sel('network', ['Instagram', 'Facebook', 'TikTok', 'YouTube Shorts', 'Pinterest', 'LinkedIn'])}</ERow>
        <ERow label="Tipo">{sel('piece_type', ['Reels', 'Feed', 'Stories', 'LinkedIn', 'Pin'])}</ERow>
        <ERow label="Produção">{sel('origin', ['Original', 'Apoio', 'Reaproveitamento'])}</ERow>
        <ERow label="Formato"><input value={form.format} onChange={(e) => upd('format', e.target.value)} /></ERow>
        <ERow label="Onde (canal)"><input value={form.channel} onChange={(e) => upd('channel', e.target.value)} /></ERow>
        <ERow label="Produto"><input value={form.product} onChange={(e) => upd('product', e.target.value)} /></ERow>
        <ERow label="SKU"><input value={form.sku} onChange={(e) => upd('sku', e.target.value)} /></ERow>
        <ERow label="Semana e tema"><input value={form.week_theme} onChange={(e) => upd('week_theme', e.target.value)} /></ERow>
      </div>
      <ERow label="Objetivo"><textarea rows={2} value={form.objective} onChange={(e) => upd('objective', e.target.value)} /></ERow>
      <ERow label="Chamada (CTA)"><input value={form.cta} onChange={(e) => upd('cta', e.target.value)} /></ERow>
      <ERow label="Uso de mídia"><input value={form.media_use} onChange={(e) => upd('media_use', e.target.value)} /></ERow>
      {extra}
      <div className="sp-edit-actions">
        <button className="sp-ebtn prim" onClick={onSave} disabled={saving}>{saving ? 'Salvando…' : createMode ? 'Criar peça' : 'Salvar alterações'}</button>
        <button className="sp-ebtn" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
function ERow({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="sp-erow"><span>{label}</span>{children}</label>;
}

function pick(x: SocialPlanItem): EditForm {
  const { pub_date, brand, network, piece_type, format, origin, pauta, product, sku, week_theme, objective, cta, media_use, channel } = x;
  return { pub_date, brand, network, piece_type, format, origin, pauta, product, sku, week_theme, objective, cta, media_use, channel };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function derive(iso: string) {
  const [Y, M, D] = iso.split('-').map(Number);
  const weekday = DOW[(new Date(Y, M - 1, D).getDay() + 6) % 7];
  const ym = `${Y}-${String(M).padStart(2, '0')}`;
  const month_label = MESES[Object.keys(NOME_MES).indexOf(ym)] ?? '';
  return { weekday, month_label };
}
function blankForm(): EditForm {
  return {
    pub_date: todayISO(), brand: 'Playmi', network: 'Instagram', piece_type: 'Feed', format: '',
    origin: 'Original', pauta: '', product: '', sku: '', week_theme: '', objective: '', cta: '', media_use: '', channel: '',
  };
}

/* ---------------- criar peça nova ---------------- */
function CreateSheet({ me, onClose, onCreated }: {
  me: Profile | null; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState<EditForm>(blankForm);
  const [reuse, setReuse] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // sugere redes de reaproveitamento conforme rede/tipo da peça-mãe (Instagram)
  useEffect(() => {
    if (form.network !== 'Instagram') { setReuse(new Set()); return; }
    if (form.piece_type === 'Reels') setReuse(new Set(['TikTok', 'YouTube Shorts']));
    else if (form.piece_type === 'Feed') setReuse(new Set(['Pinterest']));
    else setReuse(new Set());
  }, [form.network, form.piece_type]);

  const toggleReuse = (net: string) =>
    setReuse((prev) => { const s = new Set(prev); s.has(net) ? s.delete(net) : s.add(net); return s; });

  const save = async () => {
    if (!form.pauta.trim() && !form.product.trim()) return;
    setSaving(true);
    const { weekday, month_label } = derive(form.pub_date);
    const base = { ...form, weekday, month_label, status: 'pendente' as const, updated_by: me?.id ?? null };
    const { data, error } = await supabase.from('social_plan_items').insert(base).select('id').single();
    const newId = (data as { id: string } | null)?.id;
    // gera as peças de reaproveitamento escolhidas, vinculadas à mãe (parent_item_id)
    if (!error && newId && reuse.size) {
      const extras = [...reuse].map((net) => ({
        ...base, origin: 'Reaproveitamento', network: net, channel: net,
        piece_type: REUSE[net].type, format: REUSE[net].format, parent_item_id: newId,
      }));
      await supabase.from('social_plan_items').insert(extras);
    }
    setSaving(false);
    if (!error && newId) onCreated(newId);
  };

  const showReuse = form.network === 'Instagram';
  const reuseBox = showReuse ? (
    <div className="sp-reusebox">
      <span className="sp-flabel">Gerar reaproveitamento em</span>
      <div className="sp-mchips" style={{ marginTop: 6 }}>
        {REUSE_NETS.map((net) => (
          <button key={net} type="button" className={`sp-mchip ${reuse.has(net) ? 'on' : ''}`} onClick={() => toggleReuse(net)}>
            {reuse.has(net) ? '✓ ' : '+ '}{net}
          </button>
        ))}
      </div>
      <p className="sp-reusehint">{reuse.size ? `Cria +${reuse.size} peça(s) “Reaproveitamento” com o mesmo produto e data.` : 'Nenhuma peça extra será criada.'}</p>
    </div>
  ) : null;

  return (
    <div className="sp-sheet on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-panel">
        <button className="close" aria-label="Fechar" onClick={onClose}>×</button>
        <div className="sp-tags"><span className="sp-badge" style={{ background: 'var(--surf2)', color: 'var(--muted)' }}>Nova peça</span></div>
        <EditPanel form={form} setForm={setForm} onSave={save} onCancel={onClose} saving={saving} createMode extra={reuseBox} />
      </div>
    </div>
  );
}
