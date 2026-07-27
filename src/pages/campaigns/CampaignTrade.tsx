import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { TRADE_ACTION_STATUSES, type CampaignTradeAction, type Profile, type TradeActionStatus } from '../../types/database';

export default function CampaignTrade() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [actions, setActions] = useState<CampaignTradeAction[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<CampaignTradeAction | 'new' | null>(null);

  async function load() {
    const [actionsRes, profilesRes] = await Promise.all([
      supabase.from('campaign_trade_actions').select('*').eq('campaign_id', campaign.id).order('start_date'),
      supabase.from('profiles').select('*'),
    ]);
    setActions((actionsRes.data as CampaignTradeAction[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return (
    <div>
      <div className="section-head">
        <h2>Trade Marketing</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Nova ação
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma ação de trade registrada ainda.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(a)}>
                <td>{a.description}</td>
                <td style={{ color: 'var(--text-faint)' }}>{a.channel}</td>
                <td style={{ color: 'var(--text-faint)' }}>{a.responsible_id ? profilesById[a.responsible_id]?.name : '—'}</td>
                <td style={{ color: 'var(--text-faint)' }}>{TRADE_ACTION_STATUSES.find((s) => s.key === a.status)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <TradeFormModal
          item={editing === 'new' ? null : editing}
          campaignId={campaign.id}
          profiles={profiles}
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

function TradeFormModal({
  item,
  campaignId,
  profiles,
  actorId,
  onClose,
  onSaved,
}: {
  item: CampaignTradeAction | null;
  campaignId: string;
  profiles: Profile[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(item);
  const [description, setDescription] = useState(item?.description ?? '');
  const [channel, setChannel] = useState(item?.channel ?? '');
  const [status, setStatus] = useState<TradeActionStatus>(item?.status ?? 'planejada');
  const [startDate, setStartDate] = useState(item?.start_date ?? '');
  const [endDate, setEndDate] = useState(item?.end_date ?? '');
  const [responsibleId, setResponsibleId] = useState(item?.responsible_id ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      description: description.trim(),
      channel,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      responsible_id: responsibleId || null,
      notes,
    };
    if (isEdit && item) {
      await supabase.from('campaign_trade_actions').update(fields).eq('id', item.id);
    } else {
      await supabase.from('campaign_trade_actions').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Ação de trade atualizada' : 'Ação de trade criada', detail: description, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!item) return;
    await supabase.from('campaign_trade_actions').delete().eq('id', item.id);
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar ação de trade' : 'Nova ação de trade'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="tr-desc">Descrição</label>
          <textarea id="tr-desc" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="tr-channel">Canal / rede</label>
          <input id="tr-channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Varejo, atacado, PDV…" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="tr-start">Início</label>
            <input id="tr-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="tr-end">Fim</label>
            <input id="tr-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="tr-responsible">Responsável</label>
          <select id="tr-responsible" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="tr-status">Status</label>
          <select id="tr-status" value={status} onChange={(e) => setStatus(e.target.value as TradeActionStatus)}>
            {TRADE_ACTION_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="tr-notes">Notas</label>
          <textarea id="tr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
