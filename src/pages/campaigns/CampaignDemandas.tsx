import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import KanbanBoard from '../../components/KanbanBoard';
import CampaignTaskDrawer from '../../components/CampaignTaskDrawer';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { CAMPAIGN_TASK_STAGES, type CampaignTask, type Product, type Profile } from '../../types/database';

type GroupBy = 'none' | 'assignee' | 'product' | 'priority';

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export default function CampaignDemandas() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [tasks, setTasks] = useState<CampaignTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dependencies, setDependencies] = useState<{ task_id: string; depends_on_id: string }[]>([]);
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [drawerTask, setDrawerTask] = useState<CampaignTask | null | 'new'>(null);

  async function load() {
    const [tasksRes, profilesRes, productsRes, depsRes] = await Promise.all([
      supabase.from('campaign_tasks').select('*').eq('campaign_id', campaign.id).order('position'),
      supabase.from('profiles').select('*'),
      supabase.from('products').select('*').order('name'),
      supabase.from('campaign_task_dependencies').select('*'),
    ]);
    setTasks((tasksRes.data as CampaignTask[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setProducts((productsRes.data as Product[]) ?? []);
    setDependencies((depsRes.data as { task_id: string; depends_on_id: string }[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));

  function isBlocked(taskId: string) {
    return dependencies
      .filter((d) => d.task_id === taskId)
      .some((d) => {
        const dep = tasksById[d.depends_on_id];
        return dep && dep.stage !== 'concluida' && dep.stage !== 'cancelada';
      });
  }

  async function changeStage(taskId: string, stage: CampaignTask['stage']) {
    await supabase.from('campaign_tasks').update({ stage }).eq('id', taskId);
    if (profile) {
      const t = tasks.find((x) => x.id === taskId);
      await logActivity({ actorId: profile.id, actionText: 'Estágio da demanda alterado', detail: `${t?.title} → ${stage}`, campaignId: campaign.id, campaignTaskId: taskId });
    }
    load();
  }

  async function quickCreate(title: string) {
    if (!profile) return;
    const { data } = await supabase
      .from('campaign_tasks')
      .insert({ campaign_id: campaign.id, title, created_by: profile.id, position: tasks.length })
      .select()
      .single();
    if (data) await logActivity({ actorId: profile.id, actionText: 'Demanda criada', detail: title, campaignId: campaign.id, campaignTaskId: data.id });
    load();
  }

  // Carga de trabalho: soma de horas previstas por responsável para demandas com prazo nesta semana
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const workload: Record<string, number> = {};
  tasks.forEach((t) => {
    if (!t.due_date || !t.assignee_id || !t.estimated_hours) return;
    const d = new Date(t.due_date + 'T00:00');
    if (d >= weekStart && d <= weekEnd) {
      workload[t.assignee_id] = (workload[t.assignee_id] ?? 0) + Number(t.estimated_hours);
    }
  });

  function groupLabel(t: CampaignTask): string {
    if (groupBy === 'assignee') return t.assignee_id ? profilesById[t.assignee_id]?.name ?? '—' : 'Sem responsável';
    if (groupBy === 'product') return t.product_id ? products.find((p) => p.id === t.product_id)?.name ?? '—' : 'Sem produto';
    if (groupBy === 'priority') return t.priority;
    return '';
  }

  const groups =
    groupBy === 'none'
      ? [{ label: '', items: tasks }]
      : Object.entries(
          tasks.reduce<Record<string, CampaignTask[]>>((acc, t) => {
            const key = groupLabel(t);
            (acc[key] ??= []).push(t);
            return acc;
          }, {})
        ).map(([label, items]) => ({ label, items }));

  return (
    <div>
      <div className="section-head">
        <h2>{tasks.length} demandas</h2>
        <div className="responsive-row">
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
            <option value="none">Sem agrupamento</option>
            <option value="assignee">Agrupar por responsável</option>
            <option value="product">Agrupar por produto</option>
            <option value="priority">Agrupar por prioridade</option>
          </select>
          <div className="filters-row" style={{ margin: 0 }}>
            <div className={`filter-chip${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')}>
              Kanban
            </div>
            <div className={`filter-chip${view === 'lista' ? ' active' : ''}`} onClick={() => setView('lista')}>
              Lista
            </div>
          </div>
          <button className="btn" onClick={() => setDrawerTask('new')}>
            + Nova demanda
          </button>
        </div>
      </div>

      {Object.keys(workload).length > 0 && (
        <div className="panel">
          <h4>Carga de trabalho — semana atual</h4>
          {Object.entries(workload).map(([userId, hours]) => (
            <div className="field-row" key={userId}>
              <span className="k">{profilesById[userId]?.name ?? '—'}</span>
              <span className={hours > 40 ? 'warn' : ''}>{hours}h previstas</span>
            </div>
          ))}
        </div>
      )}

      {view === 'kanban' ? (
        <KanbanBoard<CampaignTask>
          tasks={tasks}
          profilesById={profilesById}
          editable
          stages={CAMPAIGN_TASK_STAGES}
          onStageChange={changeStage}
          onCreate={quickCreate}
          onEdit={(t) => setDrawerTask(t)}
          renderExtra={(t) => (
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6 }}>
              {isBlocked(t.id) && <span style={{ color: 'var(--red)' }}>🔒 bloqueada </span>}
              {t.due_date && new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR')}
            </div>
          )}
        />
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            {g.label && (
              <h4 style={{ fontSize: 12, color: 'var(--text-dim)', margin: '14px 0 6px 0' }}>{g.label}</h4>
            )}
            <table className="simple">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Prioridade</th>
                  <th>Estágio</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Bloqueio</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setDrawerTask(t)}>
                    <td>{t.title}</td>
                    <td>
                      <span className={`prio ${t.priority}`}>{t.priority}</span>
                    </td>
                    <td style={{ color: 'var(--text-faint)' }}>{CAMPAIGN_TASK_STAGES.find((s) => s.key === t.stage)?.label}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{t.assignee_id ? profilesById[t.assignee_id]?.name : '—'}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{t.due_date ? new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td>{isBlocked(t.id) && <span style={{ color: 'var(--red)', fontSize: 11 }}>🔒 bloqueada</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {drawerTask && (
        <CampaignTaskDrawer
          task={drawerTask === 'new' ? null : drawerTask}
          campaignId={campaign.id}
          profiles={profiles}
          products={products}
          allTasks={tasks}
          onClose={() => setDrawerTask(null)}
          onSaved={() => {
            setDrawerTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}
