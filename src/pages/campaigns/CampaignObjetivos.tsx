import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import {
  OBJECTIVE_KINDS,
  OBJECTIVE_STATUSES,
  type CampaignObjective,
  type ObjectiveKind,
  type ObjectiveStatus,
  type Profile,
} from '../../types/database';

export default function CampaignObjetivos() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [objectives, setObjectives] = useState<CampaignObjective[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<CampaignObjective | 'new' | null>(null);

  async function load() {
    const [objRes, profRes] = await Promise.all([
      supabase.from('campaign_objectives').select('*').eq('campaign_id', campaign.id).order('created_at'),
      supabase.from('profiles').select('*'),
    ]);
    setObjectives((objRes.data as CampaignObjective[]) ?? []);
    setProfiles((profRes.data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return (
    <div>
      <div className="section-head">
        <h2>Objetivos</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo objetivo
        </button>
      </div>

      {OBJECTIVE_KINDS.map((kind) => {
        const items = objectives.filter((o) => o.kind === kind.key);
        if (items.length === 0) return null;
        return (
          <div key={kind.key}>
            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: 13, margin: '18px 0 8px 0', color: 'var(--text-dim)' }}>
              {kind.label}s
            </h4>
            <table className="simple">
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(o)}>
                    <td>{o.description}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{o.indicator}</td>
                    <td style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                      {o.current_value ?? '—'} / {o.target_value ?? '—'} {o.unit}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div className="bar" style={{ width: 80, display: 'inline-block' }}>
                        <i style={{ width: `${o.percent}%` }} />
                      </div>{' '}
                      {o.percent}%
                    </td>
                    <td style={{ color: 'var(--text-faint)' }}>{o.responsible_id ? profilesById[o.responsible_id]?.name : '—'}</td>
                    <td style={{ color: 'var(--text-faint)' }}>{OBJECTIVE_STATUSES.find((s) => s.key === o.status)?.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {objectives.length === 0 && (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum objetivo cadastrado ainda.
        </div>
      )}

      {editing && (
        <ObjectiveFormModal
          objective={editing === 'new' ? null : editing}
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

function ObjectiveFormModal({
  objective,
  campaignId,
  profiles,
  actorId,
  onClose,
  onSaved,
}: {
  objective: CampaignObjective | null;
  campaignId: string;
  profiles: Profile[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(objective);
  const [kind, setKind] = useState<ObjectiveKind>(objective?.kind ?? 'tatico');
  const [description, setDescription] = useState(objective?.description ?? '');
  const [indicator, setIndicator] = useState(objective?.indicator ?? '');
  const [unit, setUnit] = useState(objective?.unit ?? '');
  const [targetValue, setTargetValue] = useState(objective?.target_value?.toString() ?? '');
  const [currentValue, setCurrentValue] = useState(objective?.current_value?.toString() ?? '');
  const [weight, setWeight] = useState(objective?.weight?.toString() ?? '');
  const [responsibleId, setResponsibleId] = useState(objective?.responsible_id ?? '');
  const [dueDate, setDueDate] = useState(objective?.due_date ?? '');
  const [status, setStatus] = useState<ObjectiveStatus>(objective?.status ?? 'nao_iniciado');
  const [percent, setPercent] = useState(objective?.percent?.toString() ?? '0');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      kind,
      description: description.trim(),
      indicator: indicator.trim(),
      unit: unit.trim(),
      target_value: targetValue ? Number(targetValue) : null,
      current_value: currentValue ? Number(currentValue) : null,
      weight: weight ? Number(weight) : null,
      responsible_id: responsibleId || null,
      due_date: dueDate || null,
      status,
      percent: Number(percent) || 0,
    };
    if (isEdit && objective) {
      await supabase.from('campaign_objectives').update(fields).eq('id', objective.id);
    } else {
      await supabase.from('campaign_objectives').insert(fields);
    }
    await logActivity({ actorId, actionText: isEdit ? 'Objetivo atualizado' : 'Objetivo criado', detail: description, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!objective) return;
    await supabase.from('campaign_objectives').delete().eq('id', objective.id);
    await logActivity({ actorId, actionText: 'Objetivo removido', detail: objective.description, campaignId });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar objetivo' : 'Novo objetivo'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="obj-kind">Tipo</label>
          <select id="obj-kind" value={kind} onChange={(e) => setKind(e.target.value as ObjectiveKind)}>
            {OBJECTIVE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="obj-desc">Descrição</label>
          <textarea id="obj-desc" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="obj-indicator">Indicador</label>
          <input id="obj-indicator" value={indicator} onChange={(e) => setIndicator(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="obj-target">Meta</label>
            <input id="obj-target" type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="obj-current">Valor atual</label>
            <input id="obj-current" type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="obj-unit">Unidade</label>
            <input id="obj-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, R$, un." />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="obj-weight">Peso</label>
            <input id="obj-weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="obj-percent">% concluído</label>
            <input id="obj-percent" type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="obj-responsible">Responsável</label>
          <select id="obj-responsible" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="obj-due">Prazo</label>
            <input id="obj-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="obj-status">Status</label>
            <select id="obj-status" value={status} onChange={(e) => setStatus(e.target.value as ObjectiveStatus)}>
              {OBJECTIVE_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir este objetivo?</span>
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
