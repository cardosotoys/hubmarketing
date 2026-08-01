import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useProductDevWorkspace } from '../../context/ProductDevWorkspaceContext';
import { PRODUCT_DEV_PHASES, type Profile, type ProductDevTask } from '../../types/database';

const GTM_SUGGESTIONS = [
  'Definir precificação final e política comercial (varejo, atacado, marketplaces, e-commerce)',
  'Produzir material de venda: catálogo, fotos/vídeo, ficha técnica, argumentos',
  'Planejar campanha de lançamento e calendário sazonal (Dia das Crianças, Natal)',
  'Cadastrar produto nos canais e ERPs dos clientes',
  'Preparar a embalagem como ativo de PDV (destaque na gôndola/marketplace)',
];

export default function ProductDevMarketing() {
  const { profile } = useAuth();
  const { item } = useProductDevWorkspace();
  const [tasks, setTasks] = useState<(ProductDevTask & { assignee: { name: string } | null })[]>([]);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('product_dev_tasks')
      .select('*, assignee:profiles!product_dev_tasks_assignee_id_fkey(name)')
      .eq('item_id', item.id)
      .eq('track', 'marketing')
      .order('position');
    setTasks((data as (ProductDevTask & { assignee: { name: string } | null })[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function toggle(t: ProductDevTask) {
    await supabase.from('product_dev_tasks').update({ done: !t.done }).eq('id', t.id);
    load();
  }

  async function remove(id: string) {
    await supabase.from('product_dev_tasks').delete().eq('id', id);
    load();
  }

  const done = tasks.filter((t) => t.done).length;

  return (
    <div>
      <div className="section-head">
        <h2>Marketing / GTM</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Tarefa de GTM
        </button>
      </div>

      <div className="page-sub" style={{ marginTop: -6 }}>
        Trilha de go-to-market roda em paralelo desde a Fase 1 — posicionamento, precificação e campanha prontos antes
        do lançamento (Fase 8). {tasks.length > 0 && `${done}/${tasks.length} concluídas.`}
      </div>

      {tasks.length === 0 ? (
        <div className="panel">
          <h4>Sugestões de tarefas de GTM</h4>
          {GTM_SUGGESTIONS.map((s) => (
            <div key={s} className="field-row">
              <span style={{ color: 'var(--green)' }}>▸</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      ) : (
        tasks.map((t) => (
          <div className="panel" key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t)} style={{ width: 'auto' }} />
            <div style={{ flex: 1 }}>
              <div style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-faint)' : 'var(--text)' }}>
                {t.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 10, marginTop: 2 }}>
                <span>Fase {t.phase}</span>
                {t.assignee?.name && <span>· {t.assignee.name}</span>}
                {t.due_date && <span>· prazo {new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR')}</span>}
              </div>
            </div>
            <button className="btn ghost sm" onClick={() => remove(t.id)} title="Excluir">
              ✕
            </button>
          </div>
        ))
      )}

      {showNew && (
        <NewGtmModal
          itemId={item.id}
          actorId={profile?.id ?? ''}
          position={tasks.length}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewGtmModal({
  itemId,
  actorId,
  position,
  onClose,
  onSaved,
}: {
  itemId: string;
  actorId: string;
  position: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState(1);
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [people, setPeople] = useState<Profile[]>([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('name')
      .then(({ data }) => setPeople((data as Profile[]) ?? []));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await supabase.from('product_dev_tasks').insert({
      item_id: itemId,
      track: 'marketing',
      phase,
      title: title.trim(),
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      position,
      created_by: actorId,
    });
    await logActivity({ actorId, actionText: 'Tarefa de GTM criada', detail: title, productDevItemId: itemId });
    onSaved();
  }

  return (
    <Modal title="Nova tarefa de GTM" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="gtm-title">Tarefa</label>
          <input id="gtm-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="gtm-phase">Fase</label>
            <select id="gtm-phase" value={phase} onChange={(e) => setPhase(Number(e.target.value))}>
              {PRODUCT_DEV_PHASES.map((p) => (
                <option key={p.n} value={p.n}>
                  Fase {p.n} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="gtm-due">Prazo</label>
            <input id="gtm-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="gtm-assignee">Responsável</label>
          <select id="gtm-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">— sem responsável —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Criar
          </button>
        </div>
      </form>
    </Modal>
  );
}
