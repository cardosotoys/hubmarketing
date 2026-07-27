import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
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
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.user?.name ?? '—'}</td>
                <td>{r.project?.name ?? '—'}</td>
                <td>{r.summary}</td>
                <td className="mono">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--text-faint)' }}>
                  Nenhum relatório registrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
