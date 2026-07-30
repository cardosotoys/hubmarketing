import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const WEEKS = 12;
const CELL = 11;
const GAP = 3;
const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Mapa de calor estilo GitHub — atividade por dia das últimas ~12 semanas, a partir de
// activity_log.created_at. Sem lib de gráfico (mesmo padrão do sparkline de CampaignKpis.tsx):
// SVG puro, cor por intensidade relativa ao dia mais movimentado do período.
export default function ActivityHeatmap({ actorId }: { actorId?: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const { weeks, start, today } = useMemo(() => {
    const t = new Date(new Date().toDateString());
    const s = new Date(t);
    s.setDate(s.getDate() - WEEKS * 7);
    s.setDate(s.getDate() - s.getDay()); // volta pro domingo anterior, pra alinhar por semana

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

  const selectedCount = selected ? (counts[selected] ?? 0) : null;
  const selectedLabel = selected
    ? new Date(selected + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  if (loading) {
    return <div className="page-sub">Carregando atividade…</div>;
  }

  return (
    <div className="activity-heatmap">
      <svg width={width} height={height + 14} viewBox={`0 0 ${width} ${height + 14}`}>
        {weeks.map((week, wi) => {
          const firstOfMonth = week.find((d) => d.getDate() <= 7);
          return (
            <g key={wi}>
              {firstOfMonth && (
                <text x={wi * (CELL + GAP)} y={10} fontSize={9} fill="var(--text-faint)">
                  {MONTH_LABELS[firstOfMonth.getMonth()]}
                </text>
              )}
              {week.map((day) => {
                const key = isoDay(day);
                const n = counts[key] ?? 0;
                const ratio = n / max;
                const isToday = key === isoDay(today);
                return (
                  <rect
                    key={key}
                    x={wi * (CELL + GAP)}
                    y={day.getDay() * (CELL + GAP) + 14}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    fill={n === 0 ? 'var(--surface-2)' : 'var(--green)'}
                    fillOpacity={n === 0 ? 1 : Math.max(0.35, ratio)}
                    stroke={isToday ? 'var(--accent)' : 'none'}
                    strokeWidth={isToday ? 1 : 0}
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
      <div className="activity-heatmap-caption">
        {selected ? (
          <>
            <b>{selectedCount}</b> {selectedCount === 1 ? 'atividade' : 'atividades'} em {selectedLabel}
          </>
        ) : (
          'Toque num dia pra ver a contagem.'
        )}
      </div>
    </div>
  );
}
