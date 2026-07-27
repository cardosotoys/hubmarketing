import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { CampaignTask, Profile } from '../../types/database';

export default function CampaignAprovacoes() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [tasks, setTasks] = useState<CampaignTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [showFeedbackFor, setShowFeedbackFor] = useState<string | null>(null);

  async function load() {
    const [tasksRes, profilesRes] = await Promise.all([
      supabase.from('campaign_tasks').select('*').eq('campaign_id', campaign.id).eq('stage', 'aguardando_aprovacao'),
      supabase.from('profiles').select('*'),
    ]);
    setTasks((tasksRes.data as CampaignTask[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';

  function canAct(t: CampaignTask) {
    return isPrivileged || (profile && t.approver_id === profile.id);
  }

  async function approve(t: CampaignTask) {
    await supabase.from('campaign_tasks').update({ stage: 'aprovada', approval_feedback: '' }).eq('id', t.id);
    if (profile) {
      await logActivity({ actorId: profile.id, actionText: 'Demanda aprovada', detail: t.title, campaignId: campaign.id, campaignTaskId: t.id });
    }
    load();
  }

  async function requestChanges(t: CampaignTask) {
    const feedback = feedbackDrafts[t.id]?.trim();
    if (!feedback) {
      setShowFeedbackFor(t.id);
      return;
    }
    await supabase.from('campaign_tasks').update({ stage: 'revisao', approval_feedback: feedback }).eq('id', t.id);
    if (profile) {
      await logActivity({ actorId: profile.id, actionText: 'Alterações solicitadas', detail: `${t.title}: ${feedback}`, campaignId: campaign.id, campaignTaskId: t.id });
    }
    setShowFeedbackFor(null);
    load();
  }

  return (
    <div>
      <div className="section-head">
        <h2>{tasks.length} aguardando aprovação</h2>
      </div>
      {tasks.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">✓</span>Nenhuma demanda aguardando aprovação nesta campanha.
        </div>
      ) : (
        <div className="grid3">
          {tasks.map((t) => (
            <div className="card" key={t.id}>
              <h4>{t.title}</h4>
              <p style={{ color: 'var(--text-faint)' }}>{t.description || 'Sem descrição'}</p>
              <p style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                Solicitante: {t.requester_id ? profilesById[t.requester_id]?.name : '—'} · Aprovador:{' '}
                {t.approver_id ? profilesById[t.approver_id]?.name : '—'}
              </p>
              {canAct(t) ? (
                showFeedbackFor === t.id ? (
                  <div>
                    <textarea
                      rows={2}
                      placeholder="O que precisa mudar?"
                      value={feedbackDrafts[t.id] ?? ''}
                      onChange={(e) => setFeedbackDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button className="btn ghost sm" onClick={() => setShowFeedbackFor(null)}>
                        Cancelar
                      </button>
                      <button className="btn sm" onClick={() => requestChanges(t)}>
                        Enviar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="btn sm" onClick={() => approve(t)}>
                      Aprovar
                    </button>
                    <button className="btn ghost sm" onClick={() => setShowFeedbackFor(t.id)}>
                      Solicitar alterações
                    </button>
                  </div>
                )
              ) : (
                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
                  Só o aprovador designado ou Diretoria/Administrador podem agir aqui.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
