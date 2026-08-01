import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { createPackagingProject } from '../../lib/packaging';
import Modal from '../../components/Modal';
import {
  PACKAGING_TRACKS,
  PACKAGING_TRACK_STAGES,
  PRIORITIES,
  PRIORITY_LABELS,
  type Brand,
  type PackagingTrack,
  type Priority,
  type Project,
} from '../../types/database';

type PackagingProject = Project & { brand: Brand | null };

export default function Embalagens() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PackagingProject[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [trackFilter, setTrackFilter] = useState<'all' | PackagingTrack>('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [projRes, brandsRes] = await Promise.all([
      supabase.from('projects').select('*, brand:brands(*)').eq('kind', 'embalagem').order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
    ]);
    setProjects((projRes.data as PackagingProject[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = projects.filter((p) => {
    if (trackFilter !== 'all' && p.packaging_track !== trackFilter) return false;
    if (brandFilter !== 'all' && p.brand?.key !== brandFilter) return false;
    return true;
  });

  return (
    <div className="page">
      <h1 className="page-title">Embalagens</h1>
      <div className="page-sub">
        Projetos de embalagem no fluxo stage-gate — duas trilhas: <strong>Criação</strong> (embalagem nova) e{' '}
        <strong>Melhoria</strong> (corrigir/aprovar embalagem existente). Cada projeto abre um workspace completo
        (Kanban/Lista, etapas editáveis, Financeiro, Arquivos e Histórico), reaproveitando a base de Projetos.
      </div>

      <div className="brand-tabs">
        <div className={`brand-tab${brandFilter === 'all' ? ' active' : ''}`} onClick={() => setBrandFilter('all')}>
          Todas as marcas
        </div>
        {brands.map((b) => (
          <div key={b.id} className={`brand-tab${brandFilter === b.key ? ' active' : ''}`} onClick={() => setBrandFilter(b.key)}>
            <span className="sw" style={{ background: b.color }} />
            {b.label}
          </div>
        ))}
      </div>

      <div className="filters-row">
        <div className={`filter-chip${trackFilter === 'all' ? ' active' : ''}`} onClick={() => setTrackFilter('all')}>
          Todas as trilhas
        </div>
        {PACKAGING_TRACKS.map((t) => (
          <div key={t.key} className={`filter-chip${trackFilter === t.key ? ' active' : ''}`} onClick={() => setTrackFilter(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{filtered.length} projetos de embalagem</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Novo projeto de embalagem
        </button>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">▤</span>Nenhum projeto de embalagem nesta visão — crie o primeiro.
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((p) => (
            <Link key={p.id} to={`/projetos/${p.id}`} className="project-card">
              <div className="brand-strip" style={{ background: p.brand?.color }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                  {p.brand?.label ?? '—'}
                </span>
                <span className="tag" style={{ background: 'var(--surface-2)', color: p.packaging_track === 'criacao' ? 'var(--violet)' : 'var(--blue)' }}>
                  {PACKAGING_TRACKS.find((t) => t.key === p.packaging_track)?.label ?? '—'}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.sub || 'Projeto de embalagem'}</p>
              <div className="project-meta">
                <span className={`prio ${p.priority}`}>{PRIORITY_LABELS[p.priority]}</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {p.start_date ? new Date(p.start_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && profile && (
        <NewPackagingModal
          brands={brands}
          actorId={profile.id}
          onClose={() => setShowNew(false)}
          onCreated={(newId) => {
            setShowNew(false);
            navigate(`/projetos/${newId}`);
          }}
        />
      )}
    </div>
  );
}

function NewPackagingModal({
  brands,
  actorId,
  onClose,
  onCreated,
}: {
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onCreated: (newId: string) => void;
}) {
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [track, setTrack] = useState<PackagingTrack>('criacao');
  const [priority, setPriority] = useState<Priority>('medium');
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brandId) {
      setError('Escolha uma marca.');
      return;
    }
    setSaving(true);
    setError(null);
    const newId = await createPackagingProject({ name, brandId, track, priority, actorId, startDate: startDate || null });
    setSaving(false);
    if (!newId) {
      setError('Não foi possível criar o projeto.');
      return;
    }
    onCreated(newId);
  }

  return (
    <Modal title="Novo projeto de embalagem" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="pe-name">Nome</label>
          <input id="pe-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Embalagem Totoka 2026" />
        </div>
        <div className="form-field">
          <label htmlFor="pe-track">Trilha</label>
          <select id="pe-track" value={track} onChange={(e) => setTrack(e.target.value as PackagingTrack)}>
            {PACKAGING_TRACKS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} — {t.hint}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Etapas que serão criadas (editáveis depois):</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {PACKAGING_TRACK_STAGES[track].map((s) => (
              <span key={s.name} className="tag" style={{ background: 'var(--surface)', color: s.is_final ? 'var(--green)' : 'var(--text)' }}>
                {s.name}
              </span>
            ))}
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-brand">Marca</label>
            <select id="pe-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-priority">Prioridade</label>
            <select id="pe-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="pe-start">Início (opcional)</label>
          <input id="pe-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
            {saving ? 'Criando…' : 'Criar projeto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
