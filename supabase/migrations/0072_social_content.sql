-- Cardoso Marketing Hub — Social Media: fluxo de conteúdo (planejamento → aprovação → produção →
-- aprovação da arte → mLabs → publicado → lojistas). Roda depois de 0001..0071. Idempotente.

set lock_timeout = '5s';

create table if not exists public.social_content (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  brand_id uuid references public.brands (id),
  channel text not null default '',            -- Instagram, Facebook, TikTok, YouTube...
  format text not null default '',             -- Feed, Story, Reels, Carrossel...
  scheduled_date date,
  copy text not null default '',
  stage text not null default 'planejamento'
    check (stage in ('planejamento', 'aprov_conteudo', 'producao', 'aprov_arte', 'mlabs', 'publicado', 'lojistas')),
  mlabs_url text not null default '',
  post_url text not null default '',
  drive_url text not null default '',
  position integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_content_stage_idx on public.social_content (stage);
create index if not exists social_content_date_idx on public.social_content (scheduled_date);

create table if not exists public.social_content_media (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.social_content (id) on delete cascade,
  url text not null,
  path text not null default '',
  type text not null default 'image',
  name text not null default '',
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists social_content_media_idx on public.social_content_media (content_id);

create table if not exists public.social_content_approvals (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.social_content (id) on delete cascade,
  gate text not null check (gate in ('conteudo', 'arte')),      -- 2 momentos de aprovação
  approver_id uuid not null references public.profiles (id),
  decision text not null default 'pendente' check (decision in ('pendente', 'aprovado', 'alteracao')),
  note text not null default '',
  requested_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (content_id, gate, approver_id)
);
create index if not exists social_content_approvals_idx on public.social_content_approvals (content_id, gate);
create index if not exists social_content_approvals_me on public.social_content_approvals (approver_id, decision);

create table if not exists public.social_content_comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.social_content (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists social_content_comments_idx on public.social_content_comments (content_id, created_at);

-- RLS: ferramenta interna — todos logados leem; escrita por logados; aprovação por quem é o aprovador
do $$
declare t text;
begin
  foreach t in array array['social_content','social_content_media','social_content_approvals','social_content_comments']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_insert" on public.%I;', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (true);', t, t);
    execute format('drop policy if exists "%s_update" on public.%I;', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I;', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using (public.is_privileged());', t, t);
  end loop;
end $$;

-- realtime (Kanban/aprovação atualizam ao vivo)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='social_content') then
    alter publication supabase_realtime add table public.social_content;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='social_content_approvals') then
    alter publication supabase_realtime add table public.social_content_approvals;
  end if;
end $$;
