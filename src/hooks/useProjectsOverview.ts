import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Brand, Project, Task } from '../types/database';

export interface ProjectWithBrand extends Project {
  brand: Brand;
}

type TaskStub = Pick<Task, 'id' | 'project_id' | 'stage' | 'assignee_id'>;

export function useProjectsOverview() {
  const [projects, setProjects] = useState<ProjectWithBrand[]>([]);
  const [tasks, setTasks] = useState<TaskStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [projectsRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('*, brand:brands(*)').order('created_at', { ascending: false }),
      supabase.from('tasks').select('id, project_id, stage, assignee_id'),
    ]);
    if (projectsRes.error) setError(projectsRes.error.message);
    else setProjects((projectsRes.data as ProjectWithBrand[]) ?? []);
    if (tasksRes.data) setTasks(tasksRes.data as TaskStub[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function percentFor(projectId: string) {
    const projectTasks = tasks.filter((t) => t.project_id === projectId);
    if (projectTasks.length === 0) return 0;
    const done = projectTasks.filter((t) => t.stage === 'finalizado').length;
    return Math.round((done / projectTasks.length) * 100);
  }

  return { projects, tasks, loading, error, reload, percentFor };
}
