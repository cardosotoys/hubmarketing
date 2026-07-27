import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import {
  RISK_IMPACTS,
  RISK_PROBABILITIES,
  RISK_STATUSES,
  type CampaignRisk,
  type Profile,
  type RiskImpact,
  type RiskProbability,
  type RiskStatus,
} from '../../types/database';

const SEVERITY_COLOR: Record<string, string> = {
  '2-2': 'var(--red-dim)',
  '2-1': 'var(--red-dim)',
  '1-2': 'var(--red-dim)',
  '2-0': 'var(--yellow-dim)',
  '1-1': 'var(--yellow-dim)',
  '0-2': 'var(--yellow-dim)',
  '1-0': 'var(--green-dim)',
  '0-1': 'var(--green-dim)',
  '0-0': 'var(--green-dim)',
};

export default function CampaignRiscos() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [risks, setRisks] = useState<CampaignRisk[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<CampaignRisk | 'new' | null>(null);

  async function load() {
    const [risksRes, profilesRes] = await Promise.all([
      supabase.from('campaign_risks').select('*').eq('campaign_id', campaign.id).order('created_at'),
      supabase.from('profiles').select('*'),
    ]);
    setRisks((risksRes.data as CampaignRisk[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  function countFor(probability: RiskProbability, impact: RiskImpact) {
    return risks.filter((r) => r.probability === probability && r.impact === impact && r.status !== 'mitigado').length;
  }

  return (
    <div>
      <div className="section-head">
        <h2>Riscos</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo risco
        </button>
      </div>

      <div className="panel">
        <h4>Mapa de calor (probabilidade × impacto)</h4>
        <div className="heatmap">
          {RISK_IMPACTS.slice().reverse().map((impact, impactIdx) =>
            RISK_PROBABILITIES.map((prob, probIdx) => {
              const key = `${2 - impactIdx}-${probIdx}`;
              const count = countFor(prob, impact);
              return (
                <div key={`${impact}-${prob}`} className="cell" style={{ background: count > 0 ? SEVERITY_COLOR[key] : 'var(--surface-2)' }}>
                  {count > 0 ? count : ''}
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-faint)', marginTop: 4, maxWidth: 320 }}>
          <span>← probabilidade baixa</span>
          <span>probabilidade alta →</span>
        </div>
      </div>

      {risks.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum risco registrado ainda.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {risks.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(r)}>
                <td>{r.description}</td>
                <td style={{ color: 'var(--text-faint)' }}>{r.probability} / {r.impact}</td>
                <td style={{ color: 'var(--text-faint)' }}>{r.responsible_id ? profilesById[r.responsible_id]?.name : '—'}</td>
                <td style={{ color: 'var(--text-faint)' }}>{RISK_STATUSES.find((s) => s.key === r.status)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <RiskFormModal
          risk={editing === 'new' ? null : editing}
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

function RiskFormModal({
  risk,
  campaignId,
  profiles,
  actorId,
  onClose,
  onSaved,
}: {
  risk: CampaignRisk | null;
  campaignId: string;
  profiles: Profile[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(risk);
  const [description, setDescription] = useState(risk?.description ?? '');
  const [probability, setProbability] = useState<RiskProbability>(risk?.probability ?? 'media');
  const [impact, setImpact] = useState<RiskImpact>(risk?.impact ?? 'medio');
  const [mitigationPlan, setMitigationPlan] = useState(risk?.mitigation_plan ?? '');
  const [responsibleId, setResponsibleId] = useState(risk?.responsible_id ?? '');
  const [status, setStatus] = useState<RiskStatus>(risk?.status ?? 'aberto');
  const [notes, setNotes] = useState(risk?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      description: description.trim(),
      probability,
      impact,
      mitigation_plan: mitigationPlan,
      responsible_id: responsibleId || null,
      status,
      notes,
    };
    if (isEdit && risk) {
      await supabase.from('campaign_risks').update(fields).eq('id', risk.id);
    } else {
      await supabase.from('campaign_risks').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Risco atualizado' : 'Risco registrado', detail: description, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!risk) return;
    await supabase.from('campaign_risks').delete().eq('id', risk.id);
    await logActivity({ actorId, actionText: 'Risco removido', detail: risk.description, campaignId });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar risco' : 'Novo risco'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="risk-desc">Descrição</label>
          <textarea id="risk-desc" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="risk-prob">Probabilidade</label>
            <select id="risk-prob" value={probability} onChange={(e) => setProbability(e.target.value as RiskProbability)}>
              {RISK_PROBABILITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="risk-impact">Impacto</label>
            <select id="risk-impact" value={impact} onChange={(e) => setImpact(e.target.value as RiskImpact)}>
              {RISK_IMPACTS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="risk-plan">Plano de mitigação</label>
          <textarea id="risk-plan" rows={2} value={mitigationPlan} onChange={(e) => setMitigationPlan(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="risk-responsible">Responsável</label>
          <select id="risk-responsible" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="risk-status">Status</label>
          <select id="risk-status" value={status} onChange={(e) => setStatus(e.target.value as RiskStatus)}>
            {RISK_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="risk-notes">Notas</label>
          <textarea id="risk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir este risco?</span>
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
