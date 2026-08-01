-- Cardoso Marketing Hub — data de conclusão do item de checklist (para prazos encadeados)
-- Roda depois de 0001..0041. Retry-safe/idempotente.
--
-- Com done_at sabemos QUANDO cada sub-etapa foi concluída. Assim o prazo da sub-etapa seguinte
-- passa a contar a partir do check da anterior (prazos encadeados), em vez de todos a partir da
-- entrada na etapa.

set lock_timeout = '5s';

alter table public.task_checklist_items
  add column if not exists done_at timestamptz;
