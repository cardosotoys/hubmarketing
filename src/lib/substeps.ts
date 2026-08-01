import { supabase } from './supabaseClient';
import type { StageSubstep } from '../types/database';

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Recalcula os prazos ENCADEADOS das sub-etapas de uma demanda numa etapa:
// - a 1ª sub-etapa conta a partir da entrada na etapa (created_at do item);
// - cada sub-etapa seguinte só ganha prazo quando a anterior é CONCLUÍDA (done_at),
//   contando o offset (due_offset_days) a partir dessa conclusão.
// Sub-etapa cuja anterior ainda não foi concluída fica sem prazo (null).
export async function recomputeSubstepDueDates(taskId: string, stageId: string) {
  const { data: subs } = await supabase
    .from('stage_substeps')
    .select('id, due_offset_days')
    .eq('stage_id', stageId);
  const offsetById = new Map<string, number | null>(((subs as { id: string; due_offset_days: number | null }[]) ?? []).map((s) => [s.id, s.due_offset_days]));

  const { data: items } = await supabase
    .from('task_checklist_items')
    .select('id, substep_id, position, done, done_at, due_date, created_at')
    .eq('task_id', taskId)
    .eq('stage_id', stageId)
    .not('substep_id', 'is', null)
    .order('position');
  const list = (items as { id: string; substep_id: string; position: number; done: boolean; done_at: string | null; due_date: string | null; created_at: string }[]) ?? [];
  if (list.length === 0) return;

  // data de "ativação" da sub-etapa atual (quando o relógio dela começa)
  let activation: string | null = list[0].created_at;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const offset = offsetById.get(it.substep_id);
    const newDue = activation && offset != null ? addDaysIso(activation, offset) : null;
    if ((newDue ?? null) !== (it.due_date ?? null)) {
      await supabase.from('task_checklist_items').update({ due_date: newDue }).eq('id', it.id);
    }
    // a próxima só ativa quando ESTA for concluída (usa a data da conclusão)
    activation = it.done ? it.done_at : null;
  }
}

// Quando uma demanda entra numa etapa, materializa as sub-etapas dessa etapa como itens do
// checklist da demanda (sem duplicar — usa substep_id como chave). Sub-etapa condicional vira
// item-gate (is_gate). Os prazos são definidos pelo recálculo encadeado.
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
      due_date: null as string | null,
      position: s.position,
    }));
  if (toInsert.length > 0) {
    await supabase.from('task_checklist_items').insert(toInsert);
  }
  await recomputeSubstepDueDates(taskId, stageId);
}
