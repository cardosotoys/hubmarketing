import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Modal from '../components/Modal';
import {
  MPM_MARKETPLACE_LABELS,
  type Brand,
  type MpmAlert,
  type MpmListing,
  type MpmProduct,
  type MpmSettings,
  type MpmSyncRun,
  type Product,
} from '../types/database';

type ProductWithBrand = Product & { brand: Brand };
type MpmProductWithProduct = MpmProduct & { product: ProductWithBrand };
type MpmListingWithProduct = MpmListing & { mpm_product: MpmProduct & { product: ProductWithBrand } };

type View = 'monitoramento' | 'produtos' | 'configuracoes';
type StatusFilter = 'all' | 'violacao' | 'ok' | 'revisao';

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MonitorPrecos() {
  const { profile } = useAuth();
  const [view, setView] = useState<View>('monitoramento');
  const [products, setProducts] = useState<ProductWithBrand[]>([]);
  const [mpmProducts, setMpmProducts] = useState<MpmProductWithProduct[]>([]);
  const [listings, setListings] = useState<MpmListingWithProduct[]>([]);
  const [alerts, setAlerts] = useState<MpmAlert[]>([]);
  const [syncRuns, setSyncRuns] = useState<MpmSyncRun[]>([]);
  const [settings, setSettings] = useState<MpmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [productFilter, setProductFilter] = useState('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodDays, setPeriodDays] = useState('all');
  const [search, setSearch] = useState('');

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingMpmProduct, setEditingMpmProduct] = useState<MpmProductWithProduct | null>(null);

  const canEdit = profile?.department !== 'assistente';

  const load = useCallback(async () => {
    setLoading(true);
    const [productsRes, mpmProductsRes, listingsRes, alertsRes, syncRunsRes, settingsRes] = await Promise.all([
      supabase.from('products').select('*, brand:brands(*)').order('code'),
      supabase.from('mpm_products').select('*, product:products(*, brand:brands(*))').order('created_at', { ascending: false }),
      supabase
        .from('mpm_listings')
        .select('*, mpm_product:mpm_products(*, product:products(*, brand:brands(*)))')
        .order('last_checked_at', { ascending: false }),
      supabase.from('mpm_alerts').select('*').in('status', ['new', 'acknowledged']),
      supabase.from('mpm_sync_runs').select('*').order('started_at', { ascending: false }).limit(5),
      supabase.from('mpm_settings').select('*').single(),
    ]);
    setProducts((productsRes.data as ProductWithBrand[]) ?? []);
    setMpmProducts((mpmProductsRes.data as MpmProductWithProduct[]) ?? []);
    setListings((listingsRes.data as MpmListingWithProduct[]) ?? []);
    setAlerts((alertsRes.data as MpmAlert[]) ?? []);
    setSyncRuns((syncRunsRes.data as MpmSyncRun[]) ?? []);
    setSettings((settingsRes.data as MpmSettings) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alertByListingId = Object.fromEntries(alerts.map((a) => [a.listing_id, a]));
  const lastRun = syncRuns[0];

  async function syncNow() {
    setSyncing(true);
    await supabase.functions.invoke('mpm-sync', { body: { force: true } });
    setSyncing(false);
    load();
  }

  function exportViolationsCSV() {
    const rows = listings.filter((l) => l.is_violation && alertByListingId[l.id]);
    const header = ['Produto', 'Marca', 'Marketplace', 'Loja', 'Preço encontrado', 'Preço mínimo', 'Diferença', 'Link'];
    const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((l) => {
      const diff = (l.mpm_product?.min_price ?? 0) - l.current_price;
      return [
        l.mpm_product?.product?.name ?? '',
        l.mpm_product?.product?.brand?.label ?? '',
        MPM_MARKETPLACE_LABELS[l.marketplace],
        l.store_name,
        fmtBRL(l.current_price),
        fmtBRL(l.mpm_product?.min_price ?? 0),
        fmtBRL(diff),
        l.url,
      ]
        .map((v) => csvEscape(String(v)))
        .join(';');
    });
    const csv = [header.map(csvEscape).join(';'), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alertas-mpm-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function reviewListing(listingId: string, status: 'confirmed_match' | 'rejected') {
    if (!profile) return;
    await supabase
      .from('mpm_listings')
      .update({ match_status: status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('id', listingId);
    load();
  }

  async function resolveAlert(listingId: string) {
    if (!profile) return;
    const alert = alertByListingId[listingId];
    if (!alert) return;
    await supabase
      .from('mpm_alerts')
      .update({ status: 'resolved', resolved_by: profile.id, resolved_at: new Date().toISOString() })
      .eq('id', alert.id);
    load();
  }

  const filteredListings = listings.filter((l) => {
    if (productFilter !== 'all' && l.mpm_product?.product?.id !== productFilter) return false;
    if (marketplaceFilter !== 'all' && l.marketplace !== marketplaceFilter) return false;
    if (statusFilter === 'violacao' && !l.is_violation) return false;
    if (statusFilter === 'ok' && (l.is_violation || l.match_status === 'needs_review')) return false;
    if (statusFilter === 'revisao' && l.match_status !== 'needs_review') return false;
    if (periodDays !== 'all') {
      const days = Number(periodDays);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(l.last_checked_at) < cutoff) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!l.title.toLowerCase().includes(q) && !l.store_name.toLowerCase().includes(q) && !(l.mpm_product?.product?.name ?? '').toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const openViolationsCount = listings.filter((l) => l.is_violation).length;

  return (
    <div className="page">
      <h1 className="page-title">Monitor de Preços</h1>
      <div className="page-sub">
        Monitoramento automático de preços dos produtos Cardoso, Playmi e Tópi nos marketplaces — alerta só
        quando o preço encontrado fica abaixo do mínimo permitido.
      </div>

      <div className="brand-tabs">
        <div className={`brand-tab${view === 'monitoramento' ? ' active' : ''}`} onClick={() => setView('monitoramento')}>
          Monitoramento
        </div>
        <div className={`brand-tab${view === 'produtos' ? ' active' : ''}`} onClick={() => setView('produtos')}>
          Produtos monitorados
        </div>
        {canEdit && (
          <div className={`brand-tab${view === 'configuracoes' ? ' active' : ''}`} onClick={() => setView('configuracoes')}>
            Configurações
          </div>
        )}
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : view === 'monitoramento' ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-num">{mpmProducts.filter((p) => p.monitoring_status === 'active').length}</div>
              <div className="stat-label">Produtos monitorados</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{listings.length}</div>
              <div className="stat-label">Anúncios encontrados</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ color: openViolationsCount > 0 ? 'var(--red)' : undefined }}>
                {openViolationsCount}
              </div>
              <div className="stat-label">Infrações em aberto</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ fontSize: 16 }}>
                {lastRun ? new Date(lastRun.started_at).toLocaleString('pt-BR') : 'Nunca rodou'}
              </div>
              <div className="stat-label">
                Última sincronização{lastRun?.status === 'error' && <span style={{ color: 'var(--red)' }}> · erro</span>}
              </div>
              {canEdit && (
                <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={syncNow} disabled={syncing}>
                  {syncing ? 'Sincronizando…' : '↻ Sincronizar agora'}
                </button>
              )}
            </div>
          </div>

          {lastRun && lastRun.queries_failed > 0 && (
            <div className="banner error">
              <span className="ic">⚠</span>
              <span>
                {lastRun.queries_failed} de {lastRun.queries_attempted} buscas falharam na última sincronização
                {lastRun.last_error_sample ? ` — ${lastRun.last_error_sample}` : ''}. Se a mensagem citar limite de
                taxa ou cota, confira o consumo em{' '}
                <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                  serpapi.com/manage-api-key
                </a>
                .
              </span>
            </div>
          )}

          <div className="filters-row">
            <input className="chip-input" placeholder="⌕ Pesquisar…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="chip-select" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
              <option value="all">Produto: todos</option>
              {mpmProducts.map((p) => (
                <option key={p.product.id} value={p.product.id}>
                  {p.product.code} - {p.product.name}
                </option>
              ))}
            </select>
            <select className="chip-select" value={marketplaceFilter} onChange={(e) => setMarketplaceFilter(e.target.value)}>
              <option value="all">Marketplace: todos</option>
              {Object.entries(MPM_MARKETPLACE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select className="chip-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">Status: todos</option>
              <option value="violacao">Violação</option>
              <option value="ok">Em conformidade</option>
              <option value="revisao">Revisão manual</option>
            </select>
            <select className="chip-select" value={periodDays} onChange={(e) => setPeriodDays(e.target.value)}>
              <option value="all">Período: tudo</option>
              <option value="1">Último dia</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
            </select>
          </div>

          <div className="section-head">
            <h2>{filteredListings.length} anúncios</h2>
            {openViolationsCount > 0 && (
              <button className="btn ghost sm" onClick={exportViolationsCSV}>
                ⬇ Exportar violações (CSV)
              </button>
            )}
          </div>

          <table className="simple">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Marketplace</th>
                <th>Loja</th>
                <th>Preço</th>
                <th>Preço mínimo</th>
                <th>Status</th>
                <th>Link</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredListings.map((l) => (
                <tr key={l.id}>
                  <td>{l.mpm_product?.product?.name ?? '—'}</td>
                  <td>{MPM_MARKETPLACE_LABELS[l.marketplace]}</td>
                  <td style={{ color: 'var(--text-faint)' }}>{l.store_name}</td>
                  <td className={l.is_violation ? 'mono' : 'mono'} style={l.is_violation ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
                    {fmtBRL(l.current_price)}
                  </td>
                  <td className="mono" style={{ color: 'var(--text-faint)' }}>
                    {fmtBRL(l.mpm_product?.min_price ?? 0)}
                  </td>
                  <td>
                    {l.is_violation ? (
                      <span className="pill" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                        🔴 violação
                      </span>
                    ) : l.match_status === 'needs_review' ? (
                      <span className="pill" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
                        revisar
                      </span>
                    ) : l.match_status === 'rejected' ? (
                      <span className="pill" style={{ color: 'var(--text-faint)' }}>
                        rejeitado
                      </span>
                    ) : (
                      <span className="pill" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                        conforme
                      </span>
                    )}
                  </td>
                  <td>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      abrir ↗
                    </a>
                  </td>
                  {canEdit && (
                    <td>
                      {l.match_status === 'needs_review' && (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <button className="btn ghost sm" onClick={() => reviewListing(l.id, 'confirmed_match')}>
                            Confirmar
                          </button>
                          <button className="btn ghost sm" onClick={() => reviewListing(l.id, 'rejected')}>
                            Rejeitar
                          </button>
                        </span>
                      )}
                      {l.is_violation && alertByListingId[l.id] && (
                        <button className="btn ghost sm" onClick={() => resolveAlert(l.id)}>
                          Resolver
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filteredListings.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} style={{ color: 'var(--text-faint)' }}>
                    Nenhum anúncio encontrado ainda — adicione produtos pra monitorar na aba "Produtos monitorados".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      ) : view === 'produtos' ? (
        <ProdutosMonitoradosView
          mpmProducts={mpmProducts}
          canEdit={canEdit}
          onAdd={() => setShowAddProduct(true)}
          onEdit={setEditingMpmProduct}
        />
      ) : (
        <ConfiguracoesView settings={settings} actorId={profile?.id ?? ''} onSaved={load} />
      )}

      {showAddProduct && profile && (
        <MpmProductFormModal
          products={products}
          alreadyMonitored={mpmProducts.map((p) => p.product_id)}
          actorId={profile.id}
          onClose={() => setShowAddProduct(false)}
          onSaved={() => {
            setShowAddProduct(false);
            load();
          }}
        />
      )}
      {editingMpmProduct && profile && (
        <MpmProductFormModal
          products={products}
          alreadyMonitored={mpmProducts.map((p) => p.product_id)}
          mpmProduct={editingMpmProduct}
          actorId={profile.id}
          onClose={() => setEditingMpmProduct(null)}
          onSaved={() => {
            setEditingMpmProduct(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProdutosMonitoradosView({
  mpmProducts,
  canEdit,
  onAdd,
  onEdit,
}: {
  mpmProducts: MpmProductWithProduct[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (p: MpmProductWithProduct) => void;
}) {
  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Só os produtos cadastrados aqui são pesquisados — o resto do catálogo fica de fora do monitoramento.
      </div>
      <div className="section-head">
        <h2>{mpmProducts.length} produtos monitorados</h2>
        {canEdit && (
          <button className="btn" onClick={onAdd}>
            + Monitorar produto
          </button>
        )}
      </div>
      <table className="simple">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Marca</th>
            <th>Preço mínimo</th>
            <th>Preço sugerido</th>
            <th>Palavras-chave</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {mpmProducts.map((p) => (
            <tr key={p.id} onClick={() => canEdit && onEdit(p)} style={canEdit ? { cursor: 'pointer' } : undefined}>
              <td>
                {p.product.code} - {p.product.name}
              </td>
              <td>
                <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)', color: p.product.brand?.color }}>
                  {p.product.brand?.label}
                </span>
              </td>
              <td className="mono">{fmtBRL(p.min_price)}</td>
              <td className="mono" style={{ color: 'var(--text-faint)' }}>
                {p.suggested_price != null ? fmtBRL(p.suggested_price) : '—'}
              </td>
              <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>{[...p.keywords, ...p.synonyms].join(', ') || '—'}</td>
              <td>
                <span className={`pill${p.monitoring_status === 'paused' ? '' : ''}`} style={{ color: p.monitoring_status === 'active' ? 'var(--green)' : 'var(--text-faint)' }}>
                  {p.monitoring_status === 'active' ? 'ativo' : 'pausado'}
                </span>
              </td>
            </tr>
          ))}
          {mpmProducts.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: 'var(--text-faint)' }}>
                Nenhum produto sendo monitorado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MpmProductFormModal({
  products,
  alreadyMonitored,
  mpmProduct,
  actorId,
  onClose,
  onSaved,
}: {
  products: ProductWithBrand[];
  alreadyMonitored: string[];
  mpmProduct?: MpmProductWithProduct;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(mpmProduct);
  const selectable = products.filter((p) => !alreadyMonitored.includes(p.id) || p.id === mpmProduct?.product_id);
  const [productId, setProductId] = useState(mpmProduct?.product_id ?? selectable[0]?.id ?? '');
  const [minPrice, setMinPrice] = useState(mpmProduct?.min_price?.toString() ?? '');
  const [suggestedPrice, setSuggestedPrice] = useState(mpmProduct?.suggested_price?.toString() ?? '');
  const [keywords, setKeywords] = useState(mpmProduct?.keywords.join(', ') ?? '');
  const [synonyms, setSynonyms] = useState(mpmProduct?.synonyms.join(', ') ?? '');
  const [monitoringStatus, setMonitoringStatus] = useState(mpmProduct?.monitoring_status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function splitList(s: string) {
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productId || !minPrice) {
      setError('Escolha o produto e informe o preço mínimo.');
      return;
    }
    setSaving(true);
    setError(null);
    const fields = {
      product_id: productId,
      min_price: Number(minPrice),
      suggested_price: suggestedPrice ? Number(suggestedPrice) : null,
      keywords: splitList(keywords),
      synonyms: splitList(synonyms),
      monitoring_status: monitoringStatus,
    };
    const { error: err } = isEdit
      ? await supabase.from('mpm_products').update(fields).eq('id', mpmProduct!.id)
      : await supabase.from('mpm_products').insert(fields);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    const productLabel = products.find((p) => p.id === productId)?.name;
    await logActivity({
      actorId,
      actionText: isEdit ? 'Monitoramento de produto editado' : 'Produto adicionado ao monitoramento de preços',
      detail: productLabel,
    });
    onSaved();
  }

  async function handleDelete() {
    if (!mpmProduct) return;
    setSaving(true);
    await supabase.from('mpm_products').delete().eq('id', mpmProduct.id);
    setSaving(false);
    await logActivity({
      actorId,
      actionText: 'Produto removido do monitoramento de preços',
      detail: mpmProduct.product.name,
    });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar monitoramento' : 'Monitorar produto'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="mp-product">Produto</label>
          <select id="mp-product" value={productId} onChange={(e) => setProductId(e.target.value)} disabled={isEdit}>
            {selectable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mp-min">Preço mínimo permitido</label>
            <input id="mp-min" type="number" step="0.01" required value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mp-suggested">Preço sugerido</label>
            <input id="mp-suggested" type="number" step="0.01" value={suggestedPrice} onChange={(e) => setSuggestedPrice(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="mp-keywords">Palavras-chave (separadas por vírgula)</label>
          <input id="mp-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="mp-synonyms">Sinônimos (separados por vírgula)</label>
          <input id="mp-synonyms" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} />
        </div>
        {isEdit && (
          <div className="form-field">
            <label htmlFor="mp-status">Status do monitoramento</label>
            <select id="mp-status" value={monitoringStatus} onChange={(e) => setMonitoringStatus(e.target.value as 'active' | 'paused')}>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
            </select>
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
            <span style={{ flex: 1 }}>Parar de monitorar este produto? O histórico de preços é mantido.</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" style={{ background: 'var(--red)' }} onClick={handleDelete}>
              Remover
            </button>
          </div>
        ) : (
          <div className="modal-actions" style={{ justifyContent: isEdit ? 'space-between' : 'flex-end' }}>
            {isEdit && (
              <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmingDelete(true)}>
                Remover
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Monitorar'}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

function ConfiguracoesView({
  settings,
  actorId,
  onSaved,
}: {
  settings: MpmSettings | null;
  actorId: string;
  onSaved: () => void;
}) {
  const [intervalHours, setIntervalHours] = useState(settings?.search_interval_hours?.toString() ?? '24');
  const [alertEmail, setAlertEmail] = useState(settings?.alert_email ?? '');
  const [webhookUrl, setWebhookUrl] = useState(settings?.alert_webhook_url ?? '');
  const [whatsapp, setWhatsapp] = useState(settings?.whatsapp_number ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase
      .from('mpm_settings')
      .update({
        search_interval_hours: Number(intervalHours) || 24,
        alert_email: alertEmail,
        alert_webhook_url: webhookUrl,
        whatsapp_number: whatsapp,
        updated_by: actorId,
      })
      .eq('id', true);
    await logActivity({ actorId, actionText: 'Configurações do monitor de preços atualizadas' });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <h4>Configurações do monitoramento</h4>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="cfg-interval">Intervalo entre buscas (horas)</label>
          <input id="cfg-interval" type="number" min="1" value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="cfg-email">E-mail para alertas (opcional)</label>
          <input id="cfg-email" type="email" placeholder="alguem@cardosotoys.com.br" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            Se o e-mail não estiver chegando, confirme que o secret <code>RESEND_API_KEY</code> está configurado no
            projeto Supabase (<code>supabase secrets set RESEND_API_KEY=...</code>) e que o domínio remetente
            (<code>cardosotoys.com.br</code>) está verificado na Resend. Enquanto isso, use o botão "Exportar
            violações (CSV)" na aba Monitoramento pra mandar manualmente pra quem for conferir.
          </span>
        </div>
        <div className="form-field">
          <label htmlFor="cfg-webhook">Webhook para alertas (opcional)</label>
          <input id="cfg-webhook" placeholder="https://…" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="cfg-whatsapp">WhatsApp (preparado — integração ainda não ativa)</label>
          <input id="cfg-whatsapp" placeholder="+55 11 99999-9999" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </div>
        {saved && (
          <div className="banner soon">
            <span className="ic">✓</span>
            <span>Configurações salvas.</span>
          </div>
        )}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </form>
    </div>
  );
}
