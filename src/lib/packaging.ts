import { supabase } from './supabaseClient';
import { logActivity } from './activityLog';
import { PACKAGING_TRACK_STAGES, type PackagingTrack, type Priority } from '../types/database';

// Cria um "projeto de embalagem" (project com kind='embalagem') já com as etapas-padrão da trilha
// pré-carregadas (editáveis depois), o autor como membro e, opcionalmente, o vínculo (espelho) com
// um item de Design de Produto. Retorna o id do projeto criado, ou null em caso de erro.
export async function createPackagingProject(params: {
  name: string;
  brandId: string;
  track: PackagingTrack;
  priority: Priority;
  actorId: string;
  productDevItemId?: string | null;
  startDate?: string | null;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      brand_id: params.brandId,
      name: params.name.trim(),
      sub: params.track === 'criacao' ? 'Criação de embalagem' : 'Melhoria de embalagem',
      status: 'active',
      priority: params.priority,
      category: 'Embalagens',
      kind: 'embalagem',
      packaging_track: params.track,
      product_dev_item_id: params.productDevItemId ?? null,
      start_date: params.startDate ?? null,
      created_by: params.actorId,
    })
    .select()
    .single();
  if (error || !data) return null;

  await supabase.from('project_members').insert({ project_id: data.id, user_id: params.actorId, role_label: '' });

  const stages = PACKAGING_TRACK_STAGES[params.track].map((s, i) => ({
    project_id: data.id,
    name: s.name,
    position: i + 1,
    is_final: s.is_final,
  }));
  await supabase.from('stages').insert(stages);

  await logActivity({ actorId: params.actorId, actionText: 'Projeto de embalagem criado', detail: params.name, projectId: data.id });
  return data.id;
}
