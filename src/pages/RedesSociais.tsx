import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Modal from '../components/Modal';
import { SOCIAL_POST_STATUSES, type Brand, type SocialPost } from '../types/database';

type PostWithRelations = SocialPost & { brand: Brand; creator: { name: string } | null };

const STATUS_COLOR: Record<string, string> = {
  Pendente: 'var(--yellow)',
  Aprovado: 'var(--green)',
  'Alterações solicitadas': 'var(--red)',
};

export default function RedesSociais() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [editingPost, setEditingPost] = useState<PostWithRelations | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [openFeedbackFor, setOpenFeedbackFor] = useState<string | null>(null);

  const isDiretoria = profile?.role === 'diretoria';

  const load = useCallback(async () => {
    setLoading(true);
    const [postsRes, brandsRes] = await Promise.all([
      supabase
        .from('social_posts')
        .select('*, brand:brands(*), creator:profiles!social_posts_created_by_fkey(name)')
        .order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
    ]);
    setPosts((postsRes.data as PostWithRelations[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function review(postId: string, status: string, feedback?: string) {
    if (!profile) return;
    await supabase
      .from('social_posts')
      .update({ status, reviewed_by: profile.id, reviewer_feedback: feedback ?? '' })
      .eq('id', postId);
    await logActivity({ actorId: profile.id, actionText: `Peça de mídia social: ${status.toLowerCase()}` });
    setOpenFeedbackFor(null);
    load();
  }

  const filtered = posts.filter((p) => statusFilter === 'all' || p.status === statusFilter);
  const pendingCount = posts.filter((p) => p.status === 'Pendente').length;

  return (
    <div className="page">
      <h1 className="page-title">Redes Sociais</h1>
      <div className="page-sub">
        Aprovação de peças de conteúdo — quem sobe a imagem/vídeo, e a diretoria aprova ou pede alteração, direto
        no Hub.
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{posts.length}</div>
          <div className="stat-label">Peças enviadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{pendingCount}</div>
          <div className="stat-label">Aguardando aprovação</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{posts.filter((p) => p.status === 'Aprovado').length}</div>
          <div className="stat-label">Aprovadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{posts.filter((p) => p.status === 'Alterações solicitadas').length}</div>
          <div className="stat-label">Com alteração pedida</div>
        </div>
      </div>

      <div className="filters-row">
        <div className={`filter-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>
          Todas
        </div>
        {SOCIAL_POST_STATUSES.map((s) => (
          <div key={s} className={`filter-chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s}
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Peças para aprovação</h2>
        <button className="btn" onClick={() => setShowUpload(true)}>
          + Nova peça
        </button>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma peça por aqui ainda.
        </div>
      ) : (
        <div className="grid3">
          {filtered.map((p) => (
            <div className="card" key={p.id} style={{ padding: 0, overflow: 'hidden' }}>
              {p.media_type === 'video' ? (
                <video src={p.media_url} controls style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
              ) : (
                <img src={p.media_url} alt={p.caption} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
              )}
              <div style={{ padding: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)', color: p.brand?.color }}>
                    {p.brand?.label}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLOR[p.status] }}>
                    ● {p.status}
                  </span>
                </div>
                <p style={{ margin: '0 0 8px 0' }}>{p.caption}</p>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {p.suggested_date ? `Sugestão: ${new Date(p.suggested_date + 'T00:00').toLocaleDateString('pt-BR')}` : 'Sem data sugerida'}
                  {p.creator ? ` · por ${p.creator.name}` : ''}
                </div>
                {p.reviewer_feedback && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--red)', background: 'var(--red-dim)', padding: 8, borderRadius: 6 }}>
                    {p.reviewer_feedback}
                  </div>
                )}

                <div style={{ marginTop: 10 }}>
                  <button className="btn ghost sm" onClick={() => setEditingPost(p)}>
                    Editar
                  </button>
                </div>

                {isDiretoria && p.status === 'Pendente' && (
                  <div style={{ marginTop: 10 }}>
                    {openFeedbackFor === p.id ? (
                      <div>
                        <textarea
                          rows={2}
                          placeholder="O que precisa mudar?"
                          value={feedbackDrafts[p.id] ?? ''}
                          onChange={(e) => setFeedbackDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                          style={{
                            width: '100%',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            borderRadius: 7,
                            color: 'var(--text)',
                            padding: 7,
                            fontSize: 12,
                            marginBottom: 6,
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn ghost sm" onClick={() => setOpenFeedbackFor(null)}>
                            Cancelar
                          </button>
                          <button
                            className="btn sm"
                            onClick={() => review(p.id, 'Alterações solicitadas', feedbackDrafts[p.id] ?? '')}
                          >
                            Enviar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn ghost sm" onClick={() => setOpenFeedbackFor(p.id)}>
                          Solicitar alteração
                        </button>
                        <button className="btn sm" onClick={() => review(p.id, 'Aprovado')}>
                          Aprovar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="banner soon" style={{ marginTop: 28 }}>
        <span className="ic">◐</span>
        <span>
          <b>Separado da aprovação acima:</b> não vamos integrar publicação com a MLabs por enquanto — só
          queremos, no futuro, trazer para cá a <b>leitura de relatórios</b> (alcance, engajamento) da MLabs,
          como uma consulta, sem depender disso para o fluxo de aprovação funcionar.
        </span>
      </div>

      {showUpload && profile && (
        <UploadModal
          brands={brands}
          actorId={profile.id}
          onClose={() => setShowUpload(false)}
          onCreated={() => {
            setShowUpload(false);
            load();
          }}
        />
      )}

      {editingPost && profile && (
        <EditPostModal
          post={editingPost}
          brands={brands}
          actorId={profile.id}
          onClose={() => setEditingPost(null)}
          onSaved={() => {
            setEditingPost(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  brands,
  actorId,
  onClose,
  onCreated,
}: {
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [caption, setCaption] = useState('');
  const [suggestedDate, setSuggestedDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Escolha uma imagem ou vídeo.');
      return;
    }
    if (!brandId) {
      setError('Escolha uma marca.');
      return;
    }
    setSaving(true);
    setError(null);

    const path = `${brandId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('social-media').upload(path, file);
    if (uploadError) {
      setSaving(false);
      setError(uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(path);
    const mediaType = file.type.startsWith('video') ? 'video' : 'image';

    const { error: insertError } = await supabase.from('social_posts').insert({
      brand_id: brandId,
      caption,
      suggested_date: suggestedDate || null,
      media_path: path,
      media_url: urlData.publicUrl,
      media_type: mediaType,
      created_by: actorId,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Peça de mídia social enviada para aprovação' });
    onCreated();
  }

  return (
    <Modal title="Nova peça para aprovação" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="sp-brand">Marca</label>
          <select id="sp-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="sp-file">Imagem ou vídeo</label>
          <input
            id="sp-file"
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="sp-caption">Legenda</label>
          <textarea id="sp-caption" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="sp-date">Data sugestiva de postagem</label>
          <input id="sp-date" type="date" value={suggestedDate} onChange={(e) => setSuggestedDate(e.target.value)} />
        </div>
        {error && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar para aprovação'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditPostModal({
  post,
  brands,
  actorId,
  onClose,
  onSaved,
}: {
  post: PostWithRelations;
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [brandId, setBrandId] = useState(post.brand_id);
  const [caption, setCaption] = useState(post.caption);
  const [suggestedDate, setSuggestedDate] = useState(post.suggested_date ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brandId) {
      setError('Escolha uma marca.');
      return;
    }
    setSaving(true);
    setError(null);

    const fields: Partial<SocialPost> = {
      brand_id: brandId,
      caption,
      suggested_date: suggestedDate || null,
    };

    if (file) {
      const path = `${brandId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('social-media').upload(path, file);
      if (uploadError) {
        setSaving(false);
        setError(uploadError.message);
        return;
      }
      const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(path);
      fields.media_path = path;
      fields.media_url = urlData.publicUrl;
      fields.media_type = file.type.startsWith('video') ? 'video' : 'image';
      await supabase.storage.from('social-media').remove([post.media_path]);
    }

    if (post.status === 'Alterações solicitadas') {
      fields.status = 'Pendente';
      fields.reviewer_feedback = '';
    }

    const { error: updateError } = await supabase.from('social_posts').update(fields).eq('id', post.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Peça de mídia social editada', detail: post.caption.slice(0, 60) });
    onSaved();
  }

  async function handleDelete() {
    setSaving(true);
    await supabase.storage.from('social-media').remove([post.media_path]);
    const { error } = await supabase.from('social_posts').delete().eq('id', post.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Peça de mídia social excluída' });
    onSaved();
  }

  return (
    <Modal title="Editar peça" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="ep-brand">Marca</label>
          <select id="ep-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ep-file">Substituir imagem/vídeo (opcional)</label>
          <input id="ep-file" type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="form-field">
          <label htmlFor="ep-caption">Legenda</label>
          <textarea id="ep-caption" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="ep-date">Data sugestiva de postagem</label>
          <input id="ep-date" type="date" value={suggestedDate} onChange={(e) => setSuggestedDate(e.target.value)} />
        </div>
        {post.status === 'Alterações solicitadas' && (
          <div className="banner soon">
            <span className="ic">◐</span>
            <span>Salvar aqui reenvia a peça para aprovação (volta para "Pendente").</span>
          </div>
        )}
        {error && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{error}</span>
          </div>
        )}

        {confirmingDelete ? (
          <div className="banner error" style={{ alignItems: 'center' }}>
            <span className="ic">⚠</span>
            <span style={{ flex: 1 }}>Excluir esta peça? Não dá pra desfazer.</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" style={{ background: 'var(--red)' }} onClick={handleDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => setConfirmingDelete(true)}>
              Excluir
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
