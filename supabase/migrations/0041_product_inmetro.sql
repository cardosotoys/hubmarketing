-- Cardoso Marketing Hub — número do INMETRO no produto do catálogo
-- Roda depois de 0001..0040. Retry-safe/idempotente.

set lock_timeout = '5s';

alter table public.products
  add column if not exists inmetro_number text not null default '';
