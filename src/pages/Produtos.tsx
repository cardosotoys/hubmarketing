import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { normalizeUrl } from '../lib/url';
import Modal from '../components/Modal';
import { PRIORITY_LABELS, type Brand, type Product, type ProjectStage, type Priority } from '../types/database';

type ProductWithBrand = Product & { brand: Brand };
type PackagingTaskStub = { id: string; project_id: string; product_id: string; stage_id: string; priority: Priority; updated_at: string };

function sizeLabel(p: Product): string {
  if (p.product_length_mm != null && p.product_width_mm != null && p.product_height_mm != null) {
    return `${p.product_length_mm}×${p.product_width_mm}×${p.product_height_mm}mm`;
  }
  return p.dimensions;
}

export default function Produtos() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductWithBrand[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [lineFilter, setLineFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [licensedFilter, setLicensedFilter] = useState<'all' | 'licensed' | 'own'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ProductWithBrand | null>(null);
  const [packagingTasks, setPackagingTasks] = useState<PackagingTaskStub[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [productsRes, brandsRes, packagingRes, stagesRes] = await Promise.all([
      supabase.from('products').select('*, brand:brands(*)').order('code'),
      supabase.from('brands').select('*'),
      supabase
        .from('tasks')
        .select('id, project_id, product_id, stage_id, priority, updated_at')
        .not('product_id', 'is', null)
        .order('updated_at', { ascending: false }),
      supabase.from('stages').select('*'),
    ]);
    setProducts((productsRes.data as ProductWithBrand[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setPackagingTasks((packagingRes.data as PackagingTaskStub[] | null) ?? []);
    setStages((stagesRes.data as ProjectStage[]) ?? []);
    setLoading(false);
  }, []);

  const stagesById = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s])), [stages]);

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

  useEffect(() => {
    const q = searchParams.get('q');
    if (!q) return;
    setSearch(q);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = useMemo(() => {
    const set = new Set(products.map((p) => p.line).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const ageRanges = useMemo(() => {
    const set = new Set(products.map((p) => p.age_range).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const sizes = useMemo(() => {
    const set = new Set(products.map(sizeLabel).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const toyCategories = useMemo(() => {
    const set = new Set(products.map((p) => p.toy_category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const filtered = products.filter((p) => {
    if (brandFilter !== 'all' && p.brand?.key !== brandFilter) return false;
    if (lineFilter !== 'all' && p.line !== lineFilter) return false;
    if (categoryFilter !== 'all' && p.toy_category !== categoryFilter) return false;
    if (ageFilter !== 'all' && p.age_range !== ageFilter) return false;
    if (sizeFilter !== 'all' && sizeLabel(p) !== sizeFilter) return false;
    if (licensedFilter === 'licensed' && !p.licensed) return false;
    if (licensedFilter === 'own' && p.licensed) return false;
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
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            color: 'var(--text-dim)',
            padding: '5px 10px',
            fontSize: 11.5,
          }}
        >
          <option value="all">Todas as categorias</option>
          {toyCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={ageFilter}
          onChange={(e) => setAgeFilter(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            color: 'var(--text-dim)',
            padding: '5px 10px',
            fontSize: 11.5,
          }}
        >
          <option value="all">Todas as idades</option>
          {ageRanges.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            color: 'var(--text-dim)',
            padding: '5px 10px',
            fontSize: 11.5,
          }}
        >
          <option value="all">Todos os tamanhos</option>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={licensedFilter}
          onChange={(e) => setLicensedFilter(e.target.value as typeof licensedFilter)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            color: 'var(--text-dim)',
            padding: '5px 10px',
            fontSize: 11.5,
          }}
        >
          <option value="all">Licenciados e próprios</option>
          <option value="licensed">Só licenciados</option>
          <option value="own">Só marca própria</option>
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
              <th>Categoria</th>
              <th>Marca</th>
              <th>Faixa etária</th>
              <th>Tamanho</th>
              <th>Embalagem</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const pkg = packagingByProduct.get(p.id);
              const pkgStage = pkg && stagesById[pkg.stage_id];
              return (
                <tr key={p.id} onClick={() => canEdit && setEditing(p)} style={canEdit ? { cursor: 'pointer' } : undefined}>
                  <td className="mono" data-label="Código">
                    {p.code}
                  </td>
                  <td data-label="Produto">
                    {p.name}
                    {p.licensed && (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        licenciado
                      </span>
                    )}
                  </td>
                  <td data-label="Linha">{p.line || '—'}</td>
                  <td data-label="Categoria">{p.toy_category || '—'}</td>
                  <td data-label="Marca">
                    <span
                      className="pill"
                      style={{ background: 'transparent', border: '1px solid var(--border)', color: p.brand?.color }}
                    >
                      {p.brand?.label}
                    </span>
                  </td>
                  <td data-label="Faixa etária">{p.age_range || '—'}</td>
                  <td className="mono" data-label="Tamanho">
                    {sizeLabel(p) || '—'}
                  </td>
                  <td data-label="Embalagem" onClick={(e) => e.stopPropagation()}>
                    {pkg ? (
                      <Link
                        to={`/projetos/${pkg.project_id}`}
                        className="pill"
                        style={{
                          background: pkgStage?.is_final ? 'var(--green-dim)' : 'var(--violet-dim)',
                          color: pkgStage?.is_final ? 'var(--green)' : 'var(--violet)',
                        }}
                        title={`Prioridade: ${PRIORITY_LABELS[pkg.priority]}`}
                      >
                        {pkgStage?.name ?? '—'}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Revisão">
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
                <td colSpan={9} style={{ color: 'var(--text-faint)' }}>
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
  const [toyCategory, setToyCategory] = useState(product?.toy_category ?? '');
  const [ageRange, setAgeRange] = useState(product?.age_range ?? '');
  const [ean, setEan] = useState(product?.ean ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [needsReview, setNeedsReview] = useState(product?.needs_review ?? false);

  const [technicalName, setTechnicalName] = useState(product?.technical_name ?? '');
  const [gender, setGender] = useState(product?.gender ?? '');
  const [material, setMaterial] = useState(product?.material ?? '');
  const [color, setColor] = useState(product?.color ?? '');
  const [hasMechanism, setHasMechanism] = useState(product?.has_mechanism ?? false);
  const [hasSound, setHasSound] = useState(product?.has_sound ?? false);
  const [hasLight, setHasLight] = useState(product?.has_light ?? false);
  const [batteryType, setBatteryType] = useState(product?.battery_type ?? '');
  const [supportedWeight, setSupportedWeight] = useState(product?.supported_weight ?? '');

  const [productLengthMm, setProductLengthMm] = useState(product?.product_length_mm?.toString() ?? '');
  const [productWidthMm, setProductWidthMm] = useState(product?.product_width_mm?.toString() ?? '');
  const [productHeightMm, setProductHeightMm] = useState(product?.product_height_mm?.toString() ?? '');
  const [productWeightKg, setProductWeightKg] = useState(product?.product_weight_kg?.toString() ?? '');

  const [packageContents, setPackageContents] = useState(product?.package_contents ?? '');
  const [packageLengthMm, setPackageLengthMm] = useState(product?.package_length_mm?.toString() ?? '');
  const [packageWidthMm, setPackageWidthMm] = useState(product?.package_width_mm?.toString() ?? '');
  const [packageHeightMm, setPackageHeightMm] = useState(product?.package_height_mm?.toString() ?? '');
  const [packageWeightKg, setPackageWeightKg] = useState(product?.package_weight_kg?.toString() ?? '');
  const [ncm, setNcm] = useState(product?.ncm ?? '');
  const [cst, setCst] = useState(product?.cst ?? '');
  const [dun, setDun] = useState(product?.dun ?? '');
  const [cartonLengthMm, setCartonLengthMm] = useState(product?.carton_length_mm?.toString() ?? '');
  const [cartonWidthMm, setCartonWidthMm] = useState(product?.carton_width_mm?.toString() ?? '');
  const [cartonHeightMm, setCartonHeightMm] = useState(product?.carton_height_mm?.toString() ?? '');
  const [cartonQuantity, setCartonQuantity] = useState(product?.carton_quantity?.toString() ?? '');
  const [cartonGrossWeightKg, setCartonGrossWeightKg] = useState(product?.carton_gross_weight_kg?.toString() ?? '');
  const [palletLayerPattern, setPalletLayerPattern] = useState(product?.pallet_layer_pattern ?? '');
  const [palletHeightM, setPalletHeightM] = useState(product?.pallet_height_m?.toString() ?? '');
  const [palletTotalUnits, setPalletTotalUnits] = useState(product?.pallet_total_units?.toString() ?? '');

  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function num(s: string) {
    return s.trim() ? Number(s) : null;
  }
  function int(s: string) {
    return s.trim() ? Math.round(Number(s)) : null;
  }

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
      toy_category: toyCategory,
      age_range: ageRange,
      ean,
      image_url: imageUrl ? normalizeUrl(imageUrl) : '',
      needs_review: needsReview,
      technical_name: technicalName,
      gender,
      material,
      color,
      has_mechanism: hasMechanism,
      has_sound: hasSound,
      has_light: hasLight,
      battery_type: batteryType,
      supported_weight: supportedWeight,
      product_length_mm: num(productLengthMm),
      product_width_mm: num(productWidthMm),
      product_height_mm: num(productHeightMm),
      product_weight_kg: num(productWeightKg),
      package_contents: packageContents,
      package_length_mm: num(packageLengthMm),
      package_width_mm: num(packageWidthMm),
      package_height_mm: num(packageHeightMm),
      package_weight_kg: num(packageWeightKg),
      ncm,
      cst,
      dun,
      carton_length_mm: num(cartonLengthMm),
      carton_width_mm: num(cartonWidthMm),
      carton_height_mm: num(cartonHeightMm),
      carton_quantity: int(cartonQuantity),
      carton_gross_weight_kg: num(cartonGrossWeightKg),
      pallet_layer_pattern: palletLayerPattern,
      pallet_height_m: num(palletHeightM),
      pallet_total_units: int(palletTotalUnits),
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
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-line">Linha</label>
            <input id="np-line" value={line} onChange={(e) => setLine(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-category">Categoria</label>
            <input id="np-category" value={toyCategory} onChange={(e) => setToyCategory(e.target.value)} placeholder="Ex: Didáticos" />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-age">Faixa etária</label>
            <input id="np-age" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-gender">Gênero</label>
            <input id="np-gender" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Unissex, Menino, Menina…" />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="np-technical-name">Nome técnico (nota fiscal)</label>
          <input id="np-technical-name" value={technicalName} onChange={(e) => setTechnicalName(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-material">Material</label>
            <input id="np-material" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-color">Cor predominante</label>
            <input id="np-color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
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

        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={hasMechanism} onChange={(e) => setHasMechanism(e.target.checked)} style={{ width: 'auto' }} />
              Possui mecanismo
            </label>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={hasSound} onChange={(e) => setHasSound(e.target.checked)} style={{ width: 'auto' }} />
              Possui som
            </label>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={hasLight} onChange={(e) => setHasLight(e.target.checked)} style={{ width: 'auto' }} />
              Possui luz
            </label>
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-battery">Tipo de bateria</label>
            <input id="np-battery" value={batteryType} onChange={(e) => setBatteryType(e.target.value)} placeholder="Não possui, 2xAA…" />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-supported-weight">Peso suportado</label>
            <input id="np-supported-weight" value={supportedWeight} onChange={(e) => setSupportedWeight(e.target.value)} placeholder="Ex: 20kg" />
          </div>
        </div>

        <div className="form-field">
          <label>Medidas do produto</label>
          <div className="responsive-row">
            <input placeholder="Comprim. (mm)" value={productLengthMm} onChange={(e) => setProductLengthMm(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Largura (mm)" value={productWidthMm} onChange={(e) => setProductWidthMm(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Altura (mm)" value={productHeightMm} onChange={(e) => setProductHeightMm(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Peso (kg)" value={productWeightKg} onChange={(e) => setProductWeightKg(e.target.value)} style={{ flex: 1 }} />
          </div>
        </div>

        <details className="panel" style={{ margin: '10px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>⚙ Dados fiscais e logística</summary>
          <div style={{ marginTop: 10 }}>
            <div className="form-field">
              <label htmlFor="np-pkg-contents">Conteúdo da embalagem</label>
              <textarea id="np-pkg-contents" rows={2} value={packageContents} onChange={(e) => setPackageContents(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Medidas da embalagem individual</label>
              <div className="responsive-row">
                <input placeholder="Comprim. (mm)" value={packageLengthMm} onChange={(e) => setPackageLengthMm(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Largura (mm)" value={packageWidthMm} onChange={(e) => setPackageWidthMm(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Altura (mm)" value={packageHeightMm} onChange={(e) => setPackageHeightMm(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Peso (kg)" value={packageWeightKg} onChange={(e) => setPackageWeightKg(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="responsive-row">
              <div className="form-field" style={{ flex: 1 }}>
                <label htmlFor="np-ncm">NCM</label>
                <input id="np-ncm" value={ncm} onChange={(e) => setNcm(e.target.value)} />
              </div>
              <div className="form-field" style={{ flex: 1 }}>
                <label htmlFor="np-cst">CST</label>
                <input id="np-cst" value={cst} onChange={(e) => setCst(e.target.value)} />
              </div>
              <div className="form-field" style={{ flex: 1 }}>
                <label htmlFor="np-dun">DUN</label>
                <input id="np-dun" value={dun} onChange={(e) => setDun(e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label>Medidas da caixa master</label>
              <div className="responsive-row">
                <input placeholder="Comprim. (mm)" value={cartonLengthMm} onChange={(e) => setCartonLengthMm(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Largura (mm)" value={cartonWidthMm} onChange={(e) => setCartonWidthMm(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Altura (mm)" value={cartonHeightMm} onChange={(e) => setCartonHeightMm(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Qtd. por caixa" value={cartonQuantity} onChange={(e) => setCartonQuantity(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Peso bruto (kg)" value={cartonGrossWeightKg} onChange={(e) => setCartonGrossWeightKg(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-field">
              <label>Paletização</label>
              <div className="responsive-row">
                <input placeholder="Padrão (ex: 4X3)" value={palletLayerPattern} onChange={(e) => setPalletLayerPattern(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Altura (m)" value={palletHeightM} onChange={(e) => setPalletHeightM(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="Unidades totais" value={palletTotalUnits} onChange={(e) => setPalletTotalUnits(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </details>

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
