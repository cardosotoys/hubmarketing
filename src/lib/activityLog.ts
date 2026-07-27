import { supabase } from './supabaseClient';

export async function logActivity(params: {
  actorId: string;
  actionText: string;
  detail?: string;
  projectId?: string;
  campaignId?: string;
  campaignTaskId?: string;
  taskId?: string;
}) {
  const { error } = await supabase.from('activity_log').insert({
    actor_id: params.actorId,
    action_text: params.actionText,
    detail: params.detail ?? '',
    project_id: params.projectId ?? null,
    campaign_id: params.campaignId ?? null,
    campaign_task_id: params.campaignTaskId ?? null,
    task_id: params.taskId ?? null,
  });
  if (error) {
    console.error('Falha ao registrar atividade no histórico:', error.message);
  }
}
