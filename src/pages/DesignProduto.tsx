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
    <div className="page dp-page">
      <header className="pd-head">
        <div className="pd-head-t">
          <h1>Design de Produto</h1>
          <p>Cada produto novo passa por 9 fases, da estratégia ao pós-lançamento, com uma decisão no fim de cada uma. Certificação INMETRO e rotulagem travam o lançamento.</p>
        </div>
        <button type="button" className="pd-new" onClick={() => setShowNew(true)}>+ Novo produto</button>
        <div className="pd-head-n">
          <div className="pd-stat"><b>{filtered.length}</b><span>em desenvolvimento</span></div>
        </div>
      </header>

      <section className="pd-ctrl">
        <div className="pd-ctrl-top">
          <div className="pd-brands" role="tablist" aria-label="Marca">
            <button type="button" role="tab" aria-selected={brandFilter === 'all'} onClick={() => setBrandFilter('all')}>Todas</button>
            {brands.map((b) => (
              <button type="button" role="tab" key={b.id} aria-selected={brandFilter === b.key} onClick={() => setBrandFilter(b.key)}><i style={{ background: b.color }} />{b.label}</button>
            ))}
          </div>
          <div className="pd-brands" role="tablist" aria-label="Situação">
            <button type="button" role="tab" aria-selected={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todas</button>
            {PRODUCT_DEV_STATUSES.map((s) => (
              <button type="button" role="tab" key={s.key} aria-selected={statusFilter === s.key} onClick={() => setStatusFilter(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <p className="pd-count">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="dp-empty"><b>Nenhum produto em desenvolvimento</b><span>Crie o primeiro em "+ Novo produto".</span></div>
      ) : (
        <div className="dp-grid">
          {filtered.map((i) => {
            const phase = PRODUCT_DEV_PHASES.find((p) => p.n === i.current_phase);
            const certLabel = CERTIFICATION_STATUSES.find((c) => c.key === i.certification_status)?.label ?? '';
            return (
              <Link key={i.id} to={`/design-produto/${i.id}/resumo`} className="dp-card" style={{ ['--bc' as string]: i.brand?.color ?? '#0a2530' }}>
                <span className="pd-brand"><i />{i.brand?.label ?? '—'}</span>
                <b className="dp-name">{i.name}</b>
                <span className="dp-phase">Fase {i.current_phase} de 9 · {phase?.name ?? '—'}</span>
                <div className="dp-bar" aria-hidden>
                  {PRODUCT_DEV_PHASES.map((p) => <i key={p.n} className={p.n < i.current_phase ? 'done' : p.n === i.current_phase ? 'now' : ''} title={`Fase ${p.n} — ${p.name}`} />)}
                </div>
                <div className="pd-meta">
                  {i.age_range && <span>{i.age_range}</span>}
                  {i.material && <span>{i.material}</span>}
                  <span style={{ color: CERT_COLOR[i.certification_status] }}>Certificação: {certLabel}</span>
                </div>
                <div className="dp-foot">
                  <span className={`kb-prio ${i.priority}`}><i />{PRIORITY_LABELS[i.priority]}</span>
                  <span>{i.launch_target_date ? `Lançamento ${new Date(i.launch_target_date + 'T00:00').toLocaleDateString('pt-BR')}` : 'Sem data de lançamento'}</span>
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
