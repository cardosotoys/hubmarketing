import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useProductDevWorkspace } from '../../context/ProductDevWorkspaceContext';
import {
  GATE_DECISIONS,
  PRODUCT_DEV_OWNER_LABELS,
  PRODUCT_DEV_PHASES,
  PRODUCT_DEV_TRACKS,
  type GateDecision,
  type Profile,
  type ProductDevGate,
  type ProductDevTask,
  type ProductDevTrack,
} from '../../types/database';

const DECISION_COLOR: Record<GateDecision, string> = {
  pendente: 'var(--text-faint)',
  aprovado: 'var(--green)',
  ajustar: 'var(--yellow)',
  reprovado: 'var(--red)',
};

const OWNER_COLOR: Record<string, string> = {
  compartilhado: 'var(--violet)',
  produto: 'var(--blue)',
  marketing: 'var(--green)',
  qualidade: 'var(--yellow)',
};

// Trilhas mostradas dentro do card de cada fase (marketing tem página própria)
const PHASE_TRACKS: ProductDevTrack[] = ['produto', 'embalagem'];

export default function ProductDevFases() {
  const { profile } = useAuth();
  const { item, gates, reload } = useProductDevWorkspace();
  const [tasks, setTasks] = useState<ProductDevTask[]>([]);
  const [editingGate, setEditingGate] = useState<ProductDevGate | null>(null);
  const [movingPhase, setMovingPhase] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('product_dev_tasks')
      .select('*')
      .eq('item_id', item.id)
      .in('track', PHASE_TRACKS)
      .order('position');
    setTasks((data as ProductDevTask[]) ?? []);
  }, [item.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function movePhase(delta: number) {
    const next = item.current_phase + delta;
    if (next < 1 || next > 9 || movingPhase) return;
    setMovingPhase(true);
    await supabase
      .from('product_dev_items')
      .update({ current_phase: next, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    await logActivity({
      actorId: profile?.id ?? '',
      actionText: delta > 0 ? 'Avançou de fase' : 'Voltou de fase',
      detail: `Fase ${next} — ${PRODUCT_DEV_PHASES.find((p) => p.n === next)?.name ?? ''}`,
      productDevItemId: item.id,
    });
    setMovingPhase(false);
    reload();
  }

  return (
    <div>
      <div className="section-head">
        <h2>Fases & Portões de decisão</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" disabled={item.current_phase <= 1 || movingPhase} onClick={() => movePhase(-1)}>
            ← Voltar fase
          </button>
          <button className="btn sm" disabled={item.current_phase >= 9 || movingPhase} onClick={() => movePhase(1)}>
            Avançar fase →
          </button>
        </div>
      </div>

      <div className="page-sub" style={{ marginTop: -6 }}>
        Cada fase termina num portão de decisão (go / ajustar / no-go) com aprovador. A Fase 6 (certificação) é
        bloqueante: nada avança para produção/venda sem certificado válido.
      </div>

      {PRODUCT_DEV_PHASES.map((p) => {
        const gate = gates.find((g) => g.phase === p.n);
        const decision = gate?.decision ?? 'pendente';
        const state = p.n < item.current_phase ? 'done' : p.n === item.current_phase ? 'current' : 'todo';
        const phaseTasks = tasks.filter((t) => t.phase === p.n);
        return (
          <div
            className="panel"
            key={p.n}
            style={{
              borderLeft: `3px solid ${state === 'current' ? 'var(--violet)' : state === 'done' ? 'var(--green)' : 'var(--border)'}`,
              opacity: state === 'todo' ? 0.85 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0 }}>
                    Fase {p.n} · {p.name}
                  </h4>
                  <span className="tag" style={{ background: 'var(--surface-2)', color: OWNER_COLOR[p.owner] }}>
                    {PRODUCT_DEV_OWNER_LABELS[p.owner]}
                  </span>
                  {state === 'current' && (
                    <span className="tag" style={{ background: 'var(--violet-dim)', color: 'var(--violet)' }}>
                      fase atual
                    </span>
                  )}
                  {p.blocking && (
                    <span className="tag" style={{ background: 'var(--surface-2)', color: 'var(--red)' }}>
                      ⛔ bloqueante
                    </span>
                  )}
                </div>
                <div className="field-row" style={{ marginTop: 6 }}>
                  <span className="k">Entregável</span>
                  <span>{p.deliverable}</span>
                </div>
                <div className="field-row">
                  <span className="k">Portão</span>
                  <span>{p.gate}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 150 }}>
                <span
                  className="tag"
                  style={{ background: 'var(--surface-2)', color: DECISION_COLOR[decision], fontWeight: 600 }}
                >
                  {GATE_DECISIONS.find((d) => d.key === decision)?.label ?? decision}
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                  {gate?.decided_at ? new Date(gate.decided_at).toLocaleDateString('pt-BR') : 'sem decisão'}
                </div>
                <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => gate && setEditingGate(gate)}>
                  Registrar portão
                </button>
              </div>
            </div>

            {gate?.notes && (
              <div className="field-row">
                <span className="k">Notas do portão</span>
                <span>{gate.notes}</span>
              </div>
            )}

            <PhaseTasks phase={p.n} itemId={item.id} tasks={phaseTasks} onChanged={loadTasks} />
          </div>
        );
      })}

      {editingGate && (
        <GateModal
          gate={editingGate}
          itemId={item.id}
          phaseName={PRODUCT_DEV_PHASES.find((p) => p.n === editingGate.phase)?.name ?? ''}
          actorId={profile?.id ?? ''}
          onClose={() => setEditingGate(null)}
          onSaved={() => {
            setEditingGate(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PhaseTasks({
  phase,
  itemId,
  tasks,
  onChanged,
}: {
  phase: number;
  itemId: string;
  tasks: ProductDevTask[];
  onChanged: () => void;
}) {
  const { profile } = useAuth();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [track, setTrack] = useState<ProductDevTrack>('produto');

  async function toggle(t: ProductDevTask) {
    await supabase.from('product_dev_tasks').update({ done: !t.done }).eq('id', t.id);
    onChanged();
  }

  async function remove(t: ProductDevTask) {
    await supabase.from('product_dev_tasks').delete().eq('id', t.id);
    onChanged();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await supabase.from('product_dev_tasks').insert({
      item_id: itemId,
      phase,
      track,
      title: title.trim(),
      created_by: profile?.id ?? null,
      position: tasks.length,
    });
    setTitle('');
    setAdding(false);
    onChanged();
  }

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
      {tasks.map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
          <input type="checkbox" checked={t.done} onChange={() => toggle(t)} style={{ width: 'auto' }} />
          <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-faint)' : 'var(--text)', flex: 1 }}>
            {t.title}
          </span>
          <span className="tag" style={{ background: 'var(--surface-2)', fontSize: 10 }}>
            {PRODUCT_DEV_TRACKS.find((x) => x.key === t.track)?.label ?? t.track}
          </span>
          <button className="btn ghost sm" onClick={() => remove(t)} title="Excluir">
            ✕
          </button>
        </div>
      ))}
      {adding ? (
        <form onSubmit={add} style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <input autoFocus placeholder="Atividade da fase" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <select value={track} onChange={(e) => setTrack(e.target.value as ProductDevTrack)} style={{ width: 'auto' }}>
            {PRODUCT_DEV_TRACKS.filter((t) => t.key !== 'marketing').map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn sm">
            Adicionar
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button className="btn ghost sm" style={{ marginTop: 4 }} onClick={() => setAdding(true)}>
          + Atividade
        </button>
      )}
    </div>
  );
}

function GateModal({
  gate,
  itemId,
  phaseName,
  actorId,
  onClose,
  onSaved,
}: {
  gate: ProductDevGate;
  itemId: string;
  phaseName: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [decision, setDecision] = useState<GateDecision>(gate.decision);
  const [approverId, setApproverId] = useState(gate.approver_id ?? '');
  const [notes, setNotes] = useState(gate.notes);
  const [people, setPeople] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('name')
      .then(({ data }) => setPeople((data as Profile[]) ?? []));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from('product_dev_gates')
      .update({
        decision,
        approver_id: approverId || null,
        notes,
        decided_at: decision === 'pendente' ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', gate.id);
    await logActivity({
      actorId,
      actionText: `Portão da Fase ${gate.phase} — ${GATE_DECISIONS.find((d) => d.key === decision)?.label ?? decision}`,
      detail: phaseName,
      productDevItemId: itemId,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={`Portão — Fase ${gate.phase} · ${phaseName}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="g-decision">Decisão</label>
          <select id="g-decision" value={decision} onChange={(e) => setDecision(e.target.value as GateDecision)}>
            {GATE_DECISIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="g-approver">Aprovador</label>
          <select id="g-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
            <option value="">— sem aprovador —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="g-notes">Notas / justificativa</label>
          <textarea id="g-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar decisão'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
