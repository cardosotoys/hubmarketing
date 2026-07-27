import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { CampaignContent } from '../../types/database';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function CampaignCalendarioEditorial() {
  const { campaign } = useCampaignWorkspace();
  const [contents, setContents] = useState<CampaignContent[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    supabase
      .from('campaign_contents')
      .select('*')
      .eq('campaign_id', campaign.id)
      .not('scheduled_date', 'is', null)
      .then(({ data }) => setContents((data as CampaignContent[]) ?? []));
  }, [campaign.id]);

  const byDay = useMemo(() => {
    const map: Record<string, CampaignContent[]> = {};
    contents.forEach((c) => {
      if (!c.scheduled_date) return;
      (map[c.scheduled_date] ??= []).push(c);
    });
    return map;
  }, [contents]);

  const { year, month } = cursor;
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function goMonth(delta: number) {
    setCursor((c) => {
      let m = c.month + delta;
      let y = c.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      return { year: y, month: m };
    });
  }

  return (
    <div>
      <div className="section-head">
        <h2>Calendário Editorial</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn ghost sm" onClick={() => goMonth(-1)}>
            ←
          </button>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 13, minWidth: 140, textAlign: 'center' }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button className="btn ghost sm" onClick={() => goMonth(1)}>
            →
          </button>
        </div>
      </div>

      <div className="cal-grid">
        {DAYS.map((d) => (
          <div className="cal-head" key={d}>
            {d}
          </div>
        ))}
      </div>
      <div className="cal-grid" style={{ marginTop: 6 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`b-${i}`} className="cal-cell" style={{ opacity: 0.3 }} />;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const items = byDay[key] ?? [];
          return (
            <div className="cal-cell" key={key}>
              <div className="d">{day}</div>
              {items.map((c) => (
                <div className="evt" key={c.id} style={{ background: 'var(--surface-3)' }}>
                  {c.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
