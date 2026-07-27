import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { useAuth } from '../../context/AuthContext';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { SocialPost } from '../../types/database';

const STATUS_COLOR: Record<string, string> = {
  Pendente: 'var(--yellow)',
  Aprovado: 'var(--green)',
  'Alterações solicitadas': 'var(--red)',
};

export default function CampaignSocial() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [unlinked, setUnlinked] = useState<SocialPost[]>([]);
  const [pick, setPick] = useState('');

  async function load() {
    const [linkedRes, unlinkedRes] = await Promise.all([
      supabase.from('social_posts').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false }),
      supabase.from('social_posts').select('*').eq('brand_id', campaign.brand_id).is('campaign_id', null),
    ]);
    setPosts((linkedRes.data as SocialPost[]) ?? []);
    setUnlinked((unlinkedRes.data as SocialPost[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  async function link(postId: string) {
    await supabase.from('social_posts').update({ campaign_id: campaign.id }).eq('id', postId);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Post de redes sociais vinculado à campanha', campaignId: campaign.id });
    setPick('');
    load();
  }

  async function unlink(postId: string) {
    await supabase.from('social_posts').update({ campaign_id: null }).eq('id', postId);
    load();
  }

  return (
    <div>
      <div className="section-head">
        <h2>{posts.length} peças de redes sociais</h2>
        <Link to="/redes-sociais" className="btn ghost sm">
          Enviar nova peça em Redes Sociais →
        </Link>
      </div>

      <div className="banner soon">
        <span className="ic">◐</span>
        <span>
          O upload e a aprovação de peças continuam em Redes Sociais (global) — aqui você só vincula quais posts
          pertencem a esta campanha, sem duplicar dado.
        </span>
      </div>

      {posts.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum post vinculado a esta campanha ainda.
        </div>
      ) : (
        <div className="grid3">
          {posts.map((p) => (
            <div className="card" key={p.id}>
              {p.media_type === 'video' ? (
                <video src={p.media_url} controls style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
              ) : (
                <img src={p.media_url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8, maxHeight: 160, objectFit: 'cover' }} />
              )}
              <p>{p.caption || '(sem legenda)'}</p>
              <span className="tag" style={{ background: 'var(--surface-2)', color: STATUS_COLOR[p.status] }}>
                {p.status}
              </span>
              <div style={{ marginTop: 8 }}>
                <button className="btn ghost sm" onClick={() => unlink(p.id)}>
                  Desvincular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unlinked.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h4>Vincular post existente desta marca</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
              <option value="">Escolher post…</option>
              {unlinked.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.caption ? p.caption.slice(0, 40) : `(sem legenda) ${p.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <button className="btn sm" disabled={!pick} onClick={() => link(pick)}>
              Vincular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
