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

  // Sem embed de projects/campaigns (a FK activity_log→campaigns não existe em produção e faria a
  // query falhar). Nomes resolvidos no cliente.
  const { data } = await supabase
    .from('activity_log')
    .select('*, actor:profiles(name)')
    .or(orParts.join(','))
    .neq('actor_id', userId) // só o que os OUTROS mexeram
    .order('created_at', { ascending: false })
    .limit(limit);

  const logs = (data as (ActivityLogEntry & { actor: { name: string } | null })[] | null) ?? [];
  const pIds = [...new Set(logs.map((l) => l.project_id).filter((x): x is string => !!x))];
  const cIds = [...new Set(logs.map((l) => l.campaign_id).filter((x): x is string => !!x))];
  const [projRes, campRes] = await Promise.all([
    pIds.length ? supabase.from('projects').select('id, name').in('id', pIds) : Promise.resolve({ data: [] }),
    cIds.length ? supabase.from('campaigns').select('id, name').in('id', cIds) : Promise.resolve({ data: [] }),
  ]);
  const pMap = new Map(((projRes.data as { id: string; name: string }[] | null) ?? []).map((p) => [p.id, p.name]));
  const cMap = new Map(((campRes.data as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));

  return logs.map((l) => {
    const pName = l.project_id ? pMap.get(l.project_id) : undefined;
    const cName = l.campaign_id ? cMap.get(l.campaign_id) : undefined;
    return {
      ...l,
      project: pName ? { name: pName } : null,
      campaign: cName ? { name: cName } : null,
    };
  });
}
