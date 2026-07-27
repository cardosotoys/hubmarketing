import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { MARKETPLACE_STATUSES, type CampaignMarketplaceEntry, type MarketplaceStatus, type Product } from '../../types/database';

export default function CampaignMarketplace() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [entries, setEntries] = useState<CampaignMarketplaceEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<CampaignMarketplaceEntry | 'new' | null>(null);

  async function load() {
    const [entriesRes, productsRes] = await Promise.all([
      supabase.from('campaign_marketplace_entries').select('*').eq('campaign_id', campaign.id).order('created_at'),
      supabase.from('products').select('*').order('name'),
    ]);
    setEntries((entriesRes.data as CampaignMarketplaceEntry[]) ?? []);
    setProducts((productsRes.data as Product[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  return (
    <div>
      <div className="section-head">
        <h2>Marketplace</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo registro
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum registro de marketplace ainda.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(e)}>
                <td>{e.marketplace}</td>
                <td style={{ color: 'var(--text-faint)' }}>{e.product_id ? productsById[e.product_id]?.name : '—'}</td>
                <td style={{ color: 'var(--text-faint)' }}>{MARKETPLACE_STATUSES.find((s) => s.key === e.status)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <MarketplaceFormModal
          item={editing === 'new' ? null : editing}
          campaignId={campaign.id}
          products={products}
          actorId={profile?.id ?? ''}
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

function MarketplaceFormModal({
  item,
  campaignId,
  products,
  actorId,
  onClose,
  onSaved,
}: {
  item: CampaignMarketplaceEntry | null;
  campaignId: string;
  products: Product[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(item);
  const [marketplace, setMarketplace] = useState(item?.marketplace ?? '');
  const [productId, setProductId] = useState(item?.product_id ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [status, setStatus] = useState<MarketplaceStatus>(item?.status ?? 'planejado');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = { campaign_id: campaignId, marketplace: marketplace.trim(), product_id: productId || null, url, status, notes };
    if (isEdit && item) {
      await supabase.from('campaign_marketplace_entries').update(fields).eq('id', item.id);
    } else {
      await supabase.from('campaign_marketplace_entries').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Registro de marketplace atualizado' : 'Registro de marketplace criado', detail: marketplace, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!item) return;
    await supabase.from('campaign_marketplace_entries').delete().eq('id', item.id);
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar registro' : 'Novo registro de marketplace'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="mp-name">Marketplace</label>
          <input id="mp-name" required value={marketplace} onChange={(e) => setMarketplace(e.target.value)} placeholder="Amazon, Shopee, Mercado Livre…" />
        </div>
        <div className="form-field">
          <label htmlFor="mp-product">Produto</label>
          <select id="mp-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Sem produto vinculado</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="mp-url">URL</label>
          <input id="mp-url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="mp-status">Status</label>
          <select id="mp-status" value={status} onChange={(e) => setStatus(e.target.value as MarketplaceStatus)}>
            {MARKETPLACE_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="mp-notes">Notas</label>
          <textarea id="mp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir?</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" onClick={handleDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn ghost" onClick={() => setConfirmingDelete(true)}>
                Excluir
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn">
              {isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
