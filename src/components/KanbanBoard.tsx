import { useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Priority, Profile } from '../types/database';

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
  due_date?: string | null;
}

function isOverdue(t: KanbanItem, terminalStages?: string[]) {
  if (!terminalStages || !t.due_date || terminalStages.includes(t.stage)) return false;
  return new Date(t.due_date + 'T00:00') < new Date(new Date().toDateString());
}

export default function KanbanBoard<T extends KanbanItem>({
  tasks,
  profilesById,
  editable,
  cols = 6,
  stages,
  terminalStages,
  onStageChange,
  onCreate,
  onEdit,
  renderExtra,
}: {
  tasks: T[];
  profilesById: Record<string, Profile>;
  editable: boolean;
  cols?: number;
  stages: { key: T['stage']; label: string }[];
  terminalStages?: string[];
  onStageChange?: (taskId: string, stage: T['stage']) => void;
  onCreate?: (title: string) => void;
  onEdit?: (task: T) => void;
  renderExtra?: (task: T) => ReactNode;
}) {
  const activeStages = stages;
  const firstStageKey = activeStages[0]?.key;
  const isMobile = useIsMobile();

  const [newTitle, setNewTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<T['stage'] | null>(null);
  // Colunas viram um acordeão no celular (uma seção por estágio, uma aberta por vez) — sem
  // drag-and-drop nesse modo, a troca de estágio é sempre pelo <select> que já existe em cada
  // cartão. Começa com o primeiro estágio aberto.
  const [openStage, setOpenStage] = useState<T['stage'] | null>(firstStageKey ?? null);

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

  function renderCard(t: T, draggable: boolean) {
    return (
      <div
        className={`task-card${draggingId === t.id ? ' dragging' : ''}`}
        key={t.id}
        draggable={draggable}
        onDragStart={(e) => handleDragStart(e, t.id)}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverStage(null);
        }}
        onClick={() => onEdit?.(t)}
        style={onEdit ? { cursor: 'pointer' } : undefined}
      >
        <div className="t">{t.title}</div>
        {isOverdue(t, terminalStages) && (
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 6 }}>🔴 atrasada</div>
        )}
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
    );
  }

  function renderNewTaskInput() {
    return (
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
    );
  }

  if (isMobile) {
    return (
      <div className="board-mobile">
        {activeStages.map(({ key, label }) => {
          const items = tasks.filter((t) => t.stage === key);
          const open = openStage === key;
          return (
            <div className="mobile-kanban-section" key={String(key)}>
              <button
                type="button"
                className="mobile-kanban-head"
                onClick={() => setOpenStage((s) => (s === key ? null : key))}
              >
                <span className="chev">{open ? '▾' : '▸'}</span>
                <span className="label">{label}</span>
                <span className="n">{items.length}</span>
              </button>
              {open && (
                <div className="mobile-kanban-list">
                  {items.length === 0 && !(editable && key === firstStageKey && onCreate) && (
                    <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: '6px 4px' }}>Vazio</div>
                  )}
                  {items.map((t) => renderCard(t, false))}
                  {editable && key === firstStageKey && onCreate && renderNewTaskInput()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
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
            {items.map((t) => renderCard(t, editable && Boolean(onStageChange)))}
            {editable && key === firstStageKey && onCreate && renderNewTaskInput()}
          </div>
        );
      })}
    </div>
  );
}
