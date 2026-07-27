-- Cardoso Marketing Hub — schema inicial (Fase 1)
-- Roda uma vez no SQL Editor do projeto Supabase (ou via `supabase db push`).

create extension if not exists pgcrypto;

-- ============================================================
-- Tabelas
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Sem nome',
  role text not null default 'equipe' check (role in ('diretoria', 'equipe', 'administrador')),
  job_title text not null default '',
  avatar_initials text not null default '??',
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  color text not null
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  name text not null,
  sub text not null default '',
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'done')),
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  category text not null default '',
  start_date date,
  end_date date,
  ref text not null default '',
  objective text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_label text not null default '',
  unique (project_id, user_id)
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage text not null default 'recebido'
    check (stage in ('recebido', 'planejamento', 'producao', 'revisao', 'aprovacao', 'finalizado')),
  title text not null,
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  assignee_id uuid references public.profiles (id),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  url text not null,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  actor_id uuid references public.profiles (id),
  action_text text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  project_id uuid references public.projects (id),
  summary text not null,
  report_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index on public.project_members (project_id);
create index on public.checklist_items (project_id);
create index on public.comments (project_id);
create index on public.tasks (project_id);
create index on public.project_files (project_id);
create index on public.activity_log (project_id);
create index on public.activity_log (created_at desc);
create index on public.daily_reports (user_id);
create index on public.daily_reports (report_date desc);

-- ============================================================
-- Novo usuário do Supabase Auth ganha uma linha em profiles
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'name', new.email), 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Helper de permissão (evita recursão de RLS ao checar o papel)
-- ============================================================

create function public.is_privileged()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('diretoria', 'administrador')
  );
$$;

-- Impede que um usuário sem privilégio mude o próprio papel via update de profiles.
-- Edições feitas direto pelo painel do Supabase (Table Editor / SQL Editor) rodam sem
-- auth.uid() (não passam pelo PostgREST autenticado) e já exigem acesso de dono do
-- projeto, então ficam de fora dessa checagem.
create function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.role is distinct from old.role
     and not public.is_privileged() then
    raise exception 'Apenas Diretoria/Administrador podem alterar papéis de usuário.';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.prevent_role_self_change();

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.tasks enable row level security;
alter table public.project_files enable row level security;
alter table public.activity_log enable row level security;
alter table public.daily_reports enable row level security;

-- profiles: qualquer pessoa logada vê o time todo; cada um edita a própria linha,
-- diretoria/admin editam qualquer linha (papel protegido pelo trigger acima).
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own_or_privileged" on public.profiles
  for update to authenticated using (auth.uid() = id or public.is_privileged());

-- brands: leitura para todos autenticados; gestão só para privilegiados.
create policy "brands_select_authenticated" on public.brands
  for select to authenticated using (true);
create policy "brands_write_privileged" on public.brands
  for all to authenticated using (public.is_privileged()) with check (public.is_privileged());

-- projects: qualquer pessoa do time lê e cria/edita; exclusão só privilegiados.
create policy "projects_select_authenticated" on public.projects
  for select to authenticated using (true);
create policy "projects_insert_authenticated" on public.projects
  for insert to authenticated with check (true);
create policy "projects_update_authenticated" on public.projects
  for update to authenticated using (true);
create policy "projects_delete_privileged" on public.projects
  for delete to authenticated using (public.is_privileged());

-- project_members
create policy "project_members_select_authenticated" on public.project_members
  for select to authenticated using (true);
create policy "project_members_write_authenticated" on public.project_members
  for insert to authenticated with check (true);
create policy "project_members_delete_authenticated" on public.project_members
  for delete to authenticated using (true);

-- checklist_items
create policy "checklist_select_authenticated" on public.checklist_items
  for select to authenticated using (true);
create policy "checklist_write_authenticated" on public.checklist_items
  for insert to authenticated with check (true);
create policy "checklist_update_authenticated" on public.checklist_items
  for update to authenticated using (true);
create policy "checklist_delete_authenticated" on public.checklist_items
  for delete to authenticated using (true);

-- comments: qualquer autenticado lê; só posta em nome de si mesmo.
create policy "comments_select_authenticated" on public.comments
  for select to authenticated using (true);
create policy "comments_insert_own" on public.comments
  for insert to authenticated with check (auth.uid() = author_id);

-- tasks (demandas / kanban)
create policy "tasks_select_authenticated" on public.tasks
  for select to authenticated using (true);
create policy "tasks_write_authenticated" on public.tasks
  for insert to authenticated with check (true);
create policy "tasks_update_authenticated" on public.tasks
  for update to authenticated using (true);
create policy "tasks_delete_authenticated" on public.tasks
  for delete to authenticated using (true);

-- project_files (links do Drive)
create policy "project_files_select_authenticated" on public.project_files
  for select to authenticated using (true);
create policy "project_files_insert_own" on public.project_files
  for insert to authenticated with check (auth.uid() = added_by);
create policy "project_files_delete_authenticated" on public.project_files
  for delete to authenticated using (true);

-- activity_log: log imutável — todos leem, cada ação é gravada em nome de quem a fez,
-- sem policy de update/delete (ninguém apaga histórico pelo app).
create policy "activity_log_select_authenticated" on public.activity_log
  for select to authenticated using (true);
create policy "activity_log_insert_own" on public.activity_log
  for insert to authenticated with check (auth.uid() = actor_id);

-- daily_reports: todos leem (alimenta relatórios de equipe); cada um só registra o próprio.
create policy "daily_reports_select_authenticated" on public.daily_reports
  for select to authenticated using (true);
create policy "daily_reports_insert_own" on public.daily_reports
  for insert to authenticated with check (auth.uid() = user_id);

-- ============================================================
-- Seed
-- ============================================================

insert into public.brands (key, label, color) values
  ('cardoso', 'Cardoso', '#E15241'),
  ('playmi', 'Playmi', '#00B3C6'),
  ('topi', 'Tópi', '#EA5C18');
