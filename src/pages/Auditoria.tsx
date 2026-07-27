import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { ActivityLogEntry } from '../types/database';

type Row = ActivityLogEntry & {
  actor: { name: string } | null;
  project: { name: string } | null;
  campaign: { name: string } | null;
};

export default function Auditoria() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';

  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;
    setLoading(true);

    async function load() {
      const baseQuery = supabase
        .from('activity_log')
        .select('*, actor:profiles(name), project:projects(name), campaign:campaigns(name)')
        .order('created_at', { ascending: false })
        .limit(300);

      if (isPrivileged) {
        const { data } = await baseQuery;
        setRows((data as Row[]) ?? []);
        setLoading(false);
        return;
      }

      // Escopo pessoal: tudo que a pessoa fez, mais tudo em projetos/campanhas onde ela participa.
      const [memberProjectsRes, myTasksRes, myCampaignTasksRes, ownedCampaignsRes] = await Promise.all([
        supabase.from('project_members').select('project_id').eq('user_id', userId),
        supabase.from('tasks').select('project_id').eq('assignee_id', userId),
        supabase
          .from('campaign_tasks')
          .select('campaign_id')
          .or(`assignee_id.eq.${userId},reviewer_id.eq.${userId},approver_id.eq.${userId},requester_id.eq.${userId}`),
        supabase.from('campaigns').select('id').eq('owner_id', userId),
      ]);

      const projectIds = new Set<string>();
      (memberProjectsRes.data as { project_id: string }[] | null)?.forEach((r) => projectIds.add(r.project_id));
      (myTasksRes.data as { project_id: string | null }[] | null)?.forEach((r) => r.project_id && projectIds.add(r.project_id));

      const campaignIds = new Set<string>();
      (myCampaignTasksRes.data as { campaign_id: string }[] | null)?.forEach((r) => campaignIds.add(r.campaign_id));
      (ownedCampaignsRes.data as { id: string }[] | null)?.forEach((r) => campaignIds.add(r.id));

      const orParts = [`actor_id.eq.${userId}`];
      if (projectIds.size > 0) orParts.push(`project_id.in.(${[...projectIds].join(',')})`);
      if (campaignIds.size > 0) orParts.push(`campaign_id.in.(${[...campaignIds].join(',')})`);

      const { data } = await baseQuery.or(orParts.join(','));
      setRows((data as Row[]) ?? []);
      setLoading(false);
    }

    load();
  }, [profile, isPrivileged]);

  return (
    <div className="page">
      <h1 className="page-title">Auditoria</h1>
      <div className="page-sub">
        {isPrivileged
          ? 'Quem, quando e o que foi alterado — visão completa de todo o time.'
          : 'Tudo o que você fez, e tudo o que aconteceu em projetos e campanhas nos quais você participa.'}
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <table className="simple">
          <thead>
            <tr>
              <th>Ação</th>
              <th>Usuário</th>
              <th>Projeto/Campanha</th>
              <th>Quando</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.action_text}</td>
                <td>{r.actor?.name ?? 'Sistema'}</td>
                <td>{r.project?.name ?? r.campaign?.name ?? '—'}</td>
                <td className="mono">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                <td>{r.detail || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-faint)' }}>
                  Nenhuma atividade registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
