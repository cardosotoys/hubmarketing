-- Cardoso Marketing Hub — Módulo Trade Marketing Intelligence (schema)
-- Roda depois de 0001..0066. Retry-safe/idempotente.
--
-- Modelo adaptado à REALIDADE dos dados (grade semanal de visitas dos promotores): temos promotor,
-- data, loja e rede (inferida). Campos que ainda NÃO existem nos dados (check-in/out, duração, GPS,
-- endereço/cidade/estado/região, prioridade, frequência planejada, execução) ficam preparados e
-- nulos, para preencher quando a coleta evoluir — nunca inventados.

set lock_timeout = '5s';

create table if not exists public.tm_networks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tm_promoters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  supervisor_id uuid references public.profiles (id),
  region text,
  status text not null default 'ativo',
  created_at timestamptz not null default now()
);

create table if not exists public.tm_stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  network_id uuid references public.tm_networks (id),
  address text, city text, state text, region text,
  latitude numeric, longitude numeric,
  priority text,                         -- alta/média/baixa (não existe nos dados atuais)
  planned_frequency_days int,            -- frequência planejada (não existe nos dados atuais)
  status text not null default 'ativa',
  created_at timestamptz not null default now()
);
create index if not exists tm_stores_network_idx on public.tm_stores (network_id);

-- mapeia cada nome bruto da planilha para a loja canônica (rastreabilidade + dedup revisável)
create table if not exists public.tm_store_aliases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.tm_stores (id) on delete cascade,
  raw_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tm_visits (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid references public.tm_promoters (id),
  store_id uuid references public.tm_stores (id),
  visit_date date not null,
  weekday text,
  status text,                           -- futuro
  check_in time, check_out time, duration_min int, -- futuro
  latitude numeric, longitude numeric,   -- futuro
  notes text,
  source text not null default 'spreadsheet_import',
  source_file text,
  raw_store_name text,
  created_at timestamptz not null default now()
);
create index if not exists tm_visits_date_idx on public.tm_visits (visit_date);
create index if not exists tm_visits_store_idx on public.tm_visits (store_id, visit_date);
create index if not exists tm_visits_promoter_idx on public.tm_visits (promoter_id, visit_date);
-- evita duplicar a mesma visita (mesmo promotor, loja e dia) em reimportações
create unique index if not exists tm_visits_dedup_idx on public.tm_visits (promoter_id, store_id, visit_date);

create table if not exists public.tm_raw_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  sheet text,
  imported_at timestamptz not null default now(),
  rows_total int, rows_loaded int, rows_skipped int, rows_duplicated int,
  notes text
);

create table if not exists public.tm_settings (
  id int primary key default 1,
  score_weights jsonb not null default '{"cobertura":50,"frequencia":30,"volume":20}'::jsonb,
  default_frequency_days int,
  updated_at timestamptz not null default now()
);
insert into public.tm_settings (id) values (1) on conflict (id) do nothing;

-- RLS: ferramenta interna — todos os logados leem; só privilegiado escreve (config em fase futura)
do $$
declare t text;
begin
  foreach t in array array['tm_networks','tm_promoters','tm_stores','tm_store_aliases','tm_visits','tm_raw_imports','tm_settings']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.is_privileged()) with check (public.is_privileged());', t, t);
  end loop;
end $$;
