-- Cardoso Marketing Hub — Aprovação de mídias sociais (Fase 2 → real)
-- Roda uma vez no SQL Editor do Supabase, depois de rodar 0001 e 0002.

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  caption text not null default '',
  suggested_date date,
  media_path text not null default '',
  media_url text not null default '',
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  status text not null default 'Pendente' check (status in ('Pendente', 'Aprovado', 'Alterações solicitadas')),
  created_by uuid references public.profiles (id),
  reviewed_by uuid references public.profiles (id),
  reviewer_feedback text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.social_posts (brand_id);
create index on public.social_posts (status);

alter table public.social_posts enable row level security;
create policy "social_posts_select_authenticated" on public.social_posts
  for select to authenticated using (true);
create policy "social_posts_insert_own" on public.social_posts
  for insert to authenticated with check (auth.uid() = created_by);
create policy "social_posts_update_authenticated" on public.social_posts
  for update to authenticated using (true);
create policy "social_posts_delete_privileged" on public.social_posts
  for delete to authenticated using (public.is_privileged());

-- Storage: bucket público para leitura (mostra a peça direto na tela de aprovação),
-- upload restrito a quem estiver logado no Hub.
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

create policy "social_media_public_read" on storage.objects
  for select using (bucket_id = 'social-media');
create policy "social_media_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'social-media');
create policy "social_media_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'social-media');
