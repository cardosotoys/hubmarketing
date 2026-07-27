import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { CampaignDecision } from '../../types/database';

export default function CampaignDecisoes() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [decisions, setDecisions] = useState<(CampaignDecision & { created_by_profile: { name: string } | null })[]>([]);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('campaign_decisions')
      .select('*, created_by_profile:profiles(name)')
      .eq('campaign_id', campaign.id)
      .order('decided_at', { ascending: false });
    setDecisions((data as (CampaignDecision & { created_by_profile: { name: string } | null })[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  return (
    <div>
      <div className="section-head">
        <h2>Decision log</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
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

      {showNew && (
        <NewDecisionModal
          campaignId={campaign.id}
          actorId={profile?.id ?? ''}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewDecisionModal({
  campaignId,
  actorId,
  onClose,
  onSaved,
}: {
  campaignId: string;
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
      campaign_id: campaignId,
      context,
      alternatives,
      choice: choice.trim(),
      impact,
      stakeholders,
      decided_at: decidedAt,
      created_by: actorId,
    });
    await logActivity({ actorId, actionText: 'Decisão registrada', detail: choice, campaignId });
    onSaved();
  }

  return (
    <Modal title="Nova decisão" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="dec-context">Contexto</label>
          <textarea id="dec-context" rows={2} value={context} onChange={(e) => setContext(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="dec-alt">Alternativas consideradas</label>
          <textarea id="dec-alt" rows={2} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="dec-choice">Decisão tomada</label>
          <textarea id="dec-choice" required rows={2} value={choice} onChange={(e) => setChoice(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="dec-impact">Impacto esperado</label>
          <textarea id="dec-impact" rows={2} value={impact} onChange={(e) => setImpact(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="dec-stakeholders">Stakeholders envolvidos</label>
          <input id="dec-stakeholders" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="dec-date">Data</label>
          <input id="dec-date" type="date" value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} />
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
