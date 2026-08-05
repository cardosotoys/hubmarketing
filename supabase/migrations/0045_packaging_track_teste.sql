-- Cardoso Marketing Hub — trilhas de teste no módulo Embalagens
-- Roda depois de 0001..0044. Retry-safe/idempotente.
--
-- Libera os valores 'criacao_teste' e 'melhoria_teste' em tasks.packaging_track e
-- stages.packaging_track, pro módulo isolado "Embalagens (Teste)".

set lock_timeout = '5s';

alter table public.tasks drop constraint if exists tasks_packaging_track_check;
alter table public.tasks
  add constraint tasks_packaging_track_check
  check (packaging_track in ('criacao', 'melhoria', 'criacao_teste', 'melhoria_teste'));

alter table public.stages drop constraint if exists stages_packaging_track_check;
alter table public.stages
  add constraint stages_packaging_track_check
  check (packaging_track in ('criacao', 'melhoria', 'criacao_teste', 'melhoria_teste'));
