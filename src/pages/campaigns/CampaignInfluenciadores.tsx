import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { INFLUENCER_STATUSES, type CampaignInfluencer, type InfluencerStatus } from '../../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CampaignInfluenciadores() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [items, setItems] = useState<CampaignInfluencer[]>([]);
  const [editing, setEditing] = useState<CampaignInfluencer | 'new' | null>(null);

  async function load() {
    const { data } = await supabase.from('campaign_influencers').select('*').eq('campaign_id', campaign.id).order('created_at');
    setItems((data as CampaignInfluencer[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  return (
    <div>
      <div className="section-head">
        <h2>Influenciadores</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo influenciador
        </button>
      </div>

      {items.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum influenciador cadastrado ainda.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(i)}>
                <td>{i.name}</td>
                <td style={{ color: 'var(--text-faint)' }}>{i.platform} {i.handle}</td>
                <td style={{ color: 'var(--text-faint)' }}>{formatBRL(Number(i.fee))}</td>
                <td style={{ color: 'var(--text-faint)' }}>{INFLUENCER_STATUSES.find((s) => s.key === i.status)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <InfluencerFormModal
          item={editing === 'new' ? null : editing}
          campaignId={campaign.id}
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

function InfluencerFormModal({
  item,
  campaignId,
  actorId,
  onClose,
  onSaved,
}: {
  item: CampaignInfluencer | null;
  campaignId: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(item);
  const [name, setName] = useState(item?.name ?? '');
  const [handle, setHandle] = useState(item?.handle ?? '');
  const [platform, setPlatform] = useState(item?.platform ?? '');
  const [deliverables, setDeliverables] = useState(item?.deliverables ?? '');
  const [fee, setFee] = useState(item?.fee?.toString() ?? '0');
  const [status, setStatus] = useState<InfluencerStatus>(item?.status ?? 'contato');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      name: name.trim(),
      handle,
      platform,
      deliverables,
      fee: Number(fee) || 0,
      status,
      notes,
    };
    if (isEdit && item) {
      await supabase.from('campaign_influencers').update(fields).eq('id', item.id);
    } else {
      await supabase.from('campaign_influencers').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Influenciador atualizado' : 'Influenciador adicionado', detail: name, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!item) return;
    await supabase.from('campaign_influencers').delete().eq('id', item.id);
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar influenciador' : 'Novo influenciador'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="inf-name">Nome</label>
          <input id="inf-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="inf-platform">Plataforma</label>
            <input id="inf-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Instagram, TikTok…" />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="inf-handle">@</label>
            <input id="inf-handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="inf-deliverables">Entregáveis</label>
          <textarea id="inf-deliverables" rows={2} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="inf-fee">Cachê</label>
            <input id="inf-fee" type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="inf-status">Status</label>
            <select id="inf-status" value={status} onChange={(e) => setStatus(e.target.value as InfluencerStatus)}>
              {INFLUENCER_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="inf-notes">Notas</label>
          <textarea id="inf-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
