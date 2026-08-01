import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  CAMPAIGN_STATUSES,
  type CampaignStatus,
  type Priority,
  type Profile,
  type ProjectStage,
  type ProjectStatus,
} from '../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function csvEscape(v: string | number) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.map(csvEscape).join(';'), ...rows.map((r) => r.map(csvEscape).join(';'))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButtons({ onExportCSV }: { onExportCSV: () => void }) {
  return (
    <div className="no-print" style={{ display: 'flex', gap: 8 }}>
      <button className="btn ghost sm" onClick={onExportCSV}>
        ⬇ Exportar CSV
      </button>
      <button className="btn ghost sm" onClick={() => window.print()}>
        ⎙ Exportar PDF
      </button>
    </div>
  );
}

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planejamento',
  active: 'Ativo',
  paused: 'Atenção',
  done: 'Concluído',
};

type ReportTab = 'projetos' | 'demandas' | 'auditoria' | 'redes-sociais' | 'diario' | 'campanhas' | 'financeiro';

interface ProjectRow {
  id: string;
  name: string;
  status: ProjectStatus;
  end_date: string | null;
  brand: { label: string } | null;
}
interface TaskRow {
  id: string;
  title: string;
  project_id: string | null;
  stage_id: string;
  priority: Priority;
  assignee_id: string | null;
  due_date: string | null;
}
interface AuditRow {
  id: string;
  correction_status: string;
  risk_flag: string;
  item_to_change: string;
  change_needed: string;
  responsible: string;
  product: { code: string; name: string; brand: { label: string } | null } | null;
  project: { name: string } | null;
}

export default function Relatorios() {
  const { profile } = useAuth();
  const seesFinancial = profile?.role === 'diretoria';
  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ReportTab>('projetos');
  const [projStatusFilter, setProjStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [projBrandFilter, setProjBrandFilter] = useState('all');
  const [taskProjectFilter, setTaskProjectFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | Priority>('all');
  const [campStatusFilter, setCampStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [campBrandFilter, setCampBrandFilter] = useState('all');

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [auditItems, setAuditItems] = useState<AuditRow[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [socialPosts, setSocialPosts] = useState<{ status: string; caption: string; suggested_date: string | null; brand: { label: string } | null }[]>([]);
  const [dailyReports, setDailyReports] = useState<{ user: { name: string } | null; report_date: string; summary: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: CampaignStatus; brand: { label: string } | null }[]>([]);
  const [budgetItems, setBudgetItems] = useState<{ campaign_id: string; planned_amount: number; spent_amount: number }[]>([]);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      let dailyQuery = supabase
        .from('daily_reports')
        .select('*, user:profiles(name)')
        .gte('report_date', monthStartStr);
      if (!isPrivileged) dailyQuery = dailyQuery.eq('user_id', profile.id);

      const [projectsRes, tasksRes, profilesRes, stagesRes, auditRes, productsRes, postsRes, reportsRes, campaignsRes, budgetRes] =
        await Promise.all([
          supabase.from('projects').select('id, name, status, end_date, brand:brands(label)'),
          supabase.from('tasks').select('id, title, project_id, stage_id, priority, assignee_id, due_date').is('packaging_track', null),
          supabase.from('profiles').select('*'),
          supabase.from('stages').select('*'),
          supabase.from('audit_items').select('*, product:products(code, name, brand:brands(label)), project:projects(name)'),
          supabase.from('products').select('id', { count: 'exact', head: true }),
          supabase.from('social_posts').select('status, caption, suggested_date, brand:brands(label)'),
          dailyQuery,
          supabase.from('campaigns').select('id, name, status, brand:brands(label)'),
          supabase.from('campaign_budget_items').select('campaign_id, planned_amount, spent_amount'),
        ]);

      setProjects((projectsRes.data as unknown as ProjectRow[]) ?? []);
      setTasks((tasksRes.data as TaskRow[]) ?? []);
      setProfiles((profilesRes.data as Profile[]) ?? []);
      setStages((stagesRes.data as ProjectStage[]) ?? []);
      setAuditItems((auditRes.data as unknown as AuditRow[]) ?? []);
      setProductsCount(productsRes.count ?? 0);
      setSocialPosts((postsRes.data as unknown as typeof socialPosts) ?? []);
      setDailyReports((reportsRes.data as unknown as typeof dailyReports) ?? []);
      setCampaigns((campaignsRes.data as unknown as typeof campaigns) ?? []);
      setBudgetItems((budgetRes.data as { campaign_id: string; planned_amount: number; spent_amount: number }[]) ?? []);
      setLoading(false);
    }
    load();
  }, [profile, isPrivileged]);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">Relatórios</h1>
        <div className="page-sub">Carregando…</div>
      </div>
    );
  }

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const stagesById = Object.fromEntries(stages.map((s) => [s.id, s]));
  const today = new Date().toISOString().slice(0, 10);

  const projectBrands = Array.from(new Set(projects.map((p) => p.brand?.label).filter((b): b is string => Boolean(b)))).sort();
  const filteredProjects = projects.filter((p) => {
    if (projStatusFilter !== 'all' && p.status !== projStatusFilter) return false;
    if (projBrandFilter !== 'all' && p.brand?.label !== projBrandFilter) return false;
    return true;
  });

  const filteredTasks = tasks.filter((t) => {
    if (taskProjectFilter !== 'all') {
      if (taskProjectFilter === 'none' && t.project_id) return false;
      if (taskProjectFilter !== 'none' && t.project_id !== taskProjectFilter) return false;
    }
    if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
    return true;
  });

  const campaignBrands = Array.from(new Set(campaigns.map((c) => c.brand?.label).filter((b): b is string => Boolean(b)))).sort();
  const filteredCampaigns = campaigns.filter((c) => {
    if (campStatusFilter !== 'all' && c.status !== campStatusFilter) return false;
    if (campBrandFilter !== 'all' && c.brand?.label !== campBrandFilter) return false;
    return true;
  });

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'projetos', label: 'Projetos' },
    { key: 'demandas', label: 'Demandas' },
    { key: 'auditoria', label: 'Auditoria de Mídias' },
    { key: 'redes-sociais', label: 'Redes Sociais' },
    { key: 'diario', label: 'Relatório Diário' },
    { key: 'campanhas', label: 'Campanhas' },
    ...(seesFinancial ? [{ key: 'financeiro' as ReportTab, label: 'Financeiro' }] : []),
  ];

  const TAB_INFO: Record<ReportTab, string> = {
    projetos: isPrivileged
      ? 'Todos os projetos do Hub, com status e prazo.'
      : 'Os projetos em que você participa, com status e prazo.',
    demandas: isPrivileged
      ? 'Todas as demandas do Hub, agrupadas por estágio.'
      : 'As demandas dos projetos em que você participa (mais suas demandas avulsas), agrupadas por estágio.',
    auditoria: isPrivileged
      ? 'Pendências de auditoria de mídias em todos os projetos.'
      : 'Pendências de auditoria de mídias nos projetos em que você participa.',
    'redes-sociais': 'Peças de redes sociais por status de aprovação.',
    diario: isPrivileged ? 'Registros de relatório diário do time neste mês.' : 'Seus registros de relatório diário neste mês.',
    campanhas: 'Campanhas por status.',
    financeiro: 'Verba planejada x executada de todas as campanhas — visível só pra Diretoria.',
  };

  return (
    <div className="page">
      <h1 className="page-title">Relatórios</h1>
      <div className="page-sub">
        Escolha um módulo abaixo pra ver os números e exportar em CSV — cada aba é sobre uma coisa só, pra não
        virar uma parede de números sem contexto.
      </div>

      <div className="detail-tabs">
        {TABS.map((t) => (
          <div key={t.key} className={`dtab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>
      <div className="page-sub" style={{ marginTop: -4, marginBottom: 16 }}>
        {TAB_INFO[tab]}
      </div>

      {tab === 'projetos' && (
        <>
          <div className="filters-row no-print">
            <select className="chip-select" value={projStatusFilter} onChange={(e) => setProjStatusFilter(e.target.value as typeof projStatusFilter)}>
              <option value="all">Status: todos</option>
              {(['planning', 'active', 'paused', 'done'] as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select className="chip-select" value={projBrandFilter} onChange={(e) => setProjBrandFilter(e.target.value)}>
              <option value="all">Marca: todas</option>
              {projectBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <ProjetosReport
            projects={filteredProjects}
            today={today}
            onExport={() => {
              downloadCSV(
                'relatorio-projetos.csv',
                ['Projeto', 'Marca', 'Status', 'Prazo'],
                filteredProjects.map((p) => [p.name, p.brand?.label ?? '', PROJECT_STATUS_LABELS[p.status], p.end_date ?? ''])
              );
            }}
          />
        </>
      )}

      {tab === 'demandas' && (
        <>
          <div className="filters-row no-print">
            <select className="chip-select" value={taskProjectFilter} onChange={(e) => setTaskProjectFilter(e.target.value)}>
              <option value="all">Projeto: todos</option>
              <option value="none">Avulsas</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className="chip-select" value={taskPriorityFilter} onChange={(e) => setTaskPriorityFilter(e.target.value as typeof taskPriorityFilter)}>
              <option value="all">Prioridade: todas</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <DemandasReport
            tasks={filteredTasks}
            stagesById={stagesById}
            projectsById={projectsById}
            profilesById={profilesById}
            onExport={() => {
              downloadCSV(
                'relatorio-demandas.csv',
                ['Demanda', 'Projeto', 'Estágio', 'Prioridade', 'Responsável', 'Prazo'],
                filteredTasks.map((t) => [
                  t.title,
                  t.project_id ? projectsById[t.project_id]?.name ?? '' : 'Avulsa',
                  stagesById[t.stage_id]?.name ?? '',
                  t.priority,
                  t.assignee_id ? profilesById[t.assignee_id]?.name ?? '' : '',
                  t.due_date ?? '',
                ])
              );
            }}
          />
        </>
      )}

      {tab === 'auditoria' && (
        <AuditoriaReport
          items={auditItems}
          productsCount={productsCount}
          onExport={() => {
            downloadCSV(
              'relatorio-auditoria.csv',
              ['Produto', 'Marca', 'Projeto', 'Item a alterar', 'Alteração necessária', 'Responsável', 'Status', 'Alerta'],
              auditItems.map((a) => [
                a.product?.name ?? '',
                a.product?.brand?.label ?? '',
                a.project?.name ?? '',
                a.item_to_change ?? '',
                a.change_needed ?? '',
                a.responsible ?? '',
                a.correction_status ?? '',
                a.risk_flag ?? '',
              ])
            );
          }}
        />
      )}

      {tab === 'redes-sociais' && (
        <RedesSociaisReport
          posts={socialPosts}
          onExport={() => {
            downloadCSV(
              'relatorio-redes-sociais.csv',
              ['Marca', 'Status', 'Data sugerida', 'Legenda'],
              socialPosts.map((p) => [p.brand?.label ?? '', p.status, p.suggested_date ?? '', p.caption])
            );
          }}
        />
      )}

      {tab === 'diario' && (
        <DiarioReport
          reports={dailyReports}
          onExport={() => {
            downloadCSV(
              'relatorio-diario.csv',
              ['Pessoa', 'Data', 'Resumo'],
              dailyReports.map((r) => [r.user?.name ?? '', r.report_date, r.summary])
            );
          }}
        />
      )}

      {tab === 'campanhas' && (
        <>
          <div className="filters-row no-print">
            <select className="chip-select" value={campStatusFilter} onChange={(e) => setCampStatusFilter(e.target.value as typeof campStatusFilter)}>
              <option value="all">Status: todos</option>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select className="chip-select" value={campBrandFilter} onChange={(e) => setCampBrandFilter(e.target.value)}>
              <option value="all">Marca: todas</option>
              {campaignBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <CampanhasReport
            campaigns={filteredCampaigns}
            onExport={() => {
              downloadCSV(
                'relatorio-campanhas.csv',
                ['Campanha', 'Marca', 'Status'],
                filteredCampaigns.map((c) => [c.name, c.brand?.label ?? '', CAMPAIGN_STATUSES.find((s) => s.key === c.status)?.label ?? c.status])
              );
            }}
          />
        </>
      )}

      {tab === 'financeiro' && seesFinancial && (
        <FinanceiroReport
          campaigns={campaigns}
          budgetItems={budgetItems}
          onExport={() => {
            downloadCSV(
              'relatorio-financeiro.csv',
              ['Campanha', 'Marca', 'Planejado', 'Executado'],
              campaigns.map((c) => {
                const items = budgetItems.filter((b) => b.campaign_id === c.id);
                const planned = items.reduce((s, b) => s + Number(b.planned_amount), 0);
                const spent = items.reduce((s, b) => s + Number(b.spent_amount), 0);
                return [c.name, c.brand?.label ?? '', planned, spent];
              })
            );
          }}
        />
      )}
    </div>
  );
}

function ProjetosReport({ projects, today, onExport }: { projects: ProjectRow[]; today: string; onExport: () => void }) {
  const overdueProjects = projects.filter((p) => p.end_date && p.end_date < today && p.status !== 'done').length;
  const projectsByStatus = (['planning', 'active', 'paused', 'done'] as ProjectStatus[]).map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }));

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{projects.length}</div>
          <div className="stat-label">Projetos</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: overdueProjects > 0 ? 'var(--red)' : undefined }}>
            {overdueProjects}
          </div>
          <div className="stat-label">Atrasados</div>
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
        <h2>{projects.length} projetos</h2>
        <ExportButtons onExportCSV={onExport} />
      </div>
      <table className="simple">
        <thead>
          <tr>
            <th>Projeto</th>
            <th>Marca</th>
            <th>Status</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td data-label="Projeto">{p.name}</td>
              <td data-label="Marca">{p.brand?.label ?? '—'}</td>
              <td data-label="Status">{PROJECT_STATUS_LABELS[p.status]}</td>
              <td className="mono" data-label="Prazo">
                {p.end_date ?? '—'}
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--text-faint)' }}>
                Nenhum projeto encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DemandasReport({
  tasks,
  stagesById,
  projectsById,
  profilesById,
  onExport,
}: {
  tasks: TaskRow[];
  stagesById: Record<string, ProjectStage>;
  projectsById: Record<string, ProjectRow>;
  profilesById: Record<string, Profile>;
  onExport: () => void;
}) {
  const tasksByStage = Object.entries(
    tasks.reduce<Record<string, number>>((acc, t) => {
      const name = stagesById[t.stage_id]?.name ?? '—';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => ({ label, count }));
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => stagesById[t.stage_id]?.is_final).length;
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{totalTasks}</div>
          <div className="stat-label">Demandas</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{pct}%</div>
          <div className="stat-label">Concluídas</div>
          <div className="stat-trend up">
            {doneTasks}/{totalTasks}
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>Por estágio</h2>
      </div>
      <div className="board cols4" style={{ gridTemplateColumns: `repeat(${Math.max(tasksByStage.length, 1)}, 1fr)` }}>
        {tasksByStage.map((s) => (
          <div className="card" key={s.label}>
            <h4>{s.label}</h4>
            <p>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{tasks.length} demandas</h2>
        <ExportButtons onExportCSV={onExport} />
      </div>
      <table className="simple">
        <thead>
          <tr>
            <th>Demanda</th>
            <th>Projeto</th>
            <th>Estágio</th>
            <th>Prioridade</th>
            <th>Responsável</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td data-label="Demanda">{t.title}</td>
              <td data-label="Projeto">{t.project_id ? projectsById[t.project_id]?.name ?? '—' : 'Avulsa'}</td>
              <td data-label="Estágio">{stagesById[t.stage_id]?.name ?? '—'}</td>
              <td data-label="Prioridade">
                <span className={`prio ${t.priority}`}>{t.priority}</span>
              </td>
              <td data-label="Responsável">{t.assignee_id ? profilesById[t.assignee_id]?.name ?? '—' : '—'}</td>
              <td className="mono" data-label="Prazo">
                {t.due_date ?? '—'}
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: 'var(--text-faint)' }}>
                Nenhuma demanda encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AuditoriaReport({ items, productsCount, onExport }: { items: AuditRow[]; productsCount: number; onExport: () => void }) {
  const flagged = items.length;
  const corrigidos = items.filter((a) => a.correction_status === 'Corrigido').length;
  const alertas = items.filter((a) => a.risk_flag).length;
  const pct = flagged ? Math.round((corrigidos / flagged) * 100) : 0;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{productsCount}</div>
          <div className="stat-label">Produtos no catálogo</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{flagged}</div>
          <div className="stat-label">Sinalizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{corrigidos}</div>
          <div className="stat-label">Corrigidos</div>
          <div className="stat-trend up">{pct}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: alertas > 0 ? 'var(--red)' : undefined }}>
            {alertas}
          </div>
          <div className="stat-label">Alertas ativos</div>
        </div>
      </div>

      <div className="section-head">
        <h2>{items.length} pendências</h2>
        <ExportButtons onExportCSV={onExport} />
      </div>
      <table className="simple">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Marca</th>
            <th>Projeto</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td data-label="Produto">{a.product?.name ?? '—'}</td>
              <td data-label="Marca">{a.product?.brand?.label ?? '—'}</td>
              <td data-label="Projeto">{a.project?.name ?? '—'}</td>
              <td data-label="Status">{a.correction_status}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--text-faint)' }}>
                Nenhuma pendência encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RedesSociaisReport({
  posts,
  onExport,
}: {
  posts: { status: string; caption: string; suggested_date: string | null; brand: { label: string } | null }[];
  onExport: () => void;
}) {
  const postsByStatus = ['Pendente', 'Aprovado', 'Alterações solicitadas'].map((s) => ({
    status: s,
    count: posts.filter((p) => p.status === s).length,
  }));

  return (
    <div>
      <div className="grid3">
        {postsByStatus.map((p) => (
          <div className="card" key={p.status}>
            <h4>{p.status}</h4>
            <p>{p.count} peças</p>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{posts.length} peças</h2>
        <ExportButtons onExportCSV={onExport} />
      </div>
      <table className="simple">
        <thead>
          <tr>
            <th>Marca</th>
            <th>Status</th>
            <th>Data sugerida</th>
            <th>Legenda</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p, i) => (
            <tr key={i}>
              <td data-label="Marca">{p.brand?.label ?? '—'}</td>
              <td data-label="Status">{p.status}</td>
              <td className="mono" data-label="Data sugerida">
                {p.suggested_date ?? '—'}
              </td>
              <td data-label="Legenda" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.caption}
              </td>
            </tr>
          ))}
          {posts.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--text-faint)' }}>
                Nenhuma peça encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DiarioReport({
  reports,
  onExport,
}: {
  reports: { user: { name: string } | null; report_date: string; summary: string }[];
  onExport: () => void;
}) {
  const byPerson = Object.entries(
    reports.reduce<Record<string, number>>((acc, r) => {
      const name = r.user?.name ?? 'Sem nome';
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="section-head">
        <h2>{reports.length} registros neste mês</h2>
        <ExportButtons onExportCSV={onExport} />
      </div>
      {byPerson.length === 0 ? (
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
            {byPerson.map(([name, count]) => (
              <tr key={name}>
                <td data-label="Pessoa">{name}</td>
                <td data-label="Registros no mês">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CampanhasReport({
  campaigns,
  onExport,
}: {
  campaigns: { id: string; name: string; status: CampaignStatus; brand: { label: string } | null }[];
  onExport: () => void;
}) {
  const campaignsByStatus = CAMPAIGN_STATUSES.map((s) => ({
    status: s.key,
    label: s.label,
    count: campaigns.filter((c) => c.status === s.key).length,
  }));

  return (
    <div>
      <div className="grid4">
        {campaignsByStatus.map((c) => (
          <div className="card" key={c.status}>
            <h4>{c.label}</h4>
            <p>{c.count} campanhas</p>
          </div>
        ))}
      </div>
      <div className="section-head">
        <h2>{campaigns.length} campanhas</h2>
        <ExportButtons onExportCSV={onExport} />
      </div>
      <table className="simple">
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Marca</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td data-label="Campanha">{c.name}</td>
              <td data-label="Marca">{c.brand?.label ?? '—'}</td>
              <td data-label="Status">{CAMPAIGN_STATUSES.find((s) => s.key === c.status)?.label ?? c.status}</td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: 'var(--text-faint)' }}>
                Nenhuma campanha encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FinanceiroReport({
  campaigns,
  budgetItems,
  onExport,
}: {
  campaigns: { id: string; name: string; status: CampaignStatus; brand: { label: string } | null }[];
  budgetItems: { campaign_id: string; planned_amount: number; spent_amount: number }[];
  onExport: () => void;
}) {
  const totalPlanned = budgetItems.reduce((s, b) => s + Number(b.planned_amount), 0);
  const totalSpent = budgetItems.reduce((s, b) => s + Number(b.spent_amount), 0);
  const byCampaign = campaigns
    .map((c) => {
      const items = budgetItems.filter((b) => b.campaign_id === c.id);
      const planned = items.reduce((s, b) => s + Number(b.planned_amount), 0);
      const spent = items.reduce((s, b) => s + Number(b.spent_amount), 0);
      return { ...c, planned, spent };
    })
    .filter((c) => c.planned > 0 || c.spent > 0);

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{formatBRL(totalPlanned)}</div>
          <div className="stat-label">Verba planejada</div>
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

      <div className="section-head">
        <h2>Por campanha</h2>
        <ExportButtons onExportCSV={onExport} />
      </div>
      {byCampaign.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum item de verba cadastrado ainda.
        </div>
      ) : (
        <table className="simple">
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
            {byCampaign.map((c) => {
              const pct = c.planned ? Math.round((c.spent / c.planned) * 100) : 0;
              return (
                <tr key={c.id}>
                  <td data-label="Campanha">{c.name}</td>
                  <td data-label="Marca">{c.brand?.label ?? '—'}</td>
                  <td className="mono" data-label="Planejado">
                    {formatBRL(c.planned)}
                  </td>
                  <td className="mono" data-label="Executado">
                    {formatBRL(c.spent)}
                  </td>
                  <td data-label="% executado">
                    <span className="status-dot" style={{ background: pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--yellow)' : 'var(--green)' }}></span>
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
