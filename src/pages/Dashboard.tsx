import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjectsOverview } from '../hooks/useProjectsOverview';
import { supabase } from '../lib/supabaseClient';
import ProjectCard from '../components/ProjectCard';
import ActivityHeatmap from '../components/ActivityHeatmap';
import DonutChart from '../components/DonutChart';
import type { ProjectStatus } from '../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_CHART: { status: ProjectStatus; label: string; color: string }[] = [
  { status: 'active', label: 'Em execução', color: 'var(--green)' },
  { status: 'planning', label: 'Planejamento', color: 'var(--violet)' },
  { status: 'paused', label: 'Atenção', color: 'var(--yellow)' },
  { status: 'done', label: 'Finalizado', color: 'var(--text-faint)' },
];

export default function Dashboard() {
  const { profile } = useAuth();
  const { projects, tasks, isTaskDone, terminalStageIds, loading, error, percentFor } = useProjectsOverview();
  const seesFinancial = profile?.role === 'diretoria';
  const seesEverything = profile?.role === 'diretoria' || profile?.role === 'administrador';

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const openTasks = tasks.filter((t) => !isTaskDone(t)).length;
  const myOpenTasks = tasks.filter((t) => t.assignee_id === profile?.id && !isTaskDone(t)).length;
  const overdue = projects.filter(
    (p) => p.end_date && new Date(p.end_date) < new Date() && p.status !== 'done'
  ).length;
  const overdueTasks = tasks.filter(
    (t) => t.due_date && !isTaskDone(t) && new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString())
  ).length;
  const myOverdueTasks = tasks.filter(
    (t) =>
      t.due_date &&
      !isTaskDone(t) &&
      t.assignee_id === profile?.id &&
      new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString())
  ).length;

  // Demandas de embalagem + campanha somadas aos contadores (o hook cobre só as de projeto/avulsas)
  const [extra, setExtra] = useState({ open: 0, overdue: 0, myOpen: 0, myOverdue: 0 });
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const todayCut = new Date(new Date().toDateString());
      const isOverdue = (d: string | null) => !!d && new Date(d + 'T00:00') < todayCut;
      const [pkgRes, campRes] = await Promise.all([
        supabase.from('tasks').select('id, stage_id, assignee_id, due_date').not('packaging_track', 'is', null),
        supabase.from('campaign_tasks').select('id, stage, assignee_id, due_date'),
      ]);
      let open = 0,
        overdue = 0,
        myOpen = 0,
        myOverdue = 0;
      ((pkgRes.data as { stage_id: string; assignee_id: string | null; due_date: string | null }[]) ?? []).forEach((t) => {
        if (terminalStageIds.has(t.stage_id)) return;
        open++;
        const od = isOverdue(t.due_date);
        if (od) overdue++;
        if (t.assignee_id === profile?.id) {
          myOpen++;
          if (od) myOverdue++;
        }
      });
      ((campRes.data as { stage: string; assignee_id: string | null; due_date: string | null }[]) ?? []).forEach((t) => {
        if (t.stage === 'concluida' || t.stage === 'cancelada') return;
        open++;
        const od = isOverdue(t.due_date);
        if (od) overdue++;
        if (t.assignee_id === profile?.id) {
          myOpen++;
          if (od) myOverdue++;
        }
      });
      if (!cancelled) setExtra({ open, overdue, myOpen, myOverdue });
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, terminalStageIds, profile?.id]);

  const openTasksAll = openTasks + extra.open;
  const myOpenTasksAll = myOpenTasks + extra.myOpen;
  const overdueTasksAll = overdueTasks + extra.overdue;
  const myOverdueTasksAll = myOverdueTasks + extra.myOverdue;

  const [budget, setBudget] = useState<{ planned: number; spent: number } | null>(null);
  useEffect(() => {
    if (profile?.role !== 'diretoria') return;
    supabase
      .from('campaign_budget_items')
      .select('planned_amount, spent_amount')
      .then(({ data }) => {
        const planned = (data ?? []).reduce((s, b) => s + Number(b.planned_amount), 0);
        const spent = (data ?? []).reduce((s, b) => s + Number(b.spent_amount), 0);
        setBudget({ planned, spent });
      });
  }, [profile?.role]);

  const firstName = (profile?.name ?? '').split(' ')[0] || 'por aqui';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const workspace = localStorage.getItem('workspace') || 'todos';
  const WS_LABELS: Record<string, string> = {
    todos: 'Todos',
    marketing: 'Marketing',
    comercial: 'Comercial',
    produtos: 'Produtos',
    diretoria: 'Diretoria',
  };

  return (
    <div className="page">
      <div className="dash-hero">
        <div className="dash-hero-in">
          <h1>
            {greeting}, {firstName} 👋
          </h1>
          <p>
            {seesEverything ? 'Visão consolidada de Cardoso, Playmi e Tópi.' : 'Seus projetos e demandas — só o que você participa.'}
            {workspace !== 'todos' && ` · Workspace: ${WS_LABELS[workspace] ?? workspace}`}
          </p>
          <div className="dash-hero-chips">
            <span><b>{activeProjects}</b> projetos ativos</span>
            <span><b>{openTasksAll}</b> demandas abertas</span>
            {overdueTasksAll > 0 && <span className="warn"><b>{overdueTasksAll}</b> atrasadas</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="banner error">
          <span className="ic">⚠</span>
          <span>Não foi possível carregar os dados: {error}</span>
        </div>
      )}

      {/* KPIs principais */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{activeProjects}</div>
          <div className="stat-label">Projetos ativos</div>
          <div className="stat-trend">de {projects.length} no total</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{openTasksAll}</div>
          <div className="stat-label">Demandas abertas</div>
          {myOpenTasksAll > 0 && <div className="stat-trend">{myOpenTasksAll} atribuídas a você</div>}
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: overdueTasksAll > 0 ? 'var(--red)' : undefined }}>
            {overdueTasksAll}
          </div>
          <div className="stat-label">Demandas atrasadas</div>
          {myOverdueTasksAll > 0 ? (
            <div className="stat-trend warn">{myOverdueTasksAll} suas</div>
          ) : (
            <Link to="/demandas" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Ver demandas →</Link>
          )}
        </div>
        {seesFinancial ? (
          <div className="stat-card" style={{ color: overdue > 0 ? undefined : undefined }}>
            <div className="stat-num" style={{ color: overdue > 0 ? 'var(--yellow)' : undefined }}>{overdue}</div>
            <div className="stat-label">Projetos atrasados</div>
            {overdue > 0 && <div className="stat-trend warn">Verificar prazos</div>}
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-num">{myOpenTasksAll}</div>
            <div className="stat-label">Suas demandas</div>
          </div>
        )}
      </div>

      {/* Bento: atividade + panorama à esquerda, financeiro à direita */}
      <div className="card dash-activity">
        <div className="dash-activity-head">
          <h4 style={{ margin: 0 }}>{seesEverything ? 'Atividade da equipe' : 'Sua atividade'}</h4>
          <span className="dash-activity-sub">últimas 18 semanas</span>
        </div>
        <ActivityHeatmap actorId={seesEverything ? undefined : profile?.id} />
      </div>

      <div className="dash-bento">
        <div className="dash-col">
          <div className="dash-panorama">
            <div className="card">
              <h4 style={{ marginTop: 0 }}>Projetos por status</h4>
              <DonutChart
                centerLabel={String(projects.length)}
                centerSub="projetos"
                segments={STATUS_CHART.map((s) => ({
                  label: s.label,
                  value: projects.filter((p) => p.status === s.status).length,
                  color: s.color,
                }))}
              />
            </div>
            <div className="card">
              <h4 style={{ marginTop: 0 }}>Situação das demandas</h4>
              <DonutChart
                centerLabel={String(tasks.length)}
                centerSub="demandas"
                segments={[
                  { label: 'Concluídas', value: tasks.filter((t) => isTaskDone(t)).length, color: 'var(--cyan)' },
                  { label: 'Em aberto (no prazo)', value: Math.max(0, openTasks - overdueTasks), color: 'var(--navy)' },
                  { label: 'Atrasadas', value: overdueTasks, color: 'var(--red)' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="dash-col">
          {seesFinancial ? (
            <>
              {budget && budget.planned > 0 ? (
                <div className="card dash-verba">
                  <h4 style={{ marginTop: 0 }}>Verba de campanhas</h4>
                  <DonutChart
                    size={132}
                    centerLabel={`${Math.round((budget.spent / budget.planned) * 100)}%`}
                    centerSub="executado"
                    formatValue={formatBRL}
                    segments={[
                      { label: 'Executado', value: Math.round(budget.spent), color: 'var(--accent)' },
                      { label: 'Disponível', value: Math.max(0, Math.round(budget.planned - budget.spent)), color: 'var(--surface-3)' },
                    ]}
                  />
                  <div className="dash-verba-foot">
                    <span>Planejado</span>
                    <strong>{formatBRL(budget.planned)}</strong>
                  </div>
                </div>
              ) : (
                <div className="stat-card">
                  <div className="stat-num">{budget ? formatBRL(budget.spent) : '—'}</div>
                  <div className="stat-label">Verba executada</div>
                </div>
              )}
              <Link to="/relatorios" className="card dash-cta">
                <div>
                  <div style={{ fontWeight: 700 }}>Dashboard executivo</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>Relatório completo de Diretoria</div>
                </div>
                <span aria-hidden style={{ color: 'var(--accent)', fontWeight: 700 }}>→</span>
              </Link>
            </>
          ) : (
            <div className="banner soon" style={{ marginTop: 0 }}>
              <span className="ic">🔒</span>
              <span>Indicadores financeiros e dashboard executivo visíveis apenas para Diretoria.</span>
            </div>
          )}
        </div>
      </div>

      <div className="section-head">
        <h2>{seesEverything ? 'Projetos recentes' : 'Meus projetos'}</h2>
        <Link className="btn ghost" to="/projetos">
          Ver todos →
        </Link>
      </div>
      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : projects.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum projeto cadastrado ainda.{' '}
          <Link to="/projetos" style={{ color: 'var(--violet)' }}>
            Criar o primeiro
          </Link>
          .
        </div>
      ) : (
        <div className="project-grid">
          {projects.slice(0, 6).map((p) => (
            <ProjectCard key={p.id} project={p} brand={p.brand} percent={percentFor(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
