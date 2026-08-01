-- Cardoso Marketing Hub — meta (data-alvo) e data de entrega na demanda
-- Roda depois de 0001..0039. Retry-safe/idempotente.
--
-- target_date  = META: data-alvo que guia a jornada (diferente do prazo final = due_date).
-- completed_at = quando a demanda entrou numa etapa final (entregue) — usado no calendário para
--                distinguir "entregue antes/no prazo" de "atrasada".

set lock_timeout = '5s';

alter table public.tasks
  add column if not exists target_date date,
  add column if not exists completed_at timestamptz;
