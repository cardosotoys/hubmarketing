import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Modal from '../components/Modal';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PRODUCT_DEV_MATERIALS,
  PRODUCT_DEV_PHASES,
  PRODUCT_DEV_STATUSES,
  CERTIFICATION_STATUSES,
  type Brand,
  type Priority,
  type Product,
  type ProductDevItem,
  type ProductDevStatus,
} from '../types/database';

type ItemWithRelations = ProductDevItem & { brand: Brand | null; product: Product | null };

const CERT_COLOR: Record<string, string> = {
  nao_iniciado: 'var(--text-faint)',
  em_ensaio: 'var(--yellow)',
  aprovado: 'var(--green)',
  reprovado: 'var(--red)',
};

export default function DesignProduto() {
  const { profile } = useAuth();
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductDevStatus>('all');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, brandsRes] = await Promise.all([
      supabase
        .from('product_dev_items')
        .select('*, brand:brands(*), product:products(*)')
        .order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
    ]);
    setItems((itemsRes.data as ItemWithRelations[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    if (brandFilter !== 'all' && i.brand?.key !== brandFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="page">
      <h1 className="page-title">Design de Produto</h1>
      <div className="page-sub">
        Desenvolvimento de produto no modelo stage-gate: cada produto caminha pelas 9 fases (da estratégia ao
        pós-lançamento), com portão de decisão em cada uma. Marketing e Embalagens rodam em paralelo; certificação
        INMETRO e rotulagem são bloqueantes para o lançamento.
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
        <div className={`filter-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>
          Todos os status
        </div>
        {PRODUCT_DEV_STATUSES.map((s) => (
          <div
            key={s.key}
            className={`filter-chip${statusFilter === s.key ? ' active' : ''}`}
            onClick={() => setStatusFilter(s.key)}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{filtered.length} produtos em desenvolvimento</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Novo produto
        </button>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◭</span>Nenhum produto em desenvolvimento ainda — crie o primeiro.
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((i) => {
            const phase = PRODUCT_DEV_PHASES.find((p) => p.n === i.current_phase);
            const certLabel = CERTIFICATION_STATUSES.find((c) => c.key === i.certification_status)?.label ?? '';
            return (
              <Link key={i.id} to={`/design-produto/${i.id}/resumo`} className="project-card">
                <div className="brand-strip" style={{ background: i.brand?.color }} />
                <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                  {i.brand?.label ?? '—'}
                </span>
                <h3>{i.name}</h3>
                <p>
                  Fase {i.current_phase}/9 · {phase?.name ?? '—'}
                </p>
                <div className="progress-phases" style={{ margin: '8px 0' }}>
                  {PRODUCT_DEV_PHASES.map((p) => (
                    <i
                      key={p.n}
                      className={p.n < i.current_phase ? 'done' : p.n === i.current_phase ? 'current' : ''}
                      title={`Fase ${p.n} — ${p.name}`}
                    />
                  ))}
                </div>
                <div className="project-meta" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {i.age_range && <span className="tag" style={{ background: 'var(--surface-2)' }}>{i.age_range}</span>}
                  {i.material && <span className="tag" style={{ background: 'var(--surface-2)' }}>{i.material}</span>}
                  <span className="tag" style={{ background: 'var(--surface-2)', color: CERT_COLOR[i.certification_status] }}>
                    {i.certification_status === 'aprovado' ? '✓' : '●'} Cert.: {certLabel}
                  </span>
                </div>
                <div className="project-meta" style={{ marginTop: 6 }}>
                  <span className={`prio ${i.priority}`}>{PRIORITY_LABELS[i.priority]}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {i.launch_target_date
                      ? `🎯 ${new Date(i.launch_target_date + 'T00:00').toLocaleDateString('pt-BR')}`
                      : 'sem data-alvo'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showNew && profile && (
        <NewItemModal
          brands={brands}
          actorId={profile.id}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewItemModal({
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
  const [ageRange, setAgeRange] = useState('');
  const [material, setMaterial] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [launchDate, setLaunchDate] = useState('');
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
    const { data, error: err } = await supabase
      .from('product_dev_items')
      .insert({
        name: name.trim(),
        brand_id: brandId,
        age_range: ageRange,
        material,
        target_price: targetPrice ? Number(targetPrice) : null,
        priority,
        launch_target_date: launchDate || null,
        current_phase: 1,
        status: 'ativo',
        owner_id: actorId,
        created_by: actorId,
      })
      .select()
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Produto em desenvolvimento criado', detail: name, productDevItemId: data.id });
    onCreated();
  }

  return (
    <Modal title="Novo produto em desenvolvimento" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="np-name">Nome do produto</label>
          <input id="np-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-brand">Marca</label>
            <select id="np-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-age">Faixa etária</label>
            <input id="np-age" placeholder="ex.: 3+ anos" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-material">Material</label>
            <select id="np-material" value={material} onChange={(e) => setMaterial(e.target.value)}>
              <option value="">A definir</option>
              {PRODUCT_DEV_MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-price">Meta de preço (R$)</label>
            <input id="np-price" type="number" step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-priority">Prioridade</label>
            <select id="np-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-launch">Data-alvo de lançamento</label>
            <input id="np-launch" type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
          </div>
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
            {saving ? 'Criando…' : 'Criar produto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
