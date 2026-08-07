import { useEffect, useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import ProductCombobox from './ProductCombobox';
import RichText from './RichText';
import { supabase } from '../lib/supabaseClient';
import { normalizeUrl } from '../lib/url';
import { materializeSubsteps, recomputeSubstepDueDates } from '../lib/substeps';
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
  const commentsRef = useRef<HTMLDivElement>(null);
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
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newChecklistGate, setNewChecklistGate] = useState(false);

  const [comments, setComments] = useState<(TaskComment & { author: { name: string } | null })[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [attachedFileIds, setAttachedFileIds] = useState<string[]>([]); // arquivos referenciados no comentário

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
      .then(({ data }) => setFiles((data as ProjectFile[]) ?? []));
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
  function toggleFileRef(id: string) {
    setAttachedFileIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() && attachedFileIds.length === 0) return;
    const mentionTags = mentionIds.map((id) => `@${profiles.find((p) => p.id === id)?.name ?? ''}`).join(' ');
    // referências a arquivos: nome + link (o RichText transforma a URL em link/miniatura clicável)
    const fileRefs = attachedFileIds
      .map((id) => files.find((f) => f.id === id))
      .filter((f): f is ProjectFile => Boolean(f))
      .map((f) => {
        const idx = files.findIndex((x) => x.id === f.id);
        return `📎 arquivo ${idx + 1} — ${f.name}: ${f.url}`;
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
    });
    setCommentBody('');
    setMentionIds([]);
    setAttachedFileIds([]);
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
    setSelectedApprovers([]);
    setApprovalNote('');
    loadApprovals();
    loadComments();
  }

  async function decide(a: TaskApproval, decision: ApprovalDecision) {
    await supabase.from('task_approvals').update({ decision, decided_at: new Date().toISOString() }).eq('id', a.id);
    await setAggregate(approvals.map((x) => (x.id === a.id ? { decision } : { decision: x.decision })));
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
              {activeProfiles.map((p) => (
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

        {/* Imagem do produto vinculado (SKU) — direto na demanda */}
        {(() => {
          const sel = products?.find((p) => p.id === productId);
          if (!sel) return null;
          // Dentro do módulo de embalagem só mostra o PRODUTO (a embalagem é o que se está criando,
          // e entra pelo upload de mockup abaixo). Fora dele, mostra produto + embalagem.
          const imgs = task.packaging_track
            ? [{ url: sel.image_url, cap: '📦 Produto' }]
            : [
                { url: sel.image_url, cap: '📦 Produto' },
                { url: sel.packaging_image_url, cap: '🎁 Embalagem' },
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
                        <img
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
                  <span style={{ fontFamily: 'monospace' }}>{sel.code}</span> → 📦 Imagem do produto / 🎁 Imagem da embalagem →
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
            <label style={{ color: 'var(--yellow)' }}>✅ Embalagem aprovada — falta vincular o produto</label>
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
                <label style={{ color: 'var(--green)' }}>✅ Embalagem aprovada — subir mockup da embalagem</label>
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
                      <img src={current} alt="Mockup" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

      {/* Fluxo de aprovação — múltiplos decisores */}
      <div className="panel" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Aprovação</h4>
          <span className="tag" style={{ background: 'var(--surface-2)', color: APPROVAL_COLOR[apprState] }}>
            {APPROVAL_STATE_LABELS[apprState]}
            {approvals.length > 0 ? ` · ${approvedCount}/${approvals.length} aprovaram` : ''}
          </span>
        </div>

        {/* aprovadores atuais + decisão de cada um */}
        {approvals.map((a) => {
          const color = a.decision === 'aprovado' ? 'var(--green)' : a.decision === 'correcao' ? 'var(--red)' : 'var(--text-faint)';
          const label = a.decision === 'aprovado' ? '✓ aprovou' : a.decision === 'correcao' ? '✕ pediu correção' : 'pendente';
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1 }}>{a.approver?.name ?? '—'}</span>
              <span className="tag" style={{ background: 'var(--surface-2)', color }}>{label}</span>
              {canDecide(a) && a.decision !== 'aprovado' && (
                <button type="button" className="btn ghost sm" style={{ color: 'var(--green)' }} onClick={() => decide(a, 'aprovado')}>Aprovar</button>
              )}
              {canDecide(a) && a.decision !== 'correcao' && (
                <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => decide(a, 'correcao')}>Correção</button>
              )}
              <button type="button" className="btn ghost sm" title="Remover aprovador" onClick={() => removeApprover(a)}>✕</button>
            </div>
          );
        })}

        {allApproved && (
          <button type="button" className="btn sm" style={{ background: 'var(--green)', marginTop: 8 }} onClick={approveAndAdvance}>
            ✓ Todos aprovaram — avançar etapa
          </button>
        )}

        {/* adicionar / pedir aprovação de várias pessoas */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-faint)' }}>Pedir aprovação a (pode escolher vários):</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
            {activeProfiles.map((p) => {
              const already = approvals.some((a) => a.approver_id === p.id);
              const sel = selectedApprovers.includes(p.id);
              return (
                <span
                  key={p.id}
                  onClick={() => !already && toggleApprover(p.id)}
                  className="pill"
                  style={{
                    cursor: already ? 'default' : 'pointer',
                    opacity: already ? 0.4 : 1,
                    background: sel ? 'var(--accent-dim)' : 'var(--surface-2)',
                    color: sel ? 'var(--accent)' : 'var(--text-faint)',
                    border: sel ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  {sel ? '✓ ' : ''}{p.name}{already ? ' (já)' : ''}
                </span>
              );
            })}
          </div>
          <div className="responsive-row">
            <input placeholder="Observação (opcional)" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn sm" onClick={requestApproval} disabled={!selectedApprovers.length}>
              Solicitar aprovação{selectedApprovers.length > 0 ? ` (${selectedApprovers.length})` : ''}
            </button>
          </div>
        </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 4px' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-faint)', flex: 1 }}>
                Checklist livre
              </div>
              {onSpawnDemandas && (
                <button
                  type="button"
                  className="btn ghost sm"
                  title="Cria uma demanda individual pra cada item do checklist livre"
                  onClick={() => {
                    const labels = otherItems.map((c) => c.label).filter(Boolean);
                    if (labels.length === 0) return;
                    if (confirm(`Transformar ${labels.length} item(ns) do checklist em demandas individuais?`)) {
                      onSpawnDemandas(labels);
                    }
                  }}
                >
                  ➔ Transformar em demandas ({otherItems.length})
                </button>
              )}
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
        {files.map((f, i) => (
          <div className="field-row" key={f.id}>
            <a href={f.url} target="_blank" rel="noreferrer">
              <span style={{ color: 'var(--text-faint)', marginRight: 6 }}>📎 {i + 1}</span>
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
            <div className="body" style={{ whiteSpace: 'pre-wrap' }}><RichText text={c.body} /></div>
          </div>
        ))}
        {comments.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nenhum comentário ainda.</p>}

        <form onSubmit={addComment} style={{ marginTop: 8 }}>
          <div className="form-field">
            <label>Marcar pessoas</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {activeProfiles.map((p) => (
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
          {files.length > 0 && (
            <div className="form-field">
              <label>Mencionar arquivo</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {files.map((f, i) => {
                  const on = attachedFileIds.includes(f.id);
                  return (
                    <span
                      key={f.id}
                      className="pill"
                      onClick={() => toggleFileRef(f.id)}
                      title={f.name}
                      style={{
                        cursor: 'pointer',
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        background: on ? 'var(--violet-dim)' : 'var(--surface-2)',
                        color: on ? 'var(--violet)' : 'var(--text-faint)',
                        border: on ? '1px solid var(--violet)' : '1px solid var(--border)',
                      }}
                    >
                      📎 {i + 1} · {f.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <div className="responsive-row">
            <input
              placeholder="Escrever um comentário… marque alguém ou um arquivo acima"
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

