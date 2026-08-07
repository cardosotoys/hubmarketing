import { supabase } from './supabaseClient';
import type { ActivityLogEntry } from '../types/database';

export type MyActivityRow = ActivityLogEntry & {
  actor: { name: string } | null;
  project: { name: string } | null;
  campaign: { name: string } | null;
};

// Movimentação feita por OUTRAS pessoas nos projetos/campanhas em que você participa (é membro,
// tem tarefa atribuída, criou o projeto, ou é dono/responsável da campanha). Mesma regra de escopo
// pessoal da Auditoria — mas aqui é o "notificável": o que os outros mexeram no que é seu.
// A movimentação global (ex.: edição de produto por terceiros) NÃO entra aqui, só na Auditoria.
export async function fetchMyActivity(userId: string, limit = 30): Promise<MyActivityRow[]> {
  const [memberProjectsRes, createdProjectsRes, myTasksRes, myCampaignTasksRes, ownedCampaignsRes] = await Promise.all([
    supabase.from('project_members').select('project_id').eq('user_id', userId),
    supabase.from('projects').select('id').eq('created_by', userId),
    supabase.from('tasks').select('project_id').eq('assignee_id', userId),
    supabase
      .from('campaign_tasks')
      .select('campaign_id')
      .or(`assignee_id.eq.${userId},reviewer_id.eq.${userId},approver_id.eq.${userId},requester_id.eq.${userId}`),
    supabase.from('campaigns').select('id').eq('owner_id', userId),
  ]);

  const projectIds = new Set<string>();
  (memberProjectsRes.data as { project_id: string }[] | null)?.forEach((r) => projectIds.add(r.project_id));
  (createdProjectsRes.data as { id: string }[] | null)?.forEach((r) => projectIds.add(r.id));
  (myTasksRes.data as { project_id: string | null }[] | null)?.forEach((r) => r.project_id && projectIds.add(r.project_id));

  const campaignIds = new Set<string>();
  (myCampaignTasksRes.data as { campaign_id: string }[] | null)?.forEach((r) => campaignIds.add(r.campaign_id));
  (ownedCampaignsRes.data as { id: string }[] | null)?.forEach((r) => campaignIds.add(r.id));

  const orParts: string[] = [];
  if (projectIds.size > 0) orParts.push(`project_id.in.(${[...projectIds].join(',')})`);
  if (campaignIds.size > 0) orParts.push(`campaign_id.in.(${[...campaignIds].join(',')})`);
  if (orParts.length === 0) return []; // não participa de nada ainda → nada de terceiros pra mostrar

  const { data } = await supabase
    .from('activity_log')
    .select('*, actor:profiles(name), project:projects(name), campaign:campaigns(name)')
    .or(orParts.join(','))
    .neq('actor_id', userId) // só o que os OUTROS mexeram
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data as MyActivityRow[] | null) ?? [];
}
