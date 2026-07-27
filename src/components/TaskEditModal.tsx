import { useState } from 'react';
import Modal from './Modal';
import { STAGES, type Priority, type Profile, type Stage, type Task } from '../types/database';

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      priority,
      stage,
      assignee_id: assigneeId || null,
    });
  }

  return (
    <Modal title="Editar demanda" onClose={onClose}>
      <div className="form-field">
        <label htmlFor="te-title">Título</label>
        <input id="te-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="te-stage">Estágio</label>
        <select id="te-stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="te-priority">Prioridade</label>
        <select id="te-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
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

      {confirmingDelete ? (
        <div className="banner error" style={{ alignItems: 'center' }}>
          <span className="ic">⚠</span>
          <span style={{ flex: 1 }}>Excluir esta demanda? Não dá pra desfazer.</span>
          <button className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
            Cancelar
          </button>
          <button className="btn sm" style={{ background: 'var(--red)' }} onClick={onDelete}>
            Excluir
          </button>
        </div>
      ) : (
        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmingDelete(true)}>
            Excluir
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn" onClick={handleSave}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
