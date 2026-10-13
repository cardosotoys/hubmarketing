import { supabase } from '../../lib/supabaseClient';
import type { SocialPlanItem } from '../../types/database';
import { ownGate1, ownGate2 } from './shared';

/* Decisões das etapas e do agendamento. A decisão sempre vai para a peça que é dona dela:
 * quem reaproveita decide na matriz; a etapa 2 de quem adapta sem mudar o criativo também. */

export type Decision = 'aprovada' | 'ajuste' | 'pendente';

export function gateOwner(x: SocialPlanItem, gate: 1 | 2, matriz: SocialPlanItem | undefined) {
  const own = gate === 1 ? ownGate1(x) : ownGate2(x);
  return own ? x : matriz ?? x;
}

export async function decide(owner: SocialPlanItem, gate: 1 | 2, d: Decision, meId: string | null, note?: string) {
  const now = new Date().toISOString();
  const patch = gate === 1
    ? { status: d, status_by: meId, status_at: now, ...(d !== 'pendente' ? { awaiting_review: false } : {}) }
    : { creative_status: d, creative_by: meId, creative_at: now };
  const { error } = await supabase.from('social_plan_items').update(patch).eq('id', owner.id);
  if (error) throw new Error(error.message);
  if (d === 'ajuste' && meId) {
    // o pedido vira comentário na peça; quem editou por último é avisado no sininho
    const quem = owner.updated_by && owner.updated_by !== meId ? [owner.updated_by] : [];
    await supabase.from('social_plan_comments').insert({
      item_id: owner.id, author_id: meId, kind: 'adjust', mentioned_ids: quem,
      body: `[${gate === 1 ? 'Etapa 1 · legenda' : 'Etapa 2 · criativo'}] ${note?.trim() || 'Pediu ajuste nesta peça.'}`,
    });
  }
}

export async function setStage(x: SocialPlanItem, stage: SocialPlanItem['stage'], meId: string | null) {
  const { error } = await supabase.from('social_plan_items')
    .update({ stage, stage_by: meId, stage_at: new Date().toISOString() }).eq('id', x.id);
  if (error) throw new Error(error.message);
}
