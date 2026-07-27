import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { CREATIVE_STATUSES, type CampaignCreative, type Profile } from '../../types/database';

const TYPES = ['Banner', 'Vídeo', 'Embalagem', 'Post', 'Catálogo', 'Outro'];
const STATUS_COLOR: Record<string, string> = {
  rascunho: 'var(--text-faint)',
  em_aprovacao: 'var(--yellow)',
  aprovado: 'var(--green)',
  reprovado: 'var(--red)',
};

export default function CampaignCriativos() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [creatives, setCreatives] = useState<CampaignCreative[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');

  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';

  async function load() {
    const [creativesRes, profilesRes] = await Promise.all([
      supabase.from('campaign_creatives').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);
    setCreatives((creativesRes.data as CampaignCreative[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  function canReview(c: CampaignCreative) {
    return isPrivileged || (profile && c.approver_id === profile.id);
  }

  async function submitForApproval(c: CampaignCreative) {
    await supabase.from('campaign_creatives').update({ status: 'em_aprovacao' }).eq('id', c.id);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Criativo enviado para aprovação', detail: c.name, campaignId: campaign.id });
    load();
  }

  async function decide(c: CampaignCreative, status: 'aprovado' | 'reprovado') {
    await supabase.from('campaign_creatives').update({ status, feedback: status === 'reprovado' ? feedbackDraft : '' }).eq('id', c.id);
    if (profile) await logActivity({ actorId: profile.id, actionText: status === 'aprovado' ? 'Criativo aprovado' : 'Criativo reprovado', detail: c.name, campaignId: campaign.id });
    setFeedbackFor(null);
    setFeedbackDraft('');
    load();
  }

  async function deleteCreative(c: CampaignCreative) {
    if (c.file_path) await supabase.storage.from('campaign-creatives').remove([c.file_path]);
    await supabase.from('campaign_creatives').delete().eq('id', c.id);
    load();
  }

  return (
    <div>
      <div className="section-head">
        <h2>{creatives.length} criativos</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Nova peça
        </button>
      </div>

      {creatives.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma peça criativa enviada ainda.
        </div>
      ) : (
        <div className="grid3">
          {creatives.map((c) => (
            <div className="card" key={c.id}>
              {c.file_url && (c.file_path.match(/\.(mp4|mov|webm)$/i) ? (
                <video src={c.file_url} controls style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
              ) : (
                <img src={c.file_url} alt={c.name} style={{ width: '100%', borderRadius: 8, marginBottom: 8, objectFit: 'cover', maxHeight: 160 }} />
              ))}
              <h4>
                {c.name} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>v{c.version}</span>
              </h4>
              <p style={{ color: 'var(--text-faint)' }}>{c.type}</p>
              <span className="tag" style={{ background: 'var(--surface-2)', color: STATUS_COLOR[c.status] }}>
                {CREATIVE_STATUSES.find((s) => s.key === c.status)?.label}
              </span>
              {c.feedback && <p style={{ color: 'var(--red)', fontSize: 11.5, marginTop: 6 }}>{c.feedback}</p>}
              <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                Aprovador: {c.approver_id ? profilesById[c.approver_id]?.name : '—'}
              </p>

              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {c.status === 'rascunho' && (
                  <button className="btn ghost sm" onClick={() => submitForApproval(c)}>
                    Enviar para aprovação
                  </button>
                )}
                {c.status === 'em_aprovacao' && canReview(c) && feedbackFor !== c.id && (
                  <>
                    <button className="btn sm" onClick={() => decide(c, 'aprovado')}>
                      Aprovar
                    </button>
                    <button className="btn ghost sm" onClick={() => setFeedbackFor(c.id)}>
                      Reprovar
                    </button>
                  </>
                )}
                {feedbackFor === c.id && (
                  <div style={{ width: '100%' }}>
                    <textarea rows={2} placeholder="Motivo da reprovação" value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button className="btn ghost sm" onClick={() => setFeedbackFor(null)}>
                        Cancelar
                      </button>
                      <button className="btn sm" onClick={() => decide(c, 'reprovado')}>
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}
                {isPrivileged && (
                  <button className="btn ghost sm" onClick={() => deleteCreative(c)}>
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewCreativeModal
          campaignId={campaign.id}
          profiles={profiles}
          actorId={profile?.id ?? ''}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewCreativeModal({
  campaignId,
  profiles,
  actorId,
  onClose,
  onCreated,
}: {
  campaignId: string;
  profiles: Profile[];
  actorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [approverId, setApproverId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) {
      setError('Preencha o nome e escolha um arquivo.');
      return;
    }
    setSaving(true);
    setError(null);
    const path = `${campaignId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('campaign-creatives').upload(path, file);
    if (uploadError) {
      setSaving(false);
      setError(uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('campaign-creatives').getPublicUrl(path);
    const { error: insertError } = await supabase.from('campaign_creatives').insert({
      campaign_id: campaignId,
      name: name.trim(),
      type,
      file_path: path,
      file_url: urlData.publicUrl,
      approver_id: approverId || null,
      created_by: actorId,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Criativo enviado', detail: name, campaignId });
    onCreated();
  }

  return (
    <Modal title="Nova peça criativa" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="cr-name">Nome</label>
          <input id="cr-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="cr-type">Tipo</label>
          <select id="cr-type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="cr-file">Arquivo</label>
          <input id="cr-file" type="file" accept="image/*,video/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="form-field">
          <label htmlFor="cr-approver">Aprovador</label>
          <select id="cr-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
            <option value="">Sem aprovador definido</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
            {saving ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
