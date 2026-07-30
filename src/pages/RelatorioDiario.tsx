import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Modal from '../components/Modal';
import type { DailyReport, Project } from '../types/database';

type ReportRow = DailyReport & {
  user: { name: string } | null;
  project: { name: string } | null;
};

export default function RelatorioDiario() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState<ReportRow | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    const [projectsRes, reportsRes] = await Promise.all([
      supabase.from('projects').select('*').order('name'),
      supabase
        .from('daily_reports')
        .select('*, user:profiles(name), project:projects(name)')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setProjects((projectsRes.data as Project[]) ?? []);
    setReports((reportsRes.data as ReportRow[]) ?? []);
    if (!projectId && projectsRes.data && projectsRes.data.length > 0) {
      setProjectId(projectsRes.data[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myReports = reports.filter((r) => r.user_id === profile?.id);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const daysThisMonth = new Set(
    myReports.filter((r) => new Date(r.report_date) >= startOfMonth).map((r) => r.report_date)
  ).size;
  const lastReport = myReports[0];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile || !summary.trim() || !projectId) return;
    setSaving(true);
    await supabase.from('daily_reports').insert({
      user_id: profile.id,
      project_id: projectId,
      summary: summary.trim(),
    });
    await logActivity({
      actorId: profile.id,
      actionText: 'Relatório diário registrado',
      detail: summary.trim().slice(0, 80),
      projectId,
    });
    setSummary('');
    setSaving(false);
    load();
  }

  async function handleDelete(reportId: string) {
    await supabase.from('daily_reports').delete().eq('id', reportId);
    setConfirmingDeleteId(null);
    load();
  }

  return (
    <div className="page">
      <h1 className="page-title">Relatório Diário</h1>
      <div className="page-sub">
        Cada pessoa registra, no fim do dia, o que fez e um resumo curto das tarefas executadas. Fica no
        histórico do projeto e alimenta os relatórios de equipe.
      </div>

      <div className="info-grid">
        <div>
          <div className="panel">
            <h4>
              Registrar hoje — <span className="mono">{today}</span>
            </h4>
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="rd-project">Projeto</label>
                <select id="rd-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="rd-summary">O que você fez hoje (resumo curto)</label>
                <textarea
                  id="rd-summary"
                  rows={3}
                  placeholder="Ex: fechei o brinde co-branded com a ABBLE2 e revisei a arte do scratch card."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
              <button className="btn" type="submit" disabled={saving || !projectId}>
                {saving ? 'Salvando…' : 'Salvar relatório do dia'}
              </button>
            </form>
          </div>
        </div>
        <div className="panel">
          <h4>Sua sequência</h4>
          <div className="field-row">
            <span className="k">Dias registrados (mês)</span>
            <span>{daysThisMonth}</span>
          </div>
          <div className="field-row">
            <span className="k">Último registro</span>
            <span className="mono">
              {lastReport ? new Date(lastReport.created_at).toLocaleString('pt-BR') : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>Histórico de relatórios da equipe</h2>
      </div>
      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <table className="simple">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Projeto</th>
              <th>Resumo</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const canManage = isPrivileged || r.user_id === profile?.id;
              return (
                <tr key={r.id}>
                  <td data-label="Pessoa">{r.user?.name ?? '—'}</td>
                  <td data-label="Projeto">{r.project?.name ?? '—'}</td>
                  <td data-label="Resumo">{r.summary}</td>
                  <td className="mono" data-label="Data">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td data-label="Ações">
                    {canManage &&
                      (confirmingDeleteId === r.id ? (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button className="btn ghost sm" onClick={() => setConfirmingDeleteId(null)}>
                            Cancelar
                          </button>
                          <button className="btn sm" style={{ background: 'var(--red)' }} onClick={() => handleDelete(r.id)}>
                            Confirmar
                          </button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button className="btn ghost sm" onClick={() => setEditingReport(r)}>
                            ✎
                          </button>
                          <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmingDeleteId(r.id)}>
                            ✕
                          </button>
                        </span>
                      ))}
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-faint)' }}>
                  Nenhum relatório registrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {editingReport && (
        <EditReportModal
          report={editingReport}
          projects={projects}
          onClose={() => setEditingReport(null)}
          onSaved={() => {
            setEditingReport(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditReportModal({
  report,
  projects,
  onClose,
  onSaved,
}: {
  report: ReportRow;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState(report.project_id ?? '');
  const [summary, setSummary] = useState(report.summary);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    setSaving(true);
    const { error: err } = await supabase
      .from('daily_reports')
      .update({ project_id: projectId || null, summary: summary.trim() })
      .eq('id', report.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  }

  return (
    <Modal title="Editar relatório" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="er-project">Projeto</label>
          <select id="er-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="er-summary">Resumo</label>
          <textarea id="er-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
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
