-- Cardoso Marketing Hub — módulo "Monday" (arquivo completo do Monday.com)
-- Roda depois de 0001..0042. Retry-safe/idempotente.
--
-- Guarda TUDO que veio do Monday (quadros, itens, colunas, comentários e histórico),
-- preservando datas e autores originais. Serve de fonte da verdade para depois decidir
-- onde encaixar cada coisa na estrutura do hub. Populado pelo scripts/monday-import.mjs.

set lock_timeout = '5s';

create table if not exists public.monday_boards (
  id uuid primary key default gen_random_uuid(),
  monday_id text not null unique,
  name text not null,
  state text not null default 'active',
  groups jsonb not null default '[]',
  columns jsonb not null default '[]',
  item_count integer not null default 0,
  update_count integer not null default 0,
  activity_count integer not null default 0,
  suggested_destination text not null default '',
  imported_at timestamptz not null default now()
);

create table if not exists public.monday_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.monday_boards (id) on delete cascade,
  monday_id text not null,
  name text not null,
  group_id text not null default '',
  group_title text not null default '',
  creator_name text not null default '',
  monday_created_at timestamptz,
  column_values jsonb not null default '[]',
  subitems jsonb not null default '[]',
  position integer not null default 0
);
create index if not exists monday_items_board_id_idx on public.monday_items (board_id);

create table if not exists public.monday_updates (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.monday_items (id) on delete cascade,
  author_name text not null default '',
  body text not null default '',
  monday_created_at timestamptz
);
create index if not exists monday_updates_item_id_idx on public.monday_updates (item_id);

create table if not exists public.monday_activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.monday_boards (id) on delete cascade,
  item_id uuid references public.monday_items (id) on delete set null,
  event text not null default '',
  action_text text not null default '',
  actor_name text not null default '',
  monday_created_at timestamptz
);
create index if not exists monday_activity_board_id_idx on public.monday_activity (board_id);
create index if not exists monday_activity_item_id_idx on public.monday_activity (item_id);

-- RLS: leitura para autenticados. Escrita é feita pelo importador (service_role, que ignora RLS).
alter table public.monday_boards enable row level security;
drop policy if exists "monday_boards_select" on public.monday_boards;
create policy "monday_boards_select" on public.monday_boards for select to authenticated using (true);

alter table public.monday_items enable row level security;
drop policy if exists "monday_items_select" on public.monday_items;
create policy "monday_items_select" on public.monday_items for select to authenticated using (true);

alter table public.monday_updates enable row level security;
drop policy if exists "monday_updates_select" on public.monday_updates;
create policy "monday_updates_select" on public.monday_updates for select to authenticated using (true);

alter table public.monday_activity enable row level security;
drop policy if exists "monday_activity_select" on public.monday_activity;
create policy "monday_activity_select" on public.monday_activity for select to authenticated using (true);
