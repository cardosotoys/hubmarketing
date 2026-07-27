import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Modal from '../components/Modal';
import type { Brand } from '../types/database';

interface CalEvent {
  id?: string;
  date: string;
  label: string;
  color: string;
  href?: string;
  deletable?: boolean;
  createdBy?: string | null;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function Calendario() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [projectsRes, campaignsRes, milestonesRes, postsRes, ownEventsRes, brandsRes] = await Promise.all([
      supabase.from('projects').select('*, brand:brands(color)'),
      supabase.from('campaigns').select('*, brand:brands(color)'),
      supabase.from('campaign_milestones').select('*, campaign:campaigns(id, name, brand:brands(color))'),
      supabase.from('social_posts').select('*, brand:brands(color)'),
      supabase.from('calendar_events').select('*, brand:brands(color)'),
      supabase.from('brands').select('*'),
    ]);

    const evts: CalEvent[] = [];

    type ProjRow = { id: string; name: string; start_date: string | null; end_date: string | null; brand: { color: string } | null };
    ((projectsRes.data as ProjRow[]) ?? []).forEach((p) => {
      const color = p.brand?.color ?? 'var(--violet)';
      if (p.start_date) evts.push({ date: p.start_date, label: `Início: ${p.name}`, color, href: `/projetos/${p.id}` });
      if (p.end_date) evts.push({ date: p.end_date, label: `Prazo: ${p.name}`, color, href: `/projetos/${p.id}` });
    });

    type CampRow = { id: string; name: string; start_date: string | null; end_date: string | null; brand: { color: string } | null };
    ((campaignsRes.data as CampRow[]) ?? []).forEach((c) => {
      const color = c.brand?.color ?? 'var(--accent)';
      if (c.start_date) evts.push({ date: c.start_date, label: `Campanha início: ${c.name}`, color, href: `/campanhas/${c.id}` });
      if (c.end_date) evts.push({ date: c.end_date, label: `Campanha fim: ${c.name}`, color, href: `/campanhas/${c.id}` });
    });

    type MilestoneRow = { id: string; title: string; date: string | null; campaign: { id: string; name: string; brand: { color: string } | null } | null };
    ((milestonesRes.data as MilestoneRow[]) ?? []).forEach((m) => {
      if (!m.date) return;
      const color = m.campaign?.brand?.color ?? 'var(--accent)';
      evts.push({
        date: m.date,
        label: m.campaign ? `${m.title} (${m.campaign.name})` : m.title,
        color,
        href: m.campaign ? `/campanhas/${m.campaign.id}` : undefined,
      });
    });

    type PostRow = { id: string; caption: string; suggested_date: string | null; brand: { color: string } | null };
    ((postsRes.data as PostRow[]) ?? []).forEach((p) => {
      if (!p.suggested_date) return;
      const color = p.brand?.color ?? 'var(--blue)';
      const short = p.caption.length > 28 ? `${p.caption.slice(0, 28)}…` : p.caption;
      evts.push({ date: p.suggested_date, label: `Post: ${short || '(sem legenda)'}`, color, href: '/redes-sociais' });
    });

    type OwnEventRow = { id: string; title: string; date: string; brand: { color: string } | null; created_by: string | null };
    ((ownEventsRes.data as OwnEventRow[]) ?? []).forEach((e) => {
      evts.push({
        id: e.id,
        date: e.date,
        label: e.title,
        color: e.brand?.color ?? 'var(--text-dim)',
        deletable: true,
        createdBy: e.created_by,
      });
    });

    setEvents(evts);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEvent(title: string, date: string, brandId: string) {
    if (!profile) return;
    await supabase.from('calendar_events').insert({ title, date, brand_id: brandId || null, created_by: profile.id });
    await logActivity({ actorId: profile.id, actionText: 'Evento adicionado ao calendário', detail: title });
    load();
  }

  async function deleteEvent(id: string) {
    await supabase.from('calendar_events').delete().eq('id', id);
    load();
  }

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    events.forEach((e) => {
      const key = e.date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const { year, month } = cursor;
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function pad(n: number) {
    return String(n).padStart(2, '0');
  }

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

  const canDelete = (e: CalEvent) =>
    e.deletable && profile && (e.createdBy === profile.id || profile.role === 'diretoria' || profile.role === 'administrador');

  const totalEvents = events.length;

  return (
    <div className="page">
      <h1 className="page-title">Calendário</h1>
      <div className="page-sub">
        Prazos de projetos, campanhas (início/fim e marcos), datas sugestivas de posts e qualquer evento avulso
        que você quiser marcar — tudo num só lugar.
      </div>

      {!loading && totalEvents === 0 && (
        <div className="banner soon">
          <span className="ic">◐</span>
          <span>Nenhuma data cadastrada ainda. Crie um evento ou preencha datas em projetos/campanhas/posts.</span>
        </div>
      )}

      <div className="filters-row" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn ghost sm" onClick={() => goMonth(-1)}>
            ←
          </button>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: 0, minWidth: 160, textAlign: 'center' }}>
            {MONTH_NAMES[month]} {year}
          </h2>
          <button className="btn ghost sm" onClick={() => goMonth(1)}>
            →
          </button>
        </div>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Novo evento
        </button>
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
          if (day === null) return <div key={`blank-${i}`} className="cal-cell" style={{ opacity: 0.3 }} />;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const dayEvents = eventsByDay[key] ?? [];
          return (
            <div className="cal-cell" key={key}>
              <div className="d">{day}</div>
              {dayEvents.map((e, idx) => {
                const content = (
                  <>
                    {e.label}
                    {canDelete(e) && (
                      <span
                        style={{ float: 'right', marginLeft: 4, opacity: 0.7 }}
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (e.id) deleteEvent(e.id);
                        }}
                      >
                        ✕
                      </span>
                    )}
                  </>
                );
                return e.href ? (
                  <Link
                    key={e.id ?? idx}
                    to={e.href}
                    className="evt"
                    style={{ background: 'var(--surface-3)', color: e.color, display: 'block', textDecoration: 'none' }}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={e.id ?? idx} className="evt" style={{ background: 'var(--surface-3)', color: e.color }}>
                    {content}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewEventModal brands={brands} onClose={() => setShowNew(false)} onCreate={createEvent} />
      )}
    </div>
  );
}

function NewEventModal({
  brands,
  onClose,
  onCreate,
}: {
  brands: Brand[];
  onClose: () => void;
  onCreate: (title: string, date: string, brandId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [brandId, setBrandId] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onCreate(title.trim(), date, brandId);
    onClose();
  }

  return (
    <Modal title="Novo evento" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="ce-title">Título</label>
          <input id="ce-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: entrega do briefing, reunião, feriado…" />
        </div>
        <div className="form-field">
          <label htmlFor="ce-date">Data</label>
          <input id="ce-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="ce-brand">Marca (opcional)</label>
          <select id="ce-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Sem marca / pessoal</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Criar evento
          </button>
        </div>
      </form>
    </Modal>
  );
}
