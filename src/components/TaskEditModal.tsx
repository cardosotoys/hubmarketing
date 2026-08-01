import { useEffect, useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import ProductCombobox from './ProductCombobox';
import { supabase } from '../lib/supabaseClient';
import { normalizeUrl } from '../lib/url';
import { materializeSubsteps, recomputeSubstepDueDates } from '../lib/substeps';
import {
  APPROVAL_STATE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  type ApprovalState,
  type Priority,
  type Product,
  type ProjectFile,
  type ProjectStage,
  type Profile,
  type Task,
  type TaskChecklistItem,
  type TaskComment,
} from '../types/database';

function computeOverdue(dueDate: string) {
  return new Date(dueDate + 'T00:00') < new Date(new Date().toDateString());
}

const APPROVAL_COLOR: Record<ApprovalState, string> = {
  none: 'var(--text-faint)',
  aguardando: 'var(--yellow)',
  aprovado: 'var(--green)',
  correcao: 'var(--red)',
};

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
  const [targetDate, setTargetDate] = useState(task.target_date ?? '');
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

  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newChecklistGate, setNewChecklistGate] = useState(false);

  const [comments, setComments] = useState<(TaskComment & { author: { name: string } | null })[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);

  // Fluxo de aprovação (approvalState é derivado da task; muda ao salvar/recarregar)
  const approvalState: ApprovalState = task.approval_state ?? 'none';
  const [approverId, setApproverId] = useState(task.approval_requested_to ?? '');
  const [approvalNote, setApprovalNote] = useState(task.approval_note ?? '');

  useEffect(() => {
    supabase
      .from('project_files')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at')
      .then(({ data }) => setFiles((data as ProjectFile[]) ?? []));
    loadComments();
    loadChecklist();
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

  async function loadChecklist() {
    // materializa as sub-etapas da etapa atual (template → itens do checklist desta demanda)
    await materializeSubsteps(task.id, task.stage_id);
    const { data } = await supabase.from('task_checklist_items').select('*').eq('task_id', task.id).order('position');
    setChecklist((data as TaskChecklistItem[]) ?? []);
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
  const currentStage = sortedStages.find((s) => s.id === task.stage_id);
  const overdue = dueDate && selectedStage && !selectedStage.is_final ? computeOverdue(dueDate) : false;
  const updatedByName = profiles.find((p) => p.id === task.updated_by)?.name;
  const pendingGates = checklist.filter((c) => c.is_gate && !c.done);
  const currentStageItems = checklist.filter((c) => c.stage_id === task.stage_id);
  const otherItems = checklist.filter((c) => c.stage_id !== task.stage_id);

  function renderChecklistRow(c: TaskChecklistItem) {
    const overdueItem = c.due_date && !c.done && new Date(c.due_date + 'T00:00') < new Date(new Date().toDateString());
    return (
      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
        <input type="checkbox" checked={c.done} onChange={() => toggleChecklistItem(c)} style={{ width: 'auto' }} />
        <span style={{ flex: 1, textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text-faint)' : 'var(--text)' }}>
          {c.label}
        </span>
        {c.due_date && (
          <span style={{ fontSize: 11, color: overdueItem ? 'var(--red)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            {overdueItem ? '🔴 ' : '📅 '}
            {new Date(c.due_date + 'T00:00').toLocaleDateString('pt-BR')}
          </span>
        )}
        <button
          type="button"
          className="btn ghost sm"
          title={c.is_gate ? 'Condicional (trava o avanço) — clique para tornar opcional' : 'Tornar condicional (trava o avanço)'}
          onClick={() => toggleChecklistGate(c)}
          style={{ color: c.is_gate ? 'var(--yellow)' : 'var(--text-faint)' }}
        >
          {c.is_gate ? '🔒' : '🔓'}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => deleteChecklistItem(c.id)}>
          ✕
        </button>
      </div>
    );
  }

  // Bloqueia avanço para uma etapa posterior enquanto houver item-gate pendente (limitador)
  function blocksAdvanceTo(targetStageId: string): boolean {
    const target = sortedStages.find((s) => s.id === targetStageId);
    if (!target || !currentStage) return false;
    const advancing = target.position > currentStage.position;
    return advancing && pendingGates.length > 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (selectedStage?.is_final && !assigneeId) {
      setFormError('Esta etapa é final — atribua um responsável antes de mover a demanda pra cá.');
      return;
    }
    if (blocksAdvanceTo(stageId)) {
      setFormError(
        `Há ${pendingGates.length} item(ns) obrigatório(s) do checklist pendente(s) — conclua-os antes de avançar de etapa.`,
      );
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
      target_date: targetDate || null,
      due_date: dueDate || null,
      delay_reason: delayReason,
      notes,
      budget: budget ? Number(budget) : null,
    });
  }

  // ---- Checklist ----
  async function addChecklistItem(e: FormEvent) {
    e.preventDefault();
    if (!newChecklistLabel.trim()) return;
    await supabase.from('task_checklist_items').insert({
      task_id: task.id,
      label: newChecklistLabel.trim(),
      is_gate: newChecklistGate,
      position: checklist.length,
    });
    setNewChecklistLabel('');
    setNewChecklistGate(false);
    loadChecklist();
  }

  async function toggleChecklistItem(item: TaskChecklistItem) {
    const done = !item.done;
    await supabase
      .from('task_checklist_items')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', item.id);
    // sub-etapa: recalcula os prazos encadeados (a próxima conta a partir deste check)
    if (item.substep_id && item.stage_id) {
      await recomputeSubstepDueDates(item.task_id, item.stage_id);
    }
    loadChecklist();
  }

  async function toggleChecklistGate(item: TaskChecklistItem) {
    await supabase.from('task_checklist_items').update({ is_gate: !item.is_gate }).eq('id', item.id);
    loadChecklist();
  }

  async function deleteChecklistItem(id: string) {
    await supabase.from('task_checklist_items').delete().eq('id', id);
    loadChecklist();
  }

  // ---- Aprovação por menção ----
  const actorRole = profiles.find((p) => p.id === actorId)?.role;
  const canApprove = actorId === task.approval_requested_to || actorRole === 'diretoria' || actorRole === 'administrador';

  async function requestApproval() {
    if (!approverId) {
      setFormError('Escolha quem vai aprovar.');
      return;
    }
    setFormError(null);
    // avisa a pessoa via comentário com menção (dispara a notificação que já existe)
    const approverName = profiles.find((p) => p.id === approverId)?.name ?? '';
    await supabase.from('task_comments').insert({
      task_id: task.id,
      author_id: actorId,
      body: `@${approverName} pedido de aprovação${approvalNote.trim() ? `: ${approvalNote.trim()}` : ''}`,
      mentioned_ids: [approverId],
    });
    onSave({ approval_state: 'aguardando', approval_requested_to: approverId, approval_note: approvalNote });
  }

  function requestCorrection() {
    onSave({ approval_state: 'correcao' });
  }

  // Aprovar = "seguir o fluxo": avança para a próxima etapa (se houver) e zera a aprovação
  function approveAndAdvance() {
    const idx = sortedStages.findIndex((s) => s.id === task.stage_id);
    const next = sortedStages[idx + 1];
    if (next && blocksAdvanceTo(next.id)) {
      setFormError(
        `Há ${pendingGates.length} item(ns) obrigatório(s) do checklist pendente(s) — conclua-os antes de aprovar e avançar.`,
      );
      return;
    }
    setFormError(null);
    onSave({
      approval_state: 'none',
      approval_requested_to: null,
      stage_id: next ? next.id : task.stage_id,
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
    <Modal title="Editar demanda" onClose={onClose} wide>
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
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
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
            <div className="form-field" style={{ flex: 1 }}>
              <label>Produto (embalagem)</label>
              <ProductCombobox products={products} value={productId} onChange={setProductId} />
            </div>
          )}
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-start">Início (start)</label>
            <input id="te-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-target">🎯 Meta</label>
            <input id="te-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="te-due">Prazo final</label>
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

      {/* Fluxo de aprovação */}
      <div className="panel" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Aprovação</h4>
          <span className="tag" style={{ background: 'var(--surface-2)', color: APPROVAL_COLOR[approvalState] }}>
            {APPROVAL_STATE_LABELS[approvalState]}
          </span>
        </div>

        {approvalState === 'aguardando' ? (
          <div style={{ marginTop: 8 }}>
            <div className="field-row">
              <span className="k">Aprovador</span>
              <span>{profiles.find((p) => p.id === task.approval_requested_to)?.name ?? '—'}</span>
            </div>
            {task.approval_note && (
              <div className="field-row">
                <span className="k">Observação</span>
                <span>{task.approval_note}</span>
              </div>
            )}
            {canApprove ? (
              <div className="responsive-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn sm" style={{ background: 'var(--green)' }} onClick={approveAndAdvance}>
                  ✓ Aprovar e seguir o fluxo
                </button>
                <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={requestCorrection}>
                  Solicitar correção
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
                Só o aprovador designado (ou a Diretoria) pode aprovar.
              </p>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div className="responsive-row">
              <div className="form-field" style={{ flex: 1 }}>
                <label htmlFor="te-approver">Pedir aprovação a</label>
                <select id="te-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
                  <option value="">— escolher pessoa —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field" style={{ flex: 2 }}>
                <label htmlFor="te-approval-note">Observação (opcional)</label>
                <input id="te-approval-note" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} />
              </div>
            </div>
            <button type="button" className="btn sm" onClick={requestApproval}>
              Solicitar aprovação
            </button>
          </div>
        )}
      </div>

      {/* Sub-etapas da etapa atual + checklist livre (item-gate = limitador de avanço) */}
      <div className="panel">
        <h4>Sub-etapas &amp; checklist</h4>
        {pendingGates.length > 0 && (
          <div className="banner" style={{ borderColor: 'var(--yellow)', marginBottom: 8 }}>
            <span className="ic">🔒</span>
            <span>
              {pendingGates.length} item(ns) condicional(is) pendente(s) — a demanda não avança de etapa até concluí-los.
            </span>
          </div>
        )}

        {currentStageItems.length > 0 && (
          <>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-faint)', margin: '2px 0 4px' }}>
              Sub-etapas — {currentStage?.name ?? 'etapa atual'}
            </div>
            {currentStageItems.map(renderChecklistRow)}
          </>
        )}

        {otherItems.length > 0 && (
          <>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-faint)', margin: '10px 0 4px' }}>
              Checklist livre
            </div>
            {otherItems.map(renderChecklistRow)}
          </>
        )}

        {checklist.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhum item ainda.</p>}
        <form onSubmit={addChecklistItem} className="responsive-row" style={{ marginTop: 8, alignItems: 'center' }}>
          <input placeholder="Novo item do checklist" value={newChecklistLabel} onChange={(e) => setNewChecklistLabel(e.target.value)} style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={newChecklistGate} onChange={(e) => setNewChecklistGate(e.target.checked)} style={{ width: 'auto' }} />
            🔒 condicional
          </label>
          <button className="btn sm" type="submit">
            Adicionar
          </button>
        </form>
      </div>

      <div className="panel">
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

