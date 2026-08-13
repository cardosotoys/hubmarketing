import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';

// ---- Tipos (espelham as tabelas tm_*) ----
type Visit = { id: string; promoter_id: string | null; store_id: string | null; visit_date: string; weekday: string | null; raw_store_name: string | null; source_file: string | null };
type Store = { id: string; name: string; network_id: string | null; planned_frequency_days: number | null };
type Promoter = { id: string; name: string };
type Network = { id: string; name: string };

type Tab = 'dashboard' | 'visitas' | 'promotores' | 'lojas' | 'frequencia';
const TABS: [Tab, string][] = [
  ['dashboard', 'Dashboard'],
  ['visitas', 'Visitas'],
  ['promotores', 'Promotores'],
  ['lojas', 'Lojas'],
  ['frequencia', 'Frequência'],
];

// ---- helpers de data (date-only, sem fuso) ----
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const fmt = (s: string) => {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};
const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function TradeMarketing() {
  const [loading, setLoading] = useState(true);
  const [visitsRaw, setVisitsRaw] = useState<Visit[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [tab, setTab] = useState<Tab>('dashboard');

  // filtros
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [promoterId, setPromoterId] = useState('all');
  const [networkId, setNetworkId] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, s, p, n] = await Promise.all([
        supabase.from('tm_visits').select('id, promoter_id, store_id, visit_date, weekday, raw_store_name, source_file').order('visit_date'),
        supabase.from('tm_stores').select('id, name, network_id, planned_frequency_days'),
        supabase.from('tm_promoters').select('id, name').order('name'),
        supabase.from('tm_networks').select('id, name').order('name'),
      ]);
      const vv = (v.data as Visit[]) ?? [];
      setVisitsRaw(vv);
      setStores((s.data as Store[]) ?? []);
      setPromoters((p.data as Promoter[]) ?? []);
      setNetworks((n.data as Network[]) ?? []);
      if (vv.length) {
        setFrom(vv[0].visit_date);
        setTo(vv[vv.length - 1].visit_date);
      }
      setLoading(false);
    })();
  }, []);

  const storesById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const promotersById = useMemo(() => new Map(promoters.map((p) => [p.id, p])), [promoters]);
  const networksById = useMemo(() => new Map(networks.map((n) => [n.id, n])), [networks]);

  const storeName = (id: string | null) => (id ? storesById.get(id)?.name ?? '—' : '—');
  const promoterName = (id: string | null) => (id ? promotersById.get(id)?.name ?? '—' : '—');
  const networkOfStore = (storeId: string | null) => {
    const st = storeId ? storesById.get(storeId) : null;
    return st?.network_id ? networksById.get(st.network_id)?.name ?? null : null;
  };

  // visitas filtradas
  const visits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visitsRaw.filter((v) => {
      if (from && v.visit_date < from) return false;
      if (to && v.visit_date > to) return false;
      if (promoterId !== 'all' && v.promoter_id !== promoterId) return false;
      if (networkId !== 'all') {
        const st = v.store_id ? storesById.get(v.store_id) : null;
        if (!st || st.network_id !== networkId) return false;
      }
      if (q) {
        const nm = storeName(v.store_id).toLowerCase();
        const pn = promoterName(v.promoter_id).toLowerCase();
        if (!nm.includes(q) && !pn.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitsRaw, from, to, promoterId, networkId, search, storesById]);

  const filtersActive = promoterId !== 'all' || networkId !== 'all' || !!search.trim();
  const clearFilters = () => {
    setPromoterId('all');
    setNetworkId('all');
    setSearch('');
  };

  // ---- agregações ----
  const agg = useMemo(() => {
    const uniqueStores = new Set(visits.map((v) => v.store_id).filter(Boolean));
    const activePromoters = new Set(visits.map((v) => v.promoter_id).filter(Boolean));
    const dates = visits.map((v) => v.visit_date);
    const distinctDays = new Set(dates).size;
    const coverage = stores.length ? (uniqueStores.size / stores.length) * 100 : 0;

    // por promotor
    const perProm = new Map<string, { visits: number; stores: Set<string>; days: Set<string> }>();
    for (const v of visits) {
      if (!v.promoter_id) continue;
      const e = perProm.get(v.promoter_id) ?? { visits: 0, stores: new Set(), days: new Set() };
      e.visits++;
      if (v.store_id) e.stores.add(v.store_id);
      e.days.add(v.visit_date);
      perProm.set(v.promoter_id, e);
    }
    const promoterRank = [...perProm.entries()]
      .map(([id, e]) => ({
        id,
        name: promoterName(id),
        visits: e.visits,
        stores: e.stores.size,
        perDay: e.days.size ? e.visits / e.days.size : 0,
        coverage: stores.length ? (e.stores.size / stores.length) * 100 : 0,
      }))
      .sort((a, b) => b.visits - a.visits);

    // por rede
    const perNet = new Map<string, { visits: number; stores: Set<string> }>();
    for (const v of visits) {
      const nm = networkOfStore(v.store_id) ?? '(sem rede)';
      const e = perNet.get(nm) ?? { visits: 0, stores: new Set() };
      e.visits++;
      if (v.store_id) e.stores.add(v.store_id);
      perNet.set(nm, e);
    }
    const networkRank = [...perNet.entries()].map(([name, e]) => ({ name, visits: e.visits, stores: e.stores.size })).sort((a, b) => b.visits - a.visits);

    // por loja: intervalos/frequência
    const perStore = new Map<string, string[]>();
    for (const v of visits) {
      if (!v.store_id) continue;
      const arr = perStore.get(v.store_id) ?? [];
      arr.push(v.visit_date);
      perStore.set(v.store_id, arr);
    }
    const today = todayYmd();
    const storeRank = [...perStore.entries()]
      .map(([id, ds]) => {
        const sorted = [...ds].sort();
        const gaps: number[] = [];
        for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1], sorted[i]));
        const last = sorted[sorted.length - 1];
        const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
        return {
          id,
          name: storeName(id),
          network: networkOfStore(id) ?? '—',
          visits: sorted.length,
          last,
          daysSince: daysBetween(last, today),
          avgGap,
          minGap: gaps.length ? Math.min(...gaps) : null,
          maxGap: gaps.length ? Math.max(...gaps) : null,
          plannedFreq: storesById.get(id)?.planned_frequency_days ?? null,
        };
      })
      .sort((a, b) => b.visits - a.visits);

    // frequência média geral (média das médias das lojas com >1 visita)
    const avgGaps = storeRank.map((s) => s.avgGap).filter((x): x is number => x != null);
    const avgFrequency = avgGaps.length ? avgGaps.reduce((a, b) => a + b, 0) / avgGaps.length : null;
    const overdue14 = storeRank.filter((s) => s.daysSince > 14).length;

    // série temporal por semana (ISO-ish: agrupa por início de semana segunda)
    const weekKey = (ymd: string) => {
      const d = parseYmd(ymd);
      const day = (d.getDay() + 6) % 7; // 0 = segunda
      d.setDate(d.getDate() - day);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const perWeek = new Map<string, number>();
    for (const v of visits) perWeek.set(weekKey(v.visit_date), (perWeek.get(weekKey(v.visit_date)) ?? 0) + 1);
    const timeline = [...perWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([wk, n]) => ({ wk, n }));

    return {
      total: visits.length,
      uniqueStores: uniqueStores.size,
      activePromoters: activePromoters.size,
      distinctDays,
      perDay: distinctDays ? visits.length / distinctDays : 0,
      coverage,
      avgFrequency,
      overdue14,
      promoterRank,
      networkRank,
      storeRank,
      timeline,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, stores, storesById, networksById, promotersById]);

  if (loading) return <Loading />;

  if (!visitsRaw.length) {
    return (
      <div className="page">
        <h1 className="page-title">Trade Marketing Intelligence</h1>
        <EmptyState icon="🧭" title="Sem dados ainda" hint="Rode as migrations 0067 (schema) e 0068 (carga inicial) no Supabase para carregar as visitas reais dos promotores." />
      </div>
    );
  }

  const kpis = [
    { label: 'Visitas realizadas', value: agg.total.toLocaleString('pt-BR') },
    { label: 'Lojas visitadas', value: agg.uniqueStores.toLocaleString('pt-BR'), sub: `de ${stores.length} na base` },
    { label: 'Promotores ativos', value: String(agg.activePromoters) },
    { label: 'Média de visitas/dia', value: agg.perDay.toFixed(1) },
    { label: 'Cobertura', value: `${agg.coverage.toFixed(0)}%`, sub: 'lojas visitadas / base' },
    { label: 'Frequência média', value: agg.avgFrequency != null ? `${agg.avgFrequency.toFixed(1)} dias` : '—', sub: 'intervalo entre visitas' },
    { label: 'Lojas +14 dias s/ visita', value: String(agg.overdue14), sub: 'desde a última visita' },
  ];

  const maxWeek = Math.max(1, ...agg.timeline.map((t) => t.n));

  return (
    <div className="page">
      <h1 className="page-title">Trade Marketing Intelligence</h1>
      <div className="page-sub">
        Visitas dos promotores — dados reais das planilhas ({fmt(visitsRaw[0].visit_date)} a {fmt(visitsRaw[visitsRaw.length - 1].visit_date)}). Métricas de execução (visitas realizadas).
      </div>

      {/* filtros globais */}
      <div className="filters-row" style={{ alignItems: 'flex-end' }}>
        <label className="form-field" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>De</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="form-field" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select className="chip-select" value={promoterId} onChange={(e) => setPromoterId(e.target.value)}>
          <option value="all">Promotor: todos</option>
          {promoters.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="chip-select" value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
          <option value="all">Rede: todas</option>
          {networks.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <input className="chip-input" placeholder="⌕ Loja ou promotor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {filtersActive && (
          <button className="btn ghost sm" onClick={clearFilters}>Limpar filtros</button>
        )}
      </div>

      {/* abas */}
      <div className="group-toggle" style={{ margin: '14px 0' }}>
        {TABS.map(([k, label]) => (
          <div key={k} className={`filter-chip${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</div>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
            {kpis.map((k) => (
              <div className="card" key={k.label} style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>{k.value}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>{k.label}</div>
                {k.sub && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{k.sub}</div>}
              </div>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <h4>Visitas por semana</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, marginTop: 10 }}>
              {agg.timeline.map((t) => (
                <div key={t.wk} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{t.n}</div>
                  <div style={{ width: '100%', maxWidth: 48, height: `${(t.n / maxWeek) * 120}px`, background: 'var(--accent)', borderRadius: '6px 6px 0 0' }} />
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{fmt(t.wk).slice(0, 5)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
            <RankPanel title="Top promotores (visitas)" rows={agg.promoterRank.slice(0, 8).map((p) => [p.name, `${p.visits} · ${p.stores} lojas`])} />
            <RankPanel title="Visitas por rede" rows={agg.networkRank.slice(0, 8).map((n) => [n.name, `${n.visits} · ${n.stores} lojas`])} />
          </div>
        </>
      )}

      {tab === 'visitas' && (
        <div className="panel">
          <div className="section-head"><h2>{visits.length} visitas</h2></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead>
                <tr><th>Data</th><th>Promotor</th><th>Loja</th><th>Rede</th></tr>
              </thead>
              <tbody>
                {visits.slice(0, 400).map((v) => (
                  <tr key={v.id}>
                    <td>{fmt(v.visit_date)}</td>
                    <td>{promoterName(v.promoter_id)}</td>
                    <td>{storeName(v.store_id)}</td>
                    <td>{networkOfStore(v.store_id) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visits.length > 400 && <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>Mostrando as 400 mais antigas do filtro. Refine os filtros para ver o restante.</p>}
        </div>
      )}

      {tab === 'promotores' && (
        <div className="panel">
          <div className="section-head"><h2>{agg.promoterRank.length} promotores no período</h2></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead>
                <tr><th>Promotor</th><th>Visitas</th><th>Lojas únicas</th><th>Média/dia</th><th>Cobertura</th></tr>
              </thead>
              <tbody>
                {agg.promoterRank.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.visits}</td>
                    <td>{p.stores}</td>
                    <td>{p.perDay.toFixed(1)}</td>
                    <td>{p.coverage.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lojas' && (
        <div className="panel">
          <div className="section-head"><h2>{agg.storeRank.length} lojas atendidas</h2></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead>
                <tr><th>Loja</th><th>Rede</th><th>Visitas</th><th>Última visita</th><th>Dias s/ visita</th></tr>
              </thead>
              <tbody>
                {agg.storeRank.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.network}</td>
                    <td>{s.visits}</td>
                    <td>{fmt(s.last)}</td>
                    <td style={{ color: s.daysSince > 14 ? 'var(--red)' : undefined }}>{s.daysSince}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'frequencia' && (
        <div className="panel">
          <div className="section-head">
            <h2>Frequência por loja</h2>
            <span className="page-sub" style={{ margin: 0 }}>Ordenado por mais tempo sem visita. Frequência planejada ainda não cadastrada nos dados.</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead>
                <tr><th>Loja</th><th>Visitas</th><th>Última</th><th>Dias s/ visita</th><th>Interv. médio</th><th>Mín</th><th>Máx</th><th>Planejada</th></tr>
              </thead>
              <tbody>
                {[...agg.storeRank].sort((a, b) => b.daysSince - a.daysSince).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.visits}</td>
                    <td>{fmt(s.last)}</td>
                    <td style={{ color: s.daysSince > 14 ? 'var(--red)' : s.daysSince > 7 ? 'var(--yellow)' : 'var(--green)', fontWeight: 600 }}>{s.daysSince}</td>
                    <td>{s.avgGap != null ? `${s.avgGap.toFixed(0)}d` : '—'}</td>
                    <td>{s.minGap != null ? `${s.minGap}d` : '—'}</td>
                    <td>{s.maxGap != null ? `${s.maxGap}d` : '—'}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{s.plannedFreq != null ? `${s.plannedFreq}d` : 'não cadastrada'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RankPanel({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="panel">
      <h4>{title}</h4>
      {rows.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sem dados no filtro.</p>}
      {rows.map(([label, val], i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ width: 20, color: 'var(--text-faint)', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
