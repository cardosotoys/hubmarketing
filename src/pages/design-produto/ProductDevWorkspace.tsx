import { useEffect, useState, type FormEvent } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProductDevWorkspaceData } from '../../hooks/useProductDevWorkspaceData';
import { ProductDevWorkspaceContext } from '../../context/ProductDevWorkspaceContext';
import { logActivity } from '../../lib/activityLog';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../../components/Modal';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PRODUCT_DEV_MATERIALS,
  PRODUCT_DEV_PHASES,
  PRODUCT_DEV_STATUSES,
  CERTIFICATION_STATUSES,
  type Brand,
  type CertificationStatus,
  type Priority,
  type ProductDevItem,
  type ProductDevStatus,
} from '../../types/database';
import ProductDevSidebar from './ProductDevSidebar';

const STATUS_COLOR: Record<ProductDevStatus, string> = {
  ativo: 'var(--green)',
  pausado: 'var(--yellow)',
  concluido: 'var(--blue)',
  descontinuado: 'var(--text-faint)',
  cancelado: 'var(--red)',
};

function money(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProductDevWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { item, brand, product, ownerName, gates, loading, error, reload } = useProductDevWorkspaceData(id);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  if (loading && !item) {
    return <div className="page-sub">Carregando produto…</div>;
  }
  if (error || !item) {
    return (
      <div className="banner error">
        <span className="ic">⚠</span>
        <span>Não foi possível carregar o produto{error ? `: ${error}` : '.'}</span>
      </div>
    );
  }

  const phase = PRODUCT_DEV_PHASES.find((p) => p.n === item.current_phase);
  const statusLabel = PRODUCT_DEV_STATUSES.find((s) => s.key === item.status)?.label ?? item.status;
  // Bloqueio: a partir da Fase 6, sem certificação aprovada o item não avança para produção/venda
  const certBlocking = item.current_phase >= 6 && item.certification_status !== 'aprovado';

  return (
    <div className="page">
      <div className="workspace-header">
        <div className="workspace-header-top">
          <div>
            <div className="workspace-title-row">
              <h1 className="page-title" style={{ margin: 0 }}>
                {item.name}
              </h1>
              <span className="tag" style={{ background: 'var(--surface-2)', color: STATUS_COLOR[item.status] }}>
                {statusLabel}
              </span>
              {brand && (
                <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
                  <span style={{ color: brand.color }}>●</span> {brand.label}
                </span>
              )}
              <span className={`prio ${item.priority}`}>{PRIORITY_LABELS[item.priority]}</span>
              <span className="tag" style={{ background: 'var(--surface-2)' }}>
                Fase {item.current_phase}/9 · {phase?.name}
              </span>
            </div>
            <div className="workspace-meta-row">
              <span>
                <span className="k">Faixa etária</span> {item.age_range || '—'}
              </span>
              <span>
                <span className="k">Material</span> {item.material || '—'}
              </span>
              <span>
                <span className="k">Meta de preço</span> {money(item.target_price)}
              </span>
              <span>
                <span className="k">Responsável</span> {ownerName ?? '—'}
              </span>
              <span>
                <span className="k">SKU do catálogo</span> {product ? `${product.code} — ${product.name}` : 'não vinculado'}
              </span>
              <span>
                <span className="k">Lançamento-alvo</span>{' '}
                {item.launch_target_date ? new Date(item.launch_target_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
          </div>
          <div className="workspace-actions">
            <button className="btn ghost sm" onClick={() => setEditing(true)}>
              ✎ Editar
            </button>
            <button
              className="btn ghost sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? '✓ Link copiado!' : '🔗 Compartilhar'}
            </button>
          </div>
        </div>

        <div className="progress-phases" title={`Fase atual: ${item.current_phase} de 9`}>
          {PRODUCT_DEV_PHASES.map((p) => (
            <i
              key={p.n}
              className={p.n < item.current_phase ? 'done' : p.n === item.current_phase ? 'current' : ''}
              title={`Fase ${p.n} — ${p.name}`}
            />
          ))}
        </div>

        {certBlocking && (
          <div className="banner error" style={{ marginTop: 12 }}>
            <span className="ic">⛔</span>
            <span>
              <strong>Certificação bloqueante:</strong> este produto está na Fase {item.current_phase} sem certificação
              INMETRO aprovada. Nenhum item pode ir a produção ou venda sem o certificado válido (Fase 6).
            </span>
          </div>
        )}
      </div>

      <div className="workspace-shell">
        <ProductDevSidebar />
        <div className="workspace-main">
          <ProductDevWorkspaceContext.Provider value={{ item, brand, product, ownerName, gates, reload }}>
            <Outlet />
          </ProductDevWorkspaceContext.Provider>
        </div>
      </div>

      {editing && profile && (
        <ItemEditModal
          item={item}
          actorId={profile.id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ItemEditModal({
  item,
  actorId,
  onClose,
  onSaved,
}: {
  item: ProductDevItem;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState(item.name);
  const [brandId, setBrandId] = useState(item.brand_id);
  const [ageRange, setAgeRange] = useState(item.age_range);
  const [material, setMaterial] = useState(item.material);
  const [targetPrice, setTargetPrice] = useState(item.target_price?.toString() ?? '');
  const [targetVolume, setTargetVolume] = useState(item.target_volume?.toString() ?? '');
  const [toolingInvestment, setToolingInvestment] = useState(item.tooling_investment?.toString() ?? '');
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [status, setStatus] = useState<ProductDevStatus>(item.status);
  const [certStatus, setCertStatus] = useState<CertificationStatus>(item.certification_status);
  const [licensed, setLicensed] = useState(item.licensed);
  const [launchDate, setLaunchDate] = useState(item.launch_target_date ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('brands')
      .select('*')
      .then(({ data }) => setBrands((data as Brand[]) ?? []));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('product_dev_items')
      .update({
        name: name.trim(),
        brand_id: brandId,
        age_range: ageRange,
        material,
        target_price: targetPrice ? Number(targetPrice) : null,
        target_volume: targetVolume ? Number(targetVolume) : null,
        tooling_investment: toolingInvestment ? Number(toolingInvestment) : null,
        priority,
        status,
        certification_status: certStatus,
        licensed,
        launch_target_date: launchDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Produto editado', productDevItemId: item.id });
    onSaved();
  }

  return (
    <Modal title="Editar produto" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="pe-name">Nome</label>
          <input id="pe-name" required value={name} onChange={(e) => setName(e.target.value)} />
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
            <label htmlFor="pe-age">Faixa etária</label>
            <input id="pe-age" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-material">Material</label>
            <select id="pe-material" value={material} onChange={(e) => setMaterial(e.target.value)}>
              <option value="">A definir</option>
              {PRODUCT_DEV_MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-price">Meta de preço (R$)</label>
            <input id="pe-price" type="number" step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-volume">Meta de volume (un.)</label>
            <input id="pe-volume" type="number" value={targetVolume} onChange={(e) => setTargetVolume(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-tooling">Investimento em molde (R$)</label>
            <input id="pe-tooling" type="number" step="0.01" value={toolingInvestment} onChange={(e) => setToolingInvestment(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
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
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-status">Status</label>
            <select id="pe-status" value={status} onChange={(e) => setStatus(e.target.value as ProductDevStatus)}>
              {PRODUCT_DEV_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-cert">Certificação</label>
            <select id="pe-cert" value={certStatus} onChange={(e) => setCertStatus(e.target.value as CertificationStatus)}>
              {CERTIFICATION_STATUSES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pe-launch">Lançamento-alvo</label>
            <input id="pe-launch" type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={licensed} onChange={(e) => setLicensed(e.target.checked)} style={{ width: 'auto' }} />
            Produto licenciado (personagem/marca de terceiro)
          </label>
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
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
