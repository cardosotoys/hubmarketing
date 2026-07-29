import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { CAMPAIGN_STATUSES, type CampaignStatus, type ProjectStage, type ProjectStatus } from '../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planejamento',
  active: 'Ativo',
  paused: 'Atenção',
  done: 'Concluído',
};

export default function Relatorios() {
  const { profile } = useAuth();
  const seesFinancial = profile?.role === 'diretoria';
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<{ status: ProjectStatus; end_date: string | null }[]>([]);
  const [tasks, setTasks] = useState<{ stage_id: string }[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [auditItems, setAuditItems] = useState<{ correction_status: string; risk_flag: string }[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [socialPosts, setSocialPosts] = useState<{ status: string; brand: { label: string } | null }[]>([]);
  const [dailyReports, setDailyReports] = useState<{ user: { name: string } | null; report_date: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: CampaignStatus; brand: { label: string } | null }[]>([]);
  const [budgetItems, setBudgetItems] = useState<{ campaign_id: string; planned_amount: number; spent_amount: number }[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [projectsRes, tasksRes, stagesRes, auditRes, productsRes, postsRes, reportsRes, campaignsRes, budgetRes] = await Promise.all([
        supabase.from('projects').select('status, end_date'),
        supabase.from('tasks').select('stage_id'),
        supabase.from('stages').select('*'),
        supabase.from('audit_items').select('correction_status, risk_flag'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('social_posts').select('*, brand:brands(label)'),
        supabase.from('daily_reports').select('*, user:profiles(name)').gte('report_date', monthStartStr),
        supabase.from('campaigns').select('*, brand:brands(label)'),
        supabase.from('campaign_budget_items').select('campaign_id, planned_amount, spent_amount'),
      ]);

      setProjects((projectsRes.data as { status: ProjectStatus; end_date: string | null }[]) ?? []);
      setTasks((tasksRes.data as { stage_id: string }[]) ?? []);
      setStages((stagesRes.data as ProjectStage[]) ?? []);
      setAuditItems((auditRes.data as { correction_status: string; risk_flag: string }[]) ?? []);
      setProductsCount(productsRes.count ?? 0);
      setSocialPosts((postsRes.data as { status: string; brand: { label: string } | null }[]) ?? []);
      setDailyReports((reportsRes.data as { user: { name: string } | null; report_date: string }[]) ?? []);
      setCampaigns((campaignsRes.data as { id: string; name: string; status: CampaignStatus; brand: { label: string } | null }[]) ?? []);
      setBudgetItems((budgetRes.data as { campaign_id: string; planned_amount: number; spent_amount: number }[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">Relatórios</h1>
        <div className="page-sub">Carregando…</div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdueProjects = projects.filter((p) => p.end_date && p.end_date < today && p.status !== 'done').length;
  const projectsByStatus = (['planning', 'active', 'paused', 'done'] as ProjectStatus[]).map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }));

  const stagesById = Object.fromEntries(stages.map((s) => [s.id, s]));
  const tasksByStage = Object.entries(
    tasks.reduce<Record<string, number>>((acc, t) => {
      const name = stagesById[t.stage_id]?.name ?? '—';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => ({ key: label, label, count }));
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => stagesById[t.stage_id]?.is_final).length;
  const taskCompletionPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const auditFlagged = auditItems.length;
  const auditCorrigidos = auditItems.filter((a) => a.correction_status === 'Corrigido').length;
  const auditAlerts = auditItems.filter((a) => a.risk_flag).length;
  const auditPct = auditFlagged ? Math.round((auditCorrigidos / auditFlagged) * 100) : 0;

  const postsByStatus = ['Pendente', 'Aprovado', 'Alterações solicitadas'].map((s) => ({
    status: s,
    count: socialPosts.filter((p) => p.status === s).length,
  }));

  const reportsByPerson = Object.entries(
    dailyReports.reduce<Record<string, number>>((acc, r) => {
      const name = r.user?.name ?? 'Sem nome';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const campaignsByStatus = CAMPAIGN_STATUSES.map((s) => ({
    status: s.key,
    label: s.label,
    count: campaigns.filter((c) => c.status === s.key).length,
  }));

  const totalPlanned = budgetItems.reduce((s, b) => s + Number(b.planned_amount), 0);
  const totalSpent = budgetItems.reduce((s, b) => s + Number(b.spent_amount), 0);
  const budgetByCampaign = campaigns
    .map((c) => {
      const items = budgetItems.filter((b) => b.campaign_id === c.id);
      const planned = items.reduce((s, b) => s + Number(b.planned_amount), 0);
      const spent = items.reduce((s, b) => s + Number(b.spent_amount), 0);
      return { ...c, planned, spent };
    })
    .filter((c) => c.planned > 0 || c.spent > 0);

  return (
    <div className="page">
      <h1 className="page-title">Relatórios</h1>
      <div className="page-sub">Panorama completo, calculado a partir dos dados reais do Hub.</div>

      <div className="section-head">
        <h2>Projetos</h2>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{projects.length}</div>
          <div className="stat-label">Projetos no total</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{overdueProjects}</div>
          <div className="stat-label">Projetos atrasados</div>
          {overdueProjects > 0 && <div className="stat-trend warn">Verificar prazos</div>}
        </div>
        <div className="stat-card">
          <div className="stat-num">{taskCompletionPct}%</div>
          <div className="stat-label">Demandas concluídas</div>
          <div className="stat-trend up">
            {doneTasks}/{totalTasks}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{productsCount}</div>
          <div className="stat-label">Produtos no catálogo</div>
        </div>
      </div>
      <div className="grid4" style={{ marginTop: 12 }}>
        {projectsByStatus.map((p) => (
          <div className="card" key={p.status}>
            <h4>{PROJECT_STATUS_LABELS[p.status]}</h4>
            <p>{p.count} projetos</p>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Demandas por estágio</h2>
      </div>
      <div className="board cols4" style={{ gridTemplateColumns: `repeat(${Math.max(tasksByStage.length, 1)}, 1fr)` }}>
        {tasksByStage.map((s) => (
          <div className="card" key={s.key}>
            <h4>{s.label}</h4>
            <p>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Auditoria de Mídias</h2>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{auditFlagged}</div>
          <div className="stat-label">Itens sinalizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{auditCorrigidos}</div>
          <div className="stat-label">Corrigidos</div>
          <div className="stat-trend up">{auditPct}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{auditAlerts}</div>
          <div className="stat-label">Alertas ativos</div>
          {auditAlerts > 0 && <div className="stat-trend warn">🔴 Verificar</div>}
        </div>
      </div>

      <div className="section-head">
        <h2>Redes Sociais</h2>
      </div>
      <div className="grid3">
        {postsByStatus.map((p) => (
          <div className="card" key={p.status}>
            <h4>{p.status}</h4>
            <p>{p.count} peças</p>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Relatório Diário — mês atual</h2>
      </div>
      {reportsByPerson.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum relatório diário registrado neste mês ainda.
        </div>
      ) : (
        <table className="simple">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Registros no mês</th>
            </tr>
          </thead>
          <tbody>
            {reportsByPerson.map(([name, count]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="section-head">
        <h2>Campanhas</h2>
      </div>
      <div className="grid4">
        {campaignsByStatus.map((c) => (
          <div className="card" key={c.status}>
            <h4>{c.label}</h4>
            <p>{c.count} campanhas</p>
          </div>
        ))}
      </div>

      {seesFinancial ? (
        <>
          <div className="section-head">
            <h2>Verba — visão financeira</h2>
            <span className="pill">Diretoria</span>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-num">{formatBRL(totalPlanned)}</div>
              <div className="stat-label">Verba planejada (todas as campanhas)</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{formatBRL(totalSpent)}</div>
              <div className="stat-label">Verba executada</div>
              <div className={`stat-trend ${totalPlanned && totalSpent > totalPlanned ? 'warn' : 'up'}`}>
                {totalPlanned ? Math.round((totalSpent / totalPlanned) * 100) : 0}% do planejado
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{formatBRL(totalPlanned - totalSpent)}</div>
              <div className="stat-label">Saldo</div>
            </div>
          </div>
          {budgetByCampaign.length > 0 && (
            <table className="simple" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Marca</th>
                  <th>Planejado</th>
                  <th>Executado</th>
                  <th>% executado</th>
                </tr>
              </thead>
              <tbody>
                {budgetByCampaign.map((c) => {
                  const pct = c.planned ? Math.round((c.spent / c.planned) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.brand?.label ?? '—'}</td>
                      <td className="mono">{formatBRL(c.planned)}</td>
                      <td className="mono">{formatBRL(c.spent)}</td>
                      <td>
                        <span className="status-dot" style={{ background: pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--yellow)' : 'var(--green)' }}></span>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <div className="banner soon">
          <span className="ic">🔒</span>
          <span>Indicadores de verba/financeiro visíveis apenas para Diretoria.</span>
        </div>
      )}
    </div>
  );
}
