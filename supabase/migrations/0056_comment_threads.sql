-- Cardoso Marketing Hub — respostas em thread nos comentários de tarefa
-- Roda depois de 0001..0055. Retry-safe/idempotente.
--
-- Adiciona parent_id em task_comments: um comentário pode responder a outro, formando uma trilha
-- (thread) em vez de tudo empilhado. Respostas são aninhadas sob o comentário pai.

set lock_timeout = '5s';

alter table public.task_comments add column if not exists parent_id uuid references public.task_comments (id) on delete cascade;
create index if not exists task_comments_parent_idx on public.task_comments (parent_id);
