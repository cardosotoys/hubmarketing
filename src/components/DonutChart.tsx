export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// Gráfico de rosca (donut) em SVG puro — sem dependências. Mostra os segmentos e uma legenda
// com valor absoluto e porcentagem.
export default function DonutChart({
  segments,
  size = 150,
  thickness = 20,
  centerLabel,
  centerSub,
  formatValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
  formatValue?: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s, i) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-acc}
                  strokeLinecap="butt"
                />
              );
              acc += len;
              return el;
            })}
        </g>
        {centerLabel != null && (
          <text x="50%" y={centerSub ? '45%' : '50%'} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 24, fontWeight: 700, fill: 'var(--text)' }}>
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x="50%" y="62%" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--text-faint)' }}>
            {centerSub}
          </text>
        )}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 170, flex: 1 }}>
        {segments.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--text-dim)' }}>{s.label}</span>
              <strong>{formatValue ? formatValue(s.value) : s.value}</strong>
              <span style={{ color: 'var(--text-faint)', minWidth: 40, textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
