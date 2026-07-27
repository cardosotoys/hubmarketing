import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjectsOverview } from '../hooks/useProjectsOverview';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import ProjectCard from '../components/ProjectCard';
import Modal from '../components/Modal';
import type { Brand, Priority, ProjectStatus } from '../types/database';

const FILTERS = ['Departamento', 'Responsável', 'Prioridade', 'Categoria', 'Licença', 'Status', 'Ano'];

export default function Projects() {
  const { profile } = useAuth();
  const { projects, loading, error, reload, percentFor } = useProjectsOverview();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    supabase
      .from('brands')
      .select('*')
      .then(({ data }) => setBrands((data as Brand[]) ?? []));
  }, []);

  const filtered =
    brandFilter === 'all' ? projects : projects.filter((p) => p.brand?.key === brandFilter);

  return (
    <div className="page">
      <h1 className="page-title">Projetos</h1>
      <div className="page-sub">
        Cada projeto é independente — com cronograma, equipe, demandas e arquivos próprios.
      </div>

      <div className="brand-tabs">
        <div
          className={`brand-tab${brandFilter === 'all' ? ' active' : ''}`}
          onClick={() => setBrandFilter('all')}
        >
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
        {FILTERS.map((f) => (
          <div className="filter-chip" key={f} title="Filtros detalhados chegam na Fase 2">
            {f} ▾
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Todos ({filtered.length})</h2>
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
        <div className="project-grid">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} brand={p.brand} percent={percentFor(p.id)} />
          ))}
        </div>
      )}

      {showNew && profile && (
        <NewProjectModal
          brands={brands}
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
  actorId,
  onClose,
  onCreated,
}: {
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [sub, setSub] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [objective, setObjective] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Projeto criado', projectId: data.id });
    onCreated();
  }

  return (
    <Modal title="Novo projeto" onClose={onClose}>
      <form onSubmit={handleSubmit}>
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
