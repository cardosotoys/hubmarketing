import { useEffect, useState, type FormEvent } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCampaignWorkspaceData } from '../../hooks/useCampaignWorkspaceData';
import { CampaignWorkspaceContext } from '../../context/CampaignWorkspaceContext';
import { logActivity } from '../../lib/activityLog';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../../components/Modal';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_PROGRESS_PHASES,
  PRIORITIES,
  type Brand,
  type Campaign,
  type CampaignStatus,
  type Priority,
} from '../../types/database';
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
  // BOM no início — sem isso o Excel abre acentos (é, ã, ç…) corrompidos ("arquivo vem ruim").
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demandas-${campaignName.toLowerCase().replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CampaignWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { campaign, brand, ownerName, taskStats, loading, error, reload } = useCampaignWorkspaceData(id);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

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
            <button className="btn ghost sm" onClick={() => setEditing(true)}>
              ✎ Editar
            </button>
            <button
              className="btn ghost sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? '✓ Link copiado!' : '🔗 Compartilhar'}
            </button>
            <button className="btn ghost sm" onClick={() => exportTasksCsv(campaign.id, campaign.name)}>
              ⬇ Exportar
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

      {editing && profile && (
        <CampaignEditModal
          campaign={campaign}
          actorId={profile.id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CampaignEditModal({
  campaign,
  actorId,
  onClose,
  onSaved,
}: {
  campaign: Campaign;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState(campaign.name);
  const [brandId, setBrandId] = useState(campaign.brand_id);
  const [category, setCategory] = useState(campaign.category);
  const [priority, setPriority] = useState<Priority>(campaign.priority);
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [startDate, setStartDate] = useState(campaign.start_date ?? '');
  const [endDate, setEndDate] = useState(campaign.end_date ?? '');
  const [tags, setTags] = useState(campaign.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('brands')
      .select('*')
      .then(({ data }) => setBrands((data as Brand[]) ?? []));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('campaigns')
      .update({
        name: name.trim(),
        brand_id: brandId,
        category,
        priority,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      .eq('id', campaign.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Campanha editada', campaignId: campaign.id });
    onSaved();
  }

  return (
    <Modal title="Editar campanha" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="ce-name">Nome</label>
          <input id="ce-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ce-brand">Marca</label>
            <select id="ce-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ce-category">Categoria</label>
            <input id="ce-category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ce-priority">Prioridade</label>
            <select id="ce-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ce-status">Status</label>
            <select id="ce-status" value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)}>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ce-start">Início</label>
            <input id="ce-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ce-end">Fim</label>
            <input id="ce-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="ce-tags">Tags (separadas por vírgula)</label>
          <input id="ce-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        {error && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
