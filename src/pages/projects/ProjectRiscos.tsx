import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import {
  RISK_IMPACTS,
  RISK_PROBABILITIES,
  RISK_STATUSES,
  type CampaignDecision,
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

export default function ProjectRiscos({
  projectId,
  actorId,
  profiles,
}: {
  projectId: string;
  actorId: string;
  profiles: Profile[];
}) {
  const [risks, setRisks] = useState<CampaignRisk[]>([]);
  const [decisions, setDecisions] = useState<(CampaignDecision & { created_by_profile: { name: string } | null })[]>([]);
  const [editingRisk, setEditingRisk] = useState<CampaignRisk | 'new' | null>(null);
  const [showNewDecision, setShowNewDecision] = useState(false);

  async function load() {
    const [risksRes, decisionsRes] = await Promise.all([
      supabase.from('campaign_risks').select('*').eq('project_id', projectId).order('created_at'),
      supabase
        .from('campaign_decisions')
        .select('*, created_by_profile:profiles(name)')
        .eq('project_id', projectId)
        .order('decided_at', { ascending: false }),
    ]);
    setRisks((risksRes.data as CampaignRisk[]) ?? []);
    setDecisions((decisionsRes.data as (CampaignDecision & { created_by_profile: { name: string } | null })[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  function countFor(probability: RiskProbability, impact: RiskImpact) {
    return risks.filter((r) => r.probability === probability && r.impact === impact && r.status !== 'mitigado').length;
  }

  return (
    <div>
      <div className="section-head">
        <h2>Riscos</h2>
        <button className="btn" onClick={() => setEditingRisk('new')}>
          + Novo risco
        </button>
      </div>

      <div className="panel">
        <h4>Mapa de calor (probabilidade × impacto)</h4>
        <div className="heatmap">
          {RISK_IMPACTS.slice()
            .reverse()
            .map((impact, impactIdx) =>
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
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setEditingRisk(r)}>
                <td>{r.description}</td>
                <td style={{ color: 'var(--text-faint)' }}>
                  {r.probability} / {r.impact}
                </td>
                <td style={{ color: 'var(--text-faint)' }}>{r.responsible_id ? profilesById[r.responsible_id]?.name : '—'}</td>
                <td style={{ color: 'var(--text-faint)' }}>{RISK_STATUSES.find((s) => s.key === r.status)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingRisk && (
        <RiskFormModal
          risk={editingRisk === 'new' ? null : editingRisk}
          projectId={projectId}
          profiles={profiles}
          actorId={actorId}
          onClose={() => setEditingRisk(null)}
          onSaved={() => {
            setEditingRisk(null);
            load();
          }}
        />
      )}

      <div className="section-head" style={{ marginTop: 28 }}>
        <h2>Decision log</h2>
        <button className="btn" onClick={() => setShowNewDecision(true)}>
          + Nova decisão
        </button>
      </div>

      {decisions.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma decisão registrada ainda.
        </div>
      ) : (
        decisions.map((d) => (
          <div className="panel" key={d.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h4>{d.choice}</h4>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {new Date(d.decided_at + 'T00:00').toLocaleDateString('pt-BR')} · {d.created_by_profile?.name ?? '—'}
              </span>
            </div>
            {d.context && (
              <div className="field-row">
                <span className="k">Contexto</span>
                <span>{d.context}</span>
              </div>
            )}
            {d.alternatives && (
              <div className="field-row">
                <span className="k">Alternativas</span>
                <span>{d.alternatives}</span>
              </div>
            )}
            {d.impact && (
              <div className="field-row">
                <span className="k">Impacto</span>
                <span>{d.impact}</span>
              </div>
            )}
            {d.stakeholders && (
              <div className="field-row">
                <span className="k">Stakeholders</span>
                <span>{d.stakeholders}</span>
              </div>
            )}
          </div>
        ))
      )}

      {showNewDecision && (
        <NewDecisionModal
          projectId={projectId}
          actorId={actorId}
          onClose={() => setShowNewDecision(false)}
          onSaved={() => {
            setShowNewDecision(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RiskFormModal({
  risk,
  projectId,
  profiles,
  actorId,
  onClose,
  onSaved,
}: {
  risk: CampaignRisk | null;
  projectId: string;
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
      project_id: projectId,
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
    await logActivity({ actorId, actionText: isEdit ? 'Risco atualizado' : 'Risco registrado', detail: description, projectId });
    onSaved();
  }

  async function handleDelete() {
    if (!risk) return;
    await supabase.from('campaign_risks').delete().eq('id', risk.id);
    await logActivity({ actorId, actionText: 'Risco removido', detail: risk.description, projectId });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar risco' : 'Novo risco'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="proj-risk-desc">Descrição</label>
          <textarea id="proj-risk-desc" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="proj-risk-prob">Probabilidade</label>
            <select id="proj-risk-prob" value={probability} onChange={(e) => setProbability(e.target.value as RiskProbability)}>
              {RISK_PROBABILITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="proj-risk-impact">Impacto</label>
            <select id="proj-risk-impact" value={impact} onChange={(e) => setImpact(e.target.value as RiskImpact)}>
              {RISK_IMPACTS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="proj-risk-plan">Plano de mitigação</label>
          <textarea id="proj-risk-plan" rows={2} value={mitigationPlan} onChange={(e) => setMitigationPlan(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="proj-risk-responsible">Responsável</label>
          <select id="proj-risk-responsible" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="proj-risk-status">Status</label>
          <select id="proj-risk-status" value={status} onChange={(e) => setStatus(e.target.value as RiskStatus)}>
            {RISK_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="proj-risk-notes">Notas</label>
          <textarea id="proj-risk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

function NewDecisionModal({
  projectId,
  actorId,
  onClose,
  onSaved,
}: {
  projectId: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [context, setContext] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [choice, setChoice] = useState('');
  const [impact, setImpact] = useState('');
  const [stakeholders, setStakeholders] = useState('');
  const [decidedAt, setDecidedAt] = useState(() => new Date().toISOString().slice(0, 10));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!choice.trim()) return;
    await supabase.from('campaign_decisions').insert({
      project_id: projectId,
      context,
      alternatives,
      choice: choice.trim(),
      impact,
      stakeholders,
      decided_at: decidedAt,
      created_by: actorId,
    });
    await logActivity({ actorId, actionText: 'Decisão registrada', detail: choice, projectId });
    onSaved();
  }

  return (
    <Modal title="Nova decisão" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="proj-dec-context">Contexto</label>
          <textarea id="proj-dec-context" rows={2} value={context} onChange={(e) => setContext(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="proj-dec-alt">Alternativas consideradas</label>
          <textarea id="proj-dec-alt" rows={2} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="proj-dec-choice">Decisão tomada</label>
          <textarea id="proj-dec-choice" required rows={2} value={choice} onChange={(e) => setChoice(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="proj-dec-impact">Impacto esperado</label>
          <textarea id="proj-dec-impact" rows={2} value={impact} onChange={(e) => setImpact(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="proj-dec-stakeholders">Stakeholders envolvidos</label>
          <input id="proj-dec-stakeholders" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="proj-dec-date">Data</label>
          <input id="proj-dec-date" type="date" value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Registrar
          </button>
        </div>
      </form>
    </Modal>
  );
}
