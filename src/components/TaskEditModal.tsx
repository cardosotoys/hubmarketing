import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import ProductCombobox from './ProductCombobox';
import RichText from './RichText';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import { normalizeUrl } from '../lib/url';
import { materializeSubsteps, recomputeSubstepDueDates } from '../lib/substeps';
import { fetchReactions, toggleReaction, type ReactionMap } from '../lib/reactions';
import { ensureThumb, useThumbs } from '../lib/thumbs';
import {
  APPROVAL_STATE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  type ApprovalState,
  type ApprovalDecision,
  type TaskApproval,
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
  onSpawnDemandas,
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
  // opcional: transforma os itens do "checklist livre" em demandas individuais (usado no módulo Marcas)
  onSpawnDemandas?: (labels: string[]) => void | Promise<void>;
}) {
  const thumb = useThumbs();
  const commentsRef = useRef<HTMLElement>(null);
  // tela cheia: trava a rolagem da página de trás e fecha no Esc
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [stageId, setStageId] = useState(task.stage_id);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '');
  const [productId, setProductId] = useState(task.product_id ?? '');
  const [mockupUrl, setMockupUrl] = useState('');
  const [mockupBusy, setMockupBusy] = useState(false);
  const [mockupMsg, setMockupMsg] = useState<string | null>(null);
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
  const [signedFiles, setSignedFiles] = useState<Record<string, string>>({}); // fileId -> URL assinada (bucket privado)
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileBusy, setFileBusy] = useState(false); // upload de anexo em andamento
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newChecklistGate, setNewChecklistGate] = useState(false);

  const [comments, setComments] = useState<(TaskComment & { author: { name: string } | null })[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>(new Map());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([]); // arquivos referenciados no comentário
  const [replyTo, setReplyTo] = useState<{ id: string; author: string; preview: string } | null>(null); // respondendo a um comentário

  // Fluxo de aprovação — múltiplos decisores (task_approvals)
  const [approvals, setApprovals] = useState<(TaskApproval & { approver: { name: string } | null })[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    supabase
      .from('project_files')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at')
      .then(({ data }) => {
        const rows = (data as ProjectFile[]) ?? [];
        setFiles(rows);
        signTaskFiles(rows);
      });
    loadComments();
    loadChecklist();
    loadApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  async function loadApprovals() {
    const { data } = await supabase
      .from('task_approvals')
      .select('*, approver:profiles!task_approvals_approver_id_fkey(name)')
      .eq('task_id', task.id)
      .order('created_at');
    setApprovals((data as (TaskApproval & { approver: { name: string } | null })[]) ?? []);
  }

  async function loadComments() {
    const { data } = await supabase
      .from('task_comments')
      .select('*, author:profiles(name)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false }); // mais recentes primeiro
    const list = (data as (TaskComment & { author: { name: string } | null })[]) ?? [];
    setComments(list);
    setReactions(await fetchReactions('task', list.map((c) => c.id), actorId));
  }

  async function likeComment(cid: string) {
    const cur = reactions.get(cid) ?? { count: 0, mine: false };
    setReactions((prev) => {
      const m = new Map(prev);
      m.set(cid, { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine });
      return m;
    });
    await toggleReaction('task', cid, actorId, cur.mine);
  }

  async function saveCommentEdit(cid: string) {
    const body = editingText.trim();
    if (!body) return;
    await supabase.from('task_comments').update({ body, edited_at: new Date().toISOString() }).eq('id', cid);
    setEditingCommentId(null);
    setEditingText('');
    await loadComments();
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
  function toggleFileRef(id: string) {
    setAttachedFileIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Bucket task-files é privado: gera URLs assinadas temporárias para os anexos (fileId -> url).
  // Só assina o que está no bucket (extrai o path da URL); links externos (Drive) ficam como estão.
  async function signTaskFiles(fileRows: ProjectFile[]) {
    const entries = fileRows
      .map((f) => ({ id: f.id, path: f.url.match(/\/task-files\/(.+)$/)?.[1] }))
      .filter((e): e is { id: string; path: string } => !!e.path);
    if (!entries.length) {
      setSignedFiles({});
      return;
    }
    const { data } = await supabase.storage.from('task-files').createSignedUrls(
      entries.map((e) => e.path),
      3600,
    );
    const map: Record<string, string> = {};
    ((data as { signedUrl: string | null }[] | null) ?? []).forEach((s, i) => {
      if (s?.signedUrl) map[entries[i].id] = s.signedUrl;
    });
    setSignedFiles(map);
  }
  const fileHref = (f: ProjectFile) => signedFiles[f.id] ?? f.url;

  // Registra a movimentação na Auditoria (admin vê tudo do time). project_id pode ser null
  // (demandas de marca/embalagem), então amarramos também pelo task_id.
  function logTask(actionText: string) {
    logActivity({ actorId, actionText, detail: task.title, projectId: task.project_id ?? undefined, taskId: task.id });
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() && attachedFileIds.length === 0) return;
    const mentionTags = mentionIds.map((id) => `@${profiles.find((p) => p.id === id)?.name ?? ''}`).join(' ');
    // referências a arquivos: só o nome (o link fica no bloco "Arquivos" com URL assinada; não
    // embutimos URL crua no comentário porque o bucket é privado e o link expira).
    const fileRefs = attachedFileIds
      .map((id) => files.find((f) => f.id === id))
      .filter((f): f is ProjectFile => Boolean(f))
      .map((f) => {
        const idx = files.findIndex((x) => x.id === f.id);
        return `📎 arquivo ${idx + 1} — ${f.name} (ver em Arquivos)`;
      })
      .join('\n');
    let body = commentBody.trim();
    if (mentionTags) body = `${mentionTags} ${body}`.trim();
    if (fileRefs) body = body ? `${body}\n${fileRefs}` : fileRefs;
    await supabase.from('task_comments').insert({
      task_id: task.id,
      author_id: actorId,
      body,
      mentioned_ids: mentionIds,
      parent_id: replyTo?.id ?? null,
    });
    setCommentBody('');
    setMentionIds([]);
    setAttachedFileIds([]);
    setReplyTo(null);
    logTask(replyTo ? 'Respondeu um comentário' : 'Comentou na demanda');
    loadComments();
  }

  // pickers só mostram gente ativa (desativados somem das escolhas, mas seguem aparecendo em
  // registros antigos pelo nome)
  const activeProfiles = profiles.filter((p) => !p.disabled);
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
      <div key={c.id} className={`td-ck ${c.done ? 'done' : ''}`}>
        <button type="button" className="td-ck-box" role="checkbox" aria-checked={c.done} onClick={() => toggleChecklistItem(c)} aria-label={c.done ? 'Desmarcar' : 'Marcar como feito'} />
        <span className="td-ck-l">{c.label}</span>
        {c.due_date && <span className={`td-ck-d ${overdueItem ? 'late' : ''}`}>{new Date(c.due_date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
        <button type="button" className={`td-ck-gate ${c.is_gate ? 'on' : ''}`} onClick={() => toggleChecklistGate(c)}
          title={c.is_gate ? 'Trava o avanço de etapa. Clique para tornar opcional' : 'Opcional. Clique para travar o avanço de etapa até concluir'}>
          {c.is_gate ? 'Trava' : 'Opcional'}
        </button>
        <button type="button" className="td-ck-x" aria-label="Tirar item" onClick={() => deleteChecklistItem(c.id)}>×</button>
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

  // ---- Aprovação por menção — múltiplos decisores ----
  const actorRole = profiles.find((p) => p.id === actorId)?.role;
  const isPrivileged = actorRole === 'diretoria' || actorRole === 'administrador';
  const approvedCount = approvals.filter((a) => a.decision === 'aprovado').length;
  const anyCorrection = approvals.some((a) => a.decision === 'correcao');
  const allApproved = approvals.length > 0 && approvedCount === approvals.length;
  const apprState: ApprovalState = approvals.length === 0 ? 'none' : anyCorrection ? 'correcao' : allApproved ? 'aprovado' : 'aguardando';
  function canDecide(a: TaskApproval) {
    return actorId === a.approver_id || isPrivileged;
  }

  // Embalagem "aprovada": pela aprovação por menção OU pela etapa (ex.: "Aprovado para Impressão")
  const embalagemAprovada = apprState === 'aprovado' || /aprovad/i.test(selectedStage?.name ?? '');
  // UI específica de embalagem (SKU/mockup) não vale pra demandas de marca (packaging_track = 'marca')
  const isPackagingDemand = !!task.packaging_track && task.packaging_track !== 'marca';

  // Sobe o mockup da embalagem aprovada e grava direto no produto vinculado (SKU) — a lista de
  // Produtos (e o pop-up/preview) passam a mostrar automaticamente, pois é o mesmo registro.
  async function uploadMockup(file: File) {
    const sel = products?.find((p) => p.id === productId);
    if (!sel) return;
    setMockupBusy(true);
    setMockupMsg(null);
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${sel.code.replace(/[^a-zA-Z0-9.\-_]/g, '_')}/packaging-mockup-${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (upErr) {
      setMockupMsg(upErr.message);
      setMockupBusy(false);
      return;
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    ensureThumb(data.publicUrl, file).catch(() => {});
    const { error: dbErr } = await supabase.from('products').update({ packaging_image_url: data.publicUrl }).eq('id', sel.id);
    if (dbErr) {
      setMockupMsg(dbErr.message);
      setMockupBusy(false);
      return;
    }
    setMockupUrl(data.publicUrl);
    setMockupMsg('Mockup salvo no produto ✓');
    setMockupBusy(false);
  }

  async function setAggregate(list: { decision: ApprovalDecision }[]) {
    const st: ApprovalState = list.length === 0 ? 'none' : list.some((a) => a.decision === 'correcao') ? 'correcao' : list.every((a) => a.decision === 'aprovado') ? 'aprovado' : 'aguardando';
    await supabase.from('tasks').update({ approval_state: st }).eq('id', task.id);
  }

  function toggleApprover(id: string) {
    setSelectedApprovers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function requestApproval() {
    if (!selectedApprovers.length) {
      setFormError('Escolha ao menos um aprovador.');
      return;
    }
    setFormError(null);
    await supabase.from('task_approvals').upsert(
      selectedApprovers.map((id) => ({ task_id: task.id, approver_id: id, decision: 'pendente', note: approvalNote })),
      { onConflict: 'task_id,approver_id' },
    );
    // avisa cada aprovador via menção (dispara a notificação que já existe)
    for (const id of selectedApprovers) {
      const name = profiles.find((p) => p.id === id)?.name ?? '';
      await supabase.from('task_comments').insert({
        task_id: task.id,
        author_id: actorId,
        body: `@${name} pedido de aprovação${approvalNote.trim() ? `: ${approvalNote.trim()}` : ''}`,
        mentioned_ids: [id],
      });
    }
    await supabase.from('tasks').update({ approval_state: 'aguardando' }).eq('id', task.id);
    const approverNames = selectedApprovers.map((id) => profiles.find((p) => p.id === id)?.name ?? '').filter(Boolean).join(', ');
    setSelectedApprovers([]);
    setApprovalNote('');
    logActivity({ actorId, actionText: 'Pediu aprovação na demanda', detail: `${task.title}${approverNames ? ` → ${approverNames}` : ''}`, projectId: task.project_id ?? undefined, taskId: task.id });
    loadApprovals();
    loadComments();
  }

  async function decide(a: TaskApproval, decision: ApprovalDecision) {
    await supabase.from('task_approvals').update({ decision, decided_at: new Date().toISOString() }).eq('id', a.id);
    await setAggregate(approvals.map((x) => (x.id === a.id ? { decision } : { decision: x.decision })));
    logTask(decision === 'aprovado' ? 'Aprovou a demanda' : decision === 'correcao' ? 'Pediu correção na demanda' : 'Atualizou uma aprovação');
    loadApprovals();
  }

  async function removeApprover(a: TaskApproval) {
    await supabase.from('task_approvals').delete().eq('id', a.id);
    const rest = approvals.filter((x) => x.id !== a.id);
    await setAggregate(rest);
    loadApprovals();
  }

  // Todos aprovaram → "seguir o fluxo": avança para a próxima etapa e limpa as aprovações
  async function approveAndAdvance() {
    const idx = sortedStages.findIndex((s) => s.id === task.stage_id);
    const next = sortedStages[idx + 1];
    if (next && blocksAdvanceTo(next.id)) {
      setFormError(`Há ${pendingGates.length} item(ns) obrigatório(s) do checklist pendente(s) — conclua-os antes de avançar.`);
      return;
    }
    setFormError(null);
    await supabase.from('task_approvals').delete().eq('task_id', task.id);
    onSave({ approval_state: 'none', approval_requested_to: null, stage_id: next ? next.id : task.stage_id });
  }

  async function addFile(e: FormEvent) {
    e.preventDefault();
    if (!fileUrl.trim()) return;
    const url = normalizeUrl(fileUrl);
    const fallbackName = url.split('/').pop()?.split('?')[0] || 'Link';
    await supabase.from('project_files').insert({
      task_id: task.id,
      project_id: task.project_id,
      name: fileName.trim() || fallbackName,
      url,
      added_by: actorId,
    });
    setFileName('');
    setFileUrl('');
    logTask('Anexou um link na demanda');
    const { data } = await supabase.from('project_files').select('*').eq('task_id', task.id).order('created_at');
    const rows = (data as ProjectFile[]) ?? [];
    setFiles(rows);
    signTaskFiles(rows);
  }

  // Sobe o arquivo (imagem/PDF/etc.) direto pro bucket e registra em project_files.
  // Assim a imagem aparece como miniatura na demanda para validação/observações/aprovação.
  async function uploadFile(file: File) {
    setFileBusy(true);
    setFileMsg(null);
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${task.id}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('task-files').upload(path, file, { upsert: true });
    if (upErr) {
      setFileMsg(upErr.message);
      setFileBusy(false);
      return;
    }
    const { data } = supabase.storage.from('task-files').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('project_files').insert({
      task_id: task.id,
      project_id: task.project_id,
      name: fileName.trim() || file.name,
      url: data.publicUrl,
      added_by: actorId,
    });
    if (dbErr) {
      setFileMsg(dbErr.message);
      setFileBusy(false);
      return;
    }
    setFileName('');
    setFileMsg('Arquivo enviado ✓');
    logTask('Enviou um arquivo na demanda');
    const { data: rows } = await supabase.from('project_files').select('*').eq('task_id', task.id).order('created_at');
    const fileRows = (rows as ProjectFile[]) ?? [];
    setFiles(fileRows);
    signTaskFiles(fileRows);
    setFileBusy(false);
  }

  async function deleteFile(id: string) {
    await supabase.from('project_files').delete().eq('id', id);
    logTask('Removeu um arquivo da demanda');
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  // ---- comentários em thread: agrupa por parent_id ----
  type CommentRow = (typeof comments)[number];
  const commentsByParent = new Map<string | null, CommentRow[]>();
  for (const c of comments) {
    const k = c.parent_id ?? null;
    if (!commentsByParent.has(k)) commentsByParent.set(k, []);
    commentsByParent.get(k)!.push(c);
  }
  // topo: mais recentes primeiro (vem da query). respostas: cronológicas (mais antigas primeiro).
  const topLevelComments = commentsByParent.get(null) ?? [];
  const iniciais = (nome?: string | null) => (nome ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  function renderComment(c: CommentRow, depth: number): ReactElement {
    const replies = [...(commentsByParent.get(c.id) ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const r = reactions.get(c.id) ?? { count: 0, mine: false };
    const meu = c.author_id === actorId;
    return (
      <div key={c.id} className={`td-msg ${depth > 0 ? 'reply' : ''}`}>
        <span className={`td-av ${meu ? 'me' : ''}`}>{iniciais(c.author?.name)}</span>
        <div className="td-msg-b">
          <div className="td-msg-h">
            <b>{c.author?.name ?? 'Alguém'}</b>
            <time>{new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}{c.edited_at ? ' · editado' : ''}</time>
          </div>
          {editingCommentId === c.id ? (
            <div className="td-msg-edit">
              <textarea rows={3} value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus />
              <div>
                <button type="button" className="td-btn prim sm" onClick={() => saveCommentEdit(c.id)} disabled={!editingText.trim()}>Salvar</button>
                <button type="button" className="td-btn ghost sm" onClick={() => { setEditingCommentId(null); setEditingText(''); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="td-msg-t"><RichText text={c.body} /></div>
          )}
          <div className="td-msg-a">
            <button type="button" className={r.mine ? 'on' : ''} onClick={() => likeComment(c.id)} title="Curtir / li">{r.mine ? 'Curtiu' : 'Curtir'}{r.count > 0 ? ` · ${r.count}` : ''}</button>
            <button type="button" onClick={() => { setReplyTo({ id: c.id, author: c.author?.name ?? 'Alguém', preview: c.body }); commentInputRef.current?.focus(); }}>Responder</button>
            {meu && editingCommentId !== c.id && <button type="button" onClick={() => { setEditingCommentId(c.id); setEditingText(c.body); }}>Editar</button>}
          </div>
          {replies.length > 0 && <div className="td-replies">{replies.map((x) => renderComment(x, depth + 1))}</div>}
        </div>
      </div>
    );
  }

  return createPortal(
    <div className="td" role="dialog" aria-label={`Demanda: ${title}`}>
      <header className="td-head">
        <button type="button" className="td-x" aria-label="Fechar" onClick={onClose}>×</button>
        <div className="td-head-t">
          <small>Demanda{currentStage ? ` · ${currentStage.name}` : ''}{(task.updated_by || task.created_at) ? ` · atualizada por ${updatedByName ?? 'ninguém ainda'} em ${new Date(task.updated_at).toLocaleDateString('pt-BR')}` : ''}</small>
          <h2>{title || 'Sem título'}</h2>
        </div>
        <div className="td-head-chips">
          <span className={`td-chip prio-${priority}`}>{PRIORITY_LABELS[priority]}</span>
          {overdue && <span className="td-chip late">Atrasada</span>}
          {approvals.length > 0 && <span className="td-chip" style={{ color: APPROVAL_COLOR[apprState] }}>{APPROVAL_STATE_LABELS[apprState]}</span>}
        </div>
        <div className="td-head-acts">
          <button type="button" className="td-btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" form="te-form" className="td-btn prim">Salvar</button>
        </div>
      </header>

      <div className="td-body">
        <div className="td-col">
          <section className="td-card">
            <h3>Detalhes</h3>
            <form id="te-form" onSubmit={handleSubmit} className="td-form">
              <label className="td-f full"><span>Título</span><input id="te-title" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label className="td-f full"><span>Notas</span><textarea id="te-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <label className="td-f"><span>Etapa</span>
                <select id="te-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  {sortedStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></label>
              <label className="td-f"><span>Prioridade</span>
                <select id="te-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </select></label>
              <label className="td-f"><span>Responsável</span>
                <select id="te-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Sem responsável</option>
                  {activeProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="td-f"><span>Orçamento</span><input id="te-budget" type="number" placeholder="R$" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
              <label className="td-f"><span>Início</span><input id="te-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
              <label className="td-f"><span>Meta</span><input id="te-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
              <label className="td-f"><span>Prazo final</span><input id="te-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
              {products && products.length > 0 && (
                <div className="td-f full"><span>Produto (embalagem)</span><ProductCombobox products={products} value={productId} onChange={setProductId} /></div>
              )}
              <div className="td-f full">
        {/* Imagem do produto vinculado (SKU) — direto na demanda */}
        {(() => {
          const sel = products?.find((p) => p.id === productId);
          if (!sel) return null;
          // Dentro do módulo de embalagem só mostra o PRODUTO (a embalagem é o que se está criando,
          // e entra pelo upload de mockup abaixo). Fora dele, mostra produto + embalagem.
          const imgs = task.packaging_track
            ? [{ url: thumb(sel.image_url), cap: 'Produto' }]
            : [
                { url: thumb(sel.image_url), cap: 'Produto' },
                { url: thumb(sel.packaging_image_url), cap: 'Embalagem' },
              ];
          const hasAny = imgs.some((i) => i.url);
          return (
            <div className="form-field">
              <label>
                Produto vinculado — <span style={{ fontFamily: 'monospace' }}>{sel.code}</span> {sel.name}
              </label>
              {hasAny ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {imgs
                    .filter((i) => i.url)
                    .map((i) => (
                      <a
                        key={i.cap}
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: 'none', color: 'var(--text-faint)' }}
                        title="Abrir imagem"
                      >
                        <img loading="lazy" decoding="async"
                          src={i.url}
                          alt={i.cap}
                          style={{
                            width: 132,
                            height: 132,
                            objectFit: 'contain',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            display: 'block',
                          }}
                        />
                        <span style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 4 }}>{i.cap}</span>
                      </a>
                    ))}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-faint)',
                    background: 'var(--surface-2)',
                    border: '1px dashed var(--border)',
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  Nenhuma imagem cadastrada para este SKU. Cadastre em <b>Produtos</b> → abra o produto{' '}
                  <span style={{ fontFamily: 'monospace' }}>{sel.code}</span> → fotos do produto e da embalagem →
                  “Enviar imagem”.
                </div>
              )}
            </div>
          );
        })()}

        {/* Mockup da embalagem — condicional: só quando a embalagem está aprovada. Grava no produto. */}
        {isPackagingDemand && embalagemAprovada && !productId && (
          <div
            className="form-field"
            style={{ background: 'var(--yellow-dim)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}
          >
            <label style={{ color: 'var(--yellow)' }}>Embalagem aprovada — falta vincular o produto</label>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 0' }}>
              Vincule um produto (SKU) no campo <b>“Produto (embalagem)”</b> acima para salvar o mockup da embalagem — o
              mockup é gravado no produto. Se ainda não existe, cadastre em <b>Produtos</b> e volte aqui pra vincular.
            </p>
          </div>
        )}
        {isPackagingDemand &&
          productId &&
          embalagemAprovada &&
          (() => {
            const sel = products?.find((p) => p.id === productId);
            if (!sel) return null;
            const current = mockupUrl || sel.packaging_image_url;
            return (
              <div className="form-field" style={{ background: 'var(--green-dim)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <label style={{ color: 'var(--green)' }}>Embalagem aprovada — subir mockup da embalagem</label>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 8px' }}>
                  Vai direto pro produto <span style={{ fontFamily: 'monospace' }}>{sel.code}</span> e atualiza a lista de Produtos
                  automaticamente (mesmo registro vinculado).
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {current ? (
                      <img loading="lazy" decoding="async" src={thumb(current)} alt="Mockup" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Sem mockup</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="btn ghost sm" style={{ cursor: mockupBusy ? 'wait' : 'pointer' }}>
                      {mockupBusy ? 'Enviando…' : current ? 'Trocar mockup' : 'Enviar mockup'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={mockupBusy}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadMockup(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {mockupMsg && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{mockupMsg}</span>}
                  </div>
                </div>
              </div>
            );
          })()}

              </div>
              {overdue && (
                <label className="td-f full td-late"><span>Esta demanda está atrasada: por que não foi concluída no prazo?</span>
                  <textarea id="te-delay" required rows={2} value={delayReason} onChange={(e) => setDelayReason(e.target.value)}
                    placeholder="O motivo fica visível para quem acompanha este projeto." /></label>
              )}
              {formError && <div className="td-err full">{formError}</div>}
              <div className="td-f full td-delrow">
                {confirmingDelete ? (
                  <div className="td-del">
                    <span>Excluir esta demanda? Não dá para desfazer.</span>
                    <button type="button" className="td-btn ghost sm" onClick={() => setConfirmingDelete(false)}>Cancelar</button>
                    <button type="button" className="td-btn danger sm" onClick={onDelete}>Excluir</button>
                  </div>
                ) : <button type="button" className="td-link danger" onClick={() => setConfirmingDelete(true)}>Excluir demanda</button>}
              </div>
            </form>
          </section>

          {/* Sub-etapas da etapa atual + checklist livre (item que trava = limitador de avanço) */}
          <section className="td-card">
            <h3>Checklist <small>{checklist.filter((c) => c.done).length} de {checklist.length} feitos</small></h3>
            {pendingGates.length > 0 && (
              <div className="td-note warn">{pendingGates.length === 1 ? 'Um item que trava ainda está pendente' : `${pendingGates.length} itens que travam ainda estão pendentes`}: a demanda só avança de etapa depois deles.</div>
            )}
            {currentStageItems.length > 0 && (
              <div className="td-ck-group"><h4>Sub-etapas de {currentStage?.name ?? 'etapa atual'}</h4>{currentStageItems.map(renderChecklistRow)}</div>
            )}
            {otherItems.length > 0 && (
              <div className="td-ck-group">
                <h4>Checklist livre
                  {onSpawnDemandas && (
                    <button type="button" className="td-link" title="Cria uma demanda individual para cada item do checklist livre"
                      onClick={() => {
                        const labels = otherItems.map((c) => c.label).filter(Boolean);
                        if (labels.length === 0) return;
                        if (confirm(`Transformar ${labels.length} item(ns) do checklist em demandas individuais?`)) onSpawnDemandas(labels);
                      }}>Transformar em demandas ({otherItems.length})</button>
                  )}
                </h4>
                {otherItems.map(renderChecklistRow)}
              </div>
            )}
            {checklist.length === 0 && <p className="td-empty">Nenhum item ainda.</p>}
            <form onSubmit={addChecklistItem} className="td-add">
              <input placeholder="Novo item do checklist" value={newChecklistLabel} onChange={(e) => setNewChecklistLabel(e.target.value)} />
              <label className={`td-ck-gate ${newChecklistGate ? 'on' : ''}`} title="Trava o avanço de etapa até concluir">
                <input type="checkbox" checked={newChecklistGate} onChange={(e) => setNewChecklistGate(e.target.checked)} />{newChecklistGate ? 'Trava' : 'Opcional'}
              </label>
              <button className="td-btn prim sm" type="submit">Adicionar</button>
            </form>
          </section>

          <section className="td-card">
            <h3>Arquivos <small>{files.length || 'nenhum ainda'}</small></h3>
            {files.length > 0 && (
              <div className="td-files">
                {files.map((f, i) => {
                  const isImg = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|$)/i.test(f.url);
                  const href = fileHref(f);
                  return (
                    <div key={f.id} className="td-file">
                      <a href={href} target="_blank" rel="noreferrer" className="td-file-art">
                        {isImg ? <img loading="lazy" decoding="async" src={href} alt={f.name} /> : <span>{(f.url.split('?')[0].split('.').pop() || 'link').slice(0, 4).toUpperCase()}</span>}
                        <em>{i + 1}</em>
                      </a>
                      <a href={href} target="_blank" rel="noreferrer" className="td-file-n">{f.name}</a>
                      <button type="button" className="td-ck-x" aria-label="Tirar arquivo" onClick={() => deleteFile(f.id)}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Upload real: sobe a imagem/arquivo pra validação */}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
            <div className="td-add">
              <input placeholder="Nome do arquivo (opcional)" value={fileName} onChange={(e) => setFileName(e.target.value)} />
              <button type="button" className="td-btn prim sm" disabled={fileBusy} onClick={() => fileInputRef.current?.click()}>{fileBusy ? 'Enviando…' : 'Enviar arquivo'}</button>
            </div>
            {fileMsg && <p className={`td-msgline ${fileMsg.includes('✓') ? 'ok' : 'bad'}`}>{fileMsg}</p>}
            <form onSubmit={addFile} className="td-add">
              <input placeholder="Ou cole um link (Drive, Acrobat…)" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
              <button className="td-btn ghost sm" type="submit">Anexar link</button>
            </form>
          </section>
        </div>

        <div className="td-col td-side">
          {/* Fluxo de aprovação — múltiplos decisores */}
          <section className="td-card">
            <h3>Aprovação <small style={{ color: APPROVAL_COLOR[apprState] }}>{APPROVAL_STATE_LABELS[apprState]}{approvals.length > 0 ? ` · ${approvedCount} de ${approvals.length}` : ''}</small></h3>
            {approvals.length > 0 && (
              <div className="td-appr">
                {approvals.map((a) => {
                  const st = a.decision === 'aprovado' ? 'ok' : a.decision === 'correcao' ? 'bad' : '';
                  return (
                    <div key={a.id} className="td-appr-r">
                      <span className="td-av sm">{iniciais(a.approver?.name)}</span>
                      <span className="td-appr-n">{a.approver?.name ?? '—'}</span>
                      <span className={`td-appr-s ${st}`}>{a.decision === 'aprovado' ? 'Aprovou' : a.decision === 'correcao' ? 'Pediu correção' : 'Pendente'}</span>
                      {canDecide(a) && a.decision !== 'aprovado' && <button type="button" className="td-btn ok sm" onClick={() => decide(a, 'aprovado')}>Aprovar</button>}
                      {canDecide(a) && a.decision !== 'correcao' && <button type="button" className="td-btn ghost sm" onClick={() => decide(a, 'correcao')}>Correção</button>}
                      <button type="button" className="td-ck-x" title="Remover aprovador" onClick={() => removeApprover(a)}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
            {allApproved && <button type="button" className="td-btn ok" onClick={approveAndAdvance}>Todos aprovaram: avançar etapa</button>}
            <div className="td-pick">
              <span>Pedir aprovação a</span>
              <div className="td-people">
                {activeProfiles.map((p) => {
                  const already = approvals.some((a) => a.approver_id === p.id);
                  const sel = selectedApprovers.includes(p.id);
                  return (
                    <button type="button" key={p.id} className={`td-person ${sel ? 'on' : ''}`} disabled={already} onClick={() => !already && toggleApprover(p.id)}>
                      <span className="td-av xs">{iniciais(p.name)}</span>{p.name.split(' ')[0]}{already ? ' · já' : ''}
                    </button>
                  );
                })}
              </div>
              <div className="td-add">
                <input placeholder="Observação (opcional)" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} />
                <button type="button" className="td-btn prim sm" onClick={requestApproval} disabled={!selectedApprovers.length}>
                  Pedir{selectedApprovers.length > 0 ? ` (${selectedApprovers.length})` : ''}
                </button>
              </div>
            </div>
          </section>

          <section className={`td-card td-chat ${focusComments ? 'focus' : ''}`} ref={commentsRef}>
            <h3>Conversa <small>{comments.length || 'nenhum comentário'}</small></h3>
            <form onSubmit={addComment} className="td-compose">
              {replyTo && (
                <div className="td-replyto">
                  <span>Respondendo a <b>{replyTo.author}</b>: {replyTo.preview.replace(/@\S+/g, '').replace(/📎[^\n]*/g, '').trim().slice(0, 70) || '…'}</span>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancelar resposta">×</button>
                </div>
              )}
              <div className="td-compose-row">
                <input ref={commentInputRef} placeholder={replyTo ? `Responder a ${replyTo.author}…` : 'Escreva um comentário'} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />
                <button className="td-btn prim sm" type="submit">{replyTo ? 'Responder' : 'Enviar'}</button>
              </div>
              <div className="td-people sm">
                {activeProfiles.map((p) => (
                  <button type="button" key={p.id} className={`td-person ${mentionIds.includes(p.id) ? 'on' : ''}`} onClick={() => toggleMention(p.id)}>@{p.name.split(' ')[0]}</button>
                ))}
                {files.map((f, i) => (
                  <button type="button" key={f.id} title={f.name} className={`td-person file ${attachedFileIds.includes(f.id) ? 'on' : ''}`} onClick={() => toggleFileRef(f.id)}>Arquivo {i + 1}</button>
                ))}
              </div>
            </form>
            <div className="td-msgs">
              {topLevelComments.map((c) => renderComment(c, 0))}
              {comments.length === 0 && <p className="td-empty">Ninguém comentou ainda.</p>}
            </div>
          </section>
        </div>
      </div>

      {/* celular: salvar ao alcance do polegar */}
      <div className="td-bar">
        <button type="button" className="td-btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" form="te-form" className="td-btn prim">Salvar</button>
      </div>
    </div>,
    document.body,
  );
}

