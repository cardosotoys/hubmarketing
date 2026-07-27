import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { CAMPAIGN_TASK_STAGES, type CampaignBudgetItem, type CampaignMediaInvestment, type CampaignTask } from '../../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProductLink {
  product: { id: string; name: string; line: string; licensed: boolean } | null;
}

interface ActivityRow {
  id: string;
  action_text: string;
  detail: string;
  created_at: string;
  actor: { name: string } | null;
}

export default function CampaignResumo() {
  const { campaign, taskStats } = useCampaignWorkspace();
  const [tasks, setTasks] = useState<CampaignTask[]>([]);
  const [budget, setBudget] = useState<CampaignBudgetItem[]>([]);
  const [products, setProducts] = useState<ProductLink[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [media, setMedia] = useState<CampaignMediaInvestment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.from('campaign_tasks').select('*').eq('campaign_id', campaign.id).order('due_date'),
      supabase.from('campaign_budget_items').select('*').eq('campaign_id', campaign.id),
      supabase.from('campaign_products').select('*, product:products(*)').eq('campaign_id', campaign.id),
      supabase
        .from('activity_log')
        .select('*, actor:profiles(name)')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase.from('campaign_media_investments').select('*').eq('campaign_id', campaign.id),
    ]).then(([tasksRes, budgetRes, productsRes, activityRes, mediaRes]) => {
      if (cancelled) return;
      setTasks((tasksRes.data as CampaignTask[]) ?? []);
      setBudget((budgetRes.data as CampaignBudgetItem[]) ?? []);
      setProducts((productsRes.data as ProductLink[]) ?? []);
      setActivity((activityRes.data as ActivityRow[]) ?? []);
      setMedia((mediaRes.data as CampaignMediaInvestment[]) ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.stage !== 'concluida' && t.stage !== 'cancelada').length;
  const critical = tasks.filter((t) => t.priority === 'urgent' && t.stage !== 'concluida' && t.stage !== 'cancelada').length;
  const inProgress = tasks.filter((t) => !['backlog', 'concluida', 'cancelada'].includes(t.stage)).length;
  const pendingApproval = tasks.filter((t) => t.stage === 'aguardando_aprovacao').length;

  const totalPlanned = budget.reduce((s, b) => s + Number(b.planned_amount), 0);
  const totalSpent = budget.reduce((s, b) => s + Number(b.spent_amount), 0);
  const budgetPct = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0;

  const linkedProducts = products.map((p) => p.product).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const licensedCount = linkedProducts.filter((p) => p.licensed).length;
  const distinctLines = new Set(linkedProducts.map((p) => p.line)).size;

  const stageCounts = CAMPAIGN_TASK_STAGES.map((s) => ({ ...s, count: tasks.filter((t) => t.stage === s.key).length }));
  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count));

  const milestones = tasks
    .filter((t) => t.is_milestone && t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const totalImpressions = media.reduce((s, m) => s + Number(m.impressions), 0);
  const totalClicks = media.reduce((s, m) => s + Number(m.clicks), 0);
  const totalMediaSpent = media.reduce((s, m) => s + Number(m.spent_amount), 0);
  const totalRevenue = media.reduce((s, m) => s + Number(m.revenue), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : null;
  const roas = totalMediaSpent > 0 ? (totalRevenue / totalMediaSpent).toFixed(2) : null;

  if (loading) return <div className="page-sub">Carregando resumo…</div>;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{taskStats.total > 0 ? `${Math.round((taskStats.done / taskStats.total) * 100)}%` : '—'}</div>
          <div className="stat-label">Progresso geral</div>
          <div className="stat-trend">{taskStats.done}/{taskStats.total} demandas concluídas</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{formatBRL(totalSpent)}</div>
          <div className="stat-label">Verba executada</div>
          {totalPlanned > 0 && (
            <div className={`stat-trend ${totalSpent > totalPlanned ? 'warn' : 'up'}`}>{budgetPct}% de {formatBRL(totalPlanned)}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-num">{tasks.length}</div>
          <div className="stat-label">Demandas</div>
          <div className="stat-trend">
            {inProgress} em andamento{overdue > 0 && <span className="warn"> · {overdue} atrasadas</span>}
            {critical > 0 && <span className="warn"> · {critical} críticas</span>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{linkedProducts.length}</div>
          <div className="stat-label">Produtos vinculados</div>
          <div className="stat-trend">{licensedCount} licenciados · {distinctLines} linhas</div>
        </div>
      </div>

      {milestones.length > 0 && (
        <>
          <div className="section-head">
            <h2>Linha do tempo</h2>
          </div>
          <div className="panel">
            {milestones.map((m) => {
              const isPast = new Date(m.due_date!) < new Date();
              return (
                <div className="field-row" key={m.id}>
                  <span className="k">{new Date(m.due_date! + 'T00:00').toLocaleDateString('pt-BR')}</span>
                  <span style={{ color: isPast ? 'var(--text-faint)' : 'var(--text)' }}>{m.title}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="section-head">
        <h2>Demandas por estágio</h2>
      </div>
      <div className="panel">
        {stageCounts.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ width: 140, fontSize: 11.5, color: 'var(--text-faint)' }}>{s.label}</span>
            <div className="bar" style={{ flex: 1 }}>
              <i style={{ width: `${(s.count / maxStageCount) * 100}%` }} />
            </div>
            <span style={{ width: 20, fontSize: 11.5, textAlign: 'right' }}>{s.count}</span>
          </div>
        ))}
      </div>

      <div className="grid3">
        <div className="card">
          <h4>Financeiro</h4>
          <p>Previsto: {formatBRL(totalPlanned)}</p>
          <p>Executado: {formatBRL(totalSpent)}</p>
          <div className="bar" style={{ marginTop: 8 }}>
            <i style={{ width: `${Math.min(100, budgetPct)}%`, background: totalSpent > totalPlanned ? 'var(--red)' : 'var(--accent)' }} />
          </div>
        </div>
        <div className="card">
          <h4>Aprovações pendentes</h4>
          <p>{pendingApproval} demanda(s) aguardando aprovação</p>
          <Link to="../aprovacoes" className="btn ghost sm" style={{ marginTop: 6 }}>
            Ver fila →
          </Link>
        </div>
        <div className="card">
          <h4>Performance de mídia</h4>
          {media.length === 0 ? (
            <p style={{ color: 'var(--text-faint)' }}>
              Nenhum investimento lançado em Mídia Paga ainda — sem dado real, nenhum número é inventado aqui.
            </p>
          ) : (
            <>
              <p>Investido: {formatBRL(totalMediaSpent)}</p>
              <p>Impressões: {totalImpressions.toLocaleString('pt-BR')} · Cliques: {totalClicks.toLocaleString('pt-BR')}</p>
              <p>CTR: {ctr ?? '—'}{ctr && '%'} · ROAS: {roas ?? '—'}{roas && 'x'}</p>
            </>
          )}
        </div>
      </div>

      <div className="section-head">
        <h2>Atividade recente</h2>
      </div>
      {activity.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma atividade registrada ainda nesta campanha.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {activity.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.action_text}
                  {a.detail && <span style={{ color: 'var(--text-faint)' }}> — {a.detail}</span>}
                </td>
                <td style={{ color: 'var(--text-faint)' }}>{a.actor?.name ?? '—'}</td>
                <td style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {new Date(a.created_at).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
