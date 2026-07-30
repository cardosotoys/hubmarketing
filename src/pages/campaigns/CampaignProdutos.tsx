import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { Product } from '../../types/database';

export default function CampaignProdutos() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [products, setProducts] = useState<Product[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [pick, setPick] = useState('');

  async function load() {
    const [productsRes, linkedRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('campaign_products').select('product_id').eq('campaign_id', campaign.id),
    ]);
    setProducts((productsRes.data as Product[]) ?? []);
    setLinkedIds(((linkedRes.data as { product_id: string }[]) ?? []).map((r) => r.product_id));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  async function attach(productId: string) {
    await supabase.from('campaign_products').insert({ campaign_id: campaign.id, product_id: productId });
    if (profile) {
      const p = products.find((pr) => pr.id === productId);
      await logActivity({ actorId: profile.id, actionText: 'Produto vinculado à campanha', detail: p?.name, campaignId: campaign.id });
    }
    setPick('');
    load();
  }

  async function detach(productId: string) {
    await supabase.from('campaign_products').delete().eq('campaign_id', campaign.id).eq('product_id', productId);
    load();
  }

  const linked = products.filter((p) => linkedIds.includes(p.id));
  const unlinked = products.filter((p) => !linkedIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="section-head">
        <h2>{linked.length} produtos vinculados</h2>
      </div>

      {linked.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum produto vinculado ainda — os produtos vêm direto do Banco de Produtos, sem
          duplicar dado.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {linked.map((p) => (
              <tr key={p.id}>
                <td className="mono" data-label="Código">
                  {p.code}
                </td>
                <td data-label="Produto">{p.name}</td>
                <td data-label="Linha" style={{ color: 'var(--text-faint)' }}>
                  {p.line || '—'}
                </td>
                <td data-label="Licenciado">{p.licensed && <span className="pill">licenciado</span>}</td>
                <td data-label="Ações">
                  <button className="btn ghost sm" onClick={() => detach(p.id)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <h4>Vincular produto do catálogo</h4>
        <div className="responsive-row">
          <input placeholder="Buscar por nome…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 2 }}>
            <option value="">Escolher produto…</option>
            {unlinked.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
          <button className="btn sm" disabled={!pick} onClick={() => attach(pick)}>
            Vincular
          </button>
        </div>
      </div>
    </div>
  );
}
