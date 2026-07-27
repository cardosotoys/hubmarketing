import { useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { STAGES, type Priority, type Profile } from '../types/database';

function initialsFor(profilesById: Record<string, Profile>, id: string | null) {
  if (!id || !profilesById[id]) return '?';
  return profilesById[id].avatar_initials;
}

interface KanbanItem {
  id: string;
  stage: string;
  priority: string;
  assignee_id: string | null;
  title: string;
}

export default function KanbanBoard<T extends KanbanItem>({
  tasks,
  profilesById,
  editable,
  cols = 6,
  stages,
  onStageChange,
  onCreate,
  onEdit,
  renderExtra,
}: {
  tasks: T[];
  profilesById: Record<string, Profile>;
  editable: boolean;
  cols?: number;
  stages?: { key: T['stage']; label: string }[];
  onStageChange?: (taskId: string, stage: T['stage']) => void;
  onCreate?: (title: string) => void;
  onEdit?: (task: T) => void;
  renderExtra?: (task: T) => ReactNode;
}) {
  const activeStages = stages ?? (STAGES as unknown as { key: T['stage']; label: string }[]);
  const firstStageKey = activeStages[0]?.key;

  const [newTitle, setNewTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<T['stage'] | null>(null);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !onCreate) return;
    onCreate(newTitle.trim());
    setNewTitle('');
  }

  function handleDragStart(e: DragEvent, taskId: string) {
    setDraggingId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent, stage: T['stage']) {
    if (!editable || !onStageChange) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) setDragOverStage(stage);
  }

  function handleDrop(e: DragEvent, stage: T['stage']) {
    if (!editable || !onStageChange) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.stage !== stage) onStageChange(taskId, stage);
  }

  return (
    <div className={`board${cols === 4 ? ' cols4' : ''}`}>
      {activeStages.map(({ key, label }) => {
        const items = tasks.filter((t) => t.stage === key);
        return (
          <div
            className={`col${dragOverStage === key ? ' col-dragover' : ''}`}
            key={String(key)}
            onDragOver={(e) => handleDragOver(e, key)}
            onDragLeave={() => setDragOverStage((s) => (s === key ? null : s))}
            onDrop={(e) => handleDrop(e, key)}
          >
            <div className="col-head">
              {label}
              <span className="n">{items.length}</span>
            </div>
            {items.length === 0 && !(editable && key === firstStageKey && onCreate) && (
              <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: '6px 4px' }}>Vazio</div>
            )}
            {items.map((t) => (
              <div
                className={`task-card${draggingId === t.id ? ' dragging' : ''}`}
                key={t.id}
                draggable={editable && Boolean(onStageChange)}
                onDragStart={(e) => handleDragStart(e, t.id)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverStage(null);
                }}
                onClick={() => onEdit?.(t)}
                style={onEdit ? { cursor: 'pointer' } : undefined}
              >
                <div className="t">{t.title}</div>
                {renderExtra?.(t)}
                <div className="task-foot">
                  <span className={`prio ${t.priority as Priority}`}>{t.priority}</span>
                  {editable && onStageChange ? (
                    <select
                      className="stage-select"
                      value={t.stage}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onStageChange(t.id, e.target.value as T['stage'])}
                    >
                      {activeStages.map((s) => (
                        <option key={String(s.key)} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="mini-avatar">{initialsFor(profilesById, t.assignee_id)}</div>
                </div>
              </div>
            ))}
            {editable && key === firstStageKey && onCreate && (
              <form onSubmit={handleCreate}>
                <input
                  placeholder="+ nova demanda…"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: '1px dashed var(--border)',
                    borderRadius: 8,
                    color: 'var(--text)',
                    padding: '8px 9px',
                    fontSize: 12,
                  }}
                />
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
