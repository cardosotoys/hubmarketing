import { useEffect, useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import { supabase } from '../lib/supabaseClient';
import { normalizeUrl } from '../lib/url';
import { PRIORITIES, PRIORITY_LABELS, type Priority, type Product, type ProjectFile, type ProjectStage, type Profile, type Task, type TaskComment } from '../types/database';

function computeOverdue(dueDate: string) {
  return new Date(dueDate + 'T00:00') < new Date(new Date().toDateString());
}

export default function TaskEditModal({
  task,
  profiles,
  products,
  stages,
  actorId,
  focusComments,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  profiles: Profile[];
  products?: Product[];
  stages: ProjectStage[];
  actorId: string;
  focusComments?: boolean;
  onClose: () => void;
  onSave: (fields: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const commentsRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [stageId, setStageId] = useState(task.stage_id);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '');
  const [productId, setProductId] = useState(task.product_id ?? '');
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [delayReason, setDelayReason] = useState(task.delay_reason ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [budget, setBudget] = useState(task.budget?.toString() ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const [comments, setComments] = useState<(TaskComment & { author: { name: string } | null })[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('project_files')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at')
      .then(({ data }) => setFiles((data as ProjectFile[]) ?? []));
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  async function loadComments() {
    const { data } = await supabase
      .from('task_comments')
      .select('*, author:profiles(name)')
      .eq('task_id', task.id)
      .order('created_at');
    setComments((data as (TaskComment & { author: { name: string } | null })[]) ?? []);
  }

  useEffect(() => {
    if (!focusComments) return;
    const timer = setTimeout(() => {
      commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(timer);
  }, [focusComments]);

  function toggleMention(id: string) {
    setMentionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    const mentionTags = mentionIds.map((id) => `@${profiles.find((p) => p.id === id)?.name ?? ''}`).join(' ');
    const body = mentionTags ? `${mentionTags} ${commentBody.trim()}` : commentBody.trim();
    await supabase.from('task_comments').insert({
      task_id: task.id,
      author_id: actorId,
      body,
      mentioned_ids: mentionIds,
    });
    setCommentBody('');
    setMentionIds([]);
    loadComments();
  }

  const selectedStage = sortedStages.find((s) => s.id === stageId);
  const overdue = dueDate && selectedStage && !selectedStage.is_final ? computeOverdue(dueDate) : false;
  const updatedByName = profiles.find((p) => p.id === task.updated_by)?.name;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (selectedStage?.is_final && !assigneeId) {
      setFormError('Esta etapa é final — atribua um responsável antes de mover a demanda pra cá.');
      return;
    }
    setFormError(null);
    onSave({
      title: title.trim(),
      priority,
      stage_id: stageId,
      assignee_id: assigneeId || null,
      product_id: productId || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      delay_reason: delayReason,
      notes,
      budget: budget ? Number(budget) : null,
    });
  }

  async function addFile(e: FormEvent) {
    e.preventDefault();
    if (!fileName.trim() || !fileUrl.trim()) return;
    await supabase.from('project_files').insert({
      task_id: task.id,
      project_id: task.project_id,
      name: fileName.trim(),
      url: normalizeUrl(fileUrl),
      added_by: actorId,
    });
    setFileName('');
    setFileUrl('');
    const { data } = await supabase.from('project_files').select('*').eq('task_id', task.id).order('created_at');
    setFiles((data as ProjectFile[]) ?? []);
  }

  async function deleteFile(id: string) {
    await supabase.from('project_files').delete().eq('id', id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <Modal title="Editar demanda" onClose={onClose}>
      {(task.updated_by || task.created_at) && (
        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-6px 0 12px 0' }}>
          Última atualização: {updatedByName ?? 'ninguém ainda'} · {new Date(task.updated_at).toLocaleString('pt-BR')}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="te-title">Título</label>
          <input id="te-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="te-notes">Notas</label>
          <textarea id="te-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-stage">Estágio</label>
            <select id="te-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
              {sortedStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-budget">Orçamento</label>
            <input id="te-budget" type="number" placeholder="R$" value={budget} onChange={(e) => setBudget(e.target.value)} />
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
        {products && products.length > 0 && (
          <div className="form-field">
            <label htmlFor="te-product">Produto (embalagem)</label>
            <select id="te-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Sem produto vinculado</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
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

        {formError && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{formError}</span>
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

      <div className="panel" style={{ marginTop: 14 }}>
        <h4>Arquivos</h4>
        {files.map((f) => (
          <div className="field-row" key={f.id}>
            <a href={f.url} target="_blank" rel="noreferrer">
              {f.name}
            </a>
            <button className="btn ghost sm" onClick={() => deleteFile(f.id)}>
              ✕
            </button>
          </div>
        ))}
        {files.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhum arquivo anexado ainda.</p>}
        <form onSubmit={addFile} className="responsive-row" style={{ marginTop: 8 }}>
          <input placeholder="Nome" value={fileName} onChange={(e) => setFileName(e.target.value)} style={{ flex: 1 }} />
          <input placeholder="Link (Drive, etc.)" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} style={{ flex: 2 }} />
          <button className="btn sm" type="submit">
            Anexar
          </button>
        </form>
      </div>

      <div className="panel" ref={commentsRef} style={focusComments ? { border: '1px solid var(--accent)' } : undefined}>
        <h4>Comentários</h4>
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <div className="comment-head">
              <span className="name">{c.author?.name ?? 'Alguém'}</span>
              <span className="time">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <div className="body">{c.body}</div>
          </div>
        ))}
        {comments.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhum comentário ainda.</p>}

        <form onSubmit={addComment} style={{ marginTop: 8 }}>
          <div className="form-field">
            <label>Marcar pessoas</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {profiles.map((p) => (
                <span
                  key={p.id}
                  className="pill"
                  onClick={() => toggleMention(p.id)}
                  style={{
                    cursor: 'pointer',
                    background: mentionIds.includes(p.id) ? 'var(--accent-dim)' : 'var(--surface-2)',
                    color: mentionIds.includes(p.id) ? 'var(--accent)' : 'var(--text-faint)',
                    border: mentionIds.includes(p.id) ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  @{p.name}
                </span>
              ))}
            </div>
          </div>
          <div className="responsive-row">
            <input
              placeholder="Escrever um comentário… marque alguém acima pra chamar atenção"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn sm" type="submit">
              Comentar
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
