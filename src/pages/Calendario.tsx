import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { useIsMobile } from '../hooks/useIsMobile';
import Modal from '../components/Modal';
import type { Brand } from '../types/database';

type EventType = 'projeto' | 'demanda' | 'embalagem' | 'campanha' | 'marco' | 'post' | 'evento';

const TYPE_LABELS: Record<EventType, string> = {
  projeto: 'Projetos',
  demanda: 'Demandas',
  embalagem: 'Embalagens',
  campanha: 'Campanhas',
  marco: 'Marcos',
  post: 'Posts',
  evento: 'Eventos avulsos',
};

interface CalEvent {
  id?: string;
  date: string;
  label: string;
  color: string;
  type: EventType;
  href?: string;
  deletable?: boolean;
  createdBy?: string | null;
  highlight?: boolean;
  // relevante para o usuário logado (responsável, mencionado, ou na sua jornada)
  mine?: boolean;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function Calendario() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ALL_TYPES = Object.keys(TYPE_LABELS) as EventType[];
  const [typeFilter, setTypeFilter] = useState<EventType[]>(ALL_TYPES);
  // 'meu' = só o que é relevante pra mim (responsável, mencionado, na minha jornada). 'todos' = tudo.
  const [scope, setScope] = useState<'meu' | 'todos'>('meu');

  function toggleType(t: EventType) {
    setTypeFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const load = useCallback(async () => {
    setLoading(true);
    const myId = profile?.id;
    const [projectsRes, tasksRes, pkgRes, campaignsRes, milestonesRes, postsRes, ownEventsRes, brandsRes, membersRes, mentionsRes] = await Promise.all([
      supabase.from('projects').select('*, brand:brands(color)'),
      supabase.from('tasks').select('id, title, due_date, priority, project_id, assignee_id').not('due_date', 'is', null).is('packaging_track', null),
      supabase.from('tasks').select('id, title, due_date, target_date, completed_at, priority, assignee_id').not('packaging_track', 'is', null),
      supabase.from('campaigns').select('*, brand:brands(color)'),
      supabase.from('campaign_milestones').select('*, campaign:campaigns(id, name, brand:brands(color))'),
      supabase.from('social_posts').select('*, brand:brands(color)'),
      supabase.from('calendar_events').select('*, brand:brands(color)'),
      supabase.from('brands').select('*'),
      myId ? supabase.from('project_members').select('project_id').eq('user_id', myId) : Promise.resolve({ data: [] }),
      myId ? supabase.from('task_comments').select('task_id').contains('mentioned_ids', [myId]) : Promise.resolve({ data: [] }),
    ]);

    const evts: CalEvent[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    // Conjuntos de relevância do usuário ("minha jornada")
    type ProjRow = { id: string; name: string; start_date: string | null; end_date: string | null; created_by: string | null; brand: { color: string } | null };
    const projRows = (projectsRes.data as ProjRow[]) ?? [];
    const projectsById = Object.fromEntries(projRows.map((p) => [p.id, p]));
    const myProjectIds = new Set<string>();
    ((membersRes.data as { project_id: string }[]) ?? []).forEach((m) => myProjectIds.add(m.project_id));
    projRows.forEach((p) => { if (p.created_by && p.created_by === myId) myProjectIds.add(p.id); });
    const mentionedTaskIds = new Set(((mentionsRes.data as { task_id: string }[]) ?? []).map((m) => m.task_id));

    type CampRow = { id: string; name: string; start_date: string | null; end_date: string | null; owner_id: string | null; created_by: string | null; brand: { color: string } | null };
    const campRows = (campaignsRes.data as CampRow[]) ?? [];
    const myCampaignIds = new Set<string>();
    campRows.forEach((c) => { if (c.owner_id === myId || c.created_by === myId) myCampaignIds.add(c.id); });

    projRows.forEach((p) => {
      const color = p.brand?.color ?? 'var(--violet)';
      const mine = myProjectIds.has(p.id);
      if (p.start_date) evts.push({ date: p.start_date, label: `Início: ${p.name}`, color, type: 'projeto', href: `/projetos/${p.id}`, mine });
      if (p.end_date) evts.push({ date: p.end_date, label: `Prazo: ${p.name}`, color, type: 'projeto', href: `/projetos/${p.id}`, highlight: p.end_date < todayStr, mine });
    });

    type TaskRow = { id: string; title: string; due_date: string | null; priority: string; project_id: string | null; assignee_id: string | null };
    ((tasksRes.data as TaskRow[]) ?? []).forEach((t) => {
      if (!t.due_date) return;
      const project = t.project_id ? projectsById[t.project_id] : null;
      const color = project?.brand?.color ?? 'var(--text-dim)';
      const overdue = t.due_date < todayStr;
      const mine = t.assignee_id === myId || (t.project_id != null && myProjectIds.has(t.project_id)) || mentionedTaskIds.has(t.id);
      evts.push({
        id: t.id,
        date: t.due_date,
        label: project ? `${t.title} (${project.name})` : t.title,
        color,
        type: 'demanda',
        href: `/demandas?task=${t.id}`,
        highlight: overdue || t.priority === 'urgent',
        mine,
      });
    });

    // Demandas de embalagem — META (🎯 target_date) e PRAZO FINAL (🏁 due_date)
    type PkgRow = { id: string; title: string; due_date: string | null; target_date: string | null; completed_at: string | null; priority: string; assignee_id: string | null };
    ((pkgRes.data as PkgRow[]) ?? []).forEach((t) => {
      const mine = t.assignee_id === myId || mentionedTaskIds.has(t.id);
      if (t.target_date) {
        evts.push({ id: `${t.id}-meta`, date: t.target_date, label: `🎯 Meta: ${t.title}`, color: 'var(--violet)', type: 'embalagem', href: '/design-produto/embalagens', mine });
      }
      if (t.due_date) {
        const overdue = !t.completed_at && t.due_date < todayStr;
        const color = t.completed_at ? 'var(--green)' : overdue ? 'var(--red)' : 'var(--text-dim)';
        evts.push({ id: `${t.id}-prazo`, date: t.due_date, label: `🏁 Prazo: ${t.title}`, color, type: 'embalagem', href: '/design-produto/embalagens', highlight: overdue, mine });
      }
    });

    campRows.forEach((c) => {
      const color = c.brand?.color ?? 'var(--accent)';
      const mine = myCampaignIds.has(c.id);
      if (c.start_date) evts.push({ date: c.start_date, label: `Campanha início: ${c.name}`, color, type: 'campanha', href: `/campanhas/${c.id}`, mine });
      if (c.end_date) evts.push({ date: c.end_date, label: `Campanha fim: ${c.name}`, color, type: 'campanha', href: `/campanhas/${c.id}`, mine });
    });

    type MilestoneRow = { id: string; title: string; date: string | null; campaign: { id: string; name: string; brand: { color: string } | null } | null };
    ((milestonesRes.data as MilestoneRow[]) ?? []).forEach((m) => {
      if (!m.date) return;
      const color = m.campaign?.brand?.color ?? 'var(--accent)';
      evts.push({
        date: m.date,
        label: m.campaign ? `${m.title} (${m.campaign.name})` : m.title,
        color,
        type: 'marco',
        href: m.campaign ? `/campanhas/${m.campaign.id}` : undefined,
        highlight: true,
        mine: m.campaign ? myCampaignIds.has(m.campaign.id) : false,
      });
    });

    type PostRow = { id: string; caption: string; suggested_date: string | null; created_by: string | null; reviewed_by: string | null; brand: { color: string } | null };
    ((postsRes.data as PostRow[]) ?? []).forEach((p) => {
      if (!p.suggested_date) return;
      const color = p.brand?.color ?? 'var(--blue)';
      const short = p.caption.length > 28 ? `${p.caption.slice(0, 28)}…` : p.caption;
      evts.push({ date: p.suggested_date, label: `Post: ${short || '(sem legenda)'}`, color, type: 'post', href: '/redes-sociais', mine: p.created_by === myId || p.reviewed_by === myId });
    });

    type OwnEventRow = { id: string; title: string; date: string; brand: { color: string } | null; created_by: string | null };
    ((ownEventsRes.data as OwnEventRow[]) ?? []).forEach((e) => {
      evts.push({
        id: e.id,
        date: e.date,
        label: e.title,
        color: e.brand?.color ?? 'var(--text-dim)',
        type: 'evento',
        deletable: true,
        createdBy: e.created_by,
        mine: e.created_by === myId,
      });
    });

    setEvents(evts);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

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

  const filteredEvents = useMemo(
    () => events.filter((e) => typeFilter.includes(e.type) && (scope === 'todos' || e.mine)),
    [events, typeFilter, scope],
  );

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    filteredEvents.forEach((e) => {
      const key = e.date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [filteredEvents]);

  const { year, month } = cursor;
  const todayKey = new Date().toISOString().slice(0, 10);
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function pad(n: number) {
    return String(n).padStart(2, '0');
  }

  // Grade de 7 colunas não cabe numa tela de celular sem espremer demais — no mobile vira uma
  // agenda (só os dias com evento, mais o dia de hoje mesmo vazio, pra sempre ter uma referência).
  const agendaDays = useMemo(() => {
    const days: { day: number; dateKey: string; isToday: boolean; events: CalEvent[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${pad(month + 1)}-${pad(d)}`;
      const dayEvents = eventsByDay[key] ?? [];
      const isToday = key === todayKey;
      if (dayEvents.length > 0 || isToday) {
        days.push({ day: d, dateKey: key, isToday, events: dayEvents });
      }
    }
    return days;
  }, [daysInMonth, year, month, eventsByDay, todayKey]);

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

  // Compartilhado pela grade (desktop) e pela agenda (celular) — mesmo evento, dois lugares.
  function renderEvent(e: CalEvent, idx: number) {
    const content = (
      <>
        {e.highlight && '★ '}
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
    const evtClass = `evt${e.highlight ? ' highlight' : ''}`;
    return e.href ? (
      <Link
        key={e.id ?? idx}
        to={e.href}
        className={evtClass}
        style={{ background: 'var(--surface-3)', color: e.color, display: 'block', textDecoration: 'none' }}
      >
        {content}
      </Link>
    ) : (
      <div key={e.id ?? idx} className={evtClass} style={{ background: 'var(--surface-3)', color: e.color }}>
        {content}
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Calendário</h1>
      <div className="page-sub">
        Prazos de projetos, campanhas, embalagens (🎯 meta e 🏁 prazo), posts e eventos avulsos. Por padrão mostra
        <strong> só o que é seu</strong> — onde você é responsável, foi mencionado, ou está na sua jornada.
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

      <div className="group-toggle" style={{ marginBottom: 8 }}>
        <div className={`filter-chip${scope === 'meu' ? ' active' : ''}`} onClick={() => setScope('meu')}>
          👤 Meu calendário
        </div>
        <div className={`filter-chip${scope === 'todos' ? ' active' : ''}`} onClick={() => setScope('todos')}>
          🌐 Todos
        </div>
      </div>

      <div className="group-toggle" style={{ marginBottom: 14 }}>
        {ALL_TYPES.map((t) => (
          <div key={t} className={`filter-chip${typeFilter.includes(t) ? ' active' : ''}`} onClick={() => toggleType(t)}>
            {TYPE_LABELS[t]}
          </div>
        ))}
      </div>

      {isMobile ? (
        <div className="agenda-list">
          {agendaDays.length === 0 && (
            <div className="locked-banner">
              <span className="ic">◐</span>Nenhum evento neste mês pra esse filtro.
            </div>
          )}
          {agendaDays.map(({ day, dateKey, isToday, events: dayEvents }) => (
            <div className={`agenda-day${isToday ? ' today' : ''}`} key={dateKey}>
              <div className="agenda-day-head">
                <span className="num">{day}</span>
                <span className="dow">{DAYS[new Date(year, month, day).getDay()]}</span>
                {isToday && <span className="pill" style={{ marginLeft: 'auto' }}>hoje</span>}
              </div>
              {dayEvents.length === 0 ? (
                <div className="agenda-empty">Nenhum evento.</div>
              ) : (
                dayEvents.map((e, idx) => renderEvent(e, idx))
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
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
              const isToday = key === todayKey;
              return (
                <div className={`cal-cell${isToday ? ' today' : ''}`} key={key}>
                  <div className="d">{day}</div>
                  {dayEvents.map((e, idx) => renderEvent(e, idx))}
                </div>
              );
            })}
          </div>
        </>
      )}

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
