-- Cardoso Marketing Hub — Campaign Workspace (núcleo operacional)
-- Roda uma vez no SQL Editor, depois de 0001..0008 já terem rodado.
--
-- Redesenho completo do módulo Campanhas: reseta os dados de teste (campaigns,
-- campaign_milestones, campaign_budget_items) e recria um schema bem mais rico,
-- onde cada campanha vira um workspace com briefing, objetivos, KPIs, cronograma
-- (com dependências), demandas estilo ticket (com RACI), aprovações, riscos,
-- decisões e histórico — tudo com dado real e persistido.

drop table if exists public.campaign_milestones;
drop table if exists public.campaign_budget_items;
drop table if exists public.campaigns cascade;

-- ============================================================
-- Campanha (workspace raiz)
-- ============================================================

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  name text not null,
  category text not null default '',
  tags text[] not null default '{}',
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  status text not null default 'planejamento'
    check (status in ('planejamento', 'producao', 'aprovacao', 'execucao', 'finalizacao', 'concluida', 'cancelada')),
  start_date date,
  end_date date,
  objective text not null default '',
  description text not null default '',
  problem text not null default '',
  opportunity text not null default '',
  target_audience text not null default '',
  personas text not null default '',
  competitors text not null default '',
  message_main text not null default '',
  tone_of_voice text not null default '',
  promise text not null default '',
  value_proposition text not null default '',
  differentiators text not null default '',
  strategy text not null default '',
  restrictions text not null default '',
  assumptions text not null default '',
  stakeholders text not null default '',
  owner_id uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaigns (brand_id);

-- Produtos reais ligados à campanha (sem duplicar dado do Banco de Produtos)
create table public.campaign_products (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, product_id)
);

-- Checklist de kickoff (nível campanha, distinto do checklist por demanda)
create table public.campaign_checklist_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.campaign_checklist_items (campaign_id);

-- Documentos/links (substituto leve até a Biblioteca ganhar integração de verdade)
create table public.campaign_documents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  url text not null,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.campaign_documents (campaign_id);

-- ============================================================
-- Objetivos e KPIs
-- ============================================================

create table public.campaign_objectives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null default 'tatico' check (kind in ('estrategico', 'tatico', 'operacional')),
  description text not null,
  indicator text not null default '',
  unit text not null default '',
  target_value numeric,
  current_value numeric,
  weight numeric,
  responsible_id uuid references public.profiles (id),
  due_date date,
  status text not null default 'nao_iniciado' check (status in ('nao_iniciado', 'em_andamento', 'concluido', 'em_risco')),
  percent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_objectives (campaign_id);

create table public.campaign_kpis (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  unit text not null default '',
  target_value numeric,
  current_value numeric not null default 0,
  source text not null default '',
  responsible_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_kpis (campaign_id);

create table public.campaign_kpi_history (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.campaign_kpis (id) on delete cascade,
  value numeric not null,
  recorded_at timestamptz not null default now()
);
create index on public.campaign_kpi_history (kpi_id);

-- ============================================================
-- Demandas (ticket enterprise) + cronograma + dependências
-- ============================================================

create table public.campaign_tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null,
  description text not null default '',
  department text not null default '',
  product_id uuid references public.products (id),
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  urgency text not null default 'medium' check (urgency in ('low', 'medium', 'high')),
  complexity text not null default 'medium' check (complexity in ('low', 'medium', 'high')),
  impact text not null default 'medium' check (impact in ('low', 'medium', 'high')),
  assignee_id uuid references public.profiles (id),
  reviewer_id uuid references public.profiles (id),
  approver_id uuid references public.profiles (id),
  requester_id uuid references public.profiles (id),
  estimated_hours numeric,
  spent_hours numeric not null default 0,
  start_date date,
  due_date date,
  is_milestone boolean not null default false,
  stage text not null default 'backlog'
    check (stage in (
      'backlog', 'planejada', 'producao', 'revisao', 'aguardando_aprovacao',
      'aprovada', 'publicada', 'concluida', 'cancelada'
    )),
  approval_feedback text not null default '',
  position integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_tasks (campaign_id);

create table public.campaign_task_dependencies (
  task_id uuid not null references public.campaign_tasks (id) on delete cascade,
  depends_on_id uuid not null references public.campaign_tasks (id) on delete cascade,
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create table public.campaign_task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  campaign_task_id uuid not null references public.campaign_tasks (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.campaign_task_checklist_items (campaign_task_id);

create table public.campaign_task_comments (
  id uuid primary key default gen_random_uuid(),
  campaign_task_id uuid not null references public.campaign_tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.campaign_task_comments (campaign_task_id);

-- ============================================================
-- Financeiro, riscos e decisões
-- ============================================================

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

create table public.campaign_risks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  description text not null,
  probability text not null default 'media' check (probability in ('baixa', 'media', 'alta')),
  impact text not null default 'medio' check (impact in ('baixo', 'medio', 'alto')),
  mitigation_plan text not null default '',
  responsible_id uuid references public.profiles (id),
  status text not null default 'aberto' check (status in ('aberto', 'monitorando', 'mitigado', 'ocorreu')),
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaign_risks (campaign_id);

create table public.campaign_decisions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  context text not null default '',
  alternatives text not null default '',
  choice text not null,
  impact text not null default '',
  stakeholders text not null default '',
  decided_at date not null default current_date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.campaign_decisions (campaign_id);

-- Histórico ganha granularidade por demanda, além de por campanha (já existia)
alter table public.activity_log add column campaign_task_id uuid references public.campaign_tasks (id) on delete set null;
create index on public.activity_log (campaign_task_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.campaigns enable row level security;
create policy "campaigns_select_authenticated" on public.campaigns for select to authenticated using (true);
create policy "campaigns_insert_authenticated" on public.campaigns for insert to authenticated with check (true);
create policy "campaigns_update_authenticated" on public.campaigns for update to authenticated using (true);
create policy "campaigns_delete_privileged" on public.campaigns for delete to authenticated using (public.is_privileged());

alter table public.campaign_products enable row level security;
create policy "campaign_products_select_authenticated" on public.campaign_products for select to authenticated using (true);
create policy "campaign_products_insert_authenticated" on public.campaign_products for insert to authenticated with check (true);
create policy "campaign_products_delete_authenticated" on public.campaign_products for delete to authenticated using (true);

alter table public.campaign_checklist_items enable row level security;
create policy "campaign_checklist_select_authenticated" on public.campaign_checklist_items for select to authenticated using (true);
create policy "campaign_checklist_insert_authenticated" on public.campaign_checklist_items for insert to authenticated with check (true);
create policy "campaign_checklist_update_authenticated" on public.campaign_checklist_items for update to authenticated using (true);
create policy "campaign_checklist_delete_authenticated" on public.campaign_checklist_items for delete to authenticated using (true);

alter table public.campaign_documents enable row level security;
create policy "campaign_documents_select_authenticated" on public.campaign_documents for select to authenticated using (true);
create policy "campaign_documents_insert_own" on public.campaign_documents for insert to authenticated with check (auth.uid() = added_by);
create policy "campaign_documents_delete_authenticated" on public.campaign_documents for delete to authenticated using (true);

alter table public.campaign_objectives enable row level security;
create policy "campaign_objectives_select_authenticated" on public.campaign_objectives for select to authenticated using (true);
create policy "campaign_objectives_insert_authenticated" on public.campaign_objectives for insert to authenticated with check (true);
create policy "campaign_objectives_update_authenticated" on public.campaign_objectives for update to authenticated using (true);
create policy "campaign_objectives_delete_privileged" on public.campaign_objectives for delete to authenticated using (public.is_privileged());

alter table public.campaign_kpis enable row level security;
create policy "campaign_kpis_select_authenticated" on public.campaign_kpis for select to authenticated using (true);
create policy "campaign_kpis_insert_authenticated" on public.campaign_kpis for insert to authenticated with check (true);
create policy "campaign_kpis_update_authenticated" on public.campaign_kpis for update to authenticated using (true);
create policy "campaign_kpis_delete_privileged" on public.campaign_kpis for delete to authenticated using (public.is_privileged());

alter table public.campaign_kpi_history enable row level security;
create policy "campaign_kpi_history_select_authenticated" on public.campaign_kpi_history for select to authenticated using (true);
create policy "campaign_kpi_history_insert_authenticated" on public.campaign_kpi_history for insert to authenticated with check (true);

alter table public.campaign_tasks enable row level security;
create policy "campaign_tasks_select_authenticated" on public.campaign_tasks for select to authenticated using (true);
create policy "campaign_tasks_insert_authenticated" on public.campaign_tasks for insert to authenticated with check (true);
create policy "campaign_tasks_update_authenticated" on public.campaign_tasks for update to authenticated using (true);
create policy "campaign_tasks_delete_privileged" on public.campaign_tasks for delete to authenticated using (public.is_privileged());

alter table public.campaign_task_dependencies enable row level security;
create policy "campaign_task_deps_select_authenticated" on public.campaign_task_dependencies for select to authenticated using (true);
create policy "campaign_task_deps_insert_authenticated" on public.campaign_task_dependencies for insert to authenticated with check (true);
create policy "campaign_task_deps_delete_authenticated" on public.campaign_task_dependencies for delete to authenticated using (true);

alter table public.campaign_task_checklist_items enable row level security;
create policy "campaign_task_checklist_select_authenticated" on public.campaign_task_checklist_items for select to authenticated using (true);
create policy "campaign_task_checklist_insert_authenticated" on public.campaign_task_checklist_items for insert to authenticated with check (true);
create policy "campaign_task_checklist_update_authenticated" on public.campaign_task_checklist_items for update to authenticated using (true);
create policy "campaign_task_checklist_delete_authenticated" on public.campaign_task_checklist_items for delete to authenticated using (true);

alter table public.campaign_task_comments enable row level security;
create policy "campaign_task_comments_select_authenticated" on public.campaign_task_comments for select to authenticated using (true);
create policy "campaign_task_comments_insert_own" on public.campaign_task_comments for insert to authenticated with check (auth.uid() = author_id);

alter table public.campaign_budget_items enable row level security;
create policy "campaign_budget_select_authenticated" on public.campaign_budget_items for select to authenticated using (true);
create policy "campaign_budget_insert_authenticated" on public.campaign_budget_items for insert to authenticated with check (true);
create policy "campaign_budget_update_authenticated" on public.campaign_budget_items for update to authenticated using (true);
create policy "campaign_budget_delete_privileged" on public.campaign_budget_items for delete to authenticated using (public.is_privileged());

alter table public.campaign_risks enable row level security;
create policy "campaign_risks_select_authenticated" on public.campaign_risks for select to authenticated using (true);
create policy "campaign_risks_insert_authenticated" on public.campaign_risks for insert to authenticated with check (true);
create policy "campaign_risks_update_authenticated" on public.campaign_risks for update to authenticated using (true);
create policy "campaign_risks_delete_privileged" on public.campaign_risks for delete to authenticated using (public.is_privileged());

alter table public.campaign_decisions enable row level security;
create policy "campaign_decisions_select_authenticated" on public.campaign_decisions for select to authenticated using (true);
create policy "campaign_decisions_insert_authenticated" on public.campaign_decisions for insert to authenticated with check (true);
create policy "campaign_decisions_delete_privileged" on public.campaign_decisions for delete to authenticated using (public.is_privileged());
