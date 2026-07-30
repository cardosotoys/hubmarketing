import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import TaskEditModal from '../components/TaskEditModal';
import Modal from '../components/Modal';
import { PRIORITIES, PRIORITY_LABELS, type Priority, type Product, type ProjectStage, type Profile, type Project, type Task } from '../types/database';

type TaskWithProject = Task & { project: { id: string; name: string } | null };
type GroupBy = 'none' | 'assignee' | 'project' | 'priority';

function isTaskOverdue(t: Task, stagesById: Record<string, ProjectStage>) {
  if (!t.due_date || stagesById[t.stage_id]?.is_final) return false;
  return new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
}

function cronogramaLabel(t: Task) {
  if (!t.start_date && !t.due_date) return '—';
  const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (t.start_date && t.due_date) return `${fmt(t.start_date)} – ${fmt(t.due_date)}`;
  return fmt(t.start_date ?? t.due_date!);
}

export default function Demandas() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
  const [focusComments, setFocusComments] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    let tasksQuery = supabase.from('tasks').select('*, project:projects(id, name)').order('position');
    if (profile?.role === 'equipe') {
      tasksQuery = tasksQuery.eq('assignee_id', profile.id);
    }
    const [tasksRes, profilesRes, projectsRes, filesRes, productsRes, stagesRes] = await Promise.all([
      tasksQuery,
      supabase.from('profiles').select('*'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('project_files').select('task_id').not('task_id', 'is', null),
      supabase.from('products').select('*').order('code'),
      supabase.from('stages').select('*').order('position'),
    ]);
    setTasks((tasksRes.data as TaskWithProject[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setProjects((projectsRes.data as Project[]) ?? []);
    setProducts((productsRes.data as Product[]) ?? []);
    setStages((stagesRes.data as ProjectStage[]) ?? []);
    const counts: Record<string, number> = {};
    ((filesRes.data as { task_id: string }[]) ?? []).forEach((f) => {
      counts[f.task_id] = (counts[f.task_id] ?? 0) + 1;
    });
    setFileCounts(counts);
    setLoading(false);
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId || tasks.length === 0) return;
    const target = tasks.find((t) => t.id === taskId);
    if (target) {
      setEditingTask(target);
      setFocusComments(searchParams.get('focus') === 'comments');
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('task');
      next.delete('focus');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const stagesById = Object.fromEntries(stages.map((s) => [s.id, s]));
  const stagesByProject: Record<string, ProjectStage[]> = {};
  for (const s of stages) {
    const key = s.project_id ?? 'GLOBAL';
    (stagesByProject[key] ??= []).push(s);
  }
  for (const key of Object.keys(stagesByProject)) {
    stagesByProject[key].sort((a, b) => a.position - b.position);
  }

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
        {profile?.role === 'equipe' && ' Aqui aparecem só as demandas atribuídas a você.'}
      </div>

      <div className="section-head">
        <h2>{tasks.length} demandas</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="group-toggle">
            {(
              [
                ['project', 'Projeto'],
                ['none', 'Sem agrupar'],
                ['assignee', 'Responsável'],
                ['priority', 'Prioridade'],
              ] as [GroupBy, string][]
            ).map(([key, label]) => (
              <div
                key={key}
                className={`filter-chip${groupBy === key ? ' active' : ''}`}
                onClick={() => setGroupBy(key)}
              >
                {label}
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => setShowNew(true)}>
            + Nova demanda
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        groups.map((g) => (
          <div className="demand-group" key={g.label}>
            {g.label && (
              <div className="demand-group-head">
                <span>{g.label}</span>
                <span className="pill">{g.items.length}</span>
              </div>
            )}
            <table className="simple">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  {groupBy !== 'project' && <th>Projeto</th>}
                  <th>Prioridade</th>
                  <th>Estágio</th>
                  {groupBy !== 'assignee' && <th>Responsável</th>}
                  <th>Prazo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setEditingTask(t)}>
                    <td>
                      {t.title}
                      {fileCounts[t.id] > 0 && <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>📎{fileCounts[t.id]}</span>}
                    </td>
                    {groupBy !== 'project' && (
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
                    )}
                    <td>
                      <span className={`prio ${t.priority}`}>{t.priority}</span>
                    </td>
                    <td style={{ color: 'var(--text-faint)' }}>{stagesById[t.stage_id]?.name}</td>
                    {groupBy !== 'assignee' && (
                      <td style={{ color: 'var(--text-faint)' }}>{t.assignee_id ? profilesById[t.assignee_id]?.name : '—'}</td>
                    )}
                    <td style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{cronogramaLabel(t)}</td>
                    <td>{isTaskOverdue(t, stagesById) && <span style={{ color: 'var(--red)', fontSize: 11 }}>🔴 atrasada</span>}</td>
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
          stages={stagesByProject[editingTask.project_id ?? 'GLOBAL'] ?? []}
          actorId={profile.id}
          focusComments={focusComments}
          onClose={() => {
            setEditingTask(null);
            setFocusComments(false);
          }}
          onSave={(fields) => saveTask(editingTask.id, fields)}
          onDelete={() => deleteTask(editingTask.id, editingTask.title, editingTask.project_id)}
        />
      )}

      {showNew && profile && (
        <NewTaskModal
          projects={projects}
          profiles={profiles}
          stagesByProject={stagesByProject}
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
  stagesByProject,
  actorId,
  onClose,
  onCreated,
}: {
  projects: Project[];
  profiles: Profile[];
  stagesByProject: Record<string, ProjectStage[]>;
  actorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const firstStage = (stagesByProject[projectId || 'GLOBAL'] ?? [])[0];
    if (!firstStage) {
      setFormError('Esse projeto ainda não tem etapas configuradas.');
      return;
    }
    setFormError(null);
    const { data } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        project_id: projectId || null,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        stage_id: firstStage.id,
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
        {formError && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{formError}</span>
          </div>
        )}
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
