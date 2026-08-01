import { supabase } from './supabaseClient';
import type { StageSubstep } from '../types/database';

function isoDatePlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Quando uma demanda entra numa etapa, materializa as sub-etapas dessa etapa como itens do
// checklist da demanda (sem duplicar — usa substep_id como chave). Sub-etapa condicional vira
// item-gate (is_gate), reaproveitando o limitador de avanço. Prazo relativo vira due_date.
export async function materializeSubsteps(taskId: string, stageId: string) {
  const { data: subs } = await supabase
    .from('stage_substeps')
    .select('*')
    .eq('stage_id', stageId)
    .order('position');
  const substeps = (subs as StageSubstep[]) ?? [];
  if (substeps.length === 0) return;

  const { data: existing } = await supabase
    .from('task_checklist_items')
    .select('substep_id')
    .eq('task_id', taskId)
    .not('substep_id', 'is', null);
  const have = new Set((existing ?? []).map((e) => (e as { substep_id: string }).substep_id));

  const toInsert = substeps
    .filter((s) => !have.has(s.id))
    .map((s) => ({
      task_id: taskId,
      label: s.label,
      is_gate: s.is_conditional,
      stage_id: stageId,
      substep_id: s.id,
      due_date: s.due_offset_days != null ? isoDatePlus(s.due_offset_days) : null,
      position: s.position,
    }));
  if (toInsert.length > 0) {
    await supabase.from('task_checklist_items').insert(toInsert);
  }
}
