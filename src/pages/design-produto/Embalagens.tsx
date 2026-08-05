import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import KanbanBoard from '../../components/KanbanBoard';
import TaskEditModal from '../../components/TaskEditModal';
import ProductImageHover, { type ProductHoverData } from '../../components/ProductImageHover';
import Modal from '../../components/Modal';
import ProductCombobox from '../../components/ProductCombobox';
import { materializeSubsteps } from '../../lib/substeps';
import {
  PACKAGING_TRACKS,
  PRIORITIES,
  PRIORITY_LABELS,
  type ActivityLogEntry,
  type PackagingTrack,
  type Priority,
  type Product,
  type ProjectFile,
  type ProjectStage,
  type Profile,
  type StageSubstep,
  type Task,
} from '../../types/database';

type Tab = 'demandas' | 'calendario' | 'financeiro' | 'arquivos' | 'historico';

export default function Embalagens({
  tracks = PACKAGING_TRACKS,
  moduleTitle = 'Embalagens',
}: {
  tracks?: { key: PackagingTrack; label: string; hint: string }[];
  moduleTitle?: string;
} = {}) {
  const { profile } = useAuth();
  const [track, setTrack] = useState<PackagingTrack>(tracks[0].key);
  const [tab, setTab] = useState<Tab>('demandas');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [files, setFiles] = useState<(ProjectFile & { task: { title: string } | null })[]>([]);
  const [activity, setActivity] = useState<(ActivityLogEntry & { actor: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros / ordenação
  const [search, setSearch] = useState('');
  const [fAssignee, setFAssignee] = useState('all');
  const [fPriority, setFPriority] = useState('all');
  const [fStage, setFStage] = useState('all');
  const [hideDone, setHideDone] = useState(false);
  const [sort, setSort] = useState<'recent' | 'title' | 'priority' | 'prazo' | 'prazo_desc' | 'meta' | 'meta_desc' | 'assignee' | 'stage'>('recent');

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [hover, setHover] = useState<ProductHoverData>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [blockInfo, setBlockInfo] = useState<{
    message: string;
    fromStage: string;
    pending: { label: string; stageName: string | null; isSubstep: boolean }[];
    task: Task | null;
  } | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [managingStages, setManagingStages] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tasksRes, stagesRes, profilesRes, productsRes] = await Promise.all([
      supabase.from('tasks').select('*').is('project_id', null).eq('packaging_track', track).order('position'),
      supabase.from('stages').select('*').eq('packaging_track', track).order('position'),
      supabase.from('profiles').select('*'),
      supabase.from('products').select('*').order('code'),
    ]);
    const list = (tasksRes.data as Task[]) ?? [];
    setTasks(list);
    setStages((stagesRes.data as ProjectStage[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setProducts((productsRes.data as Product[]) ?? []);

    const taskIds = list.map((t) => t.id);
    if (taskIds.length > 0) {
      const [filesRes, actRes] = await Promise.all([
        supabase.from('project_files').select('*, task:tasks(title)').in('task_id', taskIds).order('created_at', { ascending: false }),
        supabase.from('activity_log').select('*, actor:profiles(name)').in('task_id', taskIds).order('created_at', { ascending: false }).limit(150),
      ]);
      setFiles((filesRes.data as (ProjectFile & { task: { title: string } | null })[]) ?? []);
      setActivity((actRes.data as (ActivityLogEntry & { actor: { name: string } | null })[]) ?? []);
    } else {
      setFiles([]);
      setActivity([]);
    }
    setLoading(false);
  }, [track]);

  useEffect(() => {
    load();
  }, [load]);

  const profilesById = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const productsById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const stagesById = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s])), [stages]);
  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);

  const filteredTasks = tasks
    .filter((t) => {
      if (hideDone && stagesById[t.stage_id]?.is_final) return false;
      if (fAssignee === 'none' && t.assignee_id) return false;
      if (fAssignee !== 'all' && fAssignee !== 'none' && t.assignee_id !== fAssignee) return false;
      if (fPriority !== 'all' && t.priority !== fPriority) return false;
      if (fStage !== 'all' && t.stage_id !== fStage) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const prod = t.product_id ? productsById[t.product_id] : null;
        const hay = `${t.title} ${t.notes} ${prod ? prod.code + ' ' + prod.name : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'priority') {
        const order: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      }
      // datas: sem data sempre por último; asc = mais próximo primeiro, desc = mais distante primeiro
      if (sort === 'prazo' || sort === 'prazo_desc' || sort === 'meta' || sort === 'meta_desc') {
        const field = sort.startsWith('meta') ? 'target_date' : 'due_date';
        const desc = sort.endsWith('_desc');
        const av = a[field];
        const bv = b[field];
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return desc ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      if (sort === 'assignee') {
        const an = a.assignee_id ? profilesById[a.assignee_id]?.name ?? '' : '';
        const bn = b.assignee_id ? profilesById[b.assignee_id]?.name ?? '' : '';
        if (!an && !bn) return 0;
        if (!an) return 1;
        if (!bn) return -1;
        return an.localeCompare(bn, 'pt-BR');
      }
      if (sort === 'stage') return (stagesById[a.stage_id]?.position ?? 0) - (stagesById[b.stage_id]?.position ?? 0);
      return a.position - b.position;
    });

  const terminalStageIds = sortedStages.filter((s) => s.is_final).map((s) => s.id);

  async function createTask(title: string) {
    const firstStage = sortedStages[0];
    if (!firstStage) {
      setStageError('Crie ao menos uma etapa antes de adicionar demandas.');
      return;
    }
    const { data } = await supabase
      .from('tasks')
      .insert({ project_id: null, packaging_track: track, title, stage_id: firstStage.id, priority: 'medium', position: tasks.length })
      .select()
      .single();
    if (data) await materializeSubsteps(data.id, firstStage.id);
    if (profile && data) await logActivity({ actorId: profile.id, actionText: 'Demanda de embalagem criada', detail: title, taskId: data.id });
    load();
  }

  async function createDemand(fields: { product_id: string; title: string; start_date: string; target_date: string; due_date: string; priority: Priority }) {
    const firstStage = sortedStages[0];
    if (!firstStage) {
      setStageError('Crie ao menos uma etapa antes de adicionar demandas.');
      return;
    }
    const { data } = await supabase
      .from('tasks')
      .insert({
        project_id: null,
        packaging_track: track,
        stage_id: firstStage.id,
        product_id: fields.product_id || null,
        title: fields.title.trim(),
        priority: fields.priority,
        start_date: fields.start_date || null,
        target_date: fields.target_date || null,
        due_date: fields.due_date || null,
        position: tasks.length,
      })
      .select()
      .single();
    if (data) await materializeSubsteps(data.id, firstStage.id);
    if (profile && data) await logActivity({ actorId: profile.id, actionText: 'Demanda de embalagem criada', detail: fields.title, taskId: data.id });
    setShowNew(false);
    load();
  }

  async function changeStage(taskId: string, stageId: string) {
    if (!profile) return;
    const task = tasks.find((t) => t.id === taskId);
    const targetStage = stagesById[stageId];
    const currentStage = task ? stagesById[task.stage_id] : undefined;
    if (targetStage?.is_final && !task?.assignee_id) {
      setBlockInfo({
        message: 'Esta etapa é final — atribua um responsável à demanda antes de movê-la para cá.',
        fromStage: currentStage?.name ?? '',
        pending: [],
        task: task ?? null,
      });
      return;
    }
    if (targetStage && currentStage && targetStage.position > currentStage.position) {
      const { data: pending } = await supabase
        .from('task_checklist_items')
        .select('label, stage_id, substep_id')
        .eq('task_id', taskId)
        .eq('is_gate', true)
        .eq('done', false);
      const list = (pending as { label: string; stage_id: string | null; substep_id: string | null }[]) ?? [];
      if (list.length > 0) {
        setBlockInfo({
          message: `Para sair da etapa "${currentStage.name}" e avançar para "${targetStage.name}", conclua os itens obrigatórios abaixo:`,
          fromStage: currentStage.name,
          pending: list.map((p) => ({
            label: p.label,
            stageName: p.stage_id ? stagesById[p.stage_id]?.name ?? null : null,
            isSubstep: Boolean(p.substep_id),
          })),
          task: task ?? null,
        });
        return;
      }
    }
    setStageError(null);
    // entregue = entrou numa etapa final → grava completed_at (sai da final → limpa)
    await supabase
      .from('tasks')
      .update({ stage_id: stageId, updated_by: profile.id, completed_at: targetStage?.is_final ? new Date().toISOString() : null })
      .eq('id', taskId);
    await materializeSubsteps(taskId, stageId);
    await logActivity({ actorId: profile.id, actionText: 'Demanda de embalagem movida', detail: `${task?.title ?? ''} → ${targetStage?.name ?? ''}`, taskId });
    load();
  }

  async function saveTask(taskId: string, fields: Partial<Task>) {
    await supabase.from('tasks').update({ ...fields, updated_by: profile?.id }).eq('id', taskId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Demanda de embalagem editada', taskId });
    setEditingTask(null);
    load();
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Demanda de embalagem excluída', taskId });
    setEditingTask(null);
    load();
  }

  // ---- gestão de etapas (por trilha) ----
  async function addStage(e: FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    const position = sortedStages.length > 0 ? Math.max(...sortedStages.map((s) => s.position)) + 1 : 1;
    await supabase.from('stages').insert({ project_id: null, packaging_track: track, name: newStageName.trim(), position, is_final: false });
    setNewStageName('');
    load();
  }
  async function renameStage(stageId: string, name: string) {
    if (!name.trim()) return;
    await supabase.from('stages').update({ name: name.trim() }).eq('id', stageId);
    load();
  }
  async function toggleStageFinal(stageId: string, isFinal: boolean) {
    await supabase.from('stages').update({ is_final: isFinal }).eq('id', stageId);
    load();
  }
  async function moveStage(stageId: string, dir: 'up' | 'down') {
    const idx = sortedStages.findIndex((s) => s.id === stageId);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= sortedStages.length) return;
    const a = sortedStages[idx];
    const b = sortedStages[swap];
    await Promise.all([
      supabase.from('stages').update({ position: b.position }).eq('id', a.id),
      supabase.from('stages').update({ position: a.position }).eq('id', b.id),
    ]);
    load();
  }
  async function deleteStage(stageId: string) {
    if (tasks.some((t) => t.stage_id === stageId)) {
      setStageError('Essa etapa ainda tem demandas — mova ou exclua as demandas antes de remover a etapa.');
      return;
    }
    setStageError(null);
    await supabase.from('stages').delete().eq('id', stageId);
    load();
  }

  const kanbanTasks = filteredTasks.map((t) => ({
    id: t.id,
    stage: t.stage_id,
    priority: t.priority,
    assignee_id: t.assignee_id,
    title: t.title,
    due_date: t.due_date,
  }));
  const kanbanStages = sortedStages.map((s) => ({ key: s.id, label: s.name }));

  const totalPlanned = tasks.reduce((acc, t) => acc + (t.budget ?? 0), 0);

  return (
    <div className="page">
      <h1 className="page-title">{moduleTitle}</h1>
      <div className="page-sub">
        Módulo independente com todas as embalagens de todos os SKUs, em duas trilhas. Cada embalagem é uma demanda
        com etapas editáveis, checklist com gate e aprovação por menção.
      </div>

      {/* Trilhas */}
      <div className="filters-row">
        {tracks.map((t) => (
          <div key={t.key} className={`filter-chip${track === t.key ? ' active' : ''}`} onClick={() => { setTrack(t.key); setFStage('all'); }} title={t.hint}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Abas do módulo */}
      <div className="detail-tabs" style={{ marginTop: 8 }}>
        {([['demandas', 'Demandas'], ['calendario', 'Calendário'], ['financeiro', 'Financeiro'], ['arquivos', 'Arquivos'], ['historico', 'Histórico']] as [Tab, string][]).map(([key, label]) => (
          <div key={key} className={`dtab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>

      {stageError && (
        <div className="banner error" style={{ marginTop: 10 }}>
          <span className="ic">✕</span>
          <span>{stageError}</span>
        </div>
      )}

      {loading ? (
        <div className="page-sub" style={{ marginTop: 12 }}>Carregando…</div>
      ) : tab === 'demandas' ? (
        <div style={{ marginTop: 10 }}>
          {/* Ações — ficam acima, separadas dos filtros */}
          <div className="filters-row" style={{ justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
            <button className="btn sm" onClick={() => setShowNew(true)}>+ Nova demanda</button>
            <div className={`filter-chip${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')}>Kanban</div>
            <div className={`filter-chip${view === 'lista' ? ' active' : ''}`} onClick={() => setView('lista')}>Lista</div>
            <div className="filter-chip" onClick={() => setManagingStages((v) => !v)}>⚙ Etapas</div>
          </div>

          {/* Filtros — logo acima do board (colados na estrutura das etapas) */}
          <div className="filters-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Buscar por título, SKU, código…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220, flex: 1 }} />
            <select className="chip-select" value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
              <option value="all">Responsável: todos</option>
              <option value="none">Sem responsável</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select className="chip-select" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
              <option value="all">Prioridade: todas</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
            <select className="chip-select" value={fStage} onChange={(e) => setFStage(e.target.value)}>
              <option value="all">Etapa: todas</option>
              {sortedStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select className="chip-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="recent">Ordenar: posição</option>
              <option value="title">Ordenar: título (A-Z)</option>
              <option value="priority">Ordenar: prioridade</option>
              <option value="prazo">🏁 Prazo: mais próximo primeiro</option>
              <option value="prazo_desc">🏁 Prazo: mais distante primeiro</option>
              <option value="meta">🎯 Meta: mais próxima primeiro</option>
              <option value="meta_desc">🎯 Meta: mais distante primeiro</option>
              <option value="assignee">Ordenar: responsável</option>
              <option value="stage">Ordenar: etapa</option>
            </select>
            <label className="filter-chip" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} style={{ width: 'auto', marginRight: 6 }} />
              Ocultar finalizadas
            </label>
          </div>

          {managingStages && (
            <div className="panel" style={{ marginTop: 10 }}>
              <h4>Etapas da trilha {tracks.find((t) => t.key === track)?.label}</h4>
              {sortedStages.map((s, i) => (
                <div key={s.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                    <input defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && renameStage(s.id, e.target.value)} style={{ flex: 1 }} />
                    <label style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" checked={s.is_final} onChange={(e) => toggleStageFinal(s.id, e.target.checked)} style={{ width: 'auto' }} /> final
                    </label>
                    <button className="btn ghost sm" onClick={() => setExpandedStage((v) => (v === s.id ? null : s.id))} title="Sub-etapas">
                      {expandedStage === s.id ? '▾' : '▸'} sub-etapas
                    </button>
                    <button className="btn ghost sm" disabled={i === 0} onClick={() => moveStage(s.id, 'up')}>↑</button>
                    <button className="btn ghost sm" disabled={i === sortedStages.length - 1} onClick={() => moveStage(s.id, 'down')}>↓</button>
                    <button className="btn ghost sm" onClick={() => deleteStage(s.id)}>✕</button>
                  </div>
                  {expandedStage === s.id && <StageSubstepsEditor stageId={s.id} />}
                </div>
              ))}
              <form onSubmit={addStage} className="responsive-row" style={{ marginTop: 8 }}>
                <input placeholder="Nova etapa" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} style={{ flex: 1 }} />
                <button className="btn sm" type="submit">Adicionar etapa</button>
              </form>
            </div>
          )}

          {sortedStages.length === 0 ? (
            <div className="locked-banner" style={{ marginTop: 10 }}>
              <span className="ic">▤</span>Nenhuma etapa nesta trilha — rode a migration 0038 ou crie etapas em ⚙ Etapas.
            </div>
          ) : view === 'kanban' ? (
            <div style={{ marginTop: 10 }}>
              <KanbanBoard
                tasks={kanbanTasks}
                profilesById={profilesById}
                editable
                cols={sortedStages.length <= 5 ? 5 : 6}
                stages={kanbanStages}
                terminalStages={terminalStageIds}
                onStageChange={changeStage}
                onCreate={createTask}
                onEdit={(kt) => setEditingTask(tasks.find((t) => t.id === kt.id) ?? null)}
                renderExtra={(kt) => {
                  const t = tasks.find((x) => x.id === kt.id);
                  if (!t) return null;
                  const prod = t.product_id ? productsById[t.product_id] : null;
                  const isFinal = stagesById[t.stage_id]?.is_final;
                  const overduePrazo = t.due_date && !isFinal && new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
                  return (
                    <div style={{ marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {prod && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>SKU {prod.code}</div>}
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, flexWrap: 'wrap' }}>
                        {t.target_date && (
                          <span style={{ color: 'var(--violet)' }}>🎯 {new Date(t.target_date + 'T00:00').toLocaleDateString('pt-BR')}</span>
                        )}
                        {t.due_date && (
                          <span style={{ color: overduePrazo ? 'var(--red)' : 'var(--text-faint)', fontWeight: overduePrazo ? 700 : 400 }}>
                            🏁 {new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table className="simple">
                <thead>
                  <tr>
                    <th>Demanda</th>
                    <th>SKU</th>
                    <th>Etapa</th>
                    <th>Responsável</th>
                    <th>Prioridade</th>
                    <th>🎯 Meta</th>
                    <th>🏁 Prazo final</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t) => {
                    const prod = t.product_id ? productsById[t.product_id] : null;
                    const isFinal = stagesById[t.stage_id]?.is_final;
                    const overduePrazo = t.due_date && !isFinal && new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
                    return (
                      <tr
                        key={t.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setEditingTask(t)}
                        onMouseEnter={(e) =>
                          prod &&
                          (prod.image_url || prod.packaging_image_url) &&
                          setHover({ code: prod.code, name: prod.name, product: prod.image_url, packaging: prod.packaging_image_url, x: e.clientX, y: e.clientY })
                        }
                        onMouseMove={(e) => setHover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
                        onMouseLeave={() => setHover(null)}
                      >
                        <td data-label="Demanda">{t.title}</td>
                        <td data-label="SKU" style={{ color: 'var(--text-faint)' }}>{prod ? `${prod.code} — ${prod.name}` : '—'}</td>
                        <td data-label="Etapa" style={{ color: 'var(--text-faint)' }}>{stagesById[t.stage_id]?.name ?? '—'}</td>
                        <td data-label="Responsável" style={{ color: 'var(--text-faint)' }}>{t.assignee_id ? profilesById[t.assignee_id]?.name : '—'}</td>
                        <td data-label="Prioridade"><span className={`prio ${t.priority}`}>{PRIORITY_LABELS[t.priority]}</span></td>
                        <td data-label="Meta" style={{ color: 'var(--violet)' }}>{t.target_date ? new Date(t.target_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td data-label="Prazo final" style={{ color: overduePrazo ? 'var(--red)' : 'var(--text-faint)', fontWeight: overduePrazo ? 700 : 400 }}>{t.due_date ? new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTasks.length === 0 && <div className="page-sub" style={{ marginTop: 8 }}>Nenhuma demanda nesta visão.</div>}
            </div>
          )}
        </div>
      ) : tab === 'calendario' ? (
        <PackagingCalendar tasks={tasks} stagesById={stagesById} myId={profile?.id ?? null} onOpen={setEditingTask} />
      ) : tab === 'financeiro' ? (
        <div style={{ marginTop: 12 }}>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Orçamento planejado</div>
              <div className="stat-num">{totalPlanned.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div className="stat-trend">soma das demandas desta trilha</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Demandas</div>
              <div className="stat-num">{tasks.length}</div>
              <div className="stat-trend">{tasks.filter((t) => t.budget).length} com orçamento</div>
            </div>
          </div>
          <table className="simple" style={{ marginTop: 10 }}>
            <thead><tr><th>Demanda</th><th>SKU</th><th>Orçamento</th></tr></thead>
            <tbody>
              {tasks.filter((t) => t.budget).map((t) => {
                const prod = t.product_id ? productsById[t.product_id] : null;
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setEditingTask(t)}>
                    <td data-label="Demanda">{t.title}</td>
                    <td data-label="SKU" style={{ color: 'var(--text-faint)' }}>{prod ? prod.code : '—'}</td>
                    <td data-label="Orçamento">{(t.budget ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tasks.filter((t) => t.budget).length === 0 && <div className="page-sub" style={{ marginTop: 8 }}>Nenhuma demanda com orçamento ainda (defina no campo Orçamento da demanda).</div>}
        </div>
      ) : tab === 'arquivos' ? (
        <div style={{ marginTop: 12 }}>
          {files.length === 0 ? (
            <div className="locked-banner"><span className="ic">▤</span>Nenhum arquivo anexado às demandas desta trilha.</div>
          ) : (
            <div className="panel">
              {files.map((f) => (
                <div key={f.id} className="field-row">
                  <a href={f.url} target="_blank" rel="noreferrer">{f.name}</a>
                  <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{f.task?.title ?? ''}</span>
                </div>
              ))}
            </div>
          )}
          <div className="page-sub" style={{ marginTop: 8 }}>Anexe arquivos abrindo uma demanda → Arquivos.</div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {activity.length === 0 ? (
            <div className="locked-banner"><span className="ic">◷</span>Nenhuma atividade registrada ainda.</div>
          ) : (
            <div className="panel">
              {activity.map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span><strong>{a.actor?.name ?? '—'}</strong> {a.action_text}{a.detail ? <span style={{ color: 'var(--text-faint)' }}> · {a.detail}</span> : ''}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewDemandModal products={products} onClose={() => setShowNew(false)} onCreate={createDemand} />
      )}

      {blockInfo && (
        <Modal title="🔒 Não é possível avançar" onClose={() => setBlockInfo(null)}>
          <div className="banner error" style={{ marginBottom: 12 }}>
            <span className="ic">⛔</span>
            <span>{blockInfo.message}</span>
          </div>
          {blockInfo.pending.length > 0 && (
            <div className="panel" style={{ marginBottom: 12 }}>
              <h4 style={{ marginTop: 0 }}>O que está impedindo o avanço ({blockInfo.pending.length})</h4>
              {blockInfo.pending.map((p, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', gap: 8, alignItems: 'flex-start', borderLeft: '3px solid var(--red)', background: 'var(--red-dim)', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}
                >
                  <span style={{ color: 'var(--red)' }}>🔒</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {p.isSubstep ? `Sub-etapa${p.stageName ? ` · ${p.stageName}` : ''}` : 'Item de checklist'} · condicional (obrigatória para avançar)
                    </div>
                  </div>
                </div>
              ))}
              <div className="page-sub" style={{ marginTop: 4 }}>
                Marque esses itens como concluídos na demanda para liberar o avanço.
              </div>
            </div>
          )}
          <div className="modal-actions">
            {blockInfo.task && (
              <button
                className="btn"
                onClick={() => {
                  const t = blockInfo.task;
                  setBlockInfo(null);
                  setEditingTask(t);
                }}
              >
                Abrir demanda e resolver
              </button>
            )}
            <button className="btn ghost" onClick={() => setBlockInfo(null)}>
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {editingTask && profile && (
        <TaskEditModal
          task={editingTask}
          profiles={profiles}
          products={products}
          stages={stages}
          actorId={profile.id}
          onClose={() => setEditingTask(null)}
          onSave={(fields) => saveTask(editingTask.id, fields)}
          onDelete={() => deleteTask(editingTask.id)}
        />
      )}

      <ProductImageHover data={hover} />
    </div>
  );
}

// Criação de demanda de embalagem — SKU é o PRIMEIRO vínculo (toda embalagem é de um SKU),
// seguido de título e das três datas da jornada: Início (start), Meta e Prazo final.
function NewDemandModal({
  products,
  onClose,
  onCreate,
}: {
  products: Product[];
  onClose: () => void;
  onCreate: (fields: { product_id: string; title: string; start_date: string; target_date: string; due_date: string; priority: Priority }) => void;
}) {
  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [target, setTarget] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [error, setError] = useState<string | null>(null);

  const selected = products.find((p) => p.id === productId);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Dê um título à demanda.');
      return;
    }
    onCreate({ product_id: productId, title, start_date: start, target_date: target, due_date: due, priority });
  }

  return (
    <Modal title="Nova demanda de embalagem" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-field">
          <label>1) Produto / SKU (vínculo principal)</label>
          <ProductCombobox products={products} value={productId} onChange={(id) => { setProductId(id); if (!title && id) { const p = products.find((x) => x.id === id); if (p) setTitle(`Embalagem — ${p.code} ${p.name}`); } }} autoOpen />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Digite o código ou nome do SKU. Ao escolher, sugerimos um título — é só ajustar.</span>
        </div>
        <div className="form-field">
          <label htmlFor="nd-title">2) Título da demanda</label>
          <input id="nd-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Embalagem primária — blister" />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="nd-start">Início (start)</label>
            <input id="nd-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="nd-target">🎯 Meta</label>
            <input id="nd-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="nd-due">🏁 Prazo final</label>
            <input id="nd-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="nd-priority">Prioridade</label>
          <select id="nd-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
        {selected && (
          <div className="page-sub" style={{ marginTop: -4 }}>Vinculada a: <strong>{selected.code}</strong> — {selected.name}</div>
        )}
        {error && (
          <div className="banner error"><span className="ic">✕</span><span>{error}</span></div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn">Criar demanda</button>
        </div>
      </form>
    </Modal>
  );
}

// Calendário do módulo: deixa claro Meta (🎯), Prazo final (🏁), Entregue (✓) e Atrasada (🔴).
function PackagingCalendar({
  tasks,
  stagesById,
  myId,
  onOpen,
}: {
  tasks: Task[];
  stagesById: Record<string, ProjectStage>;
  myId: string | null;
  onOpen: (t: Task) => void;
}) {
  // Mês exibido (offset em relação ao mês atual)
  const [monthOffset, setMonthOffset] = useState(0);
  // 'meu' = só demandas onde sou responsável; 'todos' = todas da trilha
  const [scope, setScope] = useState<'meu' | 'todos'>('meu');
  const visibleTasks = scope === 'meu' && myId ? tasks.filter((t) => t.assignee_id === myId) : tasks;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = new Date(today.toDateString());

  type Ev = { task: Task; icon: string; label: string; color: string; bg: string };
  const eventsByDay: Record<number, Ev[]> = {};
  function push(day: number, ev: Ev) {
    (eventsByDay[day] = eventsByDay[day] ?? []).push(ev);
  }
  function dayOfIso(iso: string): number | null {
    const d = new Date(iso + 'T00:00');
    return d.getFullYear() === year && d.getMonth() === month ? d.getDate() : null;
  }

  visibleTasks.forEach((t) => {
    const isFinal = stagesById[t.stage_id]?.is_final;
    if (t.target_date) {
      const d = dayOfIso(t.target_date);
      if (d) push(d, { task: t, icon: '🎯', label: t.title, color: 'var(--violet)', bg: 'var(--violet-dim)' });
    }
    if (t.due_date) {
      const d = dayOfIso(t.due_date);
      if (d) {
        const delivered = isFinal;
        const deliveredOnTime = delivered && t.completed_at && t.due_date && new Date(t.completed_at) <= new Date(t.due_date + 'T23:59');
        const overdue = !delivered && new Date(t.due_date + 'T00:00') < todayIso;
        const icon = delivered ? '✓' : overdue ? '🔴' : '🏁';
        const color = deliveredOnTime ? 'var(--green)' : delivered ? 'var(--blue)' : overdue ? 'var(--red)' : 'var(--text)';
        const bg = deliveredOnTime ? 'var(--green-dim)' : delivered ? 'var(--blue-dim)' : overdue ? 'var(--red-dim)' : 'var(--surface-2)';
        push(d, { task: t, icon, label: t.title, color, bg });
      }
    }
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthName = base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={() => setMonthOffset((m) => m - 1)}>←</button>
        <strong style={{ textTransform: 'capitalize', minWidth: 160, textAlign: 'center' }}>{monthName}</strong>
        <button className="btn ghost sm" onClick={() => setMonthOffset((m) => m + 1)}>→</button>
        <button className="btn ghost sm" onClick={() => setMonthOffset(0)}>Hoje</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <div className={`filter-chip${scope === 'meu' ? ' active' : ''}`} onClick={() => setScope('meu')}>👤 Meu</div>
          <div className={`filter-chip${scope === 'todos' ? ' active' : ''}`} onClick={() => setScope('todos')}>🌐 Todos</div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, marginBottom: 8 }}>
        {[
          { icon: '🎯', label: 'Meta', color: 'var(--violet)', bg: 'var(--violet-dim)' },
          { icon: '🏁', label: 'Prazo final', color: 'var(--text)', bg: 'var(--surface-2)' },
          { icon: '✓', label: 'Entregue no prazo/antes', color: 'var(--green)', bg: 'var(--green-dim)' },
          { icon: '✓', label: 'Entregue', color: 'var(--blue)', bg: 'var(--blue-dim)' },
          { icon: '🔴', label: 'Atrasada', color: 'var(--red)', bg: 'var(--red-dim)' },
        ].map((l) => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: l.bg, color: l.color, borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>
            {l.icon} {l.label}
          </span>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: 4, minWidth: 700 }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', padding: '2px 0' }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const isToday = day != null && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
            return (
              <div key={i} style={{ minHeight: 78, border: '1px solid var(--border)', borderRadius: 6, padding: 4, background: day == null ? 'transparent' : 'var(--surface)', outline: isToday ? '2px solid var(--violet)' : 'none' }}>
                {day != null && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 2 }}>{day}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {(eventsByDay[day] ?? []).map((ev, j) => (
                        <div
                          key={j}
                          onClick={() => onOpen(ev.task)}
                          title={`${ev.icon} ${ev.label}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 10,
                            color: ev.color,
                            background: ev.bg,
                            borderLeft: `3px solid ${ev.color}`,
                            borderRadius: 4,
                            padding: '1px 4px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span>{ev.icon}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Editor do template de sub-etapas de uma etapa: label + prazo (dias) + condicional (gate).
// Alterar o template vale para as demandas que entrarem na etapa a partir de agora.
function StageSubstepsEditor({ stageId }: { stageId: string }) {
  const [subs, setSubs] = useState<StageSubstep[]>([]);
  const [label, setLabel] = useState('');
  const [cond, setCond] = useState(false);
  const [prazo, setPrazo] = useState('');

  async function load() {
    const { data } = await supabase.from('stage_substeps').select('*').eq('stage_id', stageId).order('position');
    setSubs((data as StageSubstep[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const position = subs.length > 0 ? Math.max(...subs.map((s) => s.position)) + 1 : 1;
    await supabase.from('stage_substeps').insert({
      stage_id: stageId,
      label: label.trim(),
      position,
      is_conditional: cond,
      due_offset_days: prazo ? Number(prazo) : null,
    });
    setLabel('');
    setCond(false);
    setPrazo('');
    load();
  }
  async function rename(s: StageSubstep, name: string) {
    if (!name.trim() || name === s.label) return;
    await supabase.from('stage_substeps').update({ label: name.trim() }).eq('id', s.id);
    load();
  }
  async function toggleCond(s: StageSubstep) {
    await supabase.from('stage_substeps').update({ is_conditional: !s.is_conditional }).eq('id', s.id);
    load();
  }
  async function setOffset(s: StageSubstep, val: string) {
    await supabase.from('stage_substeps').update({ due_offset_days: val === '' ? null : Number(val) }).eq('id', s.id);
    load();
  }
  async function move(s: StageSubstep, dir: 'up' | 'down') {
    const idx = subs.findIndex((x) => x.id === s.id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= subs.length) return;
    const a = subs[idx];
    const b = subs[swap];
    await Promise.all([
      supabase.from('stage_substeps').update({ position: b.position }).eq('id', a.id),
      supabase.from('stage_substeps').update({ position: a.position }).eq('id', b.id),
    ]);
    load();
  }
  async function del(id: string) {
    await supabase.from('stage_substeps').delete().eq('id', id);
    load();
  }

  return (
    <div style={{ margin: '2px 0 8px 16px', padding: '8px 10px', borderLeft: '2px solid var(--border)', background: 'var(--surface)' }}>
      {subs.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sem sub-etapas nesta etapa.</div>}
      {subs.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <input defaultValue={s.label} onBlur={(e) => rename(s, e.target.value)} style={{ flex: 1 }} />
          <input
            type="number"
            defaultValue={s.due_offset_days ?? ''}
            onBlur={(e) => setOffset(s, e.target.value)}
            placeholder="prazo (d)"
            title="Prazo em dias após entrar na etapa"
            style={{ width: 90 }}
          />
          <button
            type="button"
            className="btn ghost sm"
            title={s.is_conditional ? 'Condicional (trava avanço) — clique p/ opcional' : 'Tornar condicional (trava avanço)'}
            onClick={() => toggleCond(s)}
            style={{ color: s.is_conditional ? 'var(--yellow)' : 'var(--text-faint)' }}
          >
            {s.is_conditional ? '🔒' : '🔓'}
          </button>
          <button type="button" className="btn ghost sm" disabled={i === 0} onClick={() => move(s, 'up')}>↑</button>
          <button type="button" className="btn ghost sm" disabled={i === subs.length - 1} onClick={() => move(s, 'down')}>↓</button>
          <button type="button" className="btn ghost sm" onClick={() => del(s.id)}>✕</button>
        </div>
      ))}
      <form onSubmit={add} className="responsive-row" style={{ marginTop: 6, alignItems: 'center' }}>
        <input placeholder="Nova sub-etapa" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1 }} />
        <input type="number" placeholder="prazo (d)" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={{ width: 90 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={cond} onChange={(e) => setCond(e.target.checked)} style={{ width: 'auto' }} /> 🔒 condicional
        </label>
        <button type="submit" className="btn sm">Adicionar</button>
      </form>
    </div>
  );
}
