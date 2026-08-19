import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';
import CampoAdmin from '../components/CampoAdmin';
import Modal from '../components/Modal';

type Visit = { id: string; promoter_id: string | null; store_id: string | null; visit_date: string; weekday: string | null; raw_store_name: string | null };
type Store = { id: string; name: string; network_id: string | null; planned_frequency_days: number | null; region: string | null; city: string | null; address: string | null; default_promoter_id: string | null; priority: string | null; status: string | null };
const STORE_COLS = 'id, name, network_id, planned_frequency_days, region, city, address, default_promoter_id, priority, status';
const ZONAS = ['Leste', 'Oeste', 'Sul', 'Norte', 'Centro', 'ABC', 'Grande SP', 'Interior'];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
type Promoter = { id: string; name: string };
type Network = { id: string; name: string };
type PlanRoute = { storeId: string; name: string; network: string; zona: string; owner: string | null; ownerName: string; visits: number; cadence: number; daysSince: number; weekday: number; weekOffset: number };
type PlanVisit = { date: string; storeId: string; name: string; network: string; zona: string; owner: string | null; ownerName: string; weekday: number };
const WEEK_CAP = 16; // teto/alvo de visitas por promotor por semana (preenche até aqui)

type Tab = 'planejamento' | 'promotores' | 'lojas' | 'frequencia' | 'visitas' | 'cadastro' | 'campo';
type StoreDraft = { name: string; network_id: string; city: string; region: string; address: string; priority: string; planned_frequency_days: string; default_promoter_id: string; status: string };
const TABS: [Tab, string][] = [
  ['planejamento', 'Planejamento'],
  ['promotores', 'Promotores'],
  ['lojas', 'Lojas'],
  ['frequencia', 'Frequência'],
  ['visitas', 'Visitas'],
  ['cadastro', 'Cadastro'],
  ['campo', 'Campo'],
];
const CATS = ['var(--tm-accent)', 'var(--tm-purple)', 'var(--tm-cyan)', 'var(--tm-pink)', 'var(--tm-good)', 'var(--tm-warn)', 'var(--tm-accent2)', '#64748b'];
const WD = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WD_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS: [string, string][] = [['2026-08', 'Agosto 2026'], ['2026-09', 'Setembro 2026'], ['2026-10', 'Outubro 2026'], ['2026-11', 'Novembro 2026'], ['2026-12', 'Dezembro 2026']];

const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const fmt = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const wdOf = (s: string) => (parseYmd(s).getDay() + 6) % 7; // 0=segunda
const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const cadLabel = (c: number) => (c === 1 ? 'Semanal' : c === 2 ? 'Quinzenal' : c === 4 ? 'Mensal' : 'Esporádica');

export default function TradeMarketing() {
  const { profile } = useAuth();
  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';
  const [loading, setLoading] = useState(true);
  const [visitsRaw, setVisitsRaw] = useState<Visit[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [tab, setTab] = useState<Tab>('planejamento');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [promoterId, setPromoterId] = useState('all');
  const [networkId, setNetworkId] = useState('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState('');
  const [planMonth, setPlanMonth] = useState('2026-08'); // YYYY-MM alvo do plano
  const [planView, setPlanView] = useState<'mes' | 'semana' | 'dia'>('mes');
  const [planWeekIdx, setPlanWeekIdx] = useState(0);
  const [planDay, setPlanDay] = useState('');
  const [planProm, setPlanProm] = useState('all');
  const [editStore, setEditStore] = useState<Store | 'new' | null>(null);
  const [sdraft, setSdraft] = useState<StoreDraft>({ name: '', network_id: '', city: '', region: '', address: '', priority: '', planned_frequency_days: '', default_promoter_id: '', status: 'ativa' });
  const [cadSearch, setCadSearch] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, s, p, n] = await Promise.all([
        supabase.from('tm_visits').select('id, promoter_id, store_id, visit_date, weekday, raw_store_name').order('visit_date'),
        supabase.from('tm_stores').select(STORE_COLS),
        supabase.from('tm_promoters').select('id, name').order('name'),
        supabase.from('tm_networks').select('id, name').order('name'),
      ]);
      const vv = (v.data as Visit[]) ?? [];
      setVisitsRaw(vv);
      setStores((s.data as Store[]) ?? []);
      setPromoters((p.data as Promoter[]) ?? []);
      setNetworks((n.data as Network[]) ?? []);
      if (vv.length) { setFrom(vv[0].visit_date); setTo(vv[vv.length - 1].visit_date); }
      setLoading(false);
    })();
  }, []);

  const storesById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const promotersById = useMemo(() => new Map(promoters.map((p) => [p.id, p])), [promoters]);
  const networksById = useMemo(() => new Map(networks.map((n) => [n.id, n])), [networks]);
  const promoterIdByName = useMemo(() => new Map(promoters.map((p) => [p.name, p.id])), [promoters]);
  const networkIdByName = useMemo(() => new Map(networks.map((n) => [n.name, n.id])), [networks]);
  const storeName = (id: string | null) => (id ? storesById.get(id)?.name ?? '—' : '—');
  const promoterName = (id: string | null) => (id ? promotersById.get(id)?.name ?? '—' : '—');
  const networkOfStore = (storeId: string | null) => { const st = storeId ? storesById.get(storeId) : null; return st?.network_id ? networksById.get(st.network_id)?.name ?? null : null; };
  const zoneOfStore = (storeId: string | null) => (storeId ? storesById.get(storeId)?.region || 'Sem zona' : 'Sem zona');

  const visits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visitsRaw.filter((v) => {
      if (from && v.visit_date < from) return false;
      if (to && v.visit_date > to) return false;
      if (promoterId !== 'all' && v.promoter_id !== promoterId) return false;
      if (networkId !== 'all') { const st = v.store_id ? storesById.get(v.store_id) : null; if (!st || st.network_id !== networkId) return false; }
      if (q) { if (!storeName(v.store_id).toLowerCase().includes(q) && !promoterName(v.promoter_id).toLowerCase().includes(q)) return false; }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitsRaw, from, to, promoterId, networkId, search, storesById]);

  const filtersActive = promoterId !== 'all' || networkId !== 'all' || !!search.trim();
  const toggleProm = (name: string) => { const id = promoterIdByName.get(name); if (id) setPromoterId((cur) => (cur === id ? 'all' : id)); };
  const toggleNet = (name: string) => { const id = networkIdByName.get(name); if (id) setNetworkId((cur) => (cur === id ? 'all' : id)); };

  const agg = useMemo(() => {
    const uniqueStores = new Set(visits.map((v) => v.store_id).filter(Boolean));
    const activePromoters = new Set(visits.map((v) => v.promoter_id).filter(Boolean));
    const distinctDays = new Set(visits.map((v) => v.visit_date)).size;
    const coverage = stores.length ? (uniqueStores.size / stores.length) * 100 : 0;
    const perProm = new Map<string, { visits: number; stores: Set<string>; days: Set<string> }>();
    for (const v of visits) { if (!v.promoter_id) continue; const e = perProm.get(v.promoter_id) ?? { visits: 0, stores: new Set(), days: new Set() }; e.visits++; if (v.store_id) e.stores.add(v.store_id); e.days.add(v.visit_date); perProm.set(v.promoter_id, e); }
    const promoterRank = [...perProm.entries()].map(([id, e]) => ({ id, name: promoterName(id), visits: e.visits, stores: e.stores.size, perDay: e.days.size ? e.visits / e.days.size : 0, coverage: stores.length ? (e.stores.size / stores.length) * 100 : 0 })).sort((a, b) => b.visits - a.visits);
    const perNet = new Map<string, { visits: number; stores: Set<string> }>();
    for (const v of visits) { const nm = networkOfStore(v.store_id) ?? '(sem rede)'; const e = perNet.get(nm) ?? { visits: 0, stores: new Set() }; e.visits++; if (v.store_id) e.stores.add(v.store_id); perNet.set(nm, e); }
    const networkRank = [...perNet.entries()].map(([name, e]) => ({ name, visits: e.visits, stores: e.stores.size })).sort((a, b) => b.visits - a.visits);
    const perStore = new Map<string, string[]>();
    for (const v of visits) { if (!v.store_id) continue; const arr = perStore.get(v.store_id) ?? []; arr.push(v.visit_date); perStore.set(v.store_id, arr); }
    const today = todayYmd();
    const storeRank = [...perStore.entries()].map(([id, ds]) => {
      const sorted = [...ds].sort(); const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1], sorted[i]));
      const last = sorted[sorted.length - 1];
      return { id, name: storeName(id), network: networkOfStore(id) ?? '—', visits: sorted.length, last, daysSince: daysBetween(last, today), avgGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null, minGap: gaps.length ? Math.min(...gaps) : null, maxGap: gaps.length ? Math.max(...gaps) : null };
    }).sort((a, b) => b.visits - a.visits);
    const avgGaps = storeRank.map((s) => s.avgGap).filter((x): x is number => x != null);
    const avgFrequency = avgGaps.length ? avgGaps.reduce((a, b) => a + b, 0) / avgGaps.length : null;
    const overdue14 = storeRank.filter((s) => s.daysSince > 14).length;
    const weekKey = (ymd: string) => { const d = parseYmd(ymd); d.setDate(d.getDate() - wdOf(ymd)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const perWeek = new Map<string, number>();
    for (const v of visits) perWeek.set(weekKey(v.visit_date), (perWeek.get(weekKey(v.visit_date)) ?? 0) + 1);
    const timeline = [...perWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([wk, n]) => ({ label: fmt(wk).slice(0, 5), value: n }));
    return { total: visits.length, uniqueStores: uniqueStores.size, activePromoters: activePromoters.size, perDay: distinctDays ? visits.length / distinctDays : 0, coverage, avgFrequency, overdue14, promoterRank, networkRank, storeRank, timeline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, stores, storesById, networksById, promotersById]);

  // ---------- PLANEJAMENTO: roteiro fixo (histórico) balanceado + agenda do mês alvo ----------
  const plan = useMemo(() => {
    const empty = { routes: [] as PlanRoute[], agenda: [] as PlanVisit[], neglected: [] as PlanRoute[], weeks: [] as { monday: string; days: string[] }[] };
    if (!visitsRaw.length) return empty;
    const today = todayYmd();
    const spanWeeks = Math.max(1, daysBetween(visitsRaw[0].visit_date, visitsRaw[visitsRaw.length - 1].visit_date) / 7);
    const per = new Map<string, { prom: Map<string, number>; dates: string[] }>();
    for (const v of visitsRaw) {
      if (!v.store_id) continue;
      const e = per.get(v.store_id) ?? { prom: new Map<string, number>(), dates: [] as string[] };
      if (v.promoter_id) e.prom.set(v.promoter_id, (e.prom.get(v.promoter_id) ?? 0) + 1);
      e.dates.push(v.visit_date);
      per.set(v.store_id, e);
    }
    // COBERTURA: TODA loja entra no plano (piso mensal). Responsável = atribuído (cadastro) OU histórico.
    const routes: PlanRoute[] = [...per.entries()].map(([sid, e]) => {
      const histOwner = [...e.prom.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const owner = storesById.get(sid)?.default_promoter_id || histOwner;
      const visits = e.dates.length; const perWeek = visits / spanWeeks;
      const last = [...e.dates].sort().pop() as string;
      const daysSince = daysBetween(last, today);
      const cadence = perWeek >= 0.8 ? 1 : perWeek >= 0.35 ? 2 : 4; // sempre >= mensal
      return { storeId: sid, name: storeName(sid), network: networkOfStore(sid) ?? '—', zona: zoneOfStore(sid), owner, ownerName: promoterName(owner), visits, cadence, daysSince, weekday: 0, weekOffset: 0 };
    });

    // DIA FIXO por loja: agrupa por zona (promotor numa região/dia) e equilibra a contagem entre os 6 dias.
    const byOwner = new Map<string, PlanRoute[]>();
    for (const r of routes) { const k = r.owner ?? '—'; (byOwner.get(k) ?? byOwner.set(k, []).get(k)!).push(r); }
    for (const list of byOwner.values()) {
      const zonas = new Map<string, PlanRoute[]>();
      for (const r of list) (zonas.get(r.zona) ?? zonas.set(r.zona, []).get(r.zona)!).push(r);
      const zonasSorted = [...zonas.entries()].sort((a, b) => b[1].length - a[1].length);
      const cnt = [0, 0, 0, 0, 0, 0];
      const argmin = () => { let d = 0; for (let i = 1; i < 6; i++) if (cnt[i] < cnt[d]) d = i; return d; };
      const perDayCap = Math.ceil(Math.min(WEEK_CAP, list.length) / 6) + 1;
      for (const [, zlist] of zonasSorted) {
        zlist.sort((a, b) => b.daysSince - a.daysSince);
        let day = argmin();
        for (const r of zlist) { if (cnt[day] >= perDayCap) day = argmin(); r.weekday = day; cnt[day]++; }
      }
    }
    const neglected = routes.filter((r) => r.cadence === 4).sort((a, b) => b.daysSince - a.daysSince);

    // Semanas do mês alvo (segunda a sábado, só dias dentro do mês)
    const [Y, M] = planMonth.split('-').map(Number);
    const first = new Date(Y, M - 1, 1, 12); const last = new Date(Y, M, 0, 12);
    const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const weeks: { monday: string; days: string[] }[] = [];
    for (let cur = new Date(start); cur <= last; cur.setDate(cur.getDate() + 7)) {
      const monday = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      const days: string[] = [];
      for (let i = 0; i < 6; i++) { const d = new Date(cur); d.setDate(cur.getDate() + i); if (d.getMonth() === M - 1) days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }
      weeks.push({ monday, days });
    }

    // AGENDA: preenche a semana de cada promotor até o TETO (visitas reais), rotacionando por urgência.
    // Urgência = semanas desde a última visita planejada × (0,5 + frequência histórica). Assim as lojas
    // atrasadas sobem, as importantes recorrem, e cada promotor fecha ~WEEK_CAP visitas/semana.
    const byOwnerR = new Map<string, PlanRoute[]>();
    for (const r of routes) { const k = r.owner ?? '—'; (byOwnerR.get(k) ?? byOwnerR.set(k, []).get(k)!).push(r); }
    const lastWk = new Map<string, number>();
    for (const r of routes) lastWk.set(r.storeId, -Math.ceil(r.daysSince / 7));
    const imp = new Map<string, number>();
    for (const r of routes) imp.set(r.storeId, r.visits / spanWeeks);
    const agenda: PlanVisit[] = [];
    weeks.forEach((wk, wi) => {
      for (const [, list] of byOwnerR) {
        const scored = list.map((r) => ({ r, s: (wi - (lastWk.get(r.storeId) ?? 0)) * (0.5 + (imp.get(r.storeId) ?? 0)) })).sort((a, b) => b.s - a.s);
        for (const { r } of scored.slice(0, WEEK_CAP)) {
          lastWk.set(r.storeId, wi);
          const date = addDays(wk.monday, r.weekday);
          if (wk.days.includes(date)) agenda.push({ date, storeId: r.storeId, name: r.name, network: r.network, zona: r.zona, owner: r.owner, ownerName: r.ownerName, weekday: r.weekday });
        }
      }
    });
    agenda.sort((a, b) => a.date.localeCompare(b.date) || a.ownerName.localeCompare(b.ownerName));
    routes.sort((a, b) => a.ownerName.localeCompare(b.ownerName) || a.weekday - b.weekday || a.name.localeCompare(b.name));
    return { routes, agenda, neglected, weeks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitsRaw, storesById, promotersById, networksById, planMonth]);

  function exportCsv(name: string, header: string[], rows: (string | number)[][]) {
    const csv = [header.join(';'), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  async function savePlan() {
    if (!isPrivileged) return;
    setSaving('Salvando…');
    await supabase.from('tm_agenda').delete().eq('source', 'fixo');
    await supabase.from('tm_routes').delete().neq('store_id', '00000000-0000-0000-0000-000000000000');
    if (plan.routes.length) await supabase.from('tm_routes').insert(plan.routes.map((r) => ({ store_id: r.storeId, promoter_id: r.owner, weekday: r.weekday, cadence_weeks: r.cadence, source: 'auto' })));
    if (plan.agenda.length) await supabase.from('tm_agenda').insert(plan.agenda.map((a) => ({ store_id: a.storeId, promoter_id: a.owner, planned_date: a.date, source: 'fixo' })));
    setSaving('Plano salvo ✓');
    setTimeout(() => setSaving(''), 2500);
  }

  function startNewStore() {
    setSdraft({ name: '', network_id: '', city: '', region: '', address: '', priority: '', planned_frequency_days: '', default_promoter_id: '', status: 'ativa' });
    setEditStore('new');
  }
  function startEditStore(s: Store) {
    setSdraft({ name: s.name, network_id: s.network_id ?? '', city: s.city ?? '', region: s.region ?? '', address: s.address ?? '', priority: s.priority ?? '', planned_frequency_days: s.planned_frequency_days != null ? String(s.planned_frequency_days) : '', default_promoter_id: s.default_promoter_id ?? '', status: s.status ?? 'ativa' });
    setEditStore(s);
  }
  async function saveStore() {
    if (!sdraft.name.trim()) return;
    setSavingStore(true);
    const payload = {
      name: sdraft.name.trim(), network_id: sdraft.network_id || null, city: sdraft.city || null, region: sdraft.region || null, address: sdraft.address || null,
      priority: sdraft.priority || null, planned_frequency_days: sdraft.planned_frequency_days ? Number(sdraft.planned_frequency_days) : null,
      default_promoter_id: sdraft.default_promoter_id || null, status: sdraft.status || 'ativa',
    };
    if (editStore === 'new') await supabase.from('tm_stores').insert(payload);
    else if (editStore) await supabase.from('tm_stores').update(payload).eq('id', editStore.id);
    const { data } = await supabase.from('tm_stores').select(STORE_COLS);
    setStores((data as Store[]) ?? []);
    setSavingStore(false); setEditStore(null);
  }

  if (loading) return <Loading />;
  if (!visitsRaw.length) return (<div className="page"><h1 className="page-title">Trade Marketing Intelligence</h1><EmptyState icon="🧭" title="Sem dados ainda" hint="Rode as migrations 0067 (schema) e 0068 (carga) no Supabase." /></div>);

  const netItems = agg.networkRank.map((n, i) => ({ label: n.name, value: n.visits, color: CATS[i % CATS.length] }));

  // filtro por promotor dentro do planejamento
  const planAgenda = planProm === 'all' ? plan.agenda : plan.agenda.filter((a) => a.owner === planProm);
  const dayCount = new Map<string, number>();
  for (const a of planAgenda) dayCount.set(a.date, (dayCount.get(a.date) ?? 0) + 1);
  const maxDay = Math.max(1, ...dayCount.values());
  const selWeek = plan.weeks[Math.min(planWeekIdx, plan.weeks.length - 1)] ?? plan.weeks[0];
  const weekAgenda = selWeek ? planAgenda.filter((a) => selWeek.days.includes(a.date)) : [];
  type DayCell = { names: string[]; zonas: Set<string> };
  const byPromDay = new Map<string, DayCell[]>();
  for (const a of weekAgenda) {
    const pm = byPromDay.get(a.ownerName) ?? Array.from({ length: 6 }, () => ({ names: [] as string[], zonas: new Set<string>() }));
    if (!pm[a.weekday].names.includes(a.name)) pm[a.weekday].names.push(a.name);
    pm[a.weekday].zonas.add(a.zona);
    byPromDay.set(a.ownerName, pm);
  }
  const dayVisits = planDay ? planAgenda.filter((a) => a.date === planDay).sort((x, y) => x.ownerName.localeCompare(y.ownerName) || x.name.localeCompare(y.name)) : [];
  const monthLabel = MONTHS.find(([k]) => k === planMonth)?.[1] ?? planMonth;

  return (
    <div className="page tm-root">
      <div className="tm-shell">
        <aside className="tm-rail">
          <div className="fld"><label>Período — de</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="fld"><label>Até</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="fld"><label>Promotor</label><select value={promoterId} onChange={(e) => setPromoterId(e.target.value)}><option value="all">Todos</option>{promoters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="fld"><label>Rede</label><select value={networkId} onChange={(e) => setNetworkId(e.target.value)}><option value="all">Todas</option>{networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
          <div className="fld"><label>Buscar</label><input type="text" placeholder="Loja ou promotor…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {filtersActive && <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => { setPromoterId('all'); setNetworkId('all'); setSearch(''); }}>Limpar filtros</button>}
          <div style={{ fontSize: 10.5, color: 'var(--tm-ink3)', marginTop: 10, lineHeight: 1.5 }}>💡 Clique num promotor, rede ou loja nos gráficos/tabelas para filtrar tudo.</div>
        </aside>

        <div className="tm-main">
          <div className="tm-head"><h1>Trade Marketing Intelligence</h1><div className="sub">Visitas realizadas — dados reais ({fmt(visitsRaw[0].visit_date)} a {fmt(visitsRaw[visitsRaw.length - 1].visit_date)})</div></div>

          {filtersActive && (
            <div className="tm-chips">
              {promoterId !== 'all' && <span className="tm-chip">Promotor: {promoterName(promoterId)}<span className="x" onClick={() => setPromoterId('all')}>✕</span></span>}
              {networkId !== 'all' && <span className="tm-chip">Rede: {networksById.get(networkId)?.name}<span className="x" onClick={() => setNetworkId('all')}>✕</span></span>}
              {search.trim() && <span className="tm-chip">“{search.trim()}”<span className="x" onClick={() => setSearch('')}>✕</span></span>}
            </div>
          )}

          <div className="tm-kpis">
            <div className="tm-kpi feat"><div className="k-l">Visitas realizadas</div><div className="k-v">{agg.total.toLocaleString('pt-BR')}</div><div className="k-s">{agg.perDay.toFixed(1)}/dia · {agg.timeline.length} semanas</div><Spark values={agg.timeline.map((t) => t.value)} /></div>
            <Kpi icon="🏬" tint="var(--tm-cyan)" label="Lojas visitadas" value={agg.uniqueStores} sub={`de ${stores.length} na base`} />
            <Kpi icon="👤" tint="var(--tm-purple)" label="Promotores ativos" value={agg.activePromoters} />
            <Kpi icon="📍" tint="var(--tm-good)" label="Cobertura" value={`${agg.coverage.toFixed(0)}%`} />
            <Kpi icon="🔁" tint="var(--tm-warn)" label="Frequência média" value={agg.avgFrequency != null ? `${agg.avgFrequency.toFixed(0)}d` : '—'} />
            <Kpi icon="⚠️" tint="var(--tm-bad)" label="+14 dias s/ visita" value={agg.overdue14} sub="lojas" />
          </div>

          <div className="tm-grid">
            <div className="tm-card tm-c8"><h3>Evolução das visitas <span className="hint">por semana</span></h3><div className="tm-chart"><LineArea data={agg.timeline} /></div></div>
            <div className="tm-card tm-c4"><h3>Visitas por rede <span className="hint">clique p/ filtrar</span></h3><div className="tm-chart"><Donut items={netItems} total={agg.total} onClick={toggleNet} active={networkId !== 'all' ? networksById.get(networkId)?.name : undefined} /></div></div>
            <div className="tm-card tm-c6"><h3>Top promotores <span className="hint">clique p/ filtrar</span></h3><div className="tm-chart"><HBars items={agg.promoterRank.slice(0, 8).map((p) => ({ label: p.name, value: p.visits, extra: `${p.stores} lojas` }))} color="var(--tm-accent)" onClick={toggleProm} active={promoterId !== 'all' ? promoterName(promoterId) : undefined} /></div></div>
            <div className="tm-card tm-c6"><h3>Lojas mais visitadas <span className="hint">clique p/ ver</span></h3><div className="tm-chart"><HBars items={agg.storeRank.slice(0, 8).map((s) => ({ label: s.name, value: s.visits, extra: s.network }))} color="var(--tm-purple)" onClick={(n) => setSearch(n)} /></div></div>
            <div className="tm-card tm-c6"><h3>Concentração <span className="hint">Pareto</span></h3><div className="tm-chart"><Pareto items={agg.storeRank.slice(0, 15).map((s) => ({ label: s.name, value: s.visits }))} /></div></div>
            <div className="tm-card tm-c6"><h3>Mais tempo sem visita <span className="hint">dias</span></h3><div className="tm-chart"><HBars items={[...agg.storeRank].sort((a, b) => b.daysSince - a.daysSince).slice(0, 8).map((s) => ({ label: s.name, value: s.daysSince, extra: `últ. ${fmt(s.last)}` }))} color="var(--tm-bad)" unit="d" onClick={(n) => setSearch(n)} /></div></div>
          </div>

          <div className="tm-section-title">Detalhes & Planejamento</div>
          <div className="tm-tabs">{TABS.map(([k, l]) => <div key={k} className={`tm-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</div>)}</div>

          {tab === 'planejamento' && (
            <>
              <div className="tm-card" style={{ marginBottom: 14 }}>
                <h3>Roteiro fixo — {monthLabel} <span className="hint">balanceado · {planAgenda.length} visitas planejadas</span></h3>
                <p style={{ fontSize: 12.5, color: 'var(--tm-ink2)', margin: '6px 0 12px' }}>
                  Responsável fixo (quem mais visitou) + cadência pela frequência histórica. Os dias são <b>distribuídos para equilibrar a carga</b> de cada promotor na semana. Trocar o mês gera o plano dele com base em todo o histórico atual.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="chip-select" value={planMonth} onChange={(e) => { setPlanMonth(e.target.value); setPlanWeekIdx(0); }}>{MONTHS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <div className="group-toggle">
                    {(['mes', 'semana', 'dia'] as const).map((vw) => <div key={vw} className={`filter-chip${planView === vw ? ' active' : ''}`} onClick={() => setPlanView(vw)}>{vw === 'mes' ? 'Mês' : vw === 'semana' ? 'Semana' : 'Dia'}</div>)}
                  </div>
                  <select className="chip-select" value={planProm} onChange={(e) => setPlanProm(e.target.value)}><option value="all">Todos promotores</option>{promoters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <button className="btn ghost sm" onClick={() => exportCsv(`agenda_${planMonth}.csv`, ['Data', 'Dia', 'Promotor', 'Loja', 'Rede'], planAgenda.map((a) => [fmt(a.date), WD[a.weekday], a.ownerName, a.name, a.network]))}>⬇ Agenda CSV</button>
                  <button className="btn ghost sm" onClick={() => exportCsv('roteiro_fixo.csv', ['Loja', 'Rede', 'Responsavel', 'Dia', 'Cadencia', 'Visitas_hist'], plan.routes.map((r) => [r.name, r.network, r.ownerName, WD[r.weekday], cadLabel(r.cadence), r.visits]))}>⬇ Roteiro CSV</button>
                  {isPrivileged && <button className="btn sm" onClick={savePlan}>{saving || '💾 Salvar plano'}</button>}
                </div>
              </div>

              {/* ===== VISÃO MÊS: calendário ===== */}
              {planView === 'mes' && (
                <div className="tm-card">
                  <h3>Calendário — {monthLabel} <span className="hint">clique num dia para ver as visitas</span></h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginTop: 10 }}>
                    {WD_SHORT.map((d) => <div key={d} style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm-ink3)', textAlign: 'center' }}>{d}</div>)}
                    {plan.weeks.map((wk) => WD_SHORT.map((_, wi) => {
                      const date = addDays(wk.monday, wi);
                      const inMonth = wk.days.includes(date);
                      const c = dayCount.get(date) ?? 0;
                      const intensity = c ? 0.12 + 0.5 * (c / maxDay) : 0;
                      return (
                        <div key={date} onClick={() => inMonth && (setPlanDay(date), setPlanView('dia'))}
                          style={{ minHeight: 62, borderRadius: 9, border: '1px solid var(--tm-line)', padding: '6px 7px', cursor: inMonth ? 'pointer' : 'default', opacity: inMonth ? 1 : 0.35, background: c ? `color-mix(in srgb, var(--tm-accent) ${intensity * 100}%, var(--tm-panel))` : 'var(--tm-panel)' }}>
                          <div style={{ fontSize: 11, color: 'var(--tm-ink2)', fontWeight: 600 }}>{date.slice(8)}</div>
                          {inMonth && c > 0 && <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{c}</div>}
                          {inMonth && c > 0 && <div style={{ fontSize: 9.5, color: 'var(--tm-ink3)' }}>visitas</div>}
                        </div>
                      );
                    }))}
                  </div>
                </div>
              )}

              {/* ===== VISÃO SEMANA: grade promotor x dia ===== */}
              {planView === 'semana' && selWeek && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 10px' }}>
                    <button className="btn ghost sm" disabled={planWeekIdx <= 0} onClick={() => setPlanWeekIdx((i) => Math.max(0, i - 1))}>‹</button>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Semana de {fmt(selWeek.days[0])} a {fmt(selWeek.days[selWeek.days.length - 1])}</span>
                    <button className="btn ghost sm" disabled={planWeekIdx >= plan.weeks.length - 1} onClick={() => setPlanWeekIdx((i) => Math.min(plan.weeks.length - 1, i + 1))}>›</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...byPromDay.entries()].sort().map(([pm, days]) => (
                      <div className="tm-card" key={pm}>
                        <h3>{pm} <span className="hint">{days.reduce((a, b) => a + b.names.length, 0)} visitas na semana (teto {WEEK_CAP})</span></h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 8, marginTop: 10 }}>
                          {WD.map((d, wi) => {
                            const cell = days[wi]; const zonas = [...cell.zonas];
                            return (
                              <div key={d} style={{ border: '1px solid var(--tm-line)', borderRadius: 10, background: 'var(--tm-panel2)', minHeight: 118, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '7px 9px', borderBottom: '1px solid var(--tm-line)' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm-ink2)', whiteSpace: 'nowrap' }}>{WD_SHORT[wi]}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: cell.names.length ? 'var(--tm-accent-ink)' : 'var(--tm-ink3)', background: cell.names.length ? 'var(--tm-soft)' : 'transparent', borderRadius: 20, padding: cell.names.length ? '1px 7px' : 0 }}>{cell.names.length}</span>
                                </div>
                                {zonas.length > 0 && <div style={{ padding: '4px 9px 0', fontSize: 9.5, fontWeight: 700, color: 'var(--tm-purple)', textTransform: 'uppercase', letterSpacing: '.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {zonas.join(' · ')}</div>}
                                <div style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {cell.names.slice(0, 12).map((n) => <span key={n} title={n} style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>)}
                                  {cell.names.length > 12 && <span style={{ fontSize: 10.5, color: 'var(--tm-ink3)' }}>+{cell.names.length - 12}</span>}
                                  {cell.names.length === 0 && <span style={{ fontSize: 11, color: 'var(--tm-ink3)' }}>—</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {byPromDay.size === 0 && <div className="tm-card"><p style={{ color: 'var(--tm-ink3)', fontSize: 13 }}>Sem visitas nesta semana.</p></div>}
                  </div>
                </>
              )}

              {/* ===== VISÃO DIA ===== */}
              {planView === 'dia' && (
                <div className="tm-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <input type="date" className="chip-select" value={planDay} min={`${planMonth}-01`} onChange={(e) => setPlanDay(e.target.value)} />
                    <span style={{ fontSize: 13, color: 'var(--tm-ink2)' }}>{planDay ? `${dayVisits.length} visitas em ${fmt(planDay)}` : 'Escolha um dia (ou clique no calendário do Mês)'}</span>
                  </div>
                  {planDay && <Table head={['Promotor', 'Loja', 'Rede']} rows={dayVisits.map((a) => [<b>{a.ownerName}</b>, a.name, a.network])} />}
                </div>
              )}

              {plan.neglected.length > 0 && (
                <>
                  <div className="tm-section-title">Lojas com baixa cobertura <span style={{ textTransform: 'none', fontWeight: 500 }}>({plan.neglected.length} lojas mensais — já entram na agenda, as mais atrasadas primeiro)</span></div>
                  <Table head={['Loja', 'Rede', 'Responsável', 'Visitas hist.', 'Dias s/ visita']} rows={plan.neglected.slice(0, 40).map((r) => [<b>{r.name}</b>, r.network, r.ownerName, r.visits, <span style={{ color: r.daysSince > 30 ? 'var(--tm-bad)' : undefined, fontWeight: 600 }}>{r.daysSince}</span>])} />
                </>
              )}
            </>
          )}

          {tab === 'promotores' && <Table head={['Promotor', 'Visitas', 'Lojas únicas', 'Média/dia', 'Cobertura']} onRow={(i) => toggleProm(agg.promoterRank[i].name)} rows={agg.promoterRank.map((p) => [<b>{p.name}</b>, <MiniBar v={p.visits} max={agg.promoterRank[0]?.visits || 1} />, p.stores, p.perDay.toFixed(1), `${p.coverage.toFixed(0)}%`])} />}
          {tab === 'lojas' && <Table head={['Loja', 'Rede', 'Visitas', 'Última', 'Dias s/ visita']} onRow={(i) => setSearch(agg.storeRank[i].name)} rows={agg.storeRank.map((s) => [<b>{s.name}</b>, s.network, s.visits, fmt(s.last), <span style={{ color: s.daysSince > 14 ? 'var(--tm-bad)' : undefined, fontWeight: 600 }}>{s.daysSince}</span>])} />}
          {tab === 'frequencia' && <Table head={['Loja', 'Visitas', 'Última', 'Dias s/ visita', 'Interv. médio', 'Mín', 'Máx']} rows={[...agg.storeRank].sort((a, b) => b.daysSince - a.daysSince).map((s) => [<b>{s.name}</b>, s.visits, fmt(s.last), <span className="tm-badge" style={freqBadge(s.daysSince)}>{s.daysSince}d</span>, s.avgGap != null ? `${s.avgGap.toFixed(0)}d` : '—', s.minGap != null ? `${s.minGap}d` : '—', s.maxGap != null ? `${s.maxGap}d` : '—'])} />}
          {tab === 'visitas' && <Table head={['Data', 'Promotor', 'Loja', 'Rede']} rows={visits.slice(0, 500).map((v) => [fmt(v.visit_date), promoterName(v.promoter_id), storeName(v.store_id), networkOfStore(v.store_id) ?? '—'])} note={visits.length > 500 ? `Mostrando 500 de ${visits.length}.` : undefined} />}

          {tab === 'cadastro' && (() => {
            const q = cadSearch.trim().toLowerCase();
            const list = [...stores].filter((s) => !q || s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q) || (s.region ?? '').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
            const semZona = stores.filter((s) => !s.region).length;
            return (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <input className="chip-input" placeholder="⌕ Loja, cidade ou zona…" value={cadSearch} onChange={(e) => setCadSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--tm-ink2)' }}>{stores.length} lojas{semZona ? ` · ${semZona} sem zona` : ''}</span>
                  {isPrivileged && <button className="btn sm" onClick={startNewStore}>+ Nova loja</button>}
                </div>
                <Table
                  head={['Loja', 'Rede', 'Cidade', 'Zona', 'Responsável', 'Prioridade', 'Freq (d)']}
                  onRow={isPrivileged ? (i) => startEditStore(list[i]) : undefined}
                  rows={list.map((s) => [
                    <b>{s.name}</b>,
                    s.network_id ? networksById.get(s.network_id)?.name ?? '—' : '—',
                    s.city || <span style={{ color: 'var(--tm-bad)' }}>—</span>,
                    s.region || <span style={{ color: 'var(--tm-bad)' }}>sem zona</span>,
                    s.default_promoter_id ? promotersById.get(s.default_promoter_id)?.name ?? '—' : <span style={{ color: 'var(--tm-ink3)' }}>histórico</span>,
                    s.priority || '—',
                    s.planned_frequency_days ?? '—',
                  ])}
                />
                {isPrivileged && <p style={{ fontSize: 12, color: 'var(--tm-ink3)', marginTop: 8 }}>Clique numa loja para editar cidade, zona, endereço, prioridade, frequência e o <b>responsável</b> (que o planejamento passa a usar).</p>}
              </>
            );
          })()}

          {tab === 'campo' && <CampoAdmin />}
        </div>
      </div>

      {editStore && (
        <Modal wide title={editStore === 'new' ? 'Nova loja' : `Editar — ${sdraft.name}`} onClose={() => setEditStore(null)}>
          <div className="form-field"><label>Nome da loja</label><input value={sdraft.name} onChange={(e) => setSdraft({ ...sdraft, name: e.target.value })} placeholder="ex.: Ri Happy Penha" /></div>
          <div className="responsive-row">
            <div className="form-field" style={{ flex: 1 }}><label>Rede</label><select value={sdraft.network_id} onChange={(e) => setSdraft({ ...sdraft, network_id: e.target.value })}><option value="">—</option>{networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
            <div className="form-field" style={{ flex: 1 }}><label>Responsável (promotor)</label><select value={sdraft.default_promoter_id} onChange={(e) => setSdraft({ ...sdraft, default_promoter_id: e.target.value })}><option value="">Automático (histórico)</option>{promoters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <div className="responsive-row">
            <div className="form-field" style={{ flex: 1 }}><label>Cidade</label><input value={sdraft.city} onChange={(e) => setSdraft({ ...sdraft, city: e.target.value })} placeholder="São Paulo" /></div>
            <div className="form-field" style={{ flex: 1 }}><label>Zona</label><select value={sdraft.region} onChange={(e) => setSdraft({ ...sdraft, region: e.target.value })}><option value="">Sem zona</option>{ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}</select></div>
          </div>
          <div className="form-field"><label>Endereço</label><input value={sdraft.address} onChange={(e) => setSdraft({ ...sdraft, address: e.target.value })} placeholder="Rua, número - Bairro, Cidade - UF" /></div>
          <div className="responsive-row">
            <div className="form-field" style={{ flex: 1 }}><label>Prioridade</label><select value={sdraft.priority} onChange={(e) => setSdraft({ ...sdraft, priority: e.target.value })}><option value="">—</option>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="form-field" style={{ flex: 1 }}><label>Freq. planejada (dias)</label><input type="number" min="1" value={sdraft.planned_frequency_days} onChange={(e) => setSdraft({ ...sdraft, planned_frequency_days: e.target.value })} placeholder="ex.: 7" /></div>
            <div className="form-field" style={{ flex: 1 }}><label>Status</label><select value={sdraft.status} onChange={(e) => setSdraft({ ...sdraft, status: e.target.value })}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn" disabled={savingStore || !sdraft.name.trim()} onClick={saveStore}>{savingStore ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn ghost" onClick={() => setEditStore(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function freqBadge(days: number) { if (days > 14) return { background: 'rgba(239,68,68,.14)', color: 'var(--tm-bad)' }; if (days > 7) return { background: 'rgba(245,158,11,.16)', color: 'var(--tm-warn)' }; return { background: 'rgba(16,185,129,.15)', color: 'var(--tm-good)' }; }

function Kpi({ icon, tint, label, value, sub }: { icon: string; tint: string; label: string; value: ReactNode; sub?: string }) {
  return (<div className="tm-kpi"><div className="k-l"><span className="k-i" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>{icon}</span>{label}</div><div className="k-v">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</div>{sub && <div className="k-s">{sub}</div>}</div>);
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1); const W = 240, H = 34;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - (v / max) * (H - 4) - 2}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 34, marginTop: 8, overflow: 'visible' }} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} /></svg>;
}

function LineArea({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return null;
  const W = 640, H = 200, pad = 28;
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `M ${x(0)},${H - pad} L ${line.split(' ').join(' L ')} L ${x(data.length - 1)},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.5, 1].map((g) => <line key={g} x1={pad} x2={W - pad} y1={y(max * g)} y2={y(max * g)} stroke="var(--tm-line)" strokeWidth={1} />)}
      <path d={area} fill="var(--tm-accent)" opacity={0.12} />
      <polyline points={line} fill="none" stroke="var(--tm-accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (<g key={i}><circle cx={x(i)} cy={y(d.value)} r={3.5} fill="var(--tm-accent)" /><text x={x(i)} y={y(d.value) - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--tm-ink)">{d.value}</text><text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--tm-ink3)">{d.label}</text></g>))}
    </svg>
  );
}

function Donut({ items, total, onClick, active }: { items: { label: string; value: number; color: string }[]; total: number; onClick?: (label: string) => void; active?: string }) {
  const r = 62, sw = 22, C = 2 * Math.PI * r; let off = 0;
  return (
    <>
      <svg viewBox="0 0 200 170"><g transform="translate(100,85)"><circle r={r} fill="none" stroke="var(--tm-line)" strokeWidth={sw} />
        {items.map((it, i) => { const frac = total ? it.value / total : 0; const dash = frac * C; const el = <circle key={i} r={r} fill="none" stroke={it.color} strokeWidth={active && active !== it.label ? sw - 8 : sw} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform="rotate(-90)" opacity={active && active !== it.label ? 0.4 : 1} />; off += dash; return el; })}
        <text textAnchor="middle" y={-4} fontSize={26} fontWeight={800} fill="var(--tm-ink)">{total}</text><text textAnchor="middle" y={14} fontSize={11} fill="var(--tm-ink3)">visitas</text></g></svg>
      <div className="tm-legend">{items.slice(0, 6).map((it) => <span className="li" key={it.label} style={{ cursor: onClick ? 'pointer' : 'default', opacity: active && active !== it.label ? 0.5 : 1, fontWeight: active === it.label ? 700 : undefined }} onClick={() => onClick?.(it.label)}><span className="sw" style={{ background: it.color }} />{it.label} · {it.value}</span>)}</div>
    </>
  );
}

function HBars({ items, color, unit, onClick, active }: { items: { label: string; value: number; extra?: string }[]; color: string; unit?: string; onClick?: (label: string) => void; active?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
      {items.map((it) => (
        <div key={it.label} onClick={() => onClick?.(it.label)} style={{ cursor: onClick ? 'pointer' : 'default', opacity: active && active !== it.label ? 0.45 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{it.label}</span>
            <span style={{ color: 'var(--tm-ink2)' }}>{it.value}{unit || ''}{it.extra ? ` · ${it.extra}` : ''}</span>
          </div>
          <div style={{ height: 8, borderRadius: 5, background: 'var(--tm-line)' }}><div style={{ width: `${(it.value / max) * 100}%`, height: '100%', borderRadius: 5, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

function Pareto({ items }: { items: { label: string; value: number }[] }) {
  const W = 460, H = 210, pad = 30;
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const max = Math.max(...items.map((i) => i.value), 1);
  const bw = (W - pad * 2) / items.length; let cum = 0;
  const cumPts = items.map((it, i) => { cum += it.value; const cx = pad + bw * i + bw / 2; const cy = (H - pad) - (cum / total) * (H - pad * 2); return `${cx},${cy}`; }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      {items.map((it, i) => { const h = (it.value / max) * (H - pad * 2); return <rect key={i} x={pad + bw * i + 2} y={H - pad - h} width={bw - 4} height={h} rx={2} fill="var(--tm-accent)" opacity={0.85} />; })}
      <polyline points={cumPts} fill="none" stroke="var(--tm-warn)" strokeWidth={2} />
      <text x={pad} y={14} fontSize={10} fill="var(--tm-ink3)">100% = {total} visitas</text>
    </svg>
  );
}

function Table({ head, rows, note, onRow }: { head: string[]; rows: ReactNode[][]; note?: string; onRow?: (i: number) => void }) {
  return (
    <>
      <div className="tm-tblwrap"><table className="tm-tbl">
        <thead><tr>{head.map((h, i) => <th key={h} className={i === 0 ? '' : 'num'}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri} onClick={() => onRow?.(ri)} style={{ cursor: onRow ? 'pointer' : 'default' }}>{r.map((c, ci) => <td key={ci} className={ci === 0 ? '' : 'num'}>{c}</td>)}</tr>)}</tbody>
      </table></div>
      {note && <p style={{ fontSize: 12, color: 'var(--tm-ink3)', marginTop: 8 }}>{note}</p>}
    </>
  );
}

function MiniBar({ v, max }: { v: number; max: number }) { return <><span className="tm-minibar" style={{ width: `${Math.max(6, (v / max) * 70)}px` }} />{v}</>; }
