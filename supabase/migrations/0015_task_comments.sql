-- Cardoso Marketing Hub — comentários com menção dentro de cada demanda
-- Roda uma vez no SQL Editor, depois de 0001..0014 já terem rodado.

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  mentioned_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.task_comments (task_id);
create index on public.task_comments using gin (mentioned_ids);

alter table public.task_comments enable row level security;
create policy "task_comments_select_authenticated" on public.task_comments
  for select to authenticated using (true);
create policy "task_comments_insert_own" on public.task_comments
  for insert to authenticated with check (auth.uid() = author_id);
