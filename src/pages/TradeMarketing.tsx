import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';

type Visit = { id: string; promoter_id: string | null; store_id: string | null; visit_date: string; weekday: string | null; raw_store_name: string | null };
type Store = { id: string; name: string; network_id: string | null; planned_frequency_days: number | null };
type Promoter = { id: string; name: string };
type Network = { id: string; name: string };

type Tab = 'visitas' | 'promotores' | 'lojas' | 'frequencia';
const TABS: [Tab, string][] = [
  ['promotores', 'Promotores'],
  ['lojas', 'Lojas'],
  ['frequencia', 'Frequência'],
  ['visitas', 'Visitas'],
];
const CATS = ['var(--tm-accent)', 'var(--tm-purple)', 'var(--tm-cyan)', 'var(--tm-pink)', 'var(--tm-good)', 'var(--tm-warn)', 'var(--tm-accent2)', '#64748b'];

const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const fmt = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function TradeMarketing() {
  const [loading, setLoading] = useState(true);
  const [visitsRaw, setVisitsRaw] = useState<Visit[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [tab, setTab] = useState<Tab>('promotores');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [promoterId, setPromoterId] = useState('all');
  const [networkId, setNetworkId] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, s, p, n] = await Promise.all([
        supabase.from('tm_visits').select('id, promoter_id, store_id, visit_date, weekday, raw_store_name').order('visit_date'),
        supabase.from('tm_stores').select('id, name, network_id, planned_frequency_days'),
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
  const storeName = (id: string | null) => (id ? storesById.get(id)?.name ?? '—' : '—');
  const promoterName = (id: string | null) => (id ? promotersById.get(id)?.name ?? '—' : '—');
  const networkOfStore = (storeId: string | null) => { const st = storeId ? storesById.get(storeId) : null; return st?.network_id ? networksById.get(st.network_id)?.name ?? null : null; };

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
      return { id, name: storeName(id), network: networkOfStore(id) ?? '—', visits: sorted.length, last, daysSince: daysBetween(last, today), avgGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null, minGap: gaps.length ? Math.min(...gaps) : null, maxGap: gaps.length ? Math.max(...gaps) : null, plannedFreq: storesById.get(id)?.planned_frequency_days ?? null };
    }).sort((a, b) => b.visits - a.visits);

    const avgGaps = storeRank.map((s) => s.avgGap).filter((x): x is number => x != null);
    const avgFrequency = avgGaps.length ? avgGaps.reduce((a, b) => a + b, 0) / avgGaps.length : null;
    const overdue14 = storeRank.filter((s) => s.daysSince > 14).length;

    const weekKey = (ymd: string) => { const d = parseYmd(ymd); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const perWeek = new Map<string, number>();
    for (const v of visits) perWeek.set(weekKey(v.visit_date), (perWeek.get(weekKey(v.visit_date)) ?? 0) + 1);
    const timeline = [...perWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([wk, n]) => ({ label: fmt(wk).slice(0, 5), value: n }));

    return { total: visits.length, uniqueStores: uniqueStores.size, activePromoters: activePromoters.size, perDay: distinctDays ? visits.length / distinctDays : 0, coverage, avgFrequency, overdue14, promoterRank, networkRank, storeRank, timeline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, stores, storesById, networksById, promotersById]);

  if (loading) return <Loading />;
  if (!visitsRaw.length) {
    return (
      <div className="page"><h1 className="page-title">Trade Marketing Intelligence</h1>
        <EmptyState icon="🧭" title="Sem dados ainda" hint="Rode as migrations 0067 (schema) e 0068 (carga inicial) no Supabase para carregar as visitas reais." />
      </div>
    );
  }

  const netItems = agg.networkRank.map((n, i) => ({ label: n.name, value: n.visits, color: CATS[i % CATS.length] }));

  return (
    <div className="page tm-root">
      <div className="tm-shell">
        {/* rail de filtros */}
        <aside className="tm-rail">
          <div className="fld"><label>Período — de</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="fld"><label>Até</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="fld"><label>Promotor</label>
            <select value={promoterId} onChange={(e) => setPromoterId(e.target.value)}><option value="all">Todos</option>{promoters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          <div className="fld"><label>Rede</label>
            <select value={networkId} onChange={(e) => setNetworkId(e.target.value)}><option value="all">Todas</option>{networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
          </div>
          <div className="fld"><label>Buscar</label><input type="text" placeholder="Loja ou promotor…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {filtersActive && <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => { setPromoterId('all'); setNetworkId('all'); setSearch(''); }}>Limpar filtros</button>}
        </aside>

        <div className="tm-main">
          <div className="tm-head">
            <h1>Trade Marketing Intelligence</h1>
            <div className="sub">Visitas realizadas pelos promotores — dados reais ({fmt(visitsRaw[0].visit_date)} a {fmt(visitsRaw[visitsRaw.length - 1].visit_date)})</div>
          </div>

          {filtersActive && (
            <div className="tm-chips">
              {promoterId !== 'all' && <span className="tm-chip">Promotor: {promoterName(promoterId)}<span className="x" onClick={() => setPromoterId('all')}>✕</span></span>}
              {networkId !== 'all' && <span className="tm-chip">Rede: {networksById.get(networkId)?.name}<span className="x" onClick={() => setNetworkId('all')}>✕</span></span>}
              {search.trim() && <span className="tm-chip">“{search.trim()}”<span className="x" onClick={() => setSearch('')}>✕</span></span>}
            </div>
          )}

          {/* KPIs */}
          <div className="tm-kpis">
            <div className="tm-kpi feat">
              <div className="k-l">Visitas realizadas</div>
              <div className="k-v">{agg.total.toLocaleString('pt-BR')}</div>
              <div className="k-s">{agg.perDay.toFixed(1)} por dia · {agg.timeline.length} semanas</div>
              <Spark values={agg.timeline.map((t) => t.value)} />
            </div>
            <Kpi icon="🏬" tint="var(--tm-cyan)" label="Lojas visitadas" value={agg.uniqueStores} sub={`de ${stores.length} na base`} />
            <Kpi icon="👤" tint="var(--tm-purple)" label="Promotores ativos" value={agg.activePromoters} />
            <Kpi icon="📍" tint="var(--tm-good)" label="Cobertura" value={`${agg.coverage.toFixed(0)}%`} sub="lojas visitadas / base" />
            <Kpi icon="🔁" tint="var(--tm-warn)" label="Frequência média" value={agg.avgFrequency != null ? `${agg.avgFrequency.toFixed(0)}d` : '—'} sub="entre visitas" />
            <Kpi icon="⚠️" tint="var(--tm-bad)" label="+14 dias s/ visita" value={agg.overdue14} sub="lojas" />
          </div>

          {/* grid de gráficos */}
          <div className="tm-grid">
            <div className="tm-card tm-c8">
              <h3>Evolução das visitas <span className="hint">por semana</span></h3>
              <div className="tm-chart"><LineArea data={agg.timeline} /></div>
            </div>
            <div className="tm-card tm-c4">
              <h3>Visitas por rede</h3>
              <div className="tm-chart"><Donut items={netItems} total={agg.total} /></div>
            </div>
            <div className="tm-card tm-c6">
              <h3>Top promotores <span className="hint">visitas</span></h3>
              <div className="tm-chart"><HBars items={agg.promoterRank.slice(0, 8).map((p) => ({ label: p.name, value: p.visits, extra: `${p.stores} lojas` }))} color="var(--tm-accent)" /></div>
            </div>
            <div className="tm-card tm-c6">
              <h3>Lojas mais visitadas</h3>
              <div className="tm-chart"><HBars items={agg.storeRank.slice(0, 8).map((s) => ({ label: s.name, value: s.visits, extra: s.network }))} color="var(--tm-purple)" /></div>
            </div>
            <div className="tm-card tm-c6">
              <h3>Concentração de visitas <span className="hint">Pareto (top lojas)</span></h3>
              <div className="tm-chart"><Pareto items={agg.storeRank.slice(0, 15).map((s) => ({ label: s.name, value: s.visits }))} /></div>
            </div>
            <div className="tm-card tm-c6">
              <h3>Lojas mais tempo sem visita <span className="hint">dias</span></h3>
              <div className="tm-chart"><HBars items={[...agg.storeRank].sort((a, b) => b.daysSince - a.daysSince).slice(0, 8).map((s) => ({ label: s.name, value: s.daysSince, extra: `últ. ${fmt(s.last)}` }))} color="var(--tm-bad)" unit="d" /></div>
            </div>
          </div>

          {/* tabelas */}
          <div className="tm-section-title">Tabelas detalhadas</div>
          <div className="tm-tabs">{TABS.map(([k, l]) => <div key={k} className={`tm-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</div>)}</div>

          {tab === 'promotores' && (
            <Table head={['Promotor', 'Visitas', 'Lojas únicas', 'Média/dia', 'Cobertura']} rows={agg.promoterRank.map((p) => [
              <b>{p.name}</b>, <MiniBar v={p.visits} max={agg.promoterRank[0]?.visits || 1} />, p.stores, p.perDay.toFixed(1), `${p.coverage.toFixed(0)}%`,
            ])} />
          )}
          {tab === 'lojas' && (
            <Table head={['Loja', 'Rede', 'Visitas', 'Última', 'Dias s/ visita']} rows={agg.storeRank.map((s) => [
              <b>{s.name}</b>, s.network, s.visits, fmt(s.last), <span style={{ color: s.daysSince > 14 ? 'var(--tm-bad)' : undefined, fontWeight: 600 }}>{s.daysSince}</span>,
            ])} />
          )}
          {tab === 'frequencia' && (
            <Table head={['Loja', 'Visitas', 'Última', 'Dias s/ visita', 'Interv. médio', 'Mín', 'Máx', 'Planejada']} rows={[...agg.storeRank].sort((a, b) => b.daysSince - a.daysSince).map((s) => [
              <b>{s.name}</b>, s.visits, fmt(s.last),
              <span className="tm-badge" style={freqBadge(s.daysSince)}>{s.daysSince}d</span>,
              s.avgGap != null ? `${s.avgGap.toFixed(0)}d` : '—', s.minGap != null ? `${s.minGap}d` : '—', s.maxGap != null ? `${s.maxGap}d` : '—',
              <span style={{ color: 'var(--tm-ink3)' }}>{s.plannedFreq != null ? `${s.plannedFreq}d` : 'não cadastrada'}</span>,
            ])} />
          )}
          {tab === 'visitas' && (
            <Table head={['Data', 'Promotor', 'Loja', 'Rede']} rows={visits.slice(0, 500).map((v) => [
              fmt(v.visit_date), promoterName(v.promoter_id), storeName(v.store_id), networkOfStore(v.store_id) ?? '—',
            ])} note={visits.length > 500 ? `Mostrando 500 de ${visits.length}. Refine os filtros.` : undefined} />
          )}
        </div>
      </div>
    </div>
  );
}

function freqBadge(days: number) {
  if (days > 14) return { background: 'rgba(239,68,68,.14)', color: 'var(--tm-bad)' };
  if (days > 7) return { background: 'rgba(245,158,11,.16)', color: 'var(--tm-warn)' };
  return { background: 'rgba(16,185,129,.15)', color: 'var(--tm-good)' };
}

function Kpi({ icon, tint, label, value, sub }: { icon: string; tint: string; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="tm-kpi">
      <div className="k-l"><span className="k-i" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>{icon}</span>{label}</div>
      <div className="k-v">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</div>
      {sub && <div className="k-s">{sub}</div>}
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1); const W = 240, H = 34;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - (v / max) * (H - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 34, marginTop: 8, overflow: 'visible' }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
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
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r={3.5} fill="var(--tm-accent)" />
          <text x={x(i)} y={y(d.value) - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--tm-ink)">{d.value}</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--tm-ink3)">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

function Donut({ items, total }: { items: { label: string; value: number; color: string }[]; total: number }) {
  const r = 62, sw = 22, C = 2 * Math.PI * r; let off = 0;
  return (
    <>
      <svg viewBox="0 0 200 170">
        <g transform="translate(100,85)">
          <circle r={r} fill="none" stroke="var(--tm-line)" strokeWidth={sw} />
          {items.map((it, i) => {
            const frac = total ? it.value / total : 0; const dash = frac * C;
            const el = <circle key={i} r={r} fill="none" stroke={it.color} strokeWidth={sw} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform="rotate(-90)" />;
            off += dash; return el;
          })}
          <text textAnchor="middle" y={-4} fontSize={26} fontWeight={800} fill="var(--tm-ink)">{total}</text>
          <text textAnchor="middle" y={14} fontSize={11} fill="var(--tm-ink3)">visitas</text>
        </g>
      </svg>
      <div className="tm-legend">
        {items.slice(0, 6).map((it) => <span className="li" key={it.label}><span className="sw" style={{ background: it.color }} />{it.label} · {it.value}</span>)}
      </div>
    </>
  );
}

function HBars({ items, color, unit }: { items: { label: string; value: number; extra?: string }[]; color: string; unit?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
      {items.map((it) => (
        <div key={it.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{it.label}</span>
            <span style={{ color: 'var(--tm-ink2)' }}>{it.value}{unit || ''}{it.extra ? ` · ${it.extra}` : ''}</span>
          </div>
          <div style={{ height: 8, borderRadius: 5, background: 'var(--tm-line)' }}>
            <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', borderRadius: 5, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Pareto({ items }: { items: { label: string; value: number }[] }) {
  const W = 460, H = 210, pad = 30;
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const max = Math.max(...items.map((i) => i.value), 1);
  const bw = (W - pad * 2) / items.length;
  let cum = 0;
  const cumPts = items.map((it, i) => { cum += it.value; const cx = pad + bw * i + bw / 2; const cy = (H - pad) - (cum / total) * (H - pad * 2); return `${cx},${cy}`; }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      {items.map((it, i) => {
        const h = (it.value / max) * (H - pad * 2); const bx = pad + bw * i + 2;
        return <rect key={i} x={bx} y={H - pad - h} width={bw - 4} height={h} rx={2} fill="var(--tm-accent)" opacity={0.85} />;
      })}
      <polyline points={cumPts} fill="none" stroke="var(--tm-warn)" strokeWidth={2} />
      {items.map((_, i) => { const cum2 = items.slice(0, i + 1).reduce((a, b) => a + b.value, 0); const cx = pad + bw * i + bw / 2; const cy = (H - pad) - (cum2 / total) * (H - pad * 2); return <circle key={i} cx={cx} cy={cy} r={2.5} fill="var(--tm-warn)" />; })}
      <text x={pad} y={14} fontSize={10} fill="var(--tm-ink3)">100% = {total} visitas</text>
    </svg>
  );
}

function Table({ head, rows, note }: { head: string[]; rows: ReactNode[][]; note?: string }) {
  return (
    <>
      <div className="tm-tblwrap">
        <table className="tm-tbl">
          <thead><tr>{head.map((h, i) => <th key={h} className={i === 0 ? '' : 'num'}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className={ci === 0 ? '' : 'num'}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {note && <p style={{ fontSize: 12, color: 'var(--tm-ink3)', marginTop: 8 }}>{note}</p>}
    </>
  );
}

function MiniBar({ v, max }: { v: number; max: number }) {
  return <><span className="tm-minibar" style={{ width: `${Math.max(6, (v / max) * 70)}px` }} />{v}</>;
}
