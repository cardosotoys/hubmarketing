-- Cardoso Marketing Hub — Market Price Monitor (MPM), v1
-- Escopo v1 (decidido com o time): só Supabase (Edge Function + pg_cron, sem servidor novo),
-- só Mercado Livre (API pública oficial, sem Playwright), zero IA (anúncio duvidoso vai pra
-- revisão manual em vez de chamada de IA). Arquitetura preparada pra adicionar marketplaces
-- e reativar IA no futuro sem reescrever nada.
-- Roda uma vez no SQL Editor, depois de 0001..0018 já terem rodado.

-- Produto ganha EAN e imagem oficial (atributos de catálogo, não só de monitoramento).
alter table public.products add column ean text not null default '';
alter table public.products add column image_url text not null default '';

-- Configuração de monitoramento de um produto (1:1 com products).
create table public.mpm_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  min_price numeric(12, 2) not null,
  suggested_price numeric(12, 2),
  keywords text[] not null default '{}',
  synonyms text[] not null default '{}',
  monitoring_status text not null default 'active' check (monitoring_status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um anúncio único (por marketplace + id externo) — estado atual, atualizado a cada checagem.
create table public.mpm_listings (
  id uuid primary key default gen_random_uuid(),
  mpm_product_id uuid not null references public.mpm_products (id) on delete cascade,
  marketplace text not null
    check (marketplace in ('mercado_livre', 'amazon', 'shopee', 'google_shopping', 'google_search')),
  external_id text not null,
  store_name text not null default '',
  title text not null default '',
  url text not null default '',
  image_url text not null default '',
  shipping_price numeric(12, 2),
  installment_info text not null default '',
  current_price numeric(12, 2) not null,
  match_status text not null default 'needs_review'
    check (match_status in ('high_confidence', 'needs_review', 'confirmed_match', 'rejected')),
  match_score integer not null default 0,
  is_violation boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (marketplace, external_id)
);
create index on public.mpm_listings (mpm_product_id);
create index on public.mpm_listings (is_violation);
create index on public.mpm_listings (match_status);

-- Histórico de preço — nunca apaga, uma linha por checagem.
create table public.mpm_price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mpm_listings (id) on delete cascade,
  price numeric(12, 2) not null,
  min_price_at_check numeric(12, 2) not null,
  is_violation boolean not null default false,
  diff_amount numeric(12, 2),
  diff_percent numeric(6, 2),
  collected_at timestamptz not null default now()
);
create index on public.mpm_price_history (listing_id, collected_at desc);

-- Um alerta por violação em aberto (evita duplicar alerta pro mesmo anúncio enquanto não resolvido).
create table public.mpm_alerts (
  id uuid primary key default gen_random_uuid(),
  mpm_product_id uuid not null references public.mpm_products (id) on delete cascade,
  listing_id uuid not null references public.mpm_listings (id) on delete cascade,
  price numeric(12, 2) not null,
  min_price numeric(12, 2) not null,
  diff_amount numeric(12, 2) not null,
  diff_percent numeric(6, 2) not null,
  status text not null default 'new' check (status in ('new', 'acknowledged', 'resolved')),
  notified_internal boolean not null default true,
  notified_email boolean not null default false,
  notified_webhook boolean not null default false,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  resolved_note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.mpm_alerts (status);
create index on public.mpm_alerts (listing_id);

-- Log de cada execução do robô de busca (alimenta o card "Última sincronização").
create table public.mpm_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  products_checked integer not null default 0,
  listings_found integer not null default 0,
  violations_found integer not null default 0,
  error_message text not null default ''
);
create index on public.mpm_sync_runs (started_at desc);

-- Configuração única do módulo (intervalo de busca, canais de alerta).
create table public.mpm_settings (
  id boolean primary key default true check (id),
  search_interval_hours integer not null default 24,
  sources text[] not null default array['mercado_livre'],
  alert_email text not null default '',
  alert_webhook_url text not null default '',
  whatsapp_number text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
insert into public.mpm_settings (id) values (true);

alter table public.mpm_products enable row level security;
alter table public.mpm_listings enable row level security;
alter table public.mpm_price_history enable row level security;
alter table public.mpm_alerts enable row level security;
alter table public.mpm_sync_runs enable row level security;
alter table public.mpm_settings enable row level security;

create policy "mpm_products_select" on public.mpm_products for select to authenticated using (true);
create policy "mpm_products_insert" on public.mpm_products for insert to authenticated with check (true);
create policy "mpm_products_update" on public.mpm_products for update to authenticated using (true);
create policy "mpm_products_delete" on public.mpm_products for delete to authenticated using (public.is_privileged());

create policy "mpm_listings_select" on public.mpm_listings for select to authenticated using (true);
create policy "mpm_listings_update" on public.mpm_listings for update to authenticated using (true);
create policy "mpm_listings_delete" on public.mpm_listings for delete to authenticated using (public.is_privileged());

create policy "mpm_price_history_select" on public.mpm_price_history for select to authenticated using (true);

create policy "mpm_alerts_select" on public.mpm_alerts for select to authenticated using (true);
create policy "mpm_alerts_update" on public.mpm_alerts for update to authenticated using (true);

create policy "mpm_sync_runs_select" on public.mpm_sync_runs for select to authenticated using (true);

create policy "mpm_settings_select" on public.mpm_settings for select to authenticated using (true);
create policy "mpm_settings_update" on public.mpm_settings for update to authenticated using (true);
