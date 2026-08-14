-- Cardoso Marketing Hub — regra geral de comentários: editar pelo autor + curtir (👍).
-- Vale para Demandas (task_comments) e Social (social_plan_comments). Roda depois de 0001..0080.
-- Idempotente / retry-safe.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Edição pelo autor
-- ---------------------------------------------------------------------------
-- task_comments: não tinha policy de UPDATE (ninguém editava). Agrega edited_at + policy.
alter table public.task_comments add column if not exists edited_at timestamptz;
drop policy if exists "task_comments_update_own" on public.task_comments;
create policy "task_comments_update_own" on public.task_comments
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- social_plan_comments: já permite update do autor (0076). Só agrega edited_at.
alter table public.social_plan_comments add column if not exists edited_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) Curtidas (genérica p/ qualquer comentário do hub)
-- ---------------------------------------------------------------------------
create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- 'task' | 'social_plan' | (futuros)
  comment_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null default '👍',
  created_at timestamptz not null default now(),
  unique (source, comment_id, user_id, emoji)
);
create index if not exists comment_reactions_lookup_idx on public.comment_reactions (source, comment_id);

alter table public.comment_reactions enable row level security;
drop policy if exists "cr_select" on public.comment_reactions;
create policy "cr_select" on public.comment_reactions for select to authenticated using (true);
drop policy if exists "cr_insert_own" on public.comment_reactions;
create policy "cr_insert_own" on public.comment_reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "cr_delete_own" on public.comment_reactions;
create policy "cr_delete_own" on public.comment_reactions for delete to authenticated using (user_id = auth.uid());

-- realtime: curtida aparece/some sozinha
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comment_reactions') then
    alter publication supabase_realtime add table public.comment_reactions;
  end if;
end $$;
