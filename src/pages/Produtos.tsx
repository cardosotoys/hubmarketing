import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { ensureThumb, thumbStatus, useThumbs } from '../lib/thumbs';
import { normalizeUrl } from '../lib/url';
import { createPortal } from 'react-dom';
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
  const [reviewOnly, setReviewOnly] = useState(false);
  // grade (fotos) ou lista (tabela); lembra a escolha neste aparelho
  const [view, setView] = useState<'grade' | 'lista'>(() => {
    try { return localStorage.getItem('produtos:view') === 'lista' ? 'lista' : 'grade'; } catch { return 'grade'; }
  });
  const trocarView = (v: 'grade' | 'lista') => { setView(v); try { localStorage.setItem('produtos:view', v); } catch { /* sem armazenamento */ } };
  const [porMarca, setPorMarca] = useState<Record<string, number>>({});
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
      supabase.from('products').select('brand_id, line, toy_category, age_range, dimensions, product_length_mm, product_width_mm, product_height_mm'),
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
    const cont: Record<string, number> = {};
    rows.forEach((r) => { if (r.brand_id) cont[r.brand_id] = (cont[r.brand_id] ?? 0) + 1; });
    setPorMarca(cont);
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
    if (reviewOnly) q = q.eq('needs_review', true);
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
  }, [debouncedSearch, brandFilter, lineFilter, categoryFilter, ageFilter, sizeFilter, licensedFilter, reviewOnly, sort, page, brands]);

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
  }, [debouncedSearch, brandFilter, lineFilter, categoryFilter, ageFilter, sizeFilter, licensedFilter, reviewOnly, sort]);

  const sorted = products; // já vem paginado/filtrado/ordenado do servidor
  // Edita produtos: todos, menos assistentes — a não ser que o assistente tenha sido
  // liberado individualmente (toggle "pode editar produtos" em Configurações → Usuários).
  /* Espelha a regra do banco (can_edit_products no RLS de products): o cargo
   * libera diretoria e administrador; todo o resto depende da liberação
   * nominal em Configurações. A trava que vale é a do banco — isto aqui só
   * evita mostrar um botão que ia dar erro. */
  const canEdit =
    profile?.role === 'diretoria' || profile?.role === 'administrador' || profile?.can_edit_products === true;
  const thumb = useThumbs();

  const filtrosAtivos = [lineFilter, categoryFilter, ageFilter, sizeFilter].filter((f) => f !== 'all').length + (licensedFilter !== 'all' ? 1 : 0) + (reviewOnly ? 1 : 0);
  const limpar = () => { setLineFilter('all'); setCategoryFilter('all'); setAgeFilter('all'); setSizeFilter('all'); setLicensedFilter('all'); setReviewOnly(false); setSearch(''); };
  const totalGeral = Object.values(porMarca).reduce((a, b) => a + b, 0);
  const abrir = (p: ProductWithBrand) => { if (canEdit) setEditing(p); };

  return (
    <div className="page pd-page">
      {/* cabeçalho: o catálogo em números e a ação principal */}
      <header className="pd-head">
        <div className="pd-head-t">
          <h1>Banco de Produtos</h1>
          <p>Catálogo central de Cardoso, Playmi e Tópi, incluindo as linhas licenciadas.</p>
        </div>
        <div className="pd-head-n">
          <div className="pd-stat"><b>{totalGeral || total}</b><span>produtos</span></div>
          {brands.map((b) => porMarca[b.id] ? (
            <div key={b.id} className="pd-stat"><b>{porMarca[b.id]}</b><span><i style={{ background: b.color }} />{b.label}</span></div>
          ) : null)}
          {reviewCount > 0 && (
            <button type="button" className={`pd-stat pd-stat-warn ${reviewOnly ? 'on' : ''}`} onClick={() => setReviewOnly((v) => !v)}
              title="Vieram da extração automática do catálogo PDF: faixa etária, dimensões ou linha podem estar incompletas">
              <b>{reviewCount}</b><span>para revisar</span>
            </button>
          )}
        </div>
        {canEdit && <button type="button" className="pd-new" onClick={() => setShowNew(true)}>+ Novo produto</button>}
      </header>

      {canEdit && <ThumbsTool />}

      {/* busca, marca e filtros */}
      <section className="pd-ctrl">
        <div className="pd-ctrl-top">
          <label className="pd-search">
            <span aria-hidden>⌕</span>
            <input placeholder="Buscar por nome ou código" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')}>×</button>}
          </label>
          <div className="pd-brands" role="tablist" aria-label="Marca">
            <button type="button" role="tab" aria-selected={brandFilter === 'all'} onClick={() => setBrandFilter('all')}>Todas</button>
            {brands.map((b) => (
              <button type="button" role="tab" key={b.id} aria-selected={brandFilter === b.key} onClick={() => setBrandFilter(b.key)}>
                <i style={{ background: b.color }} />{b.label}
              </button>
            ))}
          </div>
          <div className="pd-view" role="tablist" aria-label="Visualização">
            <button type="button" role="tab" aria-selected={view === 'grade'} onClick={() => trocarView('grade')} title="Grade de fotos">▦</button>
            <button type="button" role="tab" aria-selected={view === 'lista'} onClick={() => trocarView('lista')} title="Lista">☰</button>
          </div>
        </div>
        <div className="pd-filters">
          <PdSelect value={lineFilter} onChange={setLineFilter} all="Linha" options={lines} />
          <PdSelect value={categoryFilter} onChange={setCategoryFilter} all="Categoria" options={toyCategories} />
          <PdSelect value={ageFilter} onChange={setAgeFilter} all="Idade" options={ageRanges} />
          <PdSelect value={sizeFilter} onChange={setSizeFilter} all="Tamanho" options={sizes} />
          <label className={`pd-sel ${licensedFilter !== 'all' ? 'on' : ''}`}>
            <select value={licensedFilter} onChange={(e) => setLicensedFilter(e.target.value as typeof licensedFilter)}>
              <option value="all">Licença</option>
              <option value="licensed">Só licenciados</option>
              <option value="own">Só marca própria</option>
            </select>
          </label>
          {filtrosAtivos > 0 && <button type="button" className="pd-clear" onClick={limpar}>Limpar {filtrosAtivos > 1 ? `${filtrosAtivos} filtros` : 'filtro'}</button>}
          <label className="pd-sel pd-sort">
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="code">Ordenar por código</option>
              <option value="name">Ordenar por nome</option>
              <option value="brand">Ordenar por marca</option>
              <option value="line">Ordenar por linha</option>
              <option value="category">Ordenar por categoria</option>
              <option value="age">Ordenar por idade</option>
            </select>
          </label>
        </div>
      </section>

      <div className="pd-count">
        <b>{total}</b> {total === 1 ? 'produto' : 'produtos'}{filtrosAtivos || search || brandFilter !== 'all' ? ' com os filtros' : ''}
        {total > PAGE_SIZE && <span> · mostrando {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)}</span>}
      </div>

      {loading ? (
        <Loading />
      ) : total === 0 ? (
        <EmptyState
          icon="📦"
          title="Nenhum produto encontrado"
          hint="Nenhum produto bate com a busca ou os filtros. Ajuste ou limpe os filtros."
          action={canEdit ? { label: '+ Novo produto', onClick: () => setShowNew(true) } : undefined}
        />
      ) : view === 'grade' ? (
        <div className="pd-grid">
          {sorted.map((p) => {
            const pkg = packagingByProduct.get(p.id);
            const pkgStage = pkg && stagesById[pkg.stage_id];
            const foto = p.image_url ? thumb(p.image_url) : '';
            const emb = p.packaging_image_url ? thumb(p.packaging_image_url) : '';
            return (
              <article key={p.id} className={`pd-card ${canEdit ? 'click' : ''}`} onClick={() => abrir(p)}
                style={{ ['--bc' as string]: p.brand?.color ?? '#0a2530' }}>
                <div className="pd-photo">
                  {foto ? <img className="a" src={foto} alt="" loading="lazy" decoding="async" /> : <span className="pd-nofoto">sem foto</span>}
                  {emb && <img className="b" src={emb} alt="" loading="lazy" decoding="async" />}
                  <span className="pd-code">{p.code}</span>
                  <span className="pd-flags">
                    {p.needs_review && <i className="rev" title="Revisar: veio da extração automática">revisar</i>}
                    {p.licensed && <i className="lic" title="Linha licenciada">licenciado</i>}
                    {p.inmetro_number && <i className="inm" title={`INMETRO ${p.inmetro_number}`}>INMETRO</i>}
                  </span>
                </div>
                <div className="pd-body">
                  <span className="pd-brand"><i />{p.brand?.label}{p.line ? ` · ${p.line}` : ''}</span>
                  <b className="pd-name">{p.name}</b>
                  <span className="pd-meta">
                    {p.age_range && <span>{p.age_range}</span>}
                    {p.toy_category && <span>{p.toy_category}</span>}
                  </span>
                  {pkg && (
                    <Link to="/design-produto/embalagens" className={`pd-pkg ${pkgStage?.is_final ? 'ok' : ''}`} onClick={(e) => e.stopPropagation()}
                      title={`Embalagem · Prioridade: ${PRIORITY_LABELS[pkg.priority]}`}>
                      Embalagem · {pkgStage?.name ?? '—'}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Linha</th>
                <th>Categoria</th>
                <th>Idade</th>
                <th>Tamanho</th>
                <th>Embalagem</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const pkg = packagingByProduct.get(p.id);
                const pkgStage = pkg && stagesById[pkg.stage_id];
                return (
                  <tr
                    key={p.id}
                    className={canEdit ? 'click' : ''}
                    onClick={() => abrir(p)}
                    onMouseEnter={(e) =>
                      (p.image_url || p.packaging_image_url) &&
                      setPreview({ url: thumb(p.image_url), packaging: thumb(p.packaging_image_url), code: p.code, name: p.name, x: e.clientX, y: e.clientY })
                    }
                    onMouseMove={(e) => setPreview((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
                    onMouseLeave={() => setPreview(null)}
                  >
                    <td className="pd-tprod">
                      <span className="pd-tthumb">{p.image_url && <img loading="lazy" decoding="async" src={thumb(p.image_url)} alt="" />}</span>
                      <span className="pd-tname">
                        <b>{p.name}</b>
                        <small><code>{p.code}</code><i style={{ background: p.brand?.color }} />{p.brand?.label}
                          {p.licensed && <em>licenciado</em>}{p.inmetro_number && <em className="inm">INMETRO</em>}{p.needs_review && <em className="rev">revisar</em>}</small>
                      </span>
                    </td>
                    <td>{p.line || '—'}</td>
                    <td>{p.toy_category || '—'}</td>
                    <td>{p.age_range || '—'}</td>
                    <td className="mono">{sizeLabel(p) || '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {pkg ? (
                        <Link to="/design-produto/embalagens" className={`pd-pkg ${pkgStage?.is_final ? 'ok' : ''}`} title={`Embalagem · Prioridade: ${PRIORITY_LABELS[pkg.priority]}`}>
                          {pkgStage?.name ?? '—'}
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <nav className="pd-pager" aria-label="Páginas">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Anterior</button>
          <span>Página <b>{page + 1}</b> de {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
          <button type="button" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Próxima →</button>
        </nav>
      )}

      {showNew && profile && (
        <ProductFormModal
          brands={brands}
          actorId={profile.id}
          sugestoes={{ lines, categories: toyCategories, ages: ageRanges }}
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
          sugestoes={{ lines, categories: toyCategories, ages: ageRanges }}
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
                  <img loading="lazy" decoding="async"
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

/* Filtro em pílula: mostra o nome do filtro quando está em "todos" e o valor escolhido quando está ativo. */
function PdSelect({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: string[] }) {
  return (
    <label className={`pd-sel ${value !== 'all' ? 'on' : ''}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={all}>
        <option value="all">{all}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ProductFormModal({
  brands,
  actorId,
  product,
  onClose,
  onSaved,
  sugestoes,
}: {
  brands: Brand[];
  actorId: string;
  product?: ProductWithBrand;
  sugestoes?: { lines: string[]; categories: string[]; ages: string[] };
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
  const [previousName, setPreviousName] = useState(product?.previous_name ?? '');
  const [packagingName, setPackagingName] = useState(product?.packaging_name ?? '');
  const [subCategory, setSubCategory] = useState(product?.sub_category ?? '');
  /* Conteúdo comercial: é daqui que a vitrine do CRM tira a frase de venda e os
   * destaques. Antes viviam dentro do CRM; agora nascem no cadastro, como todo
   * o resto do produto. */
  const [description, setDescription] = useState(product?.description ?? '');
  const [differentials, setDifferentials] = useState((product?.differentials ?? []).join('\n'));
  const [active, setActive] = useState(product?.active ?? true);
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
  /* Observação da caixa, quando a quantidade sozinha não conta a história —
   * ex.: caixa de 6 que vem "4 unissex e 2 rosas". A vitrine do CRM mostra
   * isto entre parênteses depois da quantidade. */
  const [cartonNote, setCartonNote] = useState(product?.carton_note ?? '');
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
    // miniatura sai do próprio arquivo escolhido, sem baixar a original de volta
    ensureThumb(data.publicUrl, file).catch(() => {});
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
      previous_name: previousName,
      packaging_name: packagingName,
      sub_category: subCategory,
      description,
      differentials: differentials.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 4),
      active,
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
      carton_note: cartonNote,
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

  // trava a rolagem da página atrás e fecha no Esc
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const brand = brands.find((b) => b.id === brandId);
  const difs = differentials.split('\n').map((x) => x.trim()).filter(Boolean);
  const SECOES = [
    ['pf-id', 'Identificação'], ['pf-venda', 'Vitrine do CRM'], ['pf-carac', 'Características'],
    ['pf-medidas', 'Medidas'], ['pf-fiscal', 'Fiscal'], ['pf-log', 'Caixa e palete'], ['pf-sit', 'Situação'],
  ] as const;
  const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return createPortal(
    <div className="pf" role="dialog" aria-label={isEdit ? `Editar ${code} ${name}` : 'Novo produto'} style={{ ['--bc' as string]: brand?.color ?? '#0a2530' }}>
      <form onSubmit={handleSubmit} className="pf-form">
        <header className="pf-head">
          <button type="button" className="pf-x" aria-label="Fechar" onClick={onClose}>×</button>
          <div className="pf-head-t">
            <small>{isEdit ? 'Ficha do produto' : 'Novo produto'}{brand ? ` · ${brand.label}` : ''}{line ? ` · ${line}` : ''}</small>
            <h2>{code ? <code>{code}</code> : null}{name || 'Sem nome ainda'}</h2>
          </div>
          <div className="pf-head-chips">
            <span className={`pf-chip ${active ? 'ok' : ''}`}>{active ? 'No catálogo vigente' : 'Fora do catálogo'}</span>
            {needsReview && <span className="pf-chip warn">Revisar</span>}
            {inmetroNumber && <span className="pf-chip ok">INMETRO</span>}
          </div>
          <div className="pf-head-acts">
            <button type="button" className="pf-btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="pf-btn prim" disabled={saving}>{saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar produto'}</button>
          </div>
        </header>

        <nav className="pf-nav" aria-label="Seções da ficha">
          {SECOES.map(([id, t]) => <button type="button" key={id} onClick={() => ir(id)}>{t}</button>)}
        </nav>

        <div className="pf-body">
          {/* coluna da vitrine: as duas fotos, sempre à vista */}
          <aside className="pf-side">
            <ImageUploadField label="Produto" url={imageUrl} busy={uploading === 'product'} downloadName={`${code || 'produto'}-produto`}
              onPick={(f) => uploadImage(f, 'product')} onClear={() => setImageUrl('')} />
            <ImageUploadField label="Embalagem" url={packagingImageUrl} busy={uploading === 'packaging'} downloadName={`${code || 'produto'}-embalagem`}
              onPick={(f) => uploadImage(f, 'packaging')} onClear={() => setPackagingImageUrl('')} />
          </aside>

          <div className="pf-main">
            {error && <div className="pf-err">{error}</div>}

            <section className="pf-sec" id="pf-id">
              <h3>Identificação</h3>
              <div className="pf-grid">
                <label className="pf-f s1"><span>Código</span><input id="np-code" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
                <label className="pf-f s3"><span>Nome</span><input id="np-name" required value={name} onChange={(e) => setName(e.target.value)} /></label>
                <div className="pf-f s4"><span>Marca</span>
                  <div className="pf-seg" role="radiogroup" aria-label="Marca">
                    {brands.map((b) => (
                      <button type="button" role="radio" aria-checked={brandId === b.id} key={b.id} onClick={() => setBrandId(b.id)}>
                        <i style={{ background: b.color }} />{b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="pf-f s2"><span>Linha</span><input id="np-line" list="pf-l-linhas" value={line} onChange={(e) => setLine(e.target.value)} /></label>
                <label className="pf-f s2"><span>Categoria</span><input id="np-category" list="pf-l-cats" value={toyCategory} onChange={(e) => setToyCategory(e.target.value)} placeholder="Ex.: Didáticos" /></label>
                <label className="pf-f s2"><span>Sub-categoria</span><input id="np-sub-category" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} placeholder="Didáticos, Pelúcia, Blocos…" /></label>
                <label className="pf-f s1"><span>Faixa etária</span><input id="np-age" list="pf-l-idades" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} /></label>
                <label className="pf-f s1"><span>Gênero</span><input id="np-gender" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Unissex, Menino…" /></label>
                <label className="pf-f s2"><span>Nome na embalagem</span><input id="np-packaging-name" value={packagingName} onChange={(e) => setPackagingName(e.target.value)} placeholder="O nome curto, de marketing" /></label>
                <label className="pf-f s2"><span>Nome anterior</span><input id="np-previous-name" value={previousName} onChange={(e) => setPreviousName(e.target.value)} placeholder="Como o produto se chamava antes" /></label>
                <label className="pf-f s4"><span>Nome técnico (nota fiscal)</span><input id="np-technical-name" value={technicalName} onChange={(e) => setTechnicalName(e.target.value)} /></label>
              </div>
            </section>

            {/* O que o lojista lê na vitrine do CRM. Escrito aqui, aparece lá na hora. */}
            <section className="pf-sec" id="pf-venda">
              <h3>Vitrine do CRM <small>o que o lojista lê embaixo do nome</small></h3>
              <div className="pf-grid">
                <label className="pf-f s4"><span>Descrição de venda</span>
                  <textarea id="np-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A frase que o lojista lê embaixo do nome, na vitrine" /></label>
                <label className="pf-f s4"><span>Diferenciais <em className={difs.length > 4 ? 'over' : ''}>{difs.length} de 4 · um por linha</em></span>
                  <textarea id="np-differentials" rows={4} value={differentials} onChange={(e) => setDifferentials(e.target.value)} placeholder={'Porta abre e fecha\nPrato giratório'} /></label>
              </div>
            </section>

            <section className="pf-sec" id="pf-carac">
              <h3>Características</h3>
              <div className="pf-grid">
                <label className="pf-f s2"><span>Material</span><input id="np-material" value={material} onChange={(e) => setMaterial(e.target.value)} /></label>
                <label className="pf-f s2"><span>Cor predominante</span><input id="np-color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
                <div className="pf-f s4"><span>O brinquedo tem</span>
                  <div className="pf-toggles">
                    <label className={hasMechanism ? 'on' : ''}><input type="checkbox" checked={hasMechanism} onChange={(e) => setHasMechanism(e.target.checked)} />Mecanismo</label>
                    <label className={hasSound ? 'on' : ''}><input type="checkbox" checked={hasSound} onChange={(e) => setHasSound(e.target.checked)} />Som</label>
                    <label className={hasLight ? 'on' : ''}><input type="checkbox" checked={hasLight} onChange={(e) => setHasLight(e.target.checked)} />Luz</label>
                  </div>
                </div>
                <label className="pf-f s2"><span>Tipo de bateria</span><input id="np-battery" value={batteryType} onChange={(e) => setBatteryType(e.target.value)} placeholder="Não possui, 2xAA…" /></label>
                <label className="pf-f s2"><span>Peso suportado</span><input id="np-supported-weight" value={supportedWeight} onChange={(e) => setSupportedWeight(e.target.value)} placeholder="Ex.: 20kg" /></label>
              </div>
            </section>

            <section className="pf-sec" id="pf-medidas">
              <h3>Medidas</h3>
              <div className="pf-mgroup"><b>Produto</b>
                <div className="pf-ms">
                  <Medida label="Comprimento" unit="mm" value={productLengthMm} onChange={setProductLengthMm} />
                  <Medida label="Largura" unit="mm" value={productWidthMm} onChange={setProductWidthMm} />
                  <Medida label="Altura" unit="mm" value={productHeightMm} onChange={setProductHeightMm} />
                  <Medida label="Peso" unit="kg" value={productWeightKg} onChange={setProductWeightKg} />
                </div>
              </div>
              <div className="pf-mgroup"><b>Embalagem individual</b>
                <div className="pf-ms">
                  <Medida label="Comprimento" unit="mm" value={packageLengthMm} onChange={setPackageLengthMm} />
                  <Medida label="Largura" unit="mm" value={packageWidthMm} onChange={setPackageWidthMm} />
                  <Medida label="Altura" unit="mm" value={packageHeightMm} onChange={setPackageHeightMm} />
                  <Medida label="Peso" unit="kg" value={packageWeightKg} onChange={setPackageWeightKg} />
                </div>
              </div>
              <label className="pf-f"><span>Conteúdo da embalagem</span><textarea id="np-pkg-contents" rows={2} value={packageContents} onChange={(e) => setPackageContents(e.target.value)} /></label>
            </section>

            <section className="pf-sec" id="pf-fiscal">
              <h3>Fiscal e códigos</h3>
              <div className="pf-grid">
                <label className="pf-f s2"><span>EAN</span><input id="np-ean" inputMode="numeric" value={ean} onChange={(e) => setEan(e.target.value)} placeholder="Código de barras" /></label>
                <label className="pf-f s2"><span>Nº de registro INMETRO</span><input id="np-inmetro" value={inmetroNumber} onChange={(e) => setInmetroNumber(e.target.value)} placeholder="Ex.: 000000/0000" /></label>
                <label className="pf-f s1"><span>NCM</span><input id="np-ncm" value={ncm} onChange={(e) => setNcm(e.target.value)} /></label>
                <label className="pf-f s1"><span>CST</span><input id="np-cst" value={cst} onChange={(e) => setCst(e.target.value)} /></label>
                <label className="pf-f s2"><span>DUN</span><input id="np-dun" value={dun} onChange={(e) => setDun(e.target.value)} /></label>
              </div>
            </section>

            <section className="pf-sec" id="pf-log">
              <h3>Caixa master e palete</h3>
              <div className="pf-mgroup"><b>Caixa master</b>
                <div className="pf-ms five">
                  <Medida label="Comprimento" unit="mm" value={cartonLengthMm} onChange={setCartonLengthMm} />
                  <Medida label="Largura" unit="mm" value={cartonWidthMm} onChange={setCartonWidthMm} />
                  <Medida label="Altura" unit="mm" value={cartonHeightMm} onChange={setCartonHeightMm} />
                  <Medida label="Qtd. por caixa" unit="un" value={cartonQuantity} onChange={setCartonQuantity} />
                  <Medida label="Peso bruto" unit="kg" value={cartonGrossWeightKg} onChange={setCartonGrossWeightKg} />
                </div>
              </div>
              <label className="pf-f"><span>Observação da caixa</span><input value={cartonNote} onChange={(e) => setCartonNote(e.target.value)} placeholder='Ex.: "4 unissex e 2 rosas"' /></label>
              <div className="pf-mgroup"><b>Paletização <small>"4X3" = 4 caixas por camada × 3 camadas</small></b>
                <div className="pf-ms three">
                  <label className="pf-m"><span>Lastro × camadas</span><div><input value={palletLayerPattern} onChange={(e) => setPalletLayerPattern(e.target.value)} placeholder="4X3" /></div></label>
                  <Medida label="Altura" unit="m" value={palletHeightM} onChange={setPalletHeightM} />
                  <Medida label="Total no palete" unit="cx" value={palletTotalUnits} onChange={setPalletTotalUnits} />
                </div>
              </div>
            </section>

            <section className="pf-sec" id="pf-sit">
              <h3>Situação</h3>
              <label className={`pf-switch ${active ? 'on' : ''}`}>
                <input id="np-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <i aria-hidden /><span><b>No catálogo vigente</b>Desligado, o produto sai das novas seleções do CRM e o histórico fica.</span>
              </label>
              {isEdit && (
                <label className={`pf-switch warn ${needsReview ? 'on' : ''}`}>
                  <input id="np-review" type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} />
                  <i aria-hidden /><span><b>Marcar para revisão</b>Aparece em "para revisar" no Banco de Produtos.</span>
                </label>
              )}
              {isEdit && (confirmingDelete ? (
                <div className="pf-del">
                  <span>Excluir este produto? Não dá para desfazer.</span>
                  <button type="button" className="pf-btn ghost" onClick={() => setConfirmingDelete(false)}>Cancelar</button>
                  <button type="button" className="pf-btn danger" onClick={handleDelete}>Excluir</button>
                </div>
              ) : (
                <button type="button" className="pf-delbtn" onClick={() => setConfirmingDelete(true)}>Excluir produto</button>
              ))}
            </section>
          </div>
        </div>

        {/* celular: salvar sempre ao alcance do polegar */}
        <div className="pf-bar">
          <button type="button" className="pf-btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pf-btn prim" disabled={saving}>{saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar produto'}</button>
        </div>

        <datalist id="pf-l-linhas">{(sugestoes?.lines ?? []).map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="pf-l-cats">{(sugestoes?.categories ?? []).map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="pf-l-idades">{(sugestoes?.ages ?? []).map((x) => <option key={x} value={x} />)}</datalist>
      </form>
    </div>,
    document.body,
  );
}

/* Campo de medida com a unidade dentro, fora do formulário para o cursor não sair do campo a cada tecla. */
function Medida({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="pf-m"><span>{label}</span><div><input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" /><em>{unit}</em></div></label>
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
  const thumb = useThumbs();
  return (
    <div className="pf-img">
      <div className="pf-img-h"><b>{label}</b>
        {url && <span><button type="button" onClick={() => downloadImage(url, downloadName)}>Baixar</button><button type="button" className="x" onClick={onClear}>Remover</button></span>}
      </div>
      <div className="pf-img-box">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" title="Abrir a foto original">
            <img loading="lazy" decoding="async" src={thumb(url)} alt={label} />
          </a>
        ) : <span className="pf-img-none">Sem foto {label === 'Produto' ? 'do produto' : 'da embalagem'}</span>}
        <label className={`pf-img-up ${busy ? 'busy' : ''}`}>
          {busy ? 'Enviando…' : url ? 'Trocar foto' : 'Enviar foto'}
          <input type="file" accept="image/*" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
        </label>
      </div>
    </div>
  );
}

/* Gera as miniaturas que faltam (uma vez por foto). Baixa cada original uma única vez,
 * reduz no navegador e guarda em product-images/thumbs/. Daí em diante as listas usam a leve. */
function ThumbsTool() {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [run, setRun] = useState<{ done: number; fail: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const count = useCallback(async () => {
    const urls: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('products').select('image_url, packaging_image_url').range(from, from + 999);
      const rows = (data as { image_url: string; packaging_image_url: string }[]) ?? [];
      rows.forEach((r) => { if (r.image_url) urls.push(r.image_url); if (r.packaging_image_url) urls.push(r.packaging_image_url); });
      if (rows.length < 1000) break;
    }
    setMissing(await thumbStatus([...new Set(urls)]));
  }, []);
  useEffect(() => { count(); }, [count]);

  const start = async () => {
    if (!missing?.length) return;
    setBusy(true);
    const st = { done: 0, fail: 0, total: missing.length };
    setRun({ ...st });
    for (const u of missing) {
      try { await ensureThumb(u); st.done++; } catch { st.fail++; }
      setRun({ ...st });
    }
    setBusy(false);
    await count();
  };

  if (!missing || (!missing.length && !run)) return null;
  return (
    <div className="banner soon" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="ic">◐</span>
      {run ? (
        <span>
          {busy ? 'Gerando miniaturas…' : 'Miniaturas geradas.'} <b>{run.done}</b> de {run.total}
          {run.fail ? ` · ${run.fail} não abriram (foto fora do Hub ou apagada)` : ''}
          {busy ? ' · deixe esta aba aberta' : ''}
        </span>
      ) : (
        <span>
          <b>{missing.length}</b> fotos ainda sem miniatura. As listas baixam a foto original inteira para mostrar um quadrinho,
          e isso estoura a cota do Supabase. Gere uma vez e as listas passam a usar a versão leve.
        </span>
      )}
      {!busy && missing.length > 0 && (
        <button className="btn btn-primary" onClick={start}>Gerar {missing.length} miniaturas</button>
      )}
    </div>
  );
}
