import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import {
  CAMPAIGN_TASK_STAGES,
  RAG_LEVELS,
  type CampaignTask,
  type CampaignTaskChecklistItem,
  type CampaignTaskComment,
  type Priority,
  type Product,
  type Profile,
  type Rag,
} from '../types/database';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_LABELS: Record<Priority, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };

interface Props {
  task: CampaignTask | null;
  campaignId: string;
  profiles: Profile[];
  products: Product[];
  allTasks: CampaignTask[];
  onClose: () => void;
  onSaved: () => void;
}

export default function CampaignTaskDrawer({ task, campaignId, profiles, products, allTasks, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const isEdit = Boolean(task);
  const actorId = profile?.id ?? '';

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [department, setDepartment] = useState(task?.department ?? '');
  const [productId, setProductId] = useState(task?.product_id ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [urgency, setUrgency] = useState<Rag>(task?.urgency ?? 'medium');
  const [complexity, setComplexity] = useState<Rag>(task?.complexity ?? 'medium');
  const [impact, setImpact] = useState<Rag>(task?.impact ?? 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '');
  const [reviewerId, setReviewerId] = useState(task?.reviewer_id ?? '');
  const [approverId, setApproverId] = useState(task?.approver_id ?? '');
  const [requesterId, setRequesterId] = useState(task?.requester_id ?? '');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimated_hours?.toString() ?? '');
  const [spentHours, setSpentHours] = useState(task?.spent_hours?.toString() ?? '0');
  const [startDate, setStartDate] = useState(task?.start_date ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [isMilestone, setIsMilestone] = useState(task?.is_milestone ?? false);
  const [stage, setStage] = useState(task?.stage ?? 'backlog');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [checklist, setChecklist] = useState<CampaignTaskChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [comments, setComments] = useState<(CampaignTaskComment & { author: { name: string } | null })[]>([]);
  const [newComment, setNewComment] = useState('');
  const [dependsOn, setDependsOn] = useState<string[]>([]);

  useEffect(() => {
    if (!task) return;
    supabase
      .from('campaign_task_checklist_items')
      .select('*')
      .eq('campaign_task_id', task.id)
      .order('position')
      .then(({ data }) => setChecklist((data as CampaignTaskChecklistItem[]) ?? []));
    supabase
      .from('campaign_task_comments')
      .select('*, author:profiles(name)')
      .eq('campaign_task_id', task.id)
      .order('created_at')
      .then(({ data }) => setComments((data as (CampaignTaskComment & { author: { name: string } | null })[]) ?? []));
    supabase
      .from('campaign_task_dependencies')
      .select('depends_on_id')
      .eq('task_id', task.id)
      .then(({ data }) => setDependsOn(((data as { depends_on_id: string }[]) ?? []).map((d) => d.depends_on_id)));
  }, [task]);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      title: title.trim(),
      description,
      department,
      product_id: productId || null,
      priority,
      urgency,
      complexity,
      impact,
      assignee_id: assigneeId || null,
      reviewer_id: reviewerId || null,
      approver_id: approverId || null,
      requester_id: requesterId || null,
      estimated_hours: estimatedHours ? Number(estimatedHours) : null,
      spent_hours: Number(spentHours) || 0,
      start_date: startDate || null,
      due_date: dueDate || null,
      is_milestone: isMilestone,
      stage,
    };
    if (isEdit && task) {
      await supabase.from('campaign_tasks').update(fields).eq('id', task.id);
      await logActivity({ actorId, actionText: 'Demanda atualizada', detail: title, campaignId, campaignTaskId: task.id });
    } else {
      const { data, error } = await supabase.from('campaign_tasks').insert({ ...fields, created_by: actorId }).select().single();
      if (!error && data) {
        await logActivity({ actorId, actionText: 'Demanda criada', detail: title, campaignId, campaignTaskId: data.id });
      }
    }
    onSaved();
  }

  async function handleDelete() {
    if (!task) return;
    await supabase.from('campaign_tasks').delete().eq('id', task.id);
    await logActivity({ actorId, actionText: 'Demanda removida', detail: task.title, campaignId });
    onSaved();
  }

  async function addChecklistItem(e: FormEvent) {
    e.preventDefault();
    if (!task || !newChecklistLabel.trim()) return;
    await supabase
      .from('campaign_task_checklist_items')
      .insert({ campaign_task_id: task.id, label: newChecklistLabel.trim(), position: checklist.length });
    setNewChecklistLabel('');
    const { data } = await supabase.from('campaign_task_checklist_items').select('*').eq('campaign_task_id', task.id).order('position');
    setChecklist((data as CampaignTaskChecklistItem[]) ?? []);
  }

  async function toggleChecklistItem(item: CampaignTaskChecklistItem) {
    await supabase.from('campaign_task_checklist_items').update({ done: !item.done }).eq('id', item.id);
    setChecklist((c) => c.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
  }

  async function deleteChecklistItem(id: string) {
    await supabase.from('campaign_task_checklist_items').delete().eq('id', id);
    setChecklist((c) => c.filter((i) => i.id !== id));
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!task || !newComment.trim() || !profile) return;
    await supabase.from('campaign_task_comments').insert({ campaign_task_id: task.id, author_id: profile.id, body: newComment.trim() });
    setNewComment('');
    const { data } = await supabase
      .from('campaign_task_comments')
      .select('*, author:profiles(name)')
      .eq('campaign_task_id', task.id)
      .order('created_at');
    setComments((data as (CampaignTaskComment & { author: { name: string } | null })[]) ?? []);
  }

  async function toggleDependency(depId: string) {
    if (!task) return;
    if (dependsOn.includes(depId)) {
      await supabase.from('campaign_task_dependencies').delete().eq('task_id', task.id).eq('depends_on_id', depId);
      setDependsOn((d) => d.filter((x) => x !== depId));
    } else {
      await supabase.from('campaign_task_dependencies').insert({ task_id: task.id, depends_on_id: depId });
      setDependsOn((d) => [...d, depId]);
    }
  }

  const otherTasks = allTasks.filter((t) => t.id !== task?.id);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={stop}>
        <h3>{isEdit ? 'Editar demanda' : 'Nova demanda'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="td-title">Título</label>
            <input id="td-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="td-desc">Descrição</label>
            <textarea id="td-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-dept">Departamento</label>
              <input id="td-dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-product">Produto</label>
              <select id="td-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Sem produto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '14px 0 6px 0' }}>
            Prioridade & impacto
          </h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-priority">Prioridade</label>
              <select id="td-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-urgency">Urgência</label>
              <select id="td-urgency" value={urgency} onChange={(e) => setUrgency(e.target.value as Rag)}>
                {RAG_LEVELS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-complexity">Complexidade</label>
              <select id="td-complexity" value={complexity} onChange={(e) => setComplexity(e.target.value as Rag)}>
                {RAG_LEVELS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-impact">Impacto</label>
              <select id="td-impact" value={impact} onChange={(e) => setImpact(e.target.value as Rag)}>
                {RAG_LEVELS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '14px 0 6px 0' }}>
            Matriz RACI
          </h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="form-field" style={{ flex: '1 1 45%' }}>
              <label htmlFor="td-assignee">Responsável (R)</label>
              <select id="td-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: '1 1 45%' }}>
              <label htmlFor="td-approver">Aprovador (A)</label>
              <select id="td-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: '1 1 45%' }}>
              <label htmlFor="td-reviewer">Consultado (C)</label>
              <select id="td-reviewer" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: '1 1 45%' }}>
              <label htmlFor="td-requester">Informado (I)</label>
              <select id="td-requester" value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '14px 0 6px 0' }}>
            Prazo & horas
          </h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-start">Início</label>
              <input id="td-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-due">Prazo</label>
              <input id="td-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-est">Horas previstas</label>
              <input id="td-est" type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="td-spent">Horas gastas</label>
              <input id="td-spent" type="number" value={spentHours} onChange={(e) => setSpentHours(e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label>
              <input type="checkbox" checked={isMilestone} onChange={(e) => setIsMilestone(e.target.checked)} /> É um marco
              (aparece na linha do tempo do Resumo)
            </label>
          </div>
          <div className="form-field">
            <label htmlFor="td-stage">Estágio</label>
            <select id="td-stage" value={stage} onChange={(e) => setStage(e.target.value as CampaignTask['stage'])}>
              {CAMPAIGN_TASK_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {confirmingDelete ? (
            <div className="banner error">
              <span>Excluir esta demanda?</span>
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
                {isEdit ? 'Salvar' : 'Criar demanda'}
              </button>
            </div>
          )}
        </form>

        {isEdit && task && (
          <>
            <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 6px 0' }}>
              Dependências
            </h4>
            <div className="panel">
              {otherTasks.length === 0 ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhuma outra demanda nesta campanha.</p>
              ) : (
                otherTasks.map((t) => (
                  <label key={t.id} className="field-row" style={{ cursor: 'pointer' }}>
                    <span>{t.title}</span>
                    <input type="checkbox" checked={dependsOn.includes(t.id)} onChange={() => toggleDependency(t.id)} />
                  </label>
                ))
              )}
            </div>

            <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 6px 0' }}>
              Checklist
            </h4>
            <div className="panel">
              {checklist.map((item) => (
                <div className="field-row" key={item.id}>
                  <span onClick={() => toggleChecklistItem(item)} style={{ cursor: 'pointer', textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.done ? '✅' : '◻︎'} {item.label}
                  </span>
                  <button className="btn ghost sm" onClick={() => deleteChecklistItem(item.id)}>
                    ✕
                  </button>
                </div>
              ))}
              <form onSubmit={addChecklistItem} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input placeholder="+ item…" value={newChecklistLabel} onChange={(e) => setNewChecklistLabel(e.target.value)} style={{ flex: 1 }} />
                <button className="btn sm" type="submit">
                  Adicionar
                </button>
              </form>
            </div>

            <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 6px 0' }}>
              Comentários
            </h4>
            <div className="panel">
              {comments.map((c) => (
                <div className="comment" key={c.id}>
                  <div className="comment-head">
                    <span className="name">{c.author?.name ?? 'Alguém'}</span>
                    <span className="time">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="body">{c.body}</div>
                </div>
              ))}
              <form onSubmit={addComment} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input placeholder="Escrever um comentário…" value={newComment} onChange={(e) => setNewComment(e.target.value)} style={{ flex: 1 }} />
                <button className="btn sm" type="submit">
                  Enviar
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
