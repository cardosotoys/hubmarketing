import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import KanbanBoard from '../components/KanbanBoard';
import TaskEditModal from '../components/TaskEditModal';
import Modal from '../components/Modal';
import { PRIORITIES, PRIORITY_LABELS, STAGES, type Priority, type Product, type Profile, type Project, type Stage, type Task } from '../types/database';

type TaskWithProject = Task & { project: { id: string; name: string } | null };
type GroupBy = 'none' | 'assignee' | 'project' | 'priority';

function isTaskOverdue(t: Task) {
  if (!t.due_date || t.stage === 'finalizado') return false;
  return new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cronogramaLabel(t: Task) {
  if (!t.start_date && !t.due_date) return '—';
  const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (t.start_date && t.due_date) return `${fmt(t.start_date)} – ${fmt(t.due_date)}`;
  return fmt(t.start_date ?? t.due_date!);
}

export default function Demandas() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [tasksRes, profilesRes, projectsRes, filesRes, productsRes] = await Promise.all([
      supabase.from('tasks').select('*, project:projects(id, name)').order('position'),
      supabase.from('profiles').select('*'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('project_files').select('task_id').not('task_id', 'is', null),
      supabase.from('products').select('*').order('code'),
    ]);
    setTasks((tasksRes.data as TaskWithProject[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setProjects((projectsRes.data as Project[]) ?? []);
    setProducts((productsRes.data as Product[]) ?? []);
    const counts: Record<string, number> = {};
    ((filesRes.data as { task_id: string }[]) ?? []).forEach((f) => {
      counts[f.task_id] = (counts[f.task_id] ?? 0) + 1;
    });
    setFileCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  function groupLabel(t: TaskWithProject): string {
    if (groupBy === 'assignee') return t.assignee_id ? profilesById[t.assignee_id]?.name ?? '—' : 'Sem responsável';
    if (groupBy === 'project') return t.project?.name ?? 'Sem projeto (avulsa)';
    if (groupBy === 'priority') return PRIORITY_LABELS[t.priority];
    return '';
  }

  const groups =
    groupBy === 'none'
      ? [{ label: '', items: tasks }]
      : Object.entries(
          tasks.reduce<Record<string, TaskWithProject[]>>((acc, t) => {
            const key = groupLabel(t);
            (acc[key] ??= []).push(t);
            return acc;
          }, {})
        ).map(([label, items]) => ({ label, items }));

  async function changeStage(taskId: string, stage: Stage) {
    if (!profile) return;
    const task = tasks.find((t) => t.id === taskId);
    await supabase.from('tasks').update({ stage }).eq('id', taskId);
    const stageLabel = STAGES.find((s) => s.key === stage)?.label ?? stage;
    await logActivity({
      actorId: profile.id,
      actionText: 'Demanda movida de estágio',
      detail: task ? `${task.title} → ${stageLabel}` : stageLabel,
      projectId: task?.project_id ?? undefined,
      taskId,
    });
    load();
  }

  async function saveTask(taskId: string, fields: Partial<Task>) {
    const task = tasks.find((t) => t.id === taskId);
    await supabase.from('tasks').update({ ...fields, updated_by: profile?.id }).eq('id', taskId);
    if (profile) {
      await logActivity({ actorId: profile.id, actionText: 'Demanda editada', projectId: task?.project_id ?? undefined, taskId });
    }
    setEditingTask(null);
    load();
  }

  async function deleteTask(taskId: string, title: string, projectId?: string | null) {
    await supabase.from('tasks').delete().eq('id', taskId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Demanda excluída', detail: title, projectId: projectId ?? undefined });
    setEditingTask(null);
    load();
  }

  return (
    <div className="page">
      <h1 className="page-title">Demandas</h1>
      <div className="page-sub">
        Fluxo: Recebido → Planejamento → Produção → Revisão → Aprovação → Finalizado. Demandas podem estar ligadas a um
        projeto ou ser avulsas (algo pontual, sem vínculo).
      </div>

      <div className="section-head">
        <h2>{tasks.length} demandas</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {view === 'lista' && (
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="none">Sem agrupamento</option>
              <option value="assignee">Agrupar por responsável</option>
              <option value="project">Agrupar por projeto</option>
              <option value="priority">Agrupar por prioridade</option>
            </select>
          )}
          <div className="filters-row" style={{ margin: 0 }}>
            <div className={`filter-chip${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')}>
              Kanban
            </div>
            <div className={`filter-chip${view === 'lista' ? ' active' : ''}`} onClick={() => setView('lista')}>
              Lista
            </div>
          </div>
          <button className="btn" onClick={() => setShowNew(true)}>
            + Nova demanda
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          tasks={tasks}
          profilesById={profilesById}
          editable
          terminalStages={['finalizado']}
          onStageChange={changeStage}
          onEdit={(t) => setEditingTask(t as TaskWithProject)}
          renderExtra={(t) => {
            const withProject = t as TaskWithProject;
            return withProject.project ? (
              <Link
                to={`/projetos/${withProject.project.id}`}
                onClick={(e) => e.stopPropagation()}
                className="pill"
                style={{ display: 'inline-block', marginBottom: 6, background: 'var(--violet-dim)', color: 'var(--violet)', textDecoration: 'none' }}
              >
                {withProject.project.name}
              </Link>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>Avulsa</div>
            );
          }}
        />
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            {g.label && <h4 style={{ fontSize: 12, color: 'var(--text-dim)', margin: '14px 0 6px 0' }}>{g.label}</h4>}
            <table className="simple">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Projeto</th>
                  <th>Prioridade</th>
                  <th>Estágio</th>
                  <th>Responsável</th>
                  <th>Notas</th>
                  <th>Orçamento</th>
                  <th>Arquivos</th>
                  <th>Cronograma</th>
                  <th>Atraso</th>
                  <th>Última atualização</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setEditingTask(t)}>
                    <td>{t.title}</td>
                    <td>
                      {t.project ? (
                        <Link
                          to={`/projetos/${t.project.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="pill"
                          style={{ background: 'var(--violet-dim)', color: 'var(--violet)', textDecoration: 'none' }}
                        >
                          {t.project.name}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>Avulsa</span>
                      )}
                    </td>
                    <td>
                      <span className={`prio ${t.priority}`}>{t.priority}</span>
                    </td>
                    <td style={{ color: 'var(--text-faint)' }}>{STAGES.find((s) => s.key === t.stage)?.label}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{t.assignee_id ? profilesById[t.assignee_id]?.name : '—'}</td>
                    <td style={{ color: 'var(--text-faint)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.notes || '—'}
                    </td>
                    <td style={{ color: 'var(--text-faint)' }}>{t.budget != null ? formatBRL(Number(t.budget)) : '—'}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{fileCounts[t.id] ? `📎 ${fileCounts[t.id]}` : '—'}</td>
                    <td style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{cronogramaLabel(t)}</td>
                    <td>{isTaskOverdue(t) && <span style={{ color: 'var(--red)', fontSize: 11 }}>🔴 atrasada</span>}</td>
                    <td style={{ color: 'var(--text-faint)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {t.updated_by ? profilesById[t.updated_by]?.name : '—'} · {new Date(t.updated_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {editingTask && profile && (
        <TaskEditModal
          task={editingTask}
          profiles={profiles}
          products={products}
          actorId={profile.id}
          onClose={() => setEditingTask(null)}
          onSave={(fields) => saveTask(editingTask.id, fields)}
          onDelete={() => deleteTask(editingTask.id, editingTask.title, editingTask.project_id)}
        />
      )}

      {showNew && profile && (
        <NewTaskModal
          projects={projects}
          profiles={profiles}
          actorId={profile.id}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewTaskModal({
  projects,
  profiles,
  actorId,
  onClose,
  onCreated,
}: {
  projects: Project[];
  profiles: Profile[];
  actorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        project_id: projectId || null,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        stage: 'recebido',
      })
      .select()
      .single();
    await logActivity({
      actorId,
      actionText: 'Demanda criada',
      detail: title.trim(),
      projectId: projectId || undefined,
      taskId: data?.id,
    });
    onCreated();
  }

  return (
    <Modal title="Nova demanda" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="nd-title">Título</label>
          <input id="nd-title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="nd-project">Projeto (opcional)</label>
          <select id="nd-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Sem projeto — demanda avulsa</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="nd-priority">Prioridade</label>
            <select id="nd-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="nd-assignee">Responsável</label>
            <select id="nd-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Sem responsável</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="nd-due">Prazo</label>
            <input id="nd-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Criar demanda
          </button>
        </div>
      </form>
    </Modal>
  );
}
