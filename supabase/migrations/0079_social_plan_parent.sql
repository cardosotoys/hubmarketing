-- Cardoso Marketing Hub — Social: vínculo pai→filho para reaproveitamento.
-- A peça-mãe (ex.: Reels no Instagram) referencia seus reaproveitamentos (TikTok, Shorts,
-- Pinterest). Permite editar em cascata, excluir junto e listar "reaproveitamentos desta peça".
-- Roda depois de 0076..0078. Idempotente.

set lock_timeout = '5s';

alter table public.social_plan_items
  add column if not exists parent_item_id uuid references public.social_plan_items (id) on delete set null;

create index if not exists social_plan_items_parent_idx on public.social_plan_items (parent_item_id);
