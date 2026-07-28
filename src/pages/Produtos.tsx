import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { normalizeUrl } from '../lib/url';
import Modal from '../components/Modal';
import { STAGES, PRIORITY_LABELS, type Brand, type Product, type Stage, type Priority } from '../types/database';

type ProductWithBrand = Product & { brand: Brand };
type PackagingTaskStub = { id: string; project_id: string; product_id: string; stage: Stage; priority: Priority; updated_at: string };

export default function Produtos() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<ProductWithBrand[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [lineFilter, setLineFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ProductWithBrand | null>(null);
  const [packagingTasks, setPackagingTasks] = useState<PackagingTaskStub[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [productsRes, brandsRes, packagingRes] = await Promise.all([
      supabase.from('products').select('*, brand:brands(*)').order('code'),
      supabase.from('brands').select('*'),
      supabase
        .from('tasks')
        .select('id, project_id, product_id, stage, priority, updated_at')
        .not('product_id', 'is', null)
        .order('updated_at', { ascending: false }),
    ]);
    setProducts((productsRes.data as ProductWithBrand[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setPackagingTasks((packagingRes.data as PackagingTaskStub[] | null) ?? []);
    setLoading(false);
  }, []);

  const packagingByProduct = useMemo(() => {
    const map = new Map<string, PackagingTaskStub>();
    for (const t of packagingTasks) {
      if (!map.has(t.product_id)) map.set(t.product_id, t);
    }
    return map;
  }, [packagingTasks]);

  useEffect(() => {
    load();
  }, [load]);

  const lines = useMemo(() => {
    const set = new Set(products.map((p) => p.line).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const filtered = products.filter((p) => {
    if (brandFilter !== 'all' && p.brand?.key !== brandFilter) return false;
    if (lineFilter !== 'all' && p.line !== lineFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const reviewCount = products.filter((p) => p.needs_review).length;
  const canEdit = profile?.department !== 'assistente';

  return (
    <div className="page">
      <h1 className="page-title">Banco de Produtos</h1>
      <div className="page-sub">Catálogo central — Cardoso, Playmi, Tópi e linhas licenciadas. Clique numa linha para editar.</div>

      {reviewCount > 0 && (
        <div className="banner soon">
          <span className="ic">◐</span>
          <span>
            {reviewCount} produtos vieram da extração automática do catálogo PDF e estão marcados{' '}
            <b>"revisar"</b> — faixa etária, dimensões ou linha podem estar incompletas. Confira e ajuste
            quando puder.
          </span>
        </div>
      )}

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
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            color: 'var(--text-dim)',
            padding: '5px 10px',
            fontSize: 11.5,
          }}
        >
          <option value="all">Todas as linhas</option>
          {lines.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          placeholder="Buscar por nome ou código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            color: 'var(--text)',
            padding: '5px 10px',
            fontSize: 11.5,
            minWidth: 220,
          }}
        />
      </div>

      <div className="section-head">
        <h2>{filtered.length} produtos</h2>
        {canEdit && (
          <button className="btn" onClick={() => setShowNew(true)}>
            + Novo produto
          </button>
        )}
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <table className="simple">
          <thead>
            <tr>
              <th>Código</th>
              <th>Produto</th>
              <th>Linha</th>
              <th>Marca</th>
              <th>Faixa etária</th>
              <th>Dimensões</th>
              <th>Embalagem</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const pkg = packagingByProduct.get(p.id);
              const pkgStage = pkg && STAGES.find((s) => s.key === pkg.stage);
              return (
                <tr key={p.id} onClick={() => canEdit && setEditing(p)} style={canEdit ? { cursor: 'pointer' } : undefined}>
                  <td className="mono">{p.code}</td>
                  <td>
                    {p.name}
                    {p.licensed && (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        licenciado
                      </span>
                    )}
                  </td>
                  <td>{p.line || '—'}</td>
                  <td>
                    <span
                      className="pill"
                      style={{ background: 'transparent', border: '1px solid var(--border)', color: p.brand?.color }}
                    >
                      {p.brand?.label}
                    </span>
                  </td>
                  <td>{p.age_range || '—'}</td>
                  <td className="mono">{p.dimensions || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {pkg ? (
                      <Link
                        to={`/projetos/${pkg.project_id}`}
                        className="pill"
                        style={{
                          background: pkg.stage === 'finalizado' ? 'var(--green-dim)' : 'var(--violet-dim)',
                          color: pkg.stage === 'finalizado' ? 'var(--green)' : 'var(--violet)',
                        }}
                        title={`Prioridade: ${PRIORITY_LABELS[pkg.priority]}`}
                      >
                        {pkgStage?.label ?? pkg.stage}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {p.needs_review && (
                      <span className="pill" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
                        revisar
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: 'var(--text-faint)' }}>
                  Nenhum produto encontrado para esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showNew && profile && (
        <ProductFormModal
          brands={brands}
          actorId={profile.id}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {editing && profile && (
        <ProductFormModal
          brands={brands}
          actorId={profile.id}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({
  brands,
  actorId,
  product,
  onClose,
  onSaved,
}: {
  brands: Brand[];
  actorId: string;
  product?: ProductWithBrand;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(product);
  const [code, setCode] = useState(product?.code ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [brandId, setBrandId] = useState(product?.brand_id ?? brands[0]?.id ?? '');
  const [line, setLine] = useState(product?.line ?? '');
  const [ageRange, setAgeRange] = useState(product?.age_range ?? '');
  const [dimensions, setDimensions] = useState(product?.dimensions ?? '');
  const [ean, setEan] = useState(product?.ean ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [needsReview, setNeedsReview] = useState(product?.needs_review ?? false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brandId) {
      setError('Escolha uma marca.');
      return;
    }
    setSaving(true);
    setError(null);
    const fields = {
      code,
      name,
      brand_id: brandId,
      line,
      age_range: ageRange,
      dimensions,
      ean,
      image_url: imageUrl ? normalizeUrl(imageUrl) : '',
      needs_review: needsReview,
    };
    const { error } = isEdit
      ? await supabase.from('products').update(fields).eq('id', product!.id)
      : await supabase.from('products').insert(fields);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await logActivity({
      actorId,
      actionText: isEdit ? 'Produto editado' : 'Produto criado',
      detail: `${code} - ${name}`,
    });
    onSaved();
  }

  async function handleDelete() {
    if (!product) return;
    setSaving(true);
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Produto excluído', detail: `${product.code} - ${product.name}` });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="np-code">Código</label>
          <input id="np-code" required value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
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
          <label htmlFor="np-line">Linha</label>
          <input id="np-line" value={line} onChange={(e) => setLine(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="np-age">Faixa etária</label>
          <input id="np-age" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="np-dims">Dimensões</label>
          <input id="np-dims" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-ean">EAN</label>
            <input id="np-ean" value={ean} onChange={(e) => setEan(e.target.value)} placeholder="Código de barras" />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-image">Imagem oficial (link)</label>
            <input id="np-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        {isEdit && (
          <div className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              id="np-review"
              type="checkbox"
              checked={needsReview}
              onChange={(e) => setNeedsReview(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <label htmlFor="np-review" style={{ margin: 0 }}>
              Marcar para revisão
            </label>
          </div>
        )}
        {error && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{error}</span>
          </div>
        )}

        {confirmingDelete ? (
          <div className="banner error" style={{ alignItems: 'center' }}>
            <span className="ic">⚠</span>
            <span style={{ flex: 1 }}>Excluir este produto? Não dá pra desfazer.</span>
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
              <button
                type="button"
                className="btn ghost sm"
                style={{ color: 'var(--red)' }}
                onClick={() => setConfirmingDelete(true)}
              >
                Excluir
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar produto'}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
