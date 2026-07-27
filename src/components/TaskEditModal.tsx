import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import { PRIORITIES, PRIORITY_LABELS, STAGES, type Priority, type Profile, type Stage, type Task } from '../types/database';

function computeOverdue(dueDate: string, stage: Stage) {
  if (stage === 'finalizado') return false;
  return new Date(dueDate + 'T00:00') < new Date(new Date().toDateString());
}

export default function TaskEditModal({
  task,
  profiles,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  profiles: Profile[];
  onClose: () => void;
  onSave: (fields: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [stage, setStage] = useState<Stage>(task.stage);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '');
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [delayReason, setDelayReason] = useState(task.delay_reason ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const overdue = dueDate ? computeOverdue(dueDate, stage) : false;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      priority,
      stage,
      assignee_id: assigneeId || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      delay_reason: delayReason,
    });
  }

  return (
    <Modal title="Editar demanda" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="te-title">Título</label>
          <input id="te-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-stage">Estágio</label>
            <select id="te-stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-priority">Prioridade</label>
            <select id="te-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="te-assignee">Responsável</label>
          <select id="te-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
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
            <label htmlFor="te-start">Início</label>
            <input id="te-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-due">Prazo</label>
            <input id="te-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        {overdue && (
          <div className="form-field">
            <label htmlFor="te-delay" style={{ color: 'var(--red)' }}>
              🔴 Esta demanda está atrasada — por que não foi concluída no prazo?
            </label>
            <textarea
              id="te-delay"
              required
              rows={2}
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Explique o motivo do atraso — fica visível pra quem acompanha este projeto."
              style={{ borderColor: 'var(--red)' }}
            />
          </div>
        )}

        {confirmingDelete ? (
          <div className="banner error" style={{ alignItems: 'center' }}>
            <span className="ic">⚠</span>
            <span style={{ flex: 1 }}>Excluir esta demanda? Não dá pra desfazer.</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" style={{ background: 'var(--red)' }} onClick={onDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmingDelete(true)}>
              Excluir
            </button>
            <div className="responsive-row">
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn">
                Salvar
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
