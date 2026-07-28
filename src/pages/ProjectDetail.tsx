import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { normalizeUrl } from '../lib/url';
import StatusTag from '../components/StatusTag';
import KanbanBoard from '../components/KanbanBoard';
import TaskEditModal from '../components/TaskEditModal';
import AuditItemEditModal from '../components/AuditItemEditModal';
import type {
  ActivityLogEntry,
  AuditItem,
  Brand,
  ChecklistItem,
  Comment,
  Priority,
  Product,
  Profile,
  Project,
  ProjectFile,
  ProjectMember,
  ProjectStatus,
  Stage,
  Task,
} from '../types/database';
import { CORRECTION_STATUSES, PRIORITIES, PRIORITY_LABELS, STAGES } from '../types/database';

type ProjectWithBrand = Project & { brand: Brand };
type ProductWithBrand = Product & { brand: Brand };
type CommentWithAuthor = Comment & { author: { name: string } | null };
type ActivityWithActor = ActivityLogEntry & { actor: { name: string } | null };
type MemberWithProfile = ProjectMember & { user: { name: string; job_title: string } | null };

type Tab = 'resumo' | 'demandas' | 'arquivos' | 'historico' | 'correcoes';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('resumo');
  const [demandasView, setDemandasView] = useState<'kanban' | 'lista'>('kanban');
  const [demandasGroupBy, setDemandasGroupBy] = useState<'none' | 'assignee' | 'priority'>('none');
  const [demandasSearch, setDemandasSearch] = useState('');
  const [demandasAssignee, setDemandasAssignee] = useState('all');
  const [demandasPriority, setDemandasPriority] = useState('all');
  const [demandasStage, setDemandasStage] = useState('all');
  const [demandasSort, setDemandasSort] = useState<'recent' | 'title' | 'priority' | 'prazo'>('recent');
  const [demandasHideDone, setDemandasHideDone] = useState(false);

  const [project, setProject] = useState<ProjectWithBrand | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activity, setActivity] = useState<ActivityWithActor[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [allProducts, setAllProducts] = useState<ProductWithBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [
      projectRes,
      checklistRes,
      commentsRes,
      tasksRes,
      filesRes,
      activityRes,
      membersRes,
      profilesRes,
      auditRes,
      productsRes,
    ] = await Promise.all([
      supabase.from('projects').select('*, brand:brands(*)').eq('id', id).single(),
      supabase.from('checklist_items').select('*').eq('project_id', id).order('position'),
      supabase
        .from('comments')
        .select('*, author:profiles(name)')
        .eq('project_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('project_id', id).order('position'),
      supabase.from('project_files').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase
        .from('activity_log')
        .select('*, actor:profiles(name)')
        .eq('project_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('project_members').select('*, user:profiles(name, job_title)').eq('project_id', id),
      supabase.from('profiles').select('*'),
      supabase.from('audit_items').select('*').eq('project_id', id),
      supabase.from('products').select('*, brand:brands(*)').order('code'),
    ]);

    if (projectRes.error) {
      setError(projectRes.error.message);
      setLoading(false);
      return;
    }
    setProject(projectRes.data as ProjectWithBrand);
    setChecklist((checklistRes.data as ChecklistItem[]) ?? []);
    setComments((commentsRes.data as CommentWithAuthor[]) ?? []);
    setTasks((tasksRes.data as Task[]) ?? []);
    setFiles((filesRes.data as ProjectFile[]) ?? []);
    setActivity((activityRes.data as ActivityWithActor[]) ?? []);
    setMembers((membersRes.data as MemberWithProfile[]) ?? []);
    setAllProfiles((profilesRes.data as Profile[]) ?? []);
    setAuditItems((auditRes.data as AuditItem[]) ?? []);
    setAllProducts((productsRes.data as ProductWithBrand[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const profilesById = Object.fromEntries(allProfiles.map((p) => [p.id, p]));
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = tasks
    .filter((t) => {
      if (demandasHideDone && t.stage === 'finalizado') return false;
      if (demandasAssignee === 'none' && t.assignee_id) return false;
      if (demandasAssignee !== 'all' && demandasAssignee !== 'none' && t.assignee_id !== demandasAssignee) return false;
      if (demandasPriority !== 'all' && t.priority !== demandasPriority) return false;
      if (demandasStage !== 'all' && t.stage !== demandasStage) return false;
      if (demandasSearch.trim()) {
        const q = demandasSearch.trim().toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (demandasSort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (demandasSort === 'priority') {
        const order: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      }
      if (demandasSort === 'prazo') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return a.position - b.position;
    });

  async function saveTask(taskId: string, fields: Partial<Task>) {
    await supabase.from('tasks').update({ ...fields, updated_by: profile?.id }).eq('id', taskId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Demanda editada', projectId: id, taskId });
    setEditingTask(null);
    load();
  }

  async function deleteTask(taskId: string, title: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Demanda excluída', detail: title, projectId: id });
    setEditingTask(null);
    load();
  }

  async function toggleChecklist(item: ChecklistItem) {
    await supabase.from('checklist_items').update({ done: !item.done }).eq('id', item.id);
    if (profile) {
      await logActivity({
        actorId: profile.id,
        actionText: `Checklist: "${item.label}" marcado como ${!item.done ? 'concluído' : 'pendente'}`,
        projectId: id,
      });
    }
    load();
  }

  async function addChecklistItem(label: string) {
    if (!id) return;
    await supabase.from('checklist_items').insert({ project_id: id, label, position: checklist.length });
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Item de checklist adicionado', detail: label, projectId: id });
    load();
  }

  async function addComment(body: string) {
    if (!id || !profile) return;
    await supabase.from('comments').insert({ project_id: id, author_id: profile.id, body });
    await logActivity({ actorId: profile.id, actionText: 'Comentário adicionado', projectId: id });
    load();
  }

  async function createTask(title: string) {
    if (!id || !profile) return;
    await supabase.from('tasks').insert({ project_id: id, title, stage: 'recebido', priority: 'medium' });
    await logActivity({ actorId: profile.id, actionText: 'Demanda criada', detail: title, projectId: id });
    load();
  }

  async function changeStage(taskId: string, stage: Stage) {
    if (!profile) return;
    const task = tasks.find((t) => t.id === taskId);
    await supabase.from('tasks').update({ stage }).eq('id', taskId);
    const stageLabel = STAGES.find((s) => s.key === stage)?.label ?? stage;
    await logActivity({
      actorId: profile.id,
      actionText: 'Demanda movida de estágio',
      detail: task ? `${task.title} → ${stageLabel}` : stageLabel,
      projectId: id,
    });
    load();
  }

  async function addFile(name: string, url: string) {
    if (!id || !profile) return;
    await supabase.from('project_files').insert({ project_id: id, name, url: normalizeUrl(url), added_by: profile.id });
    await logActivity({ actorId: profile.id, actionText: 'Arquivo anexado', detail: name, projectId: id });
    load();
  }

  async function addMember(userId: string, roleLabel: string) {
    if (!id || !profile) return;
    await supabase.from('project_members').insert({ project_id: id, user_id: userId, role_label: roleLabel });
    const memberProfile = profilesById[userId];
    await logActivity({
      actorId: profile.id,
      actionText: 'Membro adicionado ao projeto',
      detail: memberProfile?.name,
      projectId: id,
    });
    load();
  }

  async function removeMember(memberId: string) {
    await supabase.from('project_members').delete().eq('id', memberId);
    load();
  }

  async function saveSummary(fields: Partial<Project>) {
    if (!id || !profile) return;
    await supabase.from('projects').update(fields).eq('id', id);
    await logActivity({ actorId: profile.id, actionText: 'Detalhes do projeto atualizados', projectId: id });
    load();
  }

  async function upsertAuditItem(productId: string, existingItemId: string | null, fields: Partial<AuditItem>) {
    if (existingItemId) {
      await supabase.from('audit_items').update(fields).eq('id', existingItemId);
    } else if (id) {
      await supabase
        .from('audit_items')
        .insert({ project_id: id, product_id: productId, correction_status: 'Não Iniciado', ...fields });
    }
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Item de auditoria atualizado', projectId: id });
    load();
  }

  async function clearAuditItem(itemId: string) {
    await supabase.from('audit_items').delete().eq('id', itemId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Pendência de auditoria removida', projectId: id });
    load();
  }

  if (loading) return <div className="page-sub">Carregando…</div>;
  if (error || !project)
    return (
      <div className="banner error">
        <span className="ic">⚠</span>
        <span>Não foi possível carregar este projeto: {error ?? 'não encontrado'}</span>
      </div>
    );

  return (
    <div className="page">
      <div className="detail-header">
        <div>
          <h1 className="page-title">{project.name}</h1>
          <div className="page-sub">{project.sub}</div>
        </div>
        {project.ref && <span className="ref-pill">⛓ {project.ref}</span>}
      </div>

      <div className="detail-tabs">
        {(
          [
            ['resumo', 'Resumo'],
            ['demandas', 'Demandas'],
            ...(auditItems.length > 0 ? [['correcoes', 'Correções'] as [Tab, string]] : []),
            ['arquivos', 'Arquivos'],
            ['historico', 'Histórico'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <div key={key} className={`dtab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'resumo' && (
        <ResumoTab
          project={project}
          tasks={tasks}
          profilesById={profilesById}
          checklist={checklist}
          comments={comments}
          members={members}
          allProfiles={allProfiles}
          onToggleChecklist={toggleChecklist}
          onAddChecklistItem={addChecklistItem}
          onAddComment={addComment}
          onAddMember={addMember}
          onRemoveMember={removeMember}
          onSaveSummary={saveSummary}
        />
      )}

      {tab === 'demandas' && (
        <div>
          <div className="filters-row">
            <input
              className="chip-input"
              placeholder="⌕ Pesquisar…"
              value={demandasSearch}
              onChange={(e) => setDemandasSearch(e.target.value)}
            />
            <select className="chip-select" value={demandasAssignee} onChange={(e) => setDemandasAssignee(e.target.value)}>
              <option value="all">Responsável: todos</option>
              <option value="none">Sem responsável</option>
              {allProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className="chip-select" value={demandasPriority} onChange={(e) => setDemandasPriority(e.target.value)}>
              <option value="all">Prioridade: todas</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <select className="chip-select" value={demandasStage} onChange={(e) => setDemandasStage(e.target.value)}>
              <option value="all">Estágio: todos</option>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select className="chip-select" value={demandasSort} onChange={(e) => setDemandasSort(e.target.value as typeof demandasSort)}>
              <option value="recent">Ordenar: posição</option>
              <option value="title">Ordenar: título (A-Z)</option>
              <option value="priority">Ordenar: prioridade</option>
              <option value="prazo">Ordenar: prazo</option>
            </select>
            <div className={`filter-chip${demandasHideDone ? ' active' : ''}`} onClick={() => setDemandasHideDone((v) => !v)}>
              {demandasHideDone ? '◐ Mostrando ativas' : '◎ Ocultar finalizadas'}
            </div>
          </div>

          <div className="section-head">
            <h2>{filteredTasks.length} demandas</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {demandasView === 'lista' && (
                <select value={demandasGroupBy} onChange={(e) => setDemandasGroupBy(e.target.value as typeof demandasGroupBy)}>
                  <option value="none">Sem agrupamento</option>
                  <option value="assignee">Agrupar por responsável</option>
                  <option value="priority">Agrupar por prioridade</option>
                </select>
              )}
              <div className="filters-row" style={{ margin: 0 }}>
                <div className={`filter-chip${demandasView === 'kanban' ? ' active' : ''}`} onClick={() => setDemandasView('kanban')}>
                  Kanban
                </div>
                <div className={`filter-chip${demandasView === 'lista' ? ' active' : ''}`} onClick={() => setDemandasView('lista')}>
                  Lista
                </div>
              </div>
            </div>
          </div>

          {demandasView === 'kanban' ? (
            <KanbanBoard
              tasks={filteredTasks}
              profilesById={profilesById}
              editable
              terminalStages={['finalizado']}
              onStageChange={changeStage}
              onCreate={createTask}
              onEdit={setEditingTask}
            />
          ) : (
            (() => {
              const groupLabel = (t: Task) =>
                demandasGroupBy === 'assignee'
                  ? t.assignee_id
                    ? profilesById[t.assignee_id]?.name ?? '—'
                    : 'Sem responsável'
                  : demandasGroupBy === 'priority'
                    ? t.priority
                    : '';
              const groups =
                demandasGroupBy === 'none'
                  ? [{ label: '', items: filteredTasks }]
                  : Object.entries(
                      filteredTasks.reduce<Record<string, Task[]>>((acc, t) => {
                        const key = groupLabel(t);
                        (acc[key] ??= []).push(t);
                        return acc;
                      }, {})
                    ).map(([label, items]) => ({ label, items }));
              const fileCounts: Record<string, number> = {};
              files.forEach((f) => {
                if (f.task_id) fileCounts[f.task_id] = (fileCounts[f.task_id] ?? 0) + 1;
              });
              const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              const cronograma = (t: Task) => {
                if (!t.start_date && !t.due_date) return '—';
                const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                if (t.start_date && t.due_date) return `${fmt(t.start_date)} – ${fmt(t.due_date)}`;
                return fmt(t.start_date ?? t.due_date!);
              };
              return groups.map((g) => (
                <div key={g.label}>
                  {g.label && <h4 style={{ fontSize: 12, color: 'var(--text-dim)', margin: '14px 0 6px 0' }}>{g.label}</h4>}
                  <table className="simple">
                    <thead>
                      <tr>
                        <th>Tarefa</th>
                        <th>Prioridade</th>
                        <th>Estágio</th>
                        <th>Responsável</th>
                        <th>Notas</th>
                        <th>Orçamento</th>
                        <th>Arquivos</th>
                        <th>Cronograma</th>
                        <th>Atraso</th>
                        <th>Última atualização</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((t) => {
                        const overdue = t.due_date && t.stage !== 'finalizado' && new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
                        return (
                          <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setEditingTask(t)}>
                            <td>{t.title}</td>
                            <td>
                              <span className={`prio ${t.priority}`}>{t.priority}</span>
                            </td>
                            <td style={{ color: 'var(--text-faint)' }}>{STAGES.find((s) => s.key === t.stage)?.label}</td>
                            <td style={{ color: 'var(--text-faint)' }}>{t.assignee_id ? profilesById[t.assignee_id]?.name : '—'}</td>
                            <td style={{ color: 'var(--text-faint)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.notes || '—'}
                            </td>
                            <td style={{ color: 'var(--text-faint)' }}>{t.budget != null ? fmtBRL(Number(t.budget)) : '—'}</td>
                            <td style={{ color: 'var(--text-faint)' }}>{fileCounts[t.id] ? `📎 ${fileCounts[t.id]}` : '—'}</td>
                            <td style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{cronograma(t)}</td>
                            <td>{overdue && <span style={{ color: 'var(--red)', fontSize: 11 }}>🔴 atrasada</span>}</td>
                            <td style={{ color: 'var(--text-faint)', fontSize: 11, whiteSpace: 'nowrap' }}>
                              {t.updated_by ? profilesById[t.updated_by]?.name : '—'} · {new Date(t.updated_at).toLocaleDateString('pt-BR')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ));
            })()
          )}
        </div>
      )}

      {editingTask && profile && (
        <TaskEditModal
          task={editingTask}
          profiles={allProfiles}
          products={allProducts}
          actorId={profile.id}
          onClose={() => setEditingTask(null)}
          onSave={(fields) => saveTask(editingTask.id, fields)}
          onDelete={() => deleteTask(editingTask.id, editingTask.title)}
        />
      )}

      {tab === 'correcoes' && (
        <CorrecoesTab
          products={allProducts}
          items={auditItems}
          onUpdate={upsertAuditItem}
          onClear={clearAuditItem}
        />
      )}

      {tab === 'arquivos' && <ArquivosTab files={files} profilesById={profilesById} onAdd={addFile} />}

      {tab === 'historico' && <HistoricoTab activity={activity} />}
    </div>
  );
}

function ResumoTab({
  project,
  tasks,
  profilesById,
  checklist,
  comments,
  members,
  allProfiles,
  onToggleChecklist,
  onAddChecklistItem,
  onAddComment,
  onAddMember,
  onRemoveMember,
  onSaveSummary,
}: {
  project: ProjectWithBrand;
  tasks: Task[];
  profilesById: Record<string, Profile>;
  checklist: ChecklistItem[];
  comments: CommentWithAuthor[];
  members: MemberWithProfile[];
  allProfiles: Profile[];
  onToggleChecklist: (item: ChecklistItem) => void;
  onAddChecklistItem: (label: string) => void;
  onAddComment: (body: string) => void;
  onAddMember: (userId: string, roleLabel: string) => void;
  onRemoveMember: (memberId: string) => void;
  onSaveSummary: (fields: Partial<Project>) => void;
}) {
  const overdueTasks = tasks.filter(
    (t) => t.due_date && t.stage !== 'finalizado' && new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString())
  );
  const [editing, setEditing] = useState(false);
  const [objective, setObjective] = useState(project.objective);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [priority, setPriority] = useState<Priority>(project.priority);
  const [category, setCategory] = useState(project.category);
  const [startDate, setStartDate] = useState(project.start_date ?? '');
  const [endDate, setEndDate] = useState(project.end_date ?? '');
  const [ref, setRef] = useState(project.ref);
  const [newChecklist, setNewChecklist] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');

  function startEdit() {
    setObjective(project.objective);
    setStatus(project.status);
    setPriority(project.priority);
    setCategory(project.category);
    setStartDate(project.start_date ?? '');
    setEndDate(project.end_date ?? '');
    setRef(project.ref);
    setEditing(true);
  }

  function save() {
    onSaveSummary({
      objective,
      status,
      priority,
      category,
      start_date: startDate || null,
      end_date: endDate || null,
      ref,
    });
    setEditing(false);
  }

  const memberIds = new Set(members.map((m) => m.user_id));
  const availableProfiles = allProfiles.filter((p) => !memberIds.has(p.id));

  return (
    <div className="info-grid">
      <div>
        {overdueTasks.length > 0 && (
          <div className="panel" style={{ borderColor: 'var(--red)' }}>
            <h4 style={{ color: 'var(--red)' }}>🔴 {overdueTasks.length} demanda(s) atrasada(s)</h4>
            {overdueTasks.map((t) => {
              const days = Math.round(
                (new Date(new Date().toDateString()).getTime() - new Date(t.due_date! + 'T00:00').getTime()) / 86400000
              );
              return (
                <div className="field-row" key={t.id}>
                  <span className="k">{t.title}</span>
                  <span style={{ textAlign: 'right' }}>
                    {profilesById[t.assignee_id ?? '']?.name ?? 'Sem responsável'} · {days}d atrasada
                    {t.delay_reason && (
                      <span style={{ display: 'block', color: 'var(--text-faint)', fontSize: 11 }}>{t.delay_reason}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="panel">
          <h4>Objetivo</h4>
          {editing ? (
            <textarea
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                color: 'var(--text)',
                padding: 8,
                fontSize: 12.5,
              }}
            />
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
              {project.objective || 'Sem objetivo registrado ainda.'}
            </p>
          )}
        </div>

        <div className="panel">
          <h4>Checklist</h4>
          {checklist.map((item) => (
            <div className="field-row" key={item.id}>
              <span className="k">{item.label}</span>
              <span style={{ cursor: 'pointer' }} onClick={() => onToggleChecklist(item)}>
                {item.done ? '✅' : '◻︎'}
              </span>
            </div>
          ))}
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!newChecklist.trim()) return;
              onAddChecklistItem(newChecklist.trim());
              setNewChecklist('');
            }}
            style={{ marginTop: 8 }}
          >
            <input
              placeholder="+ novo item…"
              value={newChecklist}
              onChange={(e) => setNewChecklist(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px dashed var(--border)',
                borderRadius: 7,
                color: 'var(--text)',
                padding: 7,
                fontSize: 12,
              }}
            />
          </form>
        </div>

        <div className="panel">
          <h4>Comentários</h4>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!newComment.trim()) return;
              onAddComment(newComment.trim());
              setNewComment('');
            }}
            style={{ marginBottom: 10 }}
          >
            <textarea
              rows={2}
              placeholder="Escreva um comentário…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                color: 'var(--text)',
                padding: 8,
                fontSize: 12.5,
                marginBottom: 6,
              }}
            />
            <button className="btn sm" type="submit">
              Comentar
            </button>
          </form>
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <div className="comment-head">
                <span className="name">{c.author?.name ?? 'Alguém'}</span>
                <span className="time">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div className="body">{c.body}</div>
            </div>
          ))}
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Nenhum comentário ainda.</div>
          )}
        </div>
      </div>

      <div>
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Detalhes</h4>
            {!editing ? (
              <button className="btn ghost sm" onClick={startEdit}>
                Editar
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn ghost sm" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
                <button className="btn sm" onClick={save}>
                  Salvar
                </button>
              </div>
            )}
          </div>
          {!editing ? (
            <>
              <div className="field-row">
                <span className="k">Status</span>
                <StatusTag status={project.status} />
              </div>
              <div className="field-row">
                <span className="k">Prioridade</span>
                <span>{project.priority}</span>
              </div>
              <div className="field-row">
                <span className="k">Categoria</span>
                <span>{project.category || '—'}</span>
              </div>
              <div className="field-row">
                <span className="k">Início</span>
                <span>{project.start_date ?? '—'}</span>
              </div>
              <div className="field-row">
                <span className="k">Prazo</span>
                <span>{project.end_date ?? '—'}</span>
              </div>
              <div className="field-row">
                <span className="k">Referência</span>
                <span className="mono">{project.ref || '—'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="form-field">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                  <option value="planning">Planejamento</option>
                  <option value="active">Ativo</option>
                  <option value="paused">Atenção</option>
                  <option value="done">Concluído</option>
                </select>
              </div>
              <div className="form-field">
                <label>Prioridade</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="urgent">Urgente</option>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </div>
              <div className="form-field">
                <label>Categoria</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Início</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Prazo</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Referência</label>
                <input value={ref} onChange={(e) => setRef(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <h4>Equipe</h4>
          {members.map((m) => (
            <div className="member-row" key={m.id}>
              <div className="mini-avatar">{(m.user?.name ?? '??').slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                {m.user?.name ?? 'Sem nome'}
                <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>{m.role_label || m.user?.job_title}</div>
              </div>
              <span style={{ cursor: 'pointer', color: 'var(--text-faint)' }} onClick={() => onRemoveMember(m.id)}>
                ✕
              </span>
            </div>
          ))}
          {availableProfiles.length > 0 && (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (!newMemberId) return;
                onAddMember(newMemberId, newMemberRole);
                setNewMemberId('');
                setNewMemberRole('');
              }}
              style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
                <option value="">Adicionar pessoa…</option>
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Papel no projeto (opcional)"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
              />
              <button className="btn sm" type="submit">
                Adicionar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ArquivosTab({
  files,
  profilesById,
  onAdd,
}: {
  files: ProjectFile[];
  profilesById: Record<string, Profile>;
  onAdd: (name: string, url: string) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  return (
    <div>
      <table className="simple">
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Link</th>
            <th>Enviado por</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id}>
              <td>{f.name}</td>
              <td>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'var(--violet)' }}>
                  abrir ↗
                </a>
              </td>
              <td className="mono">{(f.added_by && profilesById[f.added_by]?.name) ?? '—'}</td>
              <td className="mono">{new Date(f.created_at).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!name.trim() || !url.trim()) return;
          onAdd(name.trim(), url.trim());
          setName('');
          setUrl('');
        }}
        style={{ display: 'flex', gap: 8, marginTop: 14 }}
      >
        <input placeholder="Nome do arquivo" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <input
          placeholder="Link do Drive"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: 2 }}
        />
        <button className="btn sm" type="submit">
          Anexar
        </button>
      </form>
    </div>
  );
}

function HistoricoTab({ activity }: { activity: ActivityWithActor[] }) {
  return (
    <table className="simple">
      <thead>
        <tr>
          <th>Ação</th>
          <th>Por</th>
          <th>Quando</th>
        </tr>
      </thead>
      <tbody>
        {activity.map((a) => (
          <tr key={a.id}>
            <td>
              {a.action_text}
              {a.detail ? ` — ${a.detail}` : ''}
            </td>
            <td>{a.actor?.name ?? 'Sistema'}</td>
            <td className="mono">{new Date(a.created_at).toLocaleString('pt-BR')}</td>
          </tr>
        ))}
        {activity.length === 0 && (
          <tr>
            <td colSpan={3} style={{ color: 'var(--text-faint)' }}>
              Nenhuma atividade registrada ainda.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

interface AuditRow {
  product: ProductWithBrand;
  item: AuditItem | null;
}

function CorrecoesTab({
  products,
  items,
  onUpdate,
  onClear,
}: {
  products: ProductWithBrand[];
  items: AuditItem[];
  onUpdate: (productId: string, existingItemId: string | null, fields: Partial<AuditItem>) => void;
  onClear: (itemId: string) => void;
}) {
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingRow, setEditingRow] = useState<AuditRow | null>(null);

  const itemByProduct = Object.fromEntries(items.map((i) => [i.product_id, i]));
  const rows: AuditRow[] = products.map((product) => ({ product, item: itemByProduct[product.id] ?? null }));

  const flagged = items.length;
  const corrigidos = items.filter((i) => i.correction_status === 'Corrigido').length;
  const emAndamento = items.filter((i) => i.correction_status === 'Em Andamento').length;
  const naoIniciados = items.filter((i) => i.correction_status === 'Não Iniciado').length;
  const pct = flagged ? Math.round((corrigidos / flagged) * 100) : 0;
  const alertas = items.filter((i) => i.risk_flag).length;

  const brands = Array.from(new Set(products.map((p) => p.brand?.label).filter(Boolean)));

  const filtered = rows.filter(({ product, item }) => {
    const status = item?.correction_status ?? 'Sem pendência';
    if (brandFilter !== 'all' && product.brand?.label !== brandFilter) return false;
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{products.length}</div>
          <div className="stat-label">Produtos no catálogo</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{flagged}</div>
          <div className="stat-label">Sinalizados com pendência</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{corrigidos}</div>
          <div className="stat-label">Corrigidos</div>
          <div className="stat-trend up">{pct}% dos sinalizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{emAndamento + naoIniciados}</div>
          <div className="stat-label">Em aberto (andamento + não iniciado)</div>
          {alertas > 0 && <div className="stat-trend warn">🔴 {alertas} alertas ativos</div>}
        </div>
      </div>

      <div className="filters-row" style={{ marginTop: 18 }}>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="all">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos os status</option>
          {CORRECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <table className="simple">
        <thead>
          <tr>
            <th>Marca</th>
            <th>Linha</th>
            <th>Código</th>
            <th>Produto</th>
            <th>Item a alterar</th>
            <th>Alteração necessária</th>
            <th>Prioridade</th>
            <th>Responsável</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(({ product, item }) => {
            const priority = item?.priority_effective ?? '';
            const status = item?.correction_status ?? 'Sem pendência';
            return (
              <tr key={product.id} onClick={() => setEditingRow({ product, item })} style={{ cursor: 'pointer' }}>
                <td>{product.brand?.label}</td>
                <td>{product.line || '—'}</td>
                <td className="mono">{product.code}</td>
                <td>{product.name}</td>
                <td>{item?.item_to_change || '—'}</td>
                <td>{item?.change_needed || '—'}</td>
                <td>
                  {priority ? (
                    <span
                      className={`prio ${priority === 'Alta' ? 'urgent' : priority === 'Média' ? 'medium' : 'low'}`}
                    >
                      {priority}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{item?.responsible || '—'}</td>
                <td>{status}</td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={9} style={{ color: 'var(--text-faint)' }}>
                Nenhum item para esse filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editingRow && (
        <AuditItemEditModal
          product={editingRow.product}
          item={editingRow.item}
          onClose={() => setEditingRow(null)}
          onSave={(fields) => {
            onUpdate(editingRow.product.id, editingRow.item?.id ?? null, fields);
            setEditingRow(null);
          }}
          onClear={() => {
            if (editingRow.item) onClear(editingRow.item.id);
            setEditingRow(null);
          }}
        />
      )}
    </div>
  );
}
