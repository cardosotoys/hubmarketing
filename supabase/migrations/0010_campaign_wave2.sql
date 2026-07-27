-- Cardoso Marketing Hub — Campaign Workspace, leva 2 (conteúdo, canais e comercial)
-- Roda uma vez no SQL Editor, depois de 0001..0009 já terem rodado.
--
-- Cobre os módulos da campanha que ainda eram só "em breve": Criativos, Conteúdos,
-- Calendário Editorial, Social Media (agora ligado à campanha), Influenciadores,
-- Trade Marketing, Marketplace, CRM e Mídia Paga. Todos com registro manual —
-- nenhuma integração de API de terceiros nesta leva, como combinado.

-- ============================================================
-- Criativos (peças com versão e aprovação)
-- ============================================================

create table public.campaign_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  type text not null default 'outro',
  file_path text not null default '',
  file_url text not null default '',
  version integer not null default 1,
  status text not null default 'rascunho' check (status in ('rascunho', 'em_aprovacao', 'aprovado', 'reprovado')),
  approver_id uuid references public.profiles (id),
  feedback text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_creatives (campaign_id);

insert into storage.buckets (id, name, public)
values ('campaign-creatives', 'campaign-creatives', true)
on conflict (id) do nothing;

create policy "campaign_creatives_public_read" on storage.objects
  for select using (bucket_id = 'campaign-creatives');
create policy "campaign_creatives_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'campaign-creatives');
create policy "campaign_creatives_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'campaign-creatives');

-- ============================================================
-- Conteúdos + Calendário Editorial (mesma tabela, duas visualizações)
-- ============================================================

create table public.campaign_contents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null,
  content_type text not null default 'post'
    check (content_type in ('post', 'video', 'story', 'reel', 'short', 'banner', 'catalogo')),
  scheduled_date date,
  status text not null default 'planejado' check (status in ('planejado', 'em_producao', 'agendado', 'publicado')),
  social_post_id uuid references public.social_posts (id) on delete set null,
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_contents (campaign_id);
create index on public.campaign_contents (scheduled_date);

-- ============================================================
-- Social Media agora liga direto na campanha (sem duplicar social_posts)
-- ============================================================

alter table public.social_posts add column campaign_id uuid references public.campaigns (id) on delete set null;
create index on public.social_posts (campaign_id);

-- ============================================================
-- Influenciadores
-- ============================================================

create table public.campaign_influencers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  handle text not null default '',
  platform text not null default '',
  deliverables text not null default '',
  fee numeric(12, 2) not null default 0,
  status text not null default 'contato'
    check (status in ('contato', 'negociacao', 'confirmado', 'entregue', 'cancelado')),
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_influencers (campaign_id);

-- ============================================================
-- Trade Marketing (registro manual)
-- ============================================================

create table public.campaign_trade_actions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  description text not null,
  channel text not null default '',
  status text not null default 'planejada' check (status in ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  start_date date,
  end_date date,
  responsible_id uuid references public.profiles (id),
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_trade_actions (campaign_id);

-- ============================================================
-- Marketplace (registro manual, ligado a produto real quando fizer sentido)
-- ============================================================

create table public.campaign_marketplace_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  marketplace text not null default '',
  product_id uuid references public.products (id),
  url text not null default '',
  status text not null default 'planejado' check (status in ('planejado', 'publicado', 'pausado')),
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_marketplace_entries (campaign_id);

-- ============================================================
-- CRM (pipeline manual de leads/oportunidades)
-- ============================================================

create table public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  company text not null default '',
  contact text not null default '',
  source text not null default '',
  stage text not null default 'novo' check (stage in ('novo', 'qualificado', 'proposta', 'fechado', 'perdido')),
  value numeric(12, 2) not null default 0,
  responsible_id uuid references public.profiles (id),
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_leads (campaign_id);

-- ============================================================
-- Mídia Paga (registro manual — alimenta o card de Performance do Resumo)
-- ============================================================

create table public.campaign_media_investments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  channel text not null default '',
  planned_amount numeric(12, 2) not null default 0,
  spent_amount numeric(12, 2) not null default 0,
  revenue numeric(12, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions integer not null default 0,
  period_start date,
  period_end date,
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_media_investments (campaign_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.campaign_creatives enable row level security;
create policy "campaign_creatives_select_authenticated" on public.campaign_creatives for select to authenticated using (true);
create policy "campaign_creatives_insert_authenticated" on public.campaign_creatives for insert to authenticated with check (true);
create policy "campaign_creatives_update_authenticated" on public.campaign_creatives for update to authenticated using (true);
create policy "campaign_creatives_delete_privileged" on public.campaign_creatives for delete to authenticated using (public.is_privileged());

alter table public.campaign_contents enable row level security;
create policy "campaign_contents_select_authenticated" on public.campaign_contents for select to authenticated using (true);
create policy "campaign_contents_insert_authenticated" on public.campaign_contents for insert to authenticated with check (true);
create policy "campaign_contents_update_authenticated" on public.campaign_contents for update to authenticated using (true);
create policy "campaign_contents_delete_privileged" on public.campaign_contents for delete to authenticated using (public.is_privileged());

alter table public.campaign_influencers enable row level security;
create policy "campaign_influencers_select_authenticated" on public.campaign_influencers for select to authenticated using (true);
create policy "campaign_influencers_insert_authenticated" on public.campaign_influencers for insert to authenticated with check (true);
create policy "campaign_influencers_update_authenticated" on public.campaign_influencers for update to authenticated using (true);
create policy "campaign_influencers_delete_privileged" on public.campaign_influencers for delete to authenticated using (public.is_privileged());

alter table public.campaign_trade_actions enable row level security;
create policy "campaign_trade_select_authenticated" on public.campaign_trade_actions for select to authenticated using (true);
create policy "campaign_trade_insert_authenticated" on public.campaign_trade_actions for insert to authenticated with check (true);
create policy "campaign_trade_update_authenticated" on public.campaign_trade_actions for update to authenticated using (true);
create policy "campaign_trade_delete_privileged" on public.campaign_trade_actions for delete to authenticated using (public.is_privileged());

alter table public.campaign_marketplace_entries enable row level security;
create policy "campaign_marketplace_select_authenticated" on public.campaign_marketplace_entries for select to authenticated using (true);
create policy "campaign_marketplace_insert_authenticated" on public.campaign_marketplace_entries for insert to authenticated with check (true);
create policy "campaign_marketplace_update_authenticated" on public.campaign_marketplace_entries for update to authenticated using (true);
create policy "campaign_marketplace_delete_privileged" on public.campaign_marketplace_entries for delete to authenticated using (public.is_privileged());

alter table public.campaign_leads enable row level security;
create policy "campaign_leads_select_authenticated" on public.campaign_leads for select to authenticated using (true);
create policy "campaign_leads_insert_authenticated" on public.campaign_leads for insert to authenticated with check (true);
create policy "campaign_leads_update_authenticated" on public.campaign_leads for update to authenticated using (true);
create policy "campaign_leads_delete_privileged" on public.campaign_leads for delete to authenticated using (public.is_privileged());

alter table public.campaign_media_investments enable row level security;
create policy "campaign_media_select_authenticated" on public.campaign_media_investments for select to authenticated using (true);
create policy "campaign_media_insert_authenticated" on public.campaign_media_investments for insert to authenticated with check (true);
create policy "campaign_media_update_authenticated" on public.campaign_media_investments for update to authenticated using (true);
create policy "campaign_media_delete_privileged" on public.campaign_media_investments for delete to authenticated using (public.is_privileged());
