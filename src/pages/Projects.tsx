import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjectsOverview, type ProjectWithBrand } from '../hooks/useProjectsOverview';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import ProjectCard from '../components/ProjectCard';
import Modal from '../components/Modal';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  type Brand,
  type Priority,
  type Profile,
  type ProjectStage,
  type ProjectStatus,
  type ProjectTemplate,
  type ProjectTemplateChecklistItem,
  type ProjectTemplateStage,
  type ProjectTemplateTask,
} from '../types/database';

const STATUS_OPTIONS: { key: ProjectStatus; label: string }[] = [
  { key: 'planning', label: 'Planejamento' },
  { key: 'active', label: 'Ativo' },
  { key: 'paused', label: 'Atenção' },
  { key: 'done', label: 'Concluído' },
];

type SortBy = 'recent' | 'name' | 'priority' | 'prazo' | 'progresso';
type GroupBy = 'none' | 'brand' | 'status' | 'priority' | 'category' | 'responsavel';
type View = 'projetos' | 'modelos';

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function Projects() {
  const { profile } = useAuth();
  const { projects, loading, error, reload, percentFor } = useProjectsOverview();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<View>('projetos');

  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [hideDone, setHideDone] = useState(false);

  const loadExtras = useCallback(async () => {
    const [brandsRes, profilesRes, templatesRes] = await Promise.all([
      supabase.from('brands').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('project_templates').select('*').order('name'),
    ]);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setTemplates((templatesRes.data as ProjectTemplate[]) ?? []);
  }, []);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const profilesById = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const categories = useMemo(
    () => Array.from(new Set(projects.map((p) => p.category).filter(Boolean))).sort(),
    [projects]
  );

  function statusLabel(status: ProjectStatus) {
    return STATUS_OPTIONS.find((s) => s.key === status)?.label ?? status;
  }

  function groupLabel(p: ProjectWithBrand): string {
    if (groupBy === 'brand') return p.brand?.label ?? 'Sem marca';
    if (groupBy === 'status') return statusLabel(p.status);
    if (groupBy === 'priority') return PRIORITY_LABELS[p.priority];
    if (groupBy === 'category') return p.category || 'Sem categoria';
    if (groupBy === 'responsavel') return p.created_by ? profilesById[p.created_by]?.name ?? 'Desconhecido' : 'Sem responsável';
    return '';
  }

  const filtered = projects.filter((p) => {
    if (brandFilter !== 'all' && p.brand?.key !== brandFilter) return false;
    if (hideDone && p.status === 'done') return false;
    if (personFilter === 'none' && p.created_by) return false;
    if (personFilter !== 'all' && personFilter !== 'none' && p.created_by !== personFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.sub.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !p.ref.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    if (sortBy === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sortBy === 'prazo') {
      if (!a.end_date && !b.end_date) return 0;
      if (!a.end_date) return 1;
      if (!b.end_date) return -1;
      return a.end_date.localeCompare(b.end_date);
    }
    if (sortBy === 'progresso') return percentFor(b.id) - percentFor(a.id);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const groups =
    groupBy === 'none'
      ? [{ label: '', items: sorted }]
      : Object.entries(
          sorted.reduce<Record<string, ProjectWithBrand[]>>((acc, p) => {
            const key = groupLabel(p);
            (acc[key] ??= []).push(p);
            return acc;
          }, {})
        ).map(([label, items]) => ({ label, items }));

  async function duplicateProject(p: ProjectWithBrand) {
    if (!profile) return;
    const { data: newProj, error: insertError } = await supabase
      .from('projects')
      .insert({
        brand_id: p.brand_id,
        name: `${p.name} (cópia)`,
        sub: p.sub,
        category: p.category,
        priority: p.priority,
        status: 'planning',
        objective: p.objective,
        created_by: profile.id,
      })
      .select()
      .single();
    if (insertError || !newProj) return;

    const [checklistRes, tasksRes, sourceStagesRes] = await Promise.all([
      supabase.from('checklist_items').select('label, position').eq('project_id', p.id),
      supabase.from('tasks').select('title, priority, position').eq('project_id', p.id),
      supabase.from('stages').select('*').eq('project_id', p.id).order('position'),
    ]);
    const checklist = checklistRes.data as { label: string; position: number }[] | null;
    const tasks = tasksRes.data as { title: string; priority: Priority; position: number }[] | null;
    const sourceStages = (sourceStagesRes.data as ProjectStage[] | null) ?? [];
    if (checklist && checklist.length > 0) {
      await supabase
        .from('checklist_items')
        .insert(checklist.map((c) => ({ project_id: newProj.id, label: c.label, position: c.position })));
    }
    if (sourceStages.length > 0) {
      await supabase.from('stages').insert(
        sourceStages.map((s) => ({ project_id: newProj.id, name: s.name, position: s.position, is_final: s.is_final }))
      );
    }
    const { data: newStages } = await supabase
      .from('stages')
      .select('*')
      .eq('project_id', newProj.id)
      .order('position');
    const firstStage = (newStages as ProjectStage[] | null)?.[0];
    if (tasks && tasks.length > 0 && firstStage) {
      await supabase.from('tasks').insert(
        tasks.map((t) => ({
          project_id: newProj.id,
          title: t.title,
          priority: t.priority,
          stage_id: firstStage.id,
          position: t.position,
        }))
      );
    }
    await logActivity({
      actorId: profile.id,
      actionText: 'Projeto duplicado',
      detail: `a partir de "${p.name}"`,
      projectId: newProj.id,
    });
    reload();
  }

  return (
    <div className="page">
      <h1 className="page-title">Projetos</h1>
      <div className="page-sub">
        Cada projeto é independente — com cronograma, equipe, demandas e arquivos próprios.
      </div>

      <div className="brand-tabs">
        <div className={`brand-tab${view === 'projetos' ? ' active' : ''}`} onClick={() => setView('projetos')}>
          Projetos
        </div>
        <div className={`brand-tab${view === 'modelos' ? ' active' : ''}`} onClick={() => setView('modelos')}>
          Modelos
        </div>
      </div>

      {view === 'modelos' ? (
        <TemplatesView
          templates={templates}
          canEdit={profile?.department !== 'assistente'}
          onReload={loadExtras}
        />
      ) : (
        <>
          <div className="brand-tabs">
            <div className={`brand-tab${brandFilter === 'all' ? ' active' : ''}`} onClick={() => setBrandFilter('all')}>
              Todas as marcas
            </div>
            {brands.map((b) => (
              <div
                key={b.id}
                className={`brand-tab${brandFilter === b.key ? ' active' : ''}`}
                onClick={() => setBrandFilter(b.key)}
              >
                <span className="sw" style={{ background: b.color }} />
                {b.label}
              </div>
            ))}
          </div>

          <div className="filters-row">
            <input
              className="chip-input"
              placeholder="⌕ Pesquisar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="chip-select" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
              <option value="all">Pessoa: todas</option>
              <option value="none">Sem responsável</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className="chip-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Status: todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select className="chip-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">Prioridade: todas</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <select className="chip-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">Categoria: todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select className="chip-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="recent">Ordenar: mais recentes</option>
              <option value="name">Ordenar: nome (A-Z)</option>
              <option value="priority">Ordenar: prioridade</option>
              <option value="prazo">Ordenar: prazo</option>
              <option value="progresso">Ordenar: progresso</option>
            </select>
            <select className="chip-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="none">Agrupar por: nada</option>
              <option value="brand">Agrupar por: marca</option>
              <option value="status">Agrupar por: status</option>
              <option value="priority">Agrupar por: prioridade</option>
              <option value="category">Agrupar por: categoria</option>
              <option value="responsavel">Agrupar por: responsável</option>
            </select>
            <div className={`filter-chip${hideDone ? ' active' : ''}`} onClick={() => setHideDone((v) => !v)}>
              {hideDone ? '◐ Mostrando ativos' : '◎ Ocultar concluídos'}
            </div>
          </div>

          <div className="section-head">
            <h2>{filtered.length} projetos</h2>
            <button className="btn" onClick={() => setShowNew(true)}>
              + Novo projeto
            </button>
          </div>

          {error && (
            <div className="banner error">
              <span className="ic">⚠</span>
              <span>Não foi possível carregar os projetos: {error}</span>
            </div>
          )}

          {loading ? (
            <div className="page-sub">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="locked-banner">
              <span className="ic">◐</span>Nenhum projeto encontrado para esse filtro.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label || 'all'} style={{ marginBottom: 22 }}>
                {g.label && <h3 style={{ fontSize: 13, color: 'var(--text-faint)', margin: '0 0 10px' }}>{g.label} · {g.items.length}</h3>}
                <div className="project-grid">
                  {g.items.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      brand={p.brand}
                      percent={percentFor(p.id)}
                      onDuplicate={() => duplicateProject(p)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {showNew && profile && (
        <NewProjectModal
          brands={brands}
          templates={templates}
          actorId={profile.id}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function NewProjectModal({
  brands,
  templates,
  actorId,
  onClose,
  onCreated,
}: {
  brands: Brand[];
  templates: ProjectTemplate[];
  actorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [sub, setSub] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [objective, setObjective] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setCategory(t.category);
    setPriority(t.default_priority);
    setObjective(t.objective);
    if (!sub) setSub(t.description);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brandId) {
      setFormError('Escolha uma marca.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        brand_id: brandId,
        sub,
        category,
        priority,
        status,
        objective,
        created_by: actorId,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      setFormError(error.message);
      return;
    }

    if (templateId) {
      const [checklistRes, tasksRes, templateStagesRes] = await Promise.all([
        supabase
          .from('project_template_checklist_items')
          .select('*')
          .eq('template_id', templateId)
          .order('position'),
        supabase.from('project_template_tasks').select('*').eq('template_id', templateId).order('position'),
        supabase.from('project_template_stages').select('*').eq('template_id', templateId).order('position'),
      ]);
      const checklistItems = (checklistRes.data as ProjectTemplateChecklistItem[]) ?? [];
      const templateTasks = (tasksRes.data as ProjectTemplateTask[]) ?? [];
      const templateStages = (templateStagesRes.data as ProjectTemplateStage[]) ?? [];
      if (checklistItems.length > 0) {
        await supabase
          .from('checklist_items')
          .insert(checklistItems.map((c) => ({ project_id: data.id, label: c.label, position: c.position })));
      }
      if (templateStages.length > 0) {
        await supabase
          .from('stages')
          .insert(templateStages.map((s) => ({ project_id: data.id, name: s.name, position: s.position, is_final: s.is_final })));
      }
      const { data: newStages } = await supabase.from('stages').select('*').eq('project_id', data.id).order('position');
      const stageIdByTemplateStage = new Map<string, string>();
      (newStages as ProjectStage[] | null)?.forEach((s, i) => {
        const templateStage = templateStages[i];
        if (templateStage) stageIdByTemplateStage.set(templateStage.id, s.id);
      });
      if (templateTasks.length > 0) {
        await supabase.from('tasks').insert(
          templateTasks.map((t) => ({
            project_id: data.id,
            title: t.title,
            stage_id: stageIdByTemplateStage.get(t.stage_template_id),
            priority: t.priority,
            position: t.position,
          }))
        );
      }
    } else {
      await supabase.from('stages').insert([
        { project_id: data.id, name: 'Recebido', position: 1, is_final: false },
        { project_id: data.id, name: 'Planejamento', position: 2, is_final: false },
        { project_id: data.id, name: 'Produção', position: 3, is_final: false },
        { project_id: data.id, name: 'Revisão', position: 4, is_final: false },
        { project_id: data.id, name: 'Aprovação', position: 5, is_final: false },
        { project_id: data.id, name: 'Finalizado', position: 6, is_final: true },
      ]);
    }

    setSaving(false);
    await logActivity({ actorId, actionText: 'Projeto criado', projectId: data.id });
    onCreated();
  }

  return (
    <Modal title="Novo projeto" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {templates.length > 0 && (
          <div className="form-field">
            <label htmlFor="np-template">Começar de um modelo (opcional)</label>
            <select id="np-template" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Projeto em branco</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field">
          <label htmlFor="np-name">Nome</label>
          <input id="np-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="np-brand">Marca</label>
          <select id="np-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="np-sub">Subtítulo</label>
          <input id="np-sub" value={sub} onChange={(e) => setSub(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="np-category">Categoria</label>
          <input id="np-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="np-priority">Prioridade</label>
          <select id="np-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="np-status">Status</label>
          <select id="np-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            <option value="planning">Planejamento</option>
            <option value="active">Ativo</option>
            <option value="paused">Atenção</option>
            <option value="done">Concluído</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="np-objective">Objetivo</label>
          <textarea
            id="np-objective"
            rows={3}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </div>
        {templateId && (
          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-4px 0 12px' }}>
            Ao criar, o checklist e as demandas padrão desse modelo já são copiados para o projeto novo.
          </p>
        )}
        {formError && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{formError}</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Criando…' : 'Criar projeto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TemplatesView({
  templates,
  canEdit,
  onReload,
}: {
  templates: ProjectTemplate[];
  canEdit: boolean;
  onReload: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ProjectTemplate | null>(null);

  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Modelos prontos pra acelerar a criação de projetos recorrentes — já vêm com checklist e demandas padrão.
      </div>
      <div className="section-head">
        <h2>{templates.length} modelos</h2>
        {canEdit && (
          <button className="btn" onClick={() => setShowNew(true)}>
            + Novo modelo
          </button>
        )}
      </div>
      <div className="project-grid">
        {templates.map((t) => (
          <div key={t.id} className="project-card" style={canEdit ? { cursor: 'pointer' } : undefined} onClick={() => canEdit && setEditing(t)}>
            <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
              {t.category || 'Sem categoria'}
            </span>
            <h3>{t.name}</h3>
            <p>{t.description}</p>
            <div className="project-meta">
              <span className="pill">{PRIORITY_LABELS[t.default_priority]}</span>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="locked-banner">
            <span className="ic">◐</span>Nenhum modelo cadastrado ainda.
          </div>
        )}
      </div>

      {showNew && (
        <TemplateFormModal
          onClose={() => setShowNew(false)}
          onCreated={(created) => {
            onReload();
            setShowNew(false);
            setEditing(created);
          }}
        />
      )}
      {editing && (
        <TemplateFormModal
          template={editing}
          onClose={() => {
            setEditing(null);
            onReload();
          }}
          onCreated={() => onReload()}
        />
      )}
    </div>
  );
}

function TemplateFormModal({
  template,
  onClose,
  onCreated,
}: {
  template?: ProjectTemplate;
  onClose: () => void;
  onCreated: (created: ProjectTemplate) => void;
}) {
  const isEdit = Boolean(template);
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [category, setCategory] = useState(template?.category ?? '');
  const [priority, setPriority] = useState<Priority>(template?.default_priority ?? 'medium');
  const [objective, setObjective] = useState(template?.objective ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [checklist, setChecklist] = useState<ProjectTemplateChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [tasks, setTasks] = useState<ProjectTemplateTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStageId, setNewTaskStageId] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [templateStages, setTemplateStages] = useState<ProjectTemplateStage[]>([]);
  const [newStageName, setNewStageName] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);

  const sortedTemplateStages = [...templateStages].sort((a, b) => a.position - b.position);
  const templateStagesById = Object.fromEntries(templateStages.map((s) => [s.id, s]));

  const loadSubItems = useCallback(async () => {
    if (!template) return;
    const [checklistRes, tasksRes, stagesRes] = await Promise.all([
      supabase.from('project_template_checklist_items').select('*').eq('template_id', template.id).order('position'),
      supabase.from('project_template_tasks').select('*').eq('template_id', template.id).order('position'),
      supabase.from('project_template_stages').select('*').eq('template_id', template.id).order('position'),
    ]);
    setChecklist((checklistRes.data as ProjectTemplateChecklistItem[]) ?? []);
    setTasks((tasksRes.data as ProjectTemplateTask[]) ?? []);
    setTemplateStages((stagesRes.data as ProjectTemplateStage[]) ?? []);
  }, [template]);

  useEffect(() => {
    loadSubItems();
  }, [loadSubItems]);

  useEffect(() => {
    if (!newTaskStageId && sortedTemplateStages.length > 0) setNewTaskStageId(sortedTemplateStages[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateStages]);

  async function addTemplateStage(e: FormEvent) {
    e.preventDefault();
    if (!template || !newStageName.trim()) return;
    const position = sortedTemplateStages.length > 0 ? Math.max(...sortedTemplateStages.map((s) => s.position)) + 1 : 1;
    await supabase.from('project_template_stages').insert({ template_id: template.id, name: newStageName.trim(), position, is_final: false });
    setNewStageName('');
    loadSubItems();
  }

  async function renameTemplateStage(stageId: string, name: string) {
    if (!name.trim()) return;
    await supabase.from('project_template_stages').update({ name: name.trim() }).eq('id', stageId);
    loadSubItems();
  }

  async function toggleTemplateStageFinal(stageId: string, isFinal: boolean) {
    await supabase.from('project_template_stages').update({ is_final: isFinal }).eq('id', stageId);
    loadSubItems();
  }

  async function moveTemplateStage(stageId: string, direction: 'up' | 'down') {
    const idx = sortedTemplateStages.findIndex((s) => s.id === stageId);
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= sortedTemplateStages.length) return;
    const a = sortedTemplateStages[idx];
    const b = sortedTemplateStages[swapWith];
    await Promise.all([
      supabase.from('project_template_stages').update({ position: b.position }).eq('id', a.id),
      supabase.from('project_template_stages').update({ position: a.position }).eq('id', b.id),
    ]);
    loadSubItems();
  }

  async function removeTemplateStage(stageId: string) {
    if (tasks.some((t) => t.stage_template_id === stageId)) {
      setStageError('Essa etapa ainda tem demandas padrão — remova ou mova as demandas antes de excluir a etapa.');
      return;
    }
    setStageError(null);
    await supabase.from('project_template_stages').delete().eq('id', stageId);
    loadSubItems();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fields = { name, description, category, default_priority: priority, objective };
    if (isEdit) {
      const { error: err } = await supabase.from('project_templates').update(fields).eq('id', template!.id);
      setSaving(false);
      if (err) {
        setError(err.message);
        return;
      }
      onCreated({ ...template!, ...fields });
    } else {
      const { data, error: err } = await supabase.from('project_templates').insert(fields).select().single();
      setSaving(false);
      if (err) {
        setError(err.message);
        return;
      }
      onCreated(data as ProjectTemplate);
    }
  }

  async function handleDelete() {
    if (!template) return;
    setSaving(true);
    const { error: err } = await supabase.from('project_templates').delete().eq('id', template.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onClose();
  }

  async function addChecklistItem(e: FormEvent) {
    e.preventDefault();
    if (!template || !newChecklistLabel.trim()) return;
    await supabase
      .from('project_template_checklist_items')
      .insert({ template_id: template.id, label: newChecklistLabel.trim(), position: checklist.length });
    setNewChecklistLabel('');
    loadSubItems();
  }

  async function removeChecklistItem(id: string) {
    await supabase.from('project_template_checklist_items').delete().eq('id', id);
    setChecklist((prev) => prev.filter((c) => c.id !== id));
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!template || !newTaskTitle.trim() || !newTaskStageId) return;
    await supabase.from('project_template_tasks').insert({
      template_id: template.id,
      title: newTaskTitle.trim(),
      stage_template_id: newTaskStageId,
      priority: newTaskPriority,
      position: tasks.length,
    });
    setNewTaskTitle('');
    loadSubItems();
  }

  async function removeTask(id: string) {
    await supabase.from('project_template_tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Modal title={isEdit ? 'Editar modelo' : 'Novo modelo'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="tpl-name">Nome</label>
          <input id="tpl-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="tpl-desc">Descrição</label>
          <textarea id="tpl-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="tpl-category">Categoria</label>
            <input id="tpl-category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="tpl-priority">Prioridade padrão</label>
            <select id="tpl-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="tpl-objective">Objetivo padrão</label>
          <textarea id="tpl-objective" rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} />
        </div>
        {error && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{error}</span>
          </div>
        )}
        {confirmingDelete ? (
          <div className="banner error" style={{ alignItems: 'center' }}>
            <span className="ic">⚠</span>
            <span style={{ flex: 1 }}>Excluir este modelo? Não dá pra desfazer.</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" style={{ background: 'var(--red)' }} onClick={handleDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions" style={{ justifyContent: isEdit ? 'space-between' : 'flex-end' }}>
            {isEdit && (
              <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmingDelete(true)}>
                Excluir
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn ghost" onClick={onClose}>
                {isEdit ? 'Fechar' : 'Cancelar'}
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar modelo'}
              </button>
            </div>
          </div>
        )}
      </form>

      {isEdit && (
        <>
          {stageError && (
            <div className="banner error" style={{ marginTop: 14 }}>
              <span className="ic">✕</span>
              <span>{stageError}</span>
            </div>
          )}
          <div className="panel" style={{ marginTop: 14 }}>
            <h4>Etapas deste modelo</h4>
            {sortedTemplateStages.map((s, i) => (
              <div className="field-row" key={s.id}>
                <input
                  value={s.name}
                  onChange={(e) => setTemplateStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                  onBlur={(e) => renameTemplateStage(s.id, e.target.value)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-faint)', marginRight: 8 }}>
                  <input type="checkbox" checked={s.is_final} onChange={(e) => toggleTemplateStageFinal(s.id, e.target.checked)} style={{ width: 'auto' }} />
                  final
                </label>
                <button type="button" className="btn ghost sm" disabled={i === 0} onClick={() => moveTemplateStage(s.id, 'up')}>
                  ↑
                </button>
                <button type="button" className="btn ghost sm" disabled={i === sortedTemplateStages.length - 1} onClick={() => moveTemplateStage(s.id, 'down')}>
                  ↓
                </button>
                <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => removeTemplateStage(s.id)}>
                  ✕
                </button>
              </div>
            ))}
            {sortedTemplateStages.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhuma etapa ainda.</p>}
            <form onSubmit={addTemplateStage} className="responsive-row" style={{ marginTop: 8 }}>
              <input placeholder="+ nova etapa…" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} style={{ flex: 1 }} />
              <button className="btn sm" type="submit">
                Adicionar
              </button>
            </form>
          </div>

          <div className="panel">
            <h4>Checklist padrão</h4>
            {checklist.map((c) => (
              <div className="field-row" key={c.id}>
                <span className="k">{c.label}</span>
                <button className="btn ghost sm" onClick={() => removeChecklistItem(c.id)}>
                  ✕
                </button>
              </div>
            ))}
            {checklist.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhum item ainda.</p>}
            <form onSubmit={addChecklistItem} className="responsive-row" style={{ marginTop: 8 }}>
              <input
                placeholder="+ novo item do checklist…"
                value={newChecklistLabel}
                onChange={(e) => setNewChecklistLabel(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn sm" type="submit">
                Adicionar
              </button>
            </form>
          </div>

          <div className="panel">
            <h4>Demandas padrão</h4>
            {tasks.map((t) => (
              <div className="field-row" key={t.id}>
                <span className="k">
                  {t.title} <span style={{ color: 'var(--text-faint)' }}>· {templateStagesById[t.stage_template_id]?.name} · {PRIORITY_LABELS[t.priority]}</span>
                </span>
                <button className="btn ghost sm" onClick={() => removeTask(t.id)}>
                  ✕
                </button>
              </div>
            ))}
            {tasks.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhuma demanda ainda.</p>}
            <form onSubmit={addTask} className="responsive-row" style={{ marginTop: 8 }}>
              <input
                placeholder="+ nova demanda…"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                style={{ flex: 2 }}
              />
              <select value={newTaskStageId} onChange={(e) => setNewTaskStageId(e.target.value)}>
                {sortedTemplateStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              <button className="btn sm" type="submit">
                Adicionar
              </button>
            </form>
          </div>
        </>
      )}
    </Modal>
  );
}
