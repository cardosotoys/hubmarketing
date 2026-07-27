import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import KanbanBoard from '../components/KanbanBoard';
import TaskEditModal from '../components/TaskEditModal';
import Modal from '../components/Modal';
import { PRIORITIES, PRIORITY_LABELS, STAGES, type Priority, type Profile, type Project, type Stage, type Task } from '../types/database';

type TaskWithProject = Task & { project: { name: string } | null };

export default function Demandas() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [tasksRes, profilesRes, projectsRes] = await Promise.all([
      supabase.from('tasks').select('*, project:projects(name)').order('position'),
      supabase.from('profiles').select('*'),
      supabase.from('projects').select('*').order('name'),
    ]);
    setTasks((tasksRes.data as TaskWithProject[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setProjects((projectsRes.data as Project[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

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
    await supabase.from('tasks').update(fields).eq('id', taskId);
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
        <button className="btn" onClick={() => setShowNew(true)}>
          + Nova demanda
        </button>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
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
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>
                {withProject.project.name}
              </div>
            ) : null;
          }}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          profiles={profiles}
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
