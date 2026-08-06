import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/activityLog';
import { materializeSubsteps, recomputeSubstepDueDates } from '../lib/substeps';
import KanbanBoard from './KanbanBoard';
import TaskEditModal from './TaskEditModal';
import Modal from './Modal';
import Loading from './Loading';
import EmptyState from './EmptyState';
import StagesEditor from './StagesEditor';
import { PRIORITIES, PRIORITY_LABELS, type Priority, type Profile, type ProjectStage, type Task } from '../types/database';

type SortKey = 'recent' | 'title' | 'priority' | 'prazo' | 'prazo_desc' | 'meta' | 'meta_desc';

// Board de demandas de UMA marca — mesmo motor das de embalagem (etapas, sub-etapas, checklist com
// gate, aprovações e comentários), escopo por brand_id + packaging_track = 'marca'.
export default function BrandDemandas({ brandId, brandLabel }: { brandId: string; brandLabel: string }) {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [managingStages, setManagingStages] = useState(false);
  const [blockInfo, setBlockInfo] = useState<{ from: string; to: string; pending: string[] } | null>(null);
  // filtros
  const [search, setSearch] = useState('');
  const [fAssignee, setFAssignee] = useState('all');
  const [fPriority, setFPriority] = useState<'all' | Priority>('all');
  const [fStage, setFStage] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [hideDone, setHideDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [tasksRes, stagesRes, profilesRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('packaging_track', 'marca').eq('brand_id', brandId).order('position'),
      supabase.from('stages').select('*').eq('packaging_track', 'marca').order('position'),
      supabase.from('profiles').select('*'),
    ]);
    setTasks((tasksRes.data as Task[]) ?? []);
    setStages((stagesRes.data as ProjectStage[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setLoading(false);
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const stagesById = Object.fromEntries(stages.map((s) => [s.id, s]));
  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const terminalStageIds = sortedStages.filter((s) => s.is_final).map((s) => s.id);

  const q = search.trim().toLowerCase();
  const prioRank = (p: Priority) => {
    const i = (PRIORITIES as readonly Priority[]).indexOf(p);
    return i === -1 ? 99 : i;
  };
  let filteredTasks = tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (fAssignee === 'none' && t.assignee_id) return false;
    if (fAssignee !== 'all' && fAssignee !== 'none' && t.assignee_id !== fAssignee) return false;
    if (fPriority !== 'all' && t.priority !== fPriority) return false;
    if (fStage !== 'all' && t.stage_id !== fStage) return false;
    if (hideDone && stagesById[t.stage_id]?.is_final) return false;
    return true;
  });
  if (sort !== 'recent') {
    filteredTasks = [...filteredTasks].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'priority') return prioRank(a.priority) - prioRank(b.priority);
      const col = sort.startsWith('meta') ? 'target_date' : 'due_date';
      const av = (a[col] as string | null) ?? '';
      const bv = (b[col] as string | null) ?? '';
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return sort.endsWith('_desc') ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }

  async function createDemand(fields: { title: string; start: string; target: string; due: string; priority: Priority }) {
    const first = sortedStages[0];
    if (!first) return;
    const { data } = await supabase
      .from('tasks')
      .insert({
        project_id: null,
        packaging_track: 'marca',
        brand_id: brandId,
        stage_id: first.id,
        title: fields.title.trim(),
        priority: fields.priority,
        start_date: fields.start || null,
        target_date: fields.target || null,
        due_date: fields.due || null,
        position: tasks.length,
      })
      .select()
      .single();
    if (data) await materializeSubsteps(data.id, first.id);
    if (profile && data) await logActivity({ actorId: profile.id, actionText: 'Demanda de marca criada', detail: `${brandLabel}: ${fields.title}`, taskId: data.id });
    setShowNew(false);
    load();
  }

  async function changeStage(taskId: string, stageId: string) {
    const task = tasks.find((t) => t.id === taskId);
    const target = stagesById[stageId];
    const current = task ? stagesById[task.stage_id] : undefined;
    if (target?.is_final && !task?.assignee_id) {
      setBlockInfo({ from: current?.name ?? '', to: target.name, pending: ['Atribua um responsável antes de mover para uma etapa final.'] });
      return;
    }
    if (target && current && target.position > current.position) {
      const { data: pending } = await supabase
        .from('task_checklist_items')
        .select('label')
        .eq('task_id', taskId)
        .eq('is_gate', true)
        .eq('done', false);
      const list = ((pending as { label: string }[]) ?? []).map((p) => p.label);
      if (list.length > 0) {
        setBlockInfo({ from: current.name, to: target.name, pending: list });
        return;
      }
    }
    await supabase.from('tasks').update({ stage_id: stageId, updated_by: profile?.id }).eq('id', taskId);
    await materializeSubsteps(taskId, stageId);
    await recomputeSubstepDueDates(taskId, stageId);
    load();
  }

  async function saveTask(taskId: string, fields: Partial<Task>) {
    await supabase.from('tasks').update({ ...fields, updated_by: profile?.id }).eq('id', taskId);
    setEditingTask(null);
    load();
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    setEditingTask(null);
    load();
  }

  if (loading) return <Loading />;

  const kanbanTasks = filteredTasks.map((t) => ({ id: t.id, stage: t.stage_id, priority: t.priority, assignee_id: t.assignee_id, title: t.title, due_date: t.due_date }));
  const kanbanStages = sortedStages.map((s) => ({ key: s.id, label: s.name }));

  return (
    <div style={{ marginTop: 12 }}>
      <div className="filters-row" style={{ justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
        <button className="btn sm" onClick={() => setShowNew(true)}>+ Nova demanda</button>
        <div className={`filter-chip${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')}>Kanban</div>
        <div className={`filter-chip${view === 'lista' ? ' active' : ''}`} onClick={() => setView('lista')}>Lista</div>
        <div className="filter-chip" onClick={() => setManagingStages((v) => !v)}>⚙ Etapas</div>
      </div>

      <div className="filters-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Buscar por título…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200, flex: 1 }} />
        <select className="chip-select" value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
          <option value="all">Responsável: todos</option>
          <option value="none">Sem responsável</option>
          {profiles.filter((p) => !p.disabled).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="chip-select" value={fPriority} onChange={(e) => setFPriority(e.target.value as 'all' | Priority)}>
          <option value="all">Prioridade: todas</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <select className="chip-select" value={fStage} onChange={(e) => setFStage(e.target.value)}>
          <option value="all">Etapa: todas</option>
          {sortedStages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="chip-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="recent">Ordenar: posição</option>
          <option value="title">Ordenar: título (A-Z)</option>
          <option value="priority">Ordenar: prioridade</option>
          <option value="prazo">🏁 Prazo: mais próximo</option>
          <option value="prazo_desc">🏁 Prazo: mais distante</option>
          <option value="meta">🎯 Meta: mais próxima</option>
          <option value="meta_desc">🎯 Meta: mais distante</option>
        </select>
        <label className="filter-chip" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} style={{ width: 'auto', marginRight: 6 }} />
          Ocultar finalizadas
        </label>
      </div>

      {managingStages && (
        <StagesEditor packagingTrack="marca" title="Marcas" taskStageIds={tasks.map((t) => t.stage_id)} onChange={load} />
      )}

      {sortedStages.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">▤</span>Nenhuma etapa — rode a migration 0055 (pipeline de marca).
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon="☰" title={`Nenhuma demanda de ${brandLabel} ainda`} hint="Crie a primeira demanda desta marca." action={{ label: '+ Nova demanda', onClick: () => setShowNew(true) }} />
      ) : view === 'kanban' ? (
        <KanbanBoard
          tasks={kanbanTasks}
          profilesById={profilesById}
          editable
          cols={kanbanStages.length <= 5 ? 5 : 6}
          stages={kanbanStages}
          terminalStages={terminalStageIds}
          onStageChange={changeStage}
          onCreate={(title) => createDemand({ title, start: '', target: '', due: '', priority: 'medium' })}
          onEdit={(kt) => setEditingTask(tasks.find((t) => t.id === kt.id) ?? null)}
          renderExtra={(kt) => {
            const t = tasks.find((x) => x.id === kt.id);
            if (!t) return null;
            const isFinal = stagesById[t.stage_id]?.is_final;
            const overdue = t.due_date && !isFinal && new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
            if (!t.target_date && !t.due_date) return null;
            return (
              <div style={{ display: 'flex', gap: 8, fontSize: 10, flexWrap: 'wrap' }}>
                {t.target_date && <span style={{ color: 'var(--violet)' }}>🎯 {new Date(t.target_date + 'T00:00').toLocaleDateString('pt-BR')}</span>}
                {t.due_date && (
                  <span style={{ color: overdue ? 'var(--red)' : 'var(--text-faint)', fontWeight: overdue ? 700 : 400 }}>
                    🏁 {new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            );
          }}
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="simple">
            <thead>
              <tr>
                <th>Demanda</th>
                <th>Etapa</th>
                <th>Responsável</th>
                <th>Prioridade</th>
                <th>🎯 Meta</th>
                <th>🏁 Prazo</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const isFinal = stagesById[t.stage_id]?.is_final;
                const overdue = t.due_date && !isFinal && new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setEditingTask(t)}>
                    <td data-label="Demanda">{t.title}</td>
                    <td data-label="Etapa" style={{ color: 'var(--text-faint)' }}>{stagesById[t.stage_id]?.name ?? '—'}</td>
                    <td data-label="Responsável" style={{ color: 'var(--text-faint)' }}>{t.assignee_id ? profilesById[t.assignee_id]?.name : '—'}</td>
                    <td data-label="Prioridade"><span className={`prio ${t.priority}`}>{PRIORITY_LABELS[t.priority]}</span></td>
                    <td data-label="Meta" style={{ color: 'var(--violet)' }}>{t.target_date ? new Date(t.target_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td data-label="Prazo" style={{ color: overdue ? 'var(--red)' : 'var(--text-faint)', fontWeight: overdue ? 700 : 400 }}>
                      {t.due_date ? new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingTask && profile && (
        <TaskEditModal
          task={editingTask}
          profiles={profiles}
          products={[]}
          stages={stages}
          actorId={profile.id}
          onClose={() => setEditingTask(null)}
          onSave={(fields) => saveTask(editingTask.id, fields)}
          onDelete={() => deleteTask(editingTask.id)}
        />
      )}

      {showNew && <NewBrandDemand brandLabel={brandLabel} onClose={() => setShowNew(false)} onCreate={createDemand} />}

      {blockInfo && (
        <Modal title="🔒 Não é possível avançar" onClose={() => setBlockInfo(null)}>
          <p style={{ fontSize: 13 }}>
            Para sair de <b>{blockInfo.from}</b> e ir para <b>{blockInfo.to}</b>, resolva antes:
          </p>
          <ul style={{ fontSize: 13, paddingLeft: 18 }}>
            {blockInfo.pending.map((p, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{p}</li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setBlockInfo(null)}>Entendi</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NewBrandDemand({
  brandLabel,
  onClose,
  onCreate,
}: {
  brandLabel: string;
  onClose: () => void;
  onCreate: (fields: { title: string; start: string; target: string; due: string; priority: Priority }) => void;
}) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [target, setTarget] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Dê um título à demanda.');
      return;
    }
    onCreate({ title, start, target, due, priority });
  }

  return (
    <Modal title={`Nova demanda — ${brandLabel}`} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-field">
          <label htmlFor="bd-title">Título da demanda</label>
          <input id="bd-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Manual de marca — v1" />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="bd-start">Início</label>
            <input id="bd-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="bd-target">🎯 Meta</label>
            <input id="bd-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="bd-due">🏁 Prazo final</label>
            <input id="bd-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="bd-prio">Prioridade</label>
          <select id="bd-prio" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
        {error && <div className="banner error"><span className="ic">⚠</span><span>{error}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn">Criar demanda</button>
        </div>
      </form>
    </Modal>
  );
}
