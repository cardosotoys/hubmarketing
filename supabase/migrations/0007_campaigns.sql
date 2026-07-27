-- Cardoso Marketing Hub — Campanhas (Fase 2 → real)
-- Roda uma vez no SQL Editor, depois de 0001..0006 já terem rodado.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  project_id uuid references public.projects (id) on delete set null,
  name text not null,
  objective text not null default '',
  status text not null default 'Planejamento'
    check (status in ('Planejamento', 'Em execução', 'Pausada', 'Concluída')),
  start_date date,
  end_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaigns (brand_id);
create index on public.campaigns (project_id);

create table public.campaign_milestones (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null,
  date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.campaign_milestones (campaign_id);

create table public.campaign_budget_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  description text not null,
  category text not null default 'Outro',
  planned_amount numeric(12, 2) not null default 0,
  spent_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.campaign_budget_items (campaign_id);

alter table public.campaigns enable row level security;
create policy "campaigns_select_authenticated" on public.campaigns for select to authenticated using (true);
create policy "campaigns_insert_authenticated" on public.campaigns for insert to authenticated with check (true);
create policy "campaigns_update_authenticated" on public.campaigns for update to authenticated using (true);
create policy "campaigns_delete_privileged" on public.campaigns for delete to authenticated using (public.is_privileged());

alter table public.campaign_milestones enable row level security;
create policy "campaign_milestones_select_authenticated" on public.campaign_milestones for select to authenticated using (true);
create policy "campaign_milestones_insert_authenticated" on public.campaign_milestones for insert to authenticated with check (true);
create policy "campaign_milestones_update_authenticated" on public.campaign_milestones for update to authenticated using (true);
create policy "campaign_milestones_delete_authenticated" on public.campaign_milestones for delete to authenticated using (true);

alter table public.campaign_budget_items enable row level security;
create policy "campaign_budget_select_authenticated" on public.campaign_budget_items for select to authenticated using (true);
create policy "campaign_budget_insert_authenticated" on public.campaign_budget_items for insert to authenticated with check (true);
create policy "campaign_budget_update_authenticated" on public.campaign_budget_items for update to authenticated using (true);
create policy "campaign_budget_delete_authenticated" on public.campaign_budget_items for delete to authenticated using (true);

-- Histórico também passa a aceitar registros ligados a uma campanha (além de projeto)
alter table public.activity_log add column campaign_id uuid references public.campaigns (id) on delete set null;
create index on public.activity_log (campaign_id);
