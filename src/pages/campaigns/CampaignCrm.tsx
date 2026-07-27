import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { LEAD_STAGES, type CampaignLead, type LeadStage, type Profile } from '../../types/database';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CampaignCrm() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<CampaignLead | 'new' | null>(null);

  async function load() {
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from('campaign_leads').select('*').eq('campaign_id', campaign.id).order('created_at'),
      supabase.from('profiles').select('*'),
    ]);
    setLeads((leadsRes.data as CampaignLead[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const totalValue = leads.filter((l) => l.stage !== 'perdido').reduce((s, l) => s + Number(l.value), 0);

  return (
    <div>
      <div className="section-head">
        <h2>CRM — {leads.length} oportunidades ({formatBRL(totalValue)} em aberto)</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo lead
        </button>
      </div>

      {LEAD_STAGES.map((stage) => {
        const items = leads.filter((l) => l.stage === stage.key);
        if (items.length === 0) return null;
        return (
          <div key={stage.key}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: 13, margin: '16px 0 8px 0', color: 'var(--text-dim)' }}>
              {stage.label} ({items.length})
            </h4>
            <table className="simple">
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(l)}>
                    <td>{l.name}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{l.company}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{formatBRL(Number(l.value))}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{l.responsible_id ? profilesById[l.responsible_id]?.name : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {leads.length === 0 && (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum lead cadastrado ainda.
        </div>
      )}

      {editing && (
        <LeadFormModal
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

function LeadFormModal({
  item,
  campaignId,
  profiles,
  actorId,
  onClose,
  onSaved,
}: {
  item: CampaignLead | null;
  campaignId: string;
  profiles: Profile[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(item);
  const [name, setName] = useState(item?.name ?? '');
  const [company, setCompany] = useState(item?.company ?? '');
  const [contact, setContact] = useState(item?.contact ?? '');
  const [source, setSource] = useState(item?.source ?? '');
  const [stage, setStage] = useState<LeadStage>(item?.stage ?? 'novo');
  const [value, setValue] = useState(item?.value?.toString() ?? '0');
  const [responsibleId, setResponsibleId] = useState(item?.responsible_id ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      name: name.trim(),
      company,
      contact,
      source,
      stage,
      value: Number(value) || 0,
      responsible_id: responsibleId || null,
      notes,
    };
    if (isEdit && item) {
      await supabase.from('campaign_leads').update(fields).eq('id', item.id);
    } else {
      await supabase.from('campaign_leads').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Lead atualizado' : 'Lead criado', detail: name, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!item) return;
    await supabase.from('campaign_leads').delete().eq('id', item.id);
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar lead' : 'Novo lead'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="ld-name">Nome</label>
          <input id="ld-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ld-company">Empresa</label>
            <input id="ld-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ld-contact">Contato</label>
            <input id="ld-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="ld-source">Origem</label>
          <input id="ld-source" value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ld-value">Valor</label>
            <input id="ld-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ld-stage">Etapa</label>
            <select id="ld-stage" value={stage} onChange={(e) => setStage(e.target.value as LeadStage)}>
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="ld-responsible">Responsável</label>
          <select id="ld-responsible" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ld-notes">Notas</label>
          <textarea id="ld-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
