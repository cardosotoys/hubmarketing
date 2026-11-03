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
  { status: 'active', label: 'Em execução', color: '#4cbdc7' },
  { status: 'planning', label: 'Planejamento', color: '#0a2530' },
  { status: 'paused', label: 'Atenção', color: '#E9A23B' },
  { status: 'done', label: 'Finalizado', color: '#C9CFD3' },
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

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page dash2">
      {/* faixa Azul Universo: saudação, ações rápidas e os números que decidem o dia */}
      <header className="dh-hero">
        <div className="dh-hero-top">
          <div>
            <small>{hoje.charAt(0).toUpperCase() + hoje.slice(1)}</small>
            <h1>{greeting}, {firstName}</h1>
            <p>
              {seesEverything ? 'Visão consolidada de Cardoso, Playmi e Tópi.' : 'Seus projetos e demandas, só o que você participa.'}
              {workspace !== 'todos' && ` · Workspace: ${WS_LABELS[workspace] ?? workspace}`}
            </p>
          </div>
          <div className="dh-acts">
            <Link to="/demandas" className="dh-act">Minhas demandas{myOpenTasksAll > 0 && <b>{myOpenTasksAll}</b>}</Link>
            <Link to="/calendario" className="dh-act ghost">Calendário</Link>
          </div>
        </div>
        <div className="dh-kpis">
          <Link to="/projetos" className="dh-kpi"><b>{activeProjects}</b><span>projetos ativos</span><em>de {projects.length} no total</em></Link>
          <Link to="/demandas" className="dh-kpi"><b>{openTasksAll}</b><span>demandas abertas</span><em>{myOpenTasksAll > 0 ? `${myOpenTasksAll} com você` : 'nenhuma com você'}</em></Link>
          <Link to="/demandas" className={`dh-kpi ${overdueTasksAll > 0 ? 'late' : ''}`}><b>{overdueTasksAll}</b><span>demandas atrasadas</span><em>{myOverdueTasksAll > 0 ? `${myOverdueTasksAll} são suas` : 'nenhuma sua'}</em></Link>
          {seesFinancial ? (
            <Link to="/projetos" className={`dh-kpi ${overdue > 0 ? 'warn' : ''}`}><b>{overdue}</b><span>projetos atrasados</span><em>{overdue > 0 ? 'verificar prazos' : 'tudo no prazo'}</em></Link>
          ) : (
            <Link to="/demandas" className="dh-kpi"><b>{myOpenTasksAll}</b><span>suas demandas</span><em>abertas agora</em></Link>
          )}
        </div>
      </header>

      {error && (
        <div className="banner error">
          <span className="ic">⚠</span>
          <span>Não foi possível carregar os dados: {error}</span>
        </div>
      )}

      <div className="dh-grid">
        <section className="dh-card dh-activity">
          <header><h2>{seesEverything ? 'Atividade da equipe' : 'Sua atividade'}</h2><span>últimas 30 semanas · clique num dia para ver o número</span></header>
          <ActivityHeatmap actorId={seesEverything ? undefined : profile?.id} />
        </section>

        <section className="dh-card">
          <header><h2>Situação das demandas</h2><span>projetos e avulsas</span></header>
          <DonutChart
            centerLabel={String(tasks.length)}
            centerSub="demandas"
            segments={[
              { label: 'Concluídas', value: tasks.filter((t) => isTaskDone(t)).length, color: '#4cbdc7' },
              { label: 'Em aberto, no prazo', value: Math.max(0, openTasks - overdueTasks), color: '#0a2530' },
              { label: 'Atrasadas', value: overdueTasks, color: '#da3a2f' },
            ]}
          />
        </section>

        <section className="dh-card">
          <header><h2>Projetos por status</h2></header>
          <DonutChart
            centerLabel={String(projects.length)}
            centerSub="projetos"
            segments={STATUS_CHART.map((s) => ({ label: s.label, value: projects.filter((p) => p.status === s.status).length, color: s.color }))}
          />
        </section>

        {seesFinancial ? (
          <section className="dh-card dh-money">
            <header><h2>Verba de campanhas</h2>{budget && budget.planned > 0 && <span>planejado {formatBRL(budget.planned)}</span>}</header>
            {budget && budget.planned > 0 ? (
              <>
                <div className="dh-money-n">
                  <b>{formatBRL(budget.spent)}</b>
                  <span>executado · {Math.round((budget.spent / budget.planned) * 100)}%</span>
                </div>
                <div className="dh-bar" aria-hidden><i style={{ width: `${Math.min(100, Math.round((budget.spent / budget.planned) * 100))}%` }} /></div>
                <div className="dh-money-f"><span>Disponível</span><b>{formatBRL(Math.max(0, budget.planned - budget.spent))}</b></div>
              </>
            ) : <div className="dh-money-n"><b>{budget ? formatBRL(budget.spent) : '—'}</b><span>verba executada</span></div>}
            <Link to="/relatorios" className="dh-exec">Dashboard executivo<span>relatório completo da Diretoria →</span></Link>
          </section>
        ) : (
          <section className="dh-card dh-money">
            <header><h2>Financeiro</h2></header>
            <p className="dh-note">Verba e dashboard executivo ficam visíveis só para a Diretoria.</p>
          </section>
        )}
      </div>

      <div className="dh-sec-h">
        <h2>{seesEverything ? 'Projetos recentes' : 'Meus projetos'}</h2>
        <Link to="/projetos">Ver todos →</Link>
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
        <div className="project-grid dh-projects">
          {projects.slice(0, 6).map((p) => (
            <ProjectCard key={p.id} project={p} brand={p.brand} percent={percentFor(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
