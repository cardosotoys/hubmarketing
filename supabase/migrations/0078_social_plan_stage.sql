-- Cardoso Marketing Hub — Social: etapa de fluxo (Kanban) por peça. Roda depois de 0076/0077.
-- Idempotente. A "etapa" é a posição no fluxo de produção (independe da aprovação/ajuste).

set lock_timeout = '5s';

alter table public.social_plan_items
  add column if not exists stage text not null default 'planejamento';

alter table public.social_plan_items drop constraint if exists social_plan_items_stage_check;
alter table public.social_plan_items add constraint social_plan_items_stage_check
  check (stage in ('planejamento', 'producao', 'aprovacao', 'agendado', 'publicado'));

create index if not exists social_plan_items_stage_idx on public.social_plan_items (stage);
