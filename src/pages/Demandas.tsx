import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import TaskEditModal from '../components/TaskEditModal';
import Modal from '../components/Modal';
import {
  CAMPAIGN_TASK_STAGES,
  PRIORITIES,
  PRIORITY_LABELS,
  type CampaignTask,
  type Priority,
  type Product,
  type ProjectStage,
  type Profile,
  type Project,
  type Task,
} from '../types/database';

type TaskWithProject = Task & { project: { id: string; name: string } | null };
type GroupBy = 'none' | 'assignee' | 'project' | 'priority';

// Linha unificada da tela Demandas: agrega demandas de projeto, de embalagem e de campanha
// numa lista só, pra dar um filtro rápido de tudo sem abrir cada projeto/campanha.
type DemandRow = {
  id: string;
  source: 'task' | 'campaign';
  title: string;
  priority: Priority;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  stageName: string;
  isFinal: boolean;
  groupProject: string;
  projectLink: { to: string; name: string } | null;
  fileCount: number;
  task: TaskWithProject | null; // preenchido só quando dá pra editar no modal (source 'task')
};

const CAMPAIGN_STAGE_LABEL = Object.fromEntries(CAMPAIGN_TASK_STAGES.map((s) => [s.key, s.label]));

function isRowOverdue(r: DemandRow) {
  if (!r.dueDate || r.isFinal) return false;
  return new Date(r.dueDate + 'T00:00') < new Date(new Date().toDateString());
}

function cronogramaLabel(start: string | null, due: string | null) {
  if (!start && !due) return '—';
  const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (start && due) return `${fmt(start)} – ${fmt(due)}`;
  return fmt((start ?? due)!);
}

export default function Demandas() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [campaignTasks, setCampaignTasks] = useState<CampaignTask[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
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
    // Agora traz TUDO: demandas de projeto, de embalagem (packaging_track) e de campanha.
    // A RLS já limita o que cada um pode ler; o filtro "só as minhas" pra Equipe é aplicado abaixo.
    const [tasksRes, campTasksRes, campaignsRes, profilesRes, projectsRes, filesRes, productsRes, stagesRes] =
      await Promise.all([
        supabase.from('tasks').select('*, project:projects(id, name)').order('position'),
        supabase.from('campaign_tasks').select('*').order('position'),
        supabase.from('campaigns').select('id, name').order('name'),
        supabase.from('profiles').select('*'),
        supabase.from('projects').select('*').order('name'),
        supabase.from('project_files').select('task_id').not('task_id', 'is', null),
        supabase.from('products').select('*').order('code'),
        supabase.from('stages').select('*').order('position'),
      ]);
    setTasks((tasksRes.data as TaskWithProject[]) ?? []);
    setCampaignTasks((campTasksRes.data as CampaignTask[]) ?? []);
    setCampaigns((campaignsRes.data as { id: string; name: string }[]) ?? []);
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
  }, []);

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

  const isEquipe = profile?.role === 'equipe';
  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const campaignsById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const stagesById = Object.fromEntries(stages.map((s) => [s.id, s]));
  // Para o "Nova demanda" (só cria demanda de projeto/avulsa): exclui os estágios de embalagem.
  const stagesByProject: Record<string, ProjectStage[]> = {};
  for (const s of stages) {
    if (s.packaging_track) continue;
    const key = s.project_id ?? 'GLOBAL';
    (stagesByProject[key] ??= []).push(s);
  }
  for (const key of Object.keys(stagesByProject)) {
    stagesByProject[key].sort((a, b) => a.position - b.position);
  }

  // Estágios da trilha de UMA tarefa (projeto, embalagem, ou avulsa) — usado pelo modal de edição.
  function stagesForTask(t: TaskWithProject): ProjectStage[] {
    const list = t.project_id
      ? stages.filter((s) => s.project_id === t.project_id)
      : t.packaging_track
        ? stages.filter((s) => s.packaging_track === t.packaging_track)
        : stages.filter((s) => !s.project_id && !s.packaging_track);
    return [...list].sort((a, b) => a.position - b.position);
  }

  const taskRows: DemandRow[] = tasks
    .filter((t) => !isEquipe || t.assignee_id === profile?.id)
    .map((t) => ({
      id: t.id,
      source: 'task',
      title: t.title,
      priority: t.priority,
      assigneeId: t.assignee_id,
      startDate: t.start_date,
      dueDate: t.due_date,
      stageName: stagesById[t.stage_id]?.name ?? '—',
      isFinal: !!stagesById[t.stage_id]?.is_final,
      groupProject: t.packaging_track ? 'Embalagens' : t.project?.name ?? 'Sem projeto (avulsa)',
      projectLink: t.project
        ? { to: `/projetos/${t.project.id}`, name: t.project.name }
        : t.packaging_track
          ? { to: '/design-produto/embalagens', name: 'Embalagens' }
          : null,
      fileCount: fileCounts[t.id] ?? 0,
      task: t,
    }));

  const campaignRows: DemandRow[] = campaignTasks
    .filter((ct) => !isEquipe || ct.assignee_id === profile?.id)
    .map((ct) => {
      const camp = campaignsById[ct.campaign_id];
      return {
        id: ct.id,
        source: 'campaign' as const,
        title: ct.title,
        priority: ct.priority,
        assigneeId: ct.assignee_id,
        startDate: ct.start_date,
        dueDate: ct.due_date,
        stageName: CAMPAIGN_STAGE_LABEL[ct.stage] ?? ct.stage,
        isFinal: ct.stage === 'concluida' || ct.stage === 'cancelada',
        groupProject: camp ? `Campanha: ${camp.name}` : 'Campanha',
        projectLink: camp ? { to: `/campanhas/${camp.id}`, name: camp.name } : null,
        fileCount: 0,
        task: null,
      };
    });

  const rows: DemandRow[] = [...taskRows, ...campaignRows];

  function groupLabel(r: DemandRow): string {
    if (groupBy === 'assignee') return r.assigneeId ? profilesById[r.assigneeId]?.name ?? '—' : 'Sem responsável';
    if (groupBy === 'project') return r.groupProject;
    if (groupBy === 'priority') return PRIORITY_LABELS[r.priority];
    return '';
  }

  const groups =
    groupBy === 'none'
      ? [{ label: '', items: rows }]
      : Object.entries(
          rows.reduce<Record<string, DemandRow[]>>((acc, r) => {
            const key = groupLabel(r);
            (acc[key] ??= []).push(r);
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
        Visão única de todas as demandas — de projetos, de embalagem e de campanhas — pra filtrar rápido sem abrir cada
        um. Demanda de campanha abre na campanha; as demais abrem aqui.
        {isEquipe && ' Aqui aparecem só as demandas atribuídas a você.'}
      </div>

      <div className="section-head">
        <h2>{rows.length} demandas</h2>
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
                {g.items.map((r) => (
                  <tr
                    key={`${r.source}-${r.id}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => (r.task ? setEditingTask(r.task) : r.projectLink && navigate(r.projectLink.to))}
                  >
                    <td data-label="Tarefa">
                      {r.title}
                      {r.source === 'campaign' && (
                        <span className="pill" style={{ marginLeft: 6, background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
                          campanha
                        </span>
                      )}
                      {r.fileCount > 0 && <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>📎{r.fileCount}</span>}
                    </td>
                    {groupBy !== 'project' && (
                      <td data-label="Projeto">
                        {r.projectLink ? (
                          <Link
                            to={r.projectLink.to}
                            onClick={(e) => e.stopPropagation()}
                            className="pill"
                            style={{ background: 'var(--violet-dim)', color: 'var(--violet)', textDecoration: 'none' }}
                          >
                            {r.projectLink.name}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-faint)' }}>Avulsa</span>
                        )}
                      </td>
                    )}
                    <td data-label="Prioridade">
                      <span className={`prio ${r.priority}`}>{r.priority}</span>
                    </td>
                    <td data-label="Estágio" style={{ color: 'var(--text-faint)' }}>
                      {r.stageName}
                    </td>
                    {groupBy !== 'assignee' && (
                      <td data-label="Responsável" style={{ color: 'var(--text-faint)' }}>
                        {r.assigneeId ? profilesById[r.assigneeId]?.name : '—'}
                      </td>
                    )}
                    <td data-label="Prazo" style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                      {cronogramaLabel(r.startDate, r.dueDate)}
                    </td>
                    <td>{isRowOverdue(r) && <span style={{ color: 'var(--red)', fontSize: 11 }}>🔴 atrasada</span>}</td>
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
          stages={stagesForTask(editingTask)}
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
