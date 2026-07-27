import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { CONTENT_STATUSES, CONTENT_TYPES, type CampaignContent, type ContentStatus, type ContentType } from '../../types/database';

const TYPE_LABELS: Record<ContentType, string> = {
  post: 'Post',
  video: 'Vídeo',
  story: 'Story',
  reel: 'Reel',
  short: 'Short',
  banner: 'Banner',
  catalogo: 'Catálogo',
};

export default function CampaignConteudos() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [contents, setContents] = useState<CampaignContent[]>([]);
  const [editing, setEditing] = useState<CampaignContent | 'new' | null>(null);

  async function load() {
    const { data } = await supabase.from('campaign_contents').select('*').eq('campaign_id', campaign.id).order('scheduled_date');
    setContents((data as CampaignContent[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const byType = CONTENT_TYPES.map((t) => ({ type: t, count: contents.filter((c) => c.content_type === t).length })).filter((t) => t.count > 0);

  return (
    <div>
      <div className="section-head">
        <h2>Conteúdos</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo conteúdo
        </button>
      </div>

      {byType.length > 0 && (
        <div className="grid4" style={{ marginBottom: 18 }}>
          {byType.map((t) => (
            <div className="card" key={t.type}>
              <h4>{TYPE_LABELS[t.type]}</h4>
              <p>{t.count}</p>
            </div>
          ))}
        </div>
      )}

      {contents.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum conteúdo planejado ainda.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {contents.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(c)}>
                <td>{c.title}</td>
                <td style={{ color: 'var(--text-faint)' }}>{TYPE_LABELS[c.content_type]}</td>
                <td style={{ color: 'var(--text-faint)' }}>{c.scheduled_date ? new Date(c.scheduled_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td style={{ color: 'var(--text-faint)' }}>{CONTENT_STATUSES.find((s) => s.key === c.status)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <ContentFormModal
          content={editing === 'new' ? null : editing}
          campaignId={campaign.id}
          actorId={profile?.id ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ContentFormModal({
  content,
  campaignId,
  actorId,
  onClose,
  onSaved,
}: {
  content: CampaignContent | null;
  campaignId: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(content);
  const [title, setTitle] = useState(content?.title ?? '');
  const [contentType, setContentType] = useState<ContentType>(content?.content_type ?? 'post');
  const [scheduledDate, setScheduledDate] = useState(content?.scheduled_date ?? '');
  const [status, setStatus] = useState<ContentStatus>(content?.status ?? 'planejado');
  const [notes, setNotes] = useState(content?.notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = { campaign_id: campaignId, title: title.trim(), content_type: contentType, scheduled_date: scheduledDate || null, status, notes };
    if (isEdit && content) {
      await supabase.from('campaign_contents').update(fields).eq('id', content.id);
    } else {
      await supabase.from('campaign_contents').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Conteúdo atualizado' : 'Conteúdo criado', detail: title, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!content) return;
    await supabase.from('campaign_contents').delete().eq('id', content.id);
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar conteúdo' : 'Novo conteúdo'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="ct-title">Título</label>
          <input id="ct-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ct-type">Tipo</label>
            <select id="ct-type" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="ct-date">Data agendada</label>
            <input id="ct-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="ct-status">Status</label>
          <select id="ct-status" value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
            {CONTENT_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ct-notes">Notas</label>
          <textarea id="ct-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir este conteúdo?</span>
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
              {isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
