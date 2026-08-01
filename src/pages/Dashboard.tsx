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
  const { projects, tasks, isTaskDone, loading, error, percentFor } = useProjectsOverview();
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

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>
      <div className="page-sub">
        {seesEverything ? 'Visão consolidada de Cardoso, Playmi e Tópi.' : 'Seus projetos e demandas — só o que você participa.'}
      </div>

      {error && (
        <div className="banner error">
          <span className="ic">⚠</span>
          <span>Não foi possível carregar os dados: {error}</span>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{activeProjects}</div>
          <div className="stat-label">Projetos ativos</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{openTasks}</div>
          <div className="stat-label">Demandas abertas</div>
          {myOpenTasks > 0 && <div className="stat-trend">{myOpenTasks} atribuídas a você</div>}
        </div>
        <div className="stat-card">
          <div className="stat-num">{projects.length}</div>
          <div className="stat-label">Projetos no total</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: overdueTasks > 0 ? 'var(--red)' : undefined }}>
            {overdueTasks}
          </div>
          <div className="stat-label">Demandas atrasadas</div>
          {myOverdueTasks > 0 && <div className="stat-trend warn">{myOverdueTasks} suas</div>}
          <Link to="/demandas" style={{ fontSize: 11, color: 'var(--violet)' }}>
            Ver demandas →
          </Link>
        </div>
      </div>

      {seesFinancial ? (
        <>
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat-card">
              <div className="stat-num">{overdue}</div>
              <div className="stat-label">Projetos atrasados</div>
              {overdue > 0 && <div className="stat-trend warn">Verificar prazos</div>}
            </div>
            <div className="stat-card">
              <div className="stat-num">{budget ? formatBRL(budget.spent) : '—'}</div>
              <div className="stat-label">Verba executada (campanhas)</div>
              {budget && budget.planned > 0 && (
                <div className={`stat-trend ${budget.spent > budget.planned ? 'warn' : 'up'}`}>
                  {Math.round((budget.spent / budget.planned) * 100)}% de {formatBRL(budget.planned)}
                </div>
              )}
            </div>
          </div>
          {budget && budget.planned > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <h4 style={{ marginTop: 0 }}>Verba de campanhas</h4>
              <DonutChart
                centerLabel={`${Math.round((budget.spent / budget.planned) * 100)}%`}
                centerSub="executado"
                segments={[
                  { label: 'Executado', value: Math.round(budget.spent), color: 'var(--green)' },
                  { label: 'Disponível', value: Math.max(0, Math.round(budget.planned - budget.spent)), color: 'var(--surface-3)' },
                ]}
              />
            </div>
          )}
          <div className="banner" style={{ marginTop: 14 }}>
            <span className="ic">◆</span>
            <span>
              Dashboard executivo — visível apenas para Diretoria.{' '}
              <Link to="/relatorios" style={{ color: 'var(--violet)' }}>
                Ver relatório completo →
              </Link>
            </span>
          </div>
        </>
      ) : (
        <div className="banner soon" style={{ marginTop: 0 }}>
          <span className="ic">🔒</span>
          <span>Indicadores financeiros e dashboard executivo visíveis apenas para Diretoria.</span>
        </div>
      )}

      <div className="section-head">
        <h2>{seesEverything ? 'Atividade da equipe' : 'Sua atividade'}</h2>
      </div>
      <div className="card">
        <ActivityHeatmap actorId={seesEverything ? undefined : profile?.id} />
      </div>

      <div className="section-head">
        <h2>Panorama</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
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
              { label: 'Concluídas', value: tasks.filter((t) => isTaskDone(t)).length, color: 'var(--green)' },
              { label: 'Em aberto (no prazo)', value: Math.max(0, openTasks - overdueTasks), color: 'var(--violet)' },
              { label: 'Atrasadas', value: overdueTasks, color: 'var(--red)' },
            ]}
          />
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
