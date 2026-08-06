import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { normalizeUrl } from '../lib/url';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';
import { PRIORITY_LABELS, type Brand, type Product, type ProjectStage, type Priority } from '../types/database';

type ProductWithBrand = Product & { brand: Brand };
type PackagingTaskStub = { id: string; product_id: string; stage_id: string; priority: Priority; updated_at: string };

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
  const [sort, setSort] = useState<'code' | 'name' | 'brand' | 'line' | 'category' | 'age'>('code');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ProductWithBrand | null>(null);
  const [packagingTasks, setPackagingTasks] = useState<PackagingTaskStub[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  // pop-up com a imagem ao passar o mouse na linha
  const [preview, setPreview] = useState<{ url: string; packaging: string; code: string; name: string; x: number; y: number } | null>(null);

  // paginação no servidor — não carrega mais o catálogo inteiro de uma vez
  const PAGE_SIZE = 50;
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  // opções dos filtros (carregadas 1x, leves)
  const [lines, setLines] = useState<string[]>([]);
  const [toyCategories, setToyCategories] = useState<string[]>([]);
  const [ageRanges, setAgeRanges] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);

  // carga estática (1x): marcas, etapas, opções de filtro e contagem de "revisar"
  const loadStatics = useCallback(async () => {
    const [brandsRes, stagesRes, optRes, reviewRes] = await Promise.all([
      supabase.from('brands').select('*'),
      supabase.from('stages').select('*'),
      supabase.from('products').select('line, toy_category, age_range, dimensions, product_length_mm, product_width_mm, product_height_mm'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('needs_review', true),
    ]);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setStages((stagesRes.data as ProjectStage[]) ?? []);
    const rows = (optRes.data as Product[]) ?? [];
    const uniq = (arr: (string | null | undefined)[]) => Array.from(new Set(arr.filter(Boolean) as string[])).sort();
    setLines(uniq(rows.map((r) => r.line)));
    setToyCategories(uniq(rows.map((r) => r.toy_category)));
    setAgeRanges(uniq(rows.map((r) => r.age_range)));
    setSizes(uniq(rows.map(sizeLabel)));
    setReviewCount(reviewRes.count ?? 0);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('products').select('*, brand:brands(*)', { count: 'exact' });
    // remove caracteres que quebram a sintaxe do .or() do PostgREST (vírgula/parênteses/%)
    const s = debouncedSearch.trim().replace(/[,()%*]/g, ' ').trim();
    if (s) q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`);
    if (brandFilter !== 'all') {
      const b = brands.find((x) => x.key === brandFilter);
      if (b) q = q.eq('brand_id', b.id);
    }
    if (lineFilter !== 'all') q = q.eq('line', lineFilter);
    if (categoryFilter !== 'all') q = q.eq('toy_category', categoryFilter);
    if (ageFilter !== 'all') q = q.eq('age_range', ageFilter);
    if (sizeFilter !== 'all') q = q.eq('dimensions', sizeFilter);
    if (licensedFilter === 'licensed') q = q.eq('licensed', true);
    if (licensedFilter === 'own') q = q.eq('licensed', false);
    const col = sort === 'name' ? 'name' : sort === 'brand' ? 'brand_id' : sort === 'line' ? 'line' : sort === 'category' ? 'toy_category' : sort === 'age' ? 'age_range' : 'code';
    q = q.order(col, { ascending: true });
    const from = page * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);
    const { data, count } = await q;
    const list = (data as ProductWithBrand[]) ?? [];
    setProducts(list);
    setTotal(count ?? 0);
    const ids = list.map((p) => p.id);
    if (ids.length) {
      const { data: pk } = await supabase
        .from('tasks')
        .select('id, product_id, stage_id, priority, updated_at')
        .in('product_id', ids)
        .not('packaging_track', 'is', null)
        .order('updated_at', { ascending: false });
      setPackagingTasks((pk as PackagingTaskStub[]) ?? []);
    } else {
      setPackagingTasks([]);
    }
    setLoading(false);
  }, [debouncedSearch, brandFilter, lineFilter, categoryFilter, ageFilter, sizeFilter, licensedFilter, sort, page, brands]);

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

  // carga estática (marcas/etapas/opções/contagem) — 1x
  useEffect(() => {
    loadStatics();
  }, [loadStatics]);

  // debounce da busca (não bate no servidor a cada tecla)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // volta pra primeira página quando qualquer filtro/ordenção muda
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, brandFilter, lineFilter, categoryFilter, ageFilter, sizeFilter, licensedFilter, sort]);

  const sorted = products; // já vem paginado/filtrado/ordenado do servidor
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

      <div className="filters-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select className="chip-select" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
          <option value="all">Todas as linhas</option>
          {lines.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select className="chip-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Todas as categorias</option>
          {toyCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="chip-select" value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
          <option value="all">Todas as idades</option>
          {ageRanges.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select className="chip-select" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
          <option value="all">Todos os tamanhos</option>
          {sizes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="chip-select" value={licensedFilter} onChange={(e) => setLicensedFilter(e.target.value as typeof licensedFilter)}>
          <option value="all">Licenciados e próprios</option>
          <option value="licensed">Só licenciados</option>
          <option value="own">Só marca própria</option>
        </select>
        <select className="chip-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="code">Ordenar: código</option>
          <option value="name">Ordenar: nome (A-Z)</option>
          <option value="brand">Ordenar: marca</option>
          <option value="line">Ordenar: linha</option>
          <option value="category">Ordenar: categoria</option>
          <option value="age">Ordenar: faixa etária</option>
        </select>
        <input
          className="chip-select"
          placeholder="Buscar por nome ou código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220, flex: 1 }}
        />
      </div>

      <div className="section-head">
        <h2>{total} produtos</h2>
        {canEdit && (
          <button className="btn" onClick={() => setShowNew(true)}>
            + Novo produto
          </button>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : total === 0 ? (
        <EmptyState
          icon="📦"
          title="Nenhum produto encontrado"
          hint="Nenhum produto bate com a busca/filtros atuais. Ajuste ou limpe os filtros."
          action={canEdit ? { label: '+ Novo produto', onClick: () => setShowNew(true) } : undefined}
        />
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
            {sorted.map((p) => {
              const pkg = packagingByProduct.get(p.id);
              const pkgStage = pkg && stagesById[pkg.stage_id];
              return (
                <tr
                  key={p.id}
                  onClick={() => canEdit && setEditing(p)}
                  onMouseEnter={(e) =>
                    (p.image_url || p.packaging_image_url) &&
                    setPreview({ url: p.image_url, packaging: p.packaging_image_url, code: p.code, name: p.name, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e) => setPreview((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
                  onMouseLeave={() => setPreview(null)}
                  style={canEdit ? { cursor: 'pointer' } : undefined}
                >
                  <td className="mono" data-label="Código">
                    {p.code}
                  </td>
                  <td data-label="Produto">
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt=""
                        style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', verticalAlign: 'middle', marginRight: 8, border: '1px solid var(--border)' }}
                      />
                    )}
                    {p.name}
                    {p.licensed && (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        licenciado
                      </span>
                    )}
                    {p.inmetro_number && (
                      <span className="pill" style={{ marginLeft: 6, background: 'var(--green-dim)', color: 'var(--green)' }} title={`INMETRO ${p.inmetro_number}`}>
                        🏅 INMETRO
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
                        to="/design-produto/embalagens"
                        className="pill"
                        style={{
                          background: pkgStage?.is_final ? 'var(--green-dim)' : 'var(--violet-dim)',
                          color: pkgStage?.is_final ? 'var(--green)' : 'var(--violet)',
                        }}
                        title={`Embalagem · Prioridade: ${PRIORITY_LABELS[pkg.priority]}`}
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
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: 'var(--text-faint)' }}>
                  Nenhum produto encontrado para esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!loading && total > PAGE_SIZE && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
          <button className="btn ghost sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            ← Anterior
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <button className="btn ghost sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>
            Próxima →
          </button>
        </div>
      )}

      {showNew && profile && (
        <ProductFormModal
          brands={brands}
          actorId={profile.id}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
            loadStatics();
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
            loadStatics();
          }}
        />
      )}

      {preview && (preview.url || preview.packaging) && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(preview.x + 20, window.innerWidth - 300),
            top: Math.min(preview.y + 20, window.innerHeight - 320),
            zIndex: 1000,
            pointerEvents: 'none',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            width: 280,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            <span className="mono">{preview.code}</span> — {preview.name}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { url: preview.url, cap: '📦 Produto' },
              { url: preview.packaging, cap: '🎁 Embalagem' },
            ]
              .filter((i) => i.url)
              .map((i) => (
                <figure key={i.cap} style={{ margin: 0, flex: 1 }}>
                  <img
                    src={i.url}
                    alt={i.cap}
                    style={{ width: '100%', height: 150, objectFit: 'contain', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                  <figcaption style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 4 }}>{i.cap}</figcaption>
                </figure>
              ))}
          </div>
        </div>
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
  const [inmetroNumber, setInmetroNumber] = useState(product?.inmetro_number ?? '');
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [packagingImageUrl, setPackagingImageUrl] = useState(product?.packaging_image_url ?? '');
  const [uploading, setUploading] = useState<'product' | 'packaging' | null>(null);
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

  async function uploadImage(file: File, which: 'product' | 'packaging') {
    setError(null);
    setUploading(which);
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${(code || 'sem-codigo').replace(/[^a-zA-Z0-9.\-_]/g, '_')}/${which}-${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (upErr) {
      setError(upErr.message);
      setUploading(null);
      return;
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    if (which === 'product') setImageUrl(data.publicUrl);
    else setPackagingImageUrl(data.publicUrl);
    setUploading(null);
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
      inmetro_number: inmetroNumber,
      image_url: imageUrl ? normalizeUrl(imageUrl) : '',
      packaging_image_url: packagingImageUrl ? normalizeUrl(packagingImageUrl) : '',
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
    <Modal title={isEdit ? 'Editar produto' : 'Novo produto'} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="np-code">Código</label>
            <input id="np-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 2 }}>
            <label htmlFor="np-name">Nome</label>
            <input id="np-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
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
            <label htmlFor="np-inmetro">🏅 Nº de registro INMETRO</label>
            <input id="np-inmetro" value={inmetroNumber} onChange={(e) => setInmetroNumber(e.target.value)} placeholder="Ex.: 000000/0000" />
          </div>
        </div>

        {/* Imagens do produto e da embalagem (upload) */}
        <div className="responsive-row">
          <ImageUploadField
            label="📦 Imagem do produto"
            url={imageUrl}
            busy={uploading === 'product'}
            downloadName={`${code || 'produto'}-produto`}
            onPick={(f) => uploadImage(f, 'product')}
            onClear={() => setImageUrl('')}
          />
          <ImageUploadField
            label="🎁 Imagem da embalagem"
            url={packagingImageUrl}
            busy={uploading === 'packaging'}
            downloadName={`${code || 'produto'}-embalagem`}
            onPick={(f) => uploadImage(f, 'packaging')}
            onClear={() => setPackagingImageUrl('')}
          />
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

async function downloadImage(url: string, baseName: string) {
  const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
  const filename = `${baseName}.${ext}`;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, '_blank'); // fallback: abre em nova aba pra salvar manualmente
  }
}

function ImageUploadField({
  label,
  url,
  busy,
  downloadName,
  onPick,
  onClear,
}: {
  label: string;
  url: string;
  busy: boolean;
  downloadName: string;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="form-field" style={{ flex: 1 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
              <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </a>
          ) : (
            <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Sem imagem</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="btn ghost sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Enviando…' : url ? 'Trocar imagem' : 'Enviar imagem'}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
                e.target.value = '';
              }}
            />
          </label>
          {url && (
            <button type="button" className="btn ghost sm" onClick={() => downloadImage(url, downloadName)}>
              ⬇ Baixar
            </button>
          )}
          {url && (
            <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={onClear}>
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
