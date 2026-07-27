import { useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useCampaignWorkspaceData } from '../../hooks/useCampaignWorkspaceData';
import { CampaignWorkspaceContext } from '../../context/CampaignWorkspaceContext';
import { supabase } from '../../lib/supabaseClient';
import { CAMPAIGN_STATUSES, CAMPAIGN_PROGRESS_PHASES, type CampaignStatus } from '../../types/database';
import CampaignSidebar from './CampaignSidebar';

const STATUS_COLOR: Record<CampaignStatus, string> = {
  planejamento: 'var(--violet)',
  producao: 'var(--blue)',
  aprovacao: 'var(--yellow)',
  execucao: 'var(--green)',
  finalizacao: 'var(--yellow)',
  concluida: 'var(--text-faint)',
  cancelada: 'var(--red)',
};

const PRIORITY_LABELS: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };

function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate + 'T00:00').getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(diff / 86400000);
}

async function exportTasksCsv(campaignId: string, campaignName: string) {
  const { data } = await supabase
    .from('campaign_tasks')
    .select('*, assignee:profiles!campaign_tasks_assignee_id_fkey(name)')
    .eq('campaign_id', campaignId)
    .order('position');
  const rows = (data as { title: string; stage: string; priority: string; start_date: string | null; due_date: string | null; assignee: { name: string } | null }[]) ?? [];
  const header = ['Título', 'Estágio', 'Prioridade', 'Início', 'Prazo', 'Responsável'];
  const csv = [header, ...rows.map((r) => [r.title, r.stage, r.priority, r.start_date ?? '', r.due_date ?? '', r.assignee?.name ?? ''])]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demandas-${campaignName.toLowerCase().replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CampaignWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { campaign, brand, ownerName, taskStats, loading, error, reload } = useCampaignWorkspaceData(id);
  const [copied, setCopied] = useState(false);

  if (loading && !campaign) {
    return <div className="page-sub">Carregando campanha…</div>;
  }
  if (error || !campaign) {
    return (
      <div className="banner error">
        <span className="ic">⚠</span>
        <span>Não foi possível carregar a campanha{error ? `: ${error}` : '.'}</span>
      </div>
    );
  }

  const left = daysLeft(campaign.end_date);
  const percent = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;
  const phaseIndex = CAMPAIGN_PROGRESS_PHASES.indexOf(campaign.status);
  const statusLabel = CAMPAIGN_STATUSES.find((s) => s.key === campaign.status)?.label ?? campaign.status;

  return (
    <div className="page">
      <div className="workspace-header">
        <div className="workspace-header-top">
          <div>
            <div className="workspace-title-row">
              <h1 className="page-title" style={{ margin: 0 }}>
                {campaign.name}
              </h1>
              <span className="tag" style={{ background: 'var(--surface-2)', color: STATUS_COLOR[campaign.status] }}>
                {statusLabel}
              </span>
              {brand && (
                <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
                  <span style={{ color: brand.color }}>●</span> {brand.label}
                </span>
              )}
              <span className={`prio ${campaign.priority}`}>{PRIORITY_LABELS[campaign.priority]}</span>
            </div>
            <div className="workspace-meta-row">
              <span>
                <span className="k">Categoria</span> {campaign.category || '—'}
              </span>
              <span>
                <span className="k">Responsável</span> {ownerName ?? '—'}
              </span>
              <span>
                <span className="k">Período</span>{' '}
                {campaign.start_date ? new Date(campaign.start_date + 'T00:00').toLocaleDateString('pt-BR') : '—'} →{' '}
                {campaign.end_date ? new Date(campaign.end_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}
              </span>
              <span>
                <span className="k">Dias restantes</span>{' '}
                {left === null ? '—' : left < 0 ? <span style={{ color: 'var(--red)' }}>{Math.abs(left)}d atrasada</span> : `${left}d`}
              </span>
              <span>
                <span className="k">Concluído</span> {taskStats.total > 0 ? `${percent}%` : '—'}
              </span>
              {campaign.tags.length > 0 && (
                <span>
                  <span className="k">Tags</span> {campaign.tags.join(', ')}
                </span>
              )}
            </div>
          </div>
          <div className="workspace-actions">
            <Link to="planejamento" className="btn ghost sm">
              Editar
            </Link>
            <button
              className="btn ghost sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Link copiado!' : 'Compartilhar'}
            </button>
            <button className="btn ghost sm" onClick={() => exportTasksCsv(campaign.id, campaign.name)}>
              Exportar
            </button>
          </div>
        </div>
        <div className="progress-phases">
          {CAMPAIGN_PROGRESS_PHASES.map((phase, i) => (
            <i key={phase} className={i < phaseIndex ? 'done' : i === phaseIndex ? 'current' : ''} title={phase} />
          ))}
        </div>
      </div>

      <div className="workspace-shell">
        <CampaignSidebar />
        <div className="workspace-main">
          <CampaignWorkspaceContext.Provider value={{ campaign, brand, ownerName, taskStats, reload }}>
            <Outlet />
          </CampaignWorkspaceContext.Provider>
        </div>
      </div>
    </div>
  );
}
