-- Cardoso Marketing Hub — respostas (replies) dos comentários do Monday
-- Roda depois de 0001..0043. Retry-safe/idempotente.
--
-- Cada comentário (update) do Monday pode ter uma thread de respostas — e é nelas que estão
-- links importantes (ex.: Acrobat/Adobe). Guardamos as respostas junto do comentário.

set lock_timeout = '5s';

alter table public.monday_updates
  add column if not exists replies jsonb not null default '[]';
