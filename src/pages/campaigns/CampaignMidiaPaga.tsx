import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { CampaignMediaInvestment } from '../../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CampaignMidiaPaga() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [items, setItems] = useState<CampaignMediaInvestment[]>([]);
  const [editing, setEditing] = useState<CampaignMediaInvestment | 'new' | null>(null);

  async function load() {
    const { data } = await supabase.from('campaign_media_investments').select('*').eq('campaign_id', campaign.id).order('created_at');
    setItems((data as CampaignMediaInvestment[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const totalSpent = items.reduce((s, i) => s + Number(i.spent_amount), 0);
  const totalImpressions = items.reduce((s, i) => s + Number(i.impressions), 0);
  const totalClicks = items.reduce((s, i) => s + Number(i.clicks), 0);
  const totalRevenue = items.reduce((s, i) => s + Number(i.revenue), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '—';
  const roas = totalSpent > 0 ? (totalRevenue / totalSpent).toFixed(2) : '—';

  return (
    <div>
      <div className="section-head">
        <h2>Mídia Paga</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo investimento
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{formatBRL(totalSpent)}</div>
          <div className="stat-label">Investido</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{totalImpressions.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Impressões</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{ctr}{ctr !== '—' && '%'}</div>
          <div className="stat-label">CTR</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{roas}{roas !== '—' && 'x'}</div>
          <div className="stat-label">ROAS</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum investimento de mídia paga lançado ainda — dados são inseridos manualmente
          (sem integração com Google/Meta/TikTok nesta leva).
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(i)}>
                <td>{i.channel}</td>
                <td style={{ color: 'var(--text-faint)' }}>{formatBRL(Number(i.spent_amount))} / {formatBRL(Number(i.planned_amount))}</td>
                <td style={{ color: 'var(--text-faint)' }}>{Number(i.impressions).toLocaleString('pt-BR')} impressões</td>
                <td style={{ color: 'var(--text-faint)' }}>{Number(i.clicks).toLocaleString('pt-BR')} cliques</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <MediaFormModal
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

function MediaFormModal({
  item,
  campaignId,
  actorId,
  onClose,
  onSaved,
}: {
  item: CampaignMediaInvestment | null;
  campaignId: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(item);
  const [channel, setChannel] = useState(item?.channel ?? '');
  const [planned, setPlanned] = useState(item?.planned_amount?.toString() ?? '0');
  const [spent, setSpent] = useState(item?.spent_amount?.toString() ?? '0');
  const [revenue, setRevenue] = useState(item?.revenue?.toString() ?? '0');
  const [impressions, setImpressions] = useState(item?.impressions?.toString() ?? '0');
  const [clicks, setClicks] = useState(item?.clicks?.toString() ?? '0');
  const [conversions, setConversions] = useState(item?.conversions?.toString() ?? '0');
  const [periodStart, setPeriodStart] = useState(item?.period_start ?? '');
  const [periodEnd, setPeriodEnd] = useState(item?.period_end ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      channel: channel.trim(),
      planned_amount: Number(planned) || 0,
      spent_amount: Number(spent) || 0,
      revenue: Number(revenue) || 0,
      impressions: Number(impressions) || 0,
      clicks: Number(clicks) || 0,
      conversions: Number(conversions) || 0,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      notes,
    };
    if (isEdit && item) {
      await supabase.from('campaign_media_investments').update(fields).eq('id', item.id);
    } else {
      await supabase.from('campaign_media_investments').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Investimento de mídia atualizado' : 'Investimento de mídia lançado', detail: channel, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!item) return;
    await supabase.from('campaign_media_investments').delete().eq('id', item.id);
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar investimento' : 'Novo investimento de mídia'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="mi-channel">Canal</label>
          <input id="mi-channel" required value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Google, Meta, TikTok…" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-planned">Previsto</label>
            <input id="mi-planned" type="number" value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-spent">Investido</label>
            <input id="mi-spent" type="number" value={spent} onChange={(e) => setSpent(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-revenue">Receita gerada</label>
            <input id="mi-revenue" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-impressions">Impressões</label>
            <input id="mi-impressions" type="number" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-clicks">Cliques</label>
            <input id="mi-clicks" type="number" value={clicks} onChange={(e) => setClicks(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-conversions">Conversões</label>
            <input id="mi-conversions" type="number" value={conversions} onChange={(e) => setConversions(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-start">Período início</label>
            <input id="mi-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mi-end">Período fim</label>
            <input id="mi-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="mi-notes">Notas</label>
          <textarea id="mi-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
