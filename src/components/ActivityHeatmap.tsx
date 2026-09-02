import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const WEEKS = 18;
const CELL = 15;
const GAP = 4;
const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Mapa de calor estilo GitHub — atividade por dia, a partir de activity_log.created_at.
// SVG puro, nas cores da marca (Vermelho Cardoso por intensidade) + painel de resumo ao lado.
export default function ActivityHeatmap({ actorId }: { actorId?: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const { weeks, start, today } = useMemo(() => {
    const t = new Date(new Date().toDateString());
    const s = new Date(t);
    s.setDate(s.getDate() - WEEKS * 7);
    s.setDate(s.getDate() - s.getDay());

    const days: Date[] = [];
    for (let i = 0; i < WEEKS * 7 + 7; i++) {
      const d = new Date(s);
      d.setDate(d.getDate() + i);
      if (d > t) break;
      days.push(d);
    }
    const w: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
    return { weeks: w, start: s, today: t };
  }, []);

  useEffect(() => {
    let query = supabase.from('activity_log').select('created_at').gte('created_at', start.toISOString());
    if (actorId) query = query.eq('actor_id', actorId);
    setLoading(true);
    query.then(({ data }) => {
      const map: Record<string, number> = {};
      for (const row of (data as { created_at: string }[] | null) ?? []) {
        const day = row.created_at.slice(0, 10);
        map[day] = (map[day] ?? 0) + 1;
      }
      setCounts(map);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, start.getTime()]);

  const max = Math.max(1, ...Object.values(counts));
  const width = weeks.length * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  // resumo do período
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const todayCount = counts[isoDay(today)] ?? 0;
  let busyKey: string | null = null;
  for (const [k, n] of Object.entries(counts)) if (busyKey === null || n > counts[busyKey]) busyKey = k;
  const busyLabel = busyKey ? new Date(busyKey + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

  const selectedCount = selected ? (counts[selected] ?? 0) : null;
  const selectedLabel = selected
    ? new Date(selected + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  // escala de cor por marca (Vermelho Cardoso em 4 níveis)
  const scale = ['var(--surface-2)', 'rgba(218,58,47,0.30)', 'rgba(218,58,47,0.55)', 'rgba(218,58,47,0.80)', 'var(--accent)'];
  const bucket = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));

  if (loading) {
    return <div className="page-sub">Carregando atividade…</div>;
  }

  return (
    <div className="activity-heatmap">
      <div className="activity-heatmap-grid">
        <svg width={width} height={height + 16} viewBox={`0 0 ${width} ${height + 16}`} style={{ maxWidth: '100%' }}>
          {weeks.map((week, wi) => {
            const firstOfMonth = week.find((d) => d.getDate() <= 7);
            return (
              <g key={wi}>
                {firstOfMonth && (
                  <text x={wi * (CELL + GAP)} y={10} fontSize={10} fill="var(--text-faint)">
                    {MONTH_LABELS[firstOfMonth.getMonth()]}
                  </text>
                )}
                {week.map((day) => {
                  const key = isoDay(day);
                  const n = counts[key] ?? 0;
                  const isToday = key === isoDay(today);
                  return (
                    <rect
                      key={key}
                      x={wi * (CELL + GAP)}
                      y={day.getDay() * (CELL + GAP) + 16}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      fill={scale[bucket(n)]}
                      stroke={isToday ? 'var(--ink, #0a2530)' : 'none'}
                      strokeWidth={isToday ? 1.5 : 0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected((s) => (s === key ? null : key))}
                    >
                      <title>{`${day.toLocaleDateString('pt-BR')}: ${n} ${n === 1 ? 'atividade' : 'atividades'}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <div className="activity-heatmap-legend">
          <span>menos</span>
          {scale.map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
          <span>mais</span>
        </div>
      </div>

      <div className="activity-heatmap-stats">
        <div className="ahm-stat">
          <div className="ahm-num">{selected ? selectedCount : total}</div>
          <div className="ahm-lbl">{selected ? `em ${selectedLabel}` : 'atividades no período'}</div>
        </div>
        <div className="ahm-stat">
          <div className="ahm-num">{todayCount}</div>
          <div className="ahm-lbl">hoje</div>
        </div>
        <div className="ahm-stat">
          <div className="ahm-num" style={{ fontSize: 18 }}>{busyLabel}</div>
          <div className="ahm-lbl">dia mais movimentado</div>
        </div>
      </div>
    </div>
  );
}
