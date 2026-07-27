import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import KanbanBoard from '../components/KanbanBoard';
import TaskEditModal from '../components/TaskEditModal';
import { STAGES, type Profile, type Stage, type Task } from '../types/database';

type TaskWithProject = Task & { project: { name: string } | null };

export default function Demandas() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tasksRes, profilesRes] = await Promise.all([
      supabase.from('tasks').select('*, project:projects(name)').order('position'),
      supabase.from('profiles').select('*'),
    ]);
    setTasks((tasksRes.data as TaskWithProject[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
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
      projectId: task?.project_id,
    });
    load();
  }

  async function saveTask(taskId: string, fields: Partial<Task>) {
    const task = tasks.find((t) => t.id === taskId);
    await supabase.from('tasks').update(fields).eq('id', taskId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Demanda editada', projectId: task?.project_id });
    setEditingTask(null);
    load();
  }

  async function deleteTask(taskId: string, title: string, projectId?: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Demanda excluída', detail: title, projectId });
    setEditingTask(null);
    load();
  }

  return (
    <div className="page">
      <h1 className="page-title">Demandas</h1>
      <div className="page-sub">Fluxo: Recebido → Planejamento → Produção → Revisão → Aprovação → Finalizado.</div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <KanbanBoard
          tasks={tasks}
          profilesById={profilesById}
          editable
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
    </div>
  );
}
