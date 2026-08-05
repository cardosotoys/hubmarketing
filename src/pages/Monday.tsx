import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { MondayBoard } from '../types/database';

export default function Monday() {
  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [destFilter, setDestFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('monday_boards')
      .select('*')
      .order('item_count', { ascending: false })
      .then(({ data }) => {
        setBoards((data as MondayBoard[]) ?? []);
        setLoading(false);
      });
  }, []);

  const dests = useMemo(() => Array.from(new Set(boards.map((b) => b.suggested_destination).filter(Boolean))).sort(), [boards]);
  const filtered = boards.filter((b) => {
    if (destFilter !== 'all' && b.suggested_destination !== destFilter) return false;
    if (search.trim() && !b.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const totals = boards.reduce(
    (a, b) => ({ items: a.items + b.item_count, updates: a.updates + b.update_count, activity: a.activity + b.activity_count }),
    { items: 0, updates: 0, activity: 0 },
  );

  return (
    <div className="page">
      <h1 className="page-title">Monday (arquivo)</h1>
      <div className="page-sub">
        Tudo que veio do Monday — quadros, itens, colunas, comentários e histórico, com datas e autores originais.
        Use como referência para decidir <strong>onde encaixar cada coisa</strong> na estrutura do hub.
      </div>

      {!loading && boards.length === 0 ? (
        <div className="locked-banner" style={{ display: 'block' }}>
          <div style={{ marginBottom: 8 }}>
            <span className="ic">◱</span> Nada importado ainda.
          </div>
          <div className="page-sub" style={{ margin: 0 }}>
            Rode o importador (ele lê o dump de <code>monday-dump/</code>):
            <br />
            <code>SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/monday-import.mjs --commit</code>
          </div>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-num">{boards.length}</div>
              <div className="stat-label">Quadros</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{totals.items}</div>
              <div className="stat-label">Itens</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{totals.updates}</div>
              <div className="stat-label">Comentários</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{totals.activity}</div>
              <div className="stat-label">Eventos de histórico</div>
            </div>
          </div>

          <div className="filters-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
            <input className="chip-select" placeholder="Buscar quadro…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220, flex: 1 }} />
            <select className="chip-select" value={destFilter} onChange={(e) => setDestFilter(e.target.value)}>
              <option value="all">Todos os destinos sugeridos</option>
              {dests.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="section-head">
            <h2>{filtered.length} quadros</h2>
          </div>

          {loading ? (
            <div className="page-sub">Carregando…</div>
          ) : (
            <div className="project-grid">
              {filtered.map((b) => (
                <Link key={b.id} to={`/monday/${b.id}`} className="project-card">
                  <div className="brand-strip" style={{ background: 'var(--violet)' }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="pill" style={{ background: 'var(--violet-dim)', color: 'var(--violet)' }}>
                      → {b.suggested_destination || 'A definir'}
                    </span>
                    {b.state !== 'active' && <span className="pill" style={{ background: 'var(--surface-2)' }}>{b.state}</span>}
                  </div>
                  <h3>{b.name}</h3>
                  <p>{b.groups.map((g) => g.title).join(' · ') || 'sem grupos'}</p>
                  <div className="project-meta" style={{ flexWrap: 'wrap', gap: 6 }}>
                    <span className="tag" style={{ background: 'var(--surface-2)' }}>{b.item_count} itens</span>
                    <span className="tag" style={{ background: 'var(--surface-2)' }}>{b.update_count} coment.</span>
                    <span className="tag" style={{ background: 'var(--surface-2)' }}>{b.activity_count} eventos</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
