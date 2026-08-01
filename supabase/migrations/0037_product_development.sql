-- Cardoso Marketing Hub — módulo Design de Produto (desenvolvimento de produto stage-gate)
-- Roda uma vez no SQL Editor, depois de 0001..0036 já terem rodado.
--
-- Modelo stage-gate para desenvolvimento de brinquedo de plástico injetado: cada produto em
-- desenvolvimento é um item que caminha pelas 9 fases (Estratégia → Pós-lançamento), cada fase
-- termina num portão de decisão (go/ajustar/no-go) com aprovador. Marketing (GTM) e Embalagens
-- rodam em trilhas paralelas desde a Fase 1. Certificação (Fase 6) e rotulagem de embalagem são
-- campos BLOQUEANTES: nada avança para venda/lançamento sem eles.
--
-- Nomes das fases, donos e perguntas dos portões ficam no código (PRODUCT_DEV_PHASES em
-- src/types/database.ts) — aqui o banco guarda só o número da fase e a decisão de cada portão.

-- ============================================================
-- Novo departamento: Produto / Engenharia (dono da maioria das fases)
-- ============================================================
alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles
  add constraint profiles_department_check
  check (department in ('diretoria', 'growth', 'coordenacao', 'design', 'assistente', 'produto_eng'));

-- ============================================================
-- Tabelas
-- ============================================================

-- Item em desenvolvimento (o "produto" que caminha pelas fases)
create table public.product_dev_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  -- vínculo ao SKU do catálogo é opcional: um produto novo pode ainda não existir no Banco de Produtos
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  concept text not null default '',
  age_range text not null default '',
  material text not null default '',
  target_price numeric(12, 2),
  target_volume integer,
  tooling_investment numeric(12, 2),
  licensed boolean not null default false,
  license_notes text not null default '',
  current_phase integer not null default 1 check (current_phase between 1 and 9),
  status text not null default 'ativo'
    check (status in ('ativo', 'pausado', 'concluido', 'descontinuado', 'cancelado')),
  -- Fase 6 — bloqueante: sem certificação aprovada o item não pode ir a produção/venda
  certification_status text not null default 'nao_iniciado'
    check (certification_status in ('nao_iniciado', 'em_ensaio', 'aprovado', 'reprovado')),
  certification_number text not null default '',
  certification_expiry date,
  requires_anatel boolean not null default false,
  launch_target_date date,
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  owner_id uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.product_dev_items (brand_id);
create index on public.product_dev_items (product_id);
create index on public.product_dev_items (status);

-- Portões de decisão: uma linha por fase (1..9) de cada item, semeadas na criação
create table public.product_dev_gates (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_dev_items (id) on delete cascade,
  phase integer not null check (phase between 1 and 9),
  decision text not null default 'pendente'
    check (decision in ('pendente', 'aprovado', 'ajustar', 'reprovado')),
  approver_id uuid references public.profiles (id),
  decided_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, phase)
);
create index on public.product_dev_gates (item_id);

-- Semeia os 9 portões automaticamente quando um item é criado
create function public.seed_product_dev_gates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.product_dev_gates (item_id, phase)
  select new.id, g from generate_series(1, 9) as g;
  return new;
end;
$$;

create trigger product_dev_items_seed_gates
  after insert on public.product_dev_items
  for each row execute function public.seed_product_dev_gates();

-- Atividades/checklist por fase e por trilha (produto / marketing / embalagem)
create table public.product_dev_tasks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_dev_items (id) on delete cascade,
  phase integer not null default 1 check (phase between 1 and 9),
  track text not null default 'produto' check (track in ('produto', 'marketing', 'embalagem')),
  title text not null,
  done boolean not null default false,
  assignee_id uuid references public.profiles (id),
  due_date date,
  notes text not null default '',
  position integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.product_dev_tasks (item_id);

-- Sub-módulo Embalagens (acoplado): uma linha por tipo (primária/secundária/terciária)
create table public.product_dev_packaging (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_dev_items (id) on delete cascade,
  kind text not null default 'primaria' check (kind in ('primaria', 'secundaria', 'terciaria')),
  pack_type text not null default '',
  dimensions text not null default '',
  material text not null default '',
  art_status text not null default 'nao_iniciada'
    check (art_status in ('nao_iniciada', 'em_producao', 'em_aprovacao', 'aprovada')),
  -- BLOQUEANTE para o lançamento (Fase 8): rotulagem obrigatória validada na certificação
  labeling_status text not null default 'pendente'
    check (labeling_status in ('pendente', 'em_producao', 'validada')),
  supplier text not null default '',
  unit_cost numeric(12, 2),
  protection_test_status text not null default 'nao_testado'
    check (protection_test_status in ('nao_testado', 'reprovado', 'aprovado')),
  guide_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.product_dev_packaging (item_id);

-- Riscos (mapa de calor probabilidade × impacto), dedicado ao módulo
create table public.product_dev_risks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_dev_items (id) on delete cascade,
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
create index on public.product_dev_risks (item_id);

-- Decision log dedicado ao módulo
create table public.product_dev_decisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_dev_items (id) on delete cascade,
  context text not null default '',
  alternatives text not null default '',
  choice text not null,
  impact text not null default '',
  stakeholders text not null default '',
  decided_at date not null default current_date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.product_dev_decisions (item_id);

-- Documentos/links do item (PRD, CAD 3D, laudos de laboratório, guia de embalagem, etc.)
create table public.product_dev_documents (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_dev_items (id) on delete cascade,
  kind text not null default 'outro' check (kind in ('prd', 'cad', 'laudo', 'guia', 'outro')),
  name text not null,
  url text not null,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.product_dev_documents (item_id);

-- Histórico também passa a aceitar registros ligados a um item de desenvolvimento
alter table public.activity_log
  add column if not exists product_dev_item_id uuid references public.product_dev_items (id) on delete set null;
create index if not exists activity_log_product_dev_item_id_idx on public.activity_log (product_dev_item_id);

-- ============================================================
-- RLS (mesmo padrão do módulo de campanhas: leitura/escrita para autenticados,
-- exclusão do item raiz restrita a Diretoria/Administrador)
-- ============================================================

alter table public.product_dev_items enable row level security;
create policy "pdi_select_authenticated" on public.product_dev_items for select to authenticated using (true);
create policy "pdi_insert_authenticated" on public.product_dev_items for insert to authenticated with check (true);
create policy "pdi_update_authenticated" on public.product_dev_items for update to authenticated using (true);
create policy "pdi_delete_privileged" on public.product_dev_items for delete to authenticated using (public.is_privileged());

alter table public.product_dev_gates enable row level security;
create policy "pdg_select_authenticated" on public.product_dev_gates for select to authenticated using (true);
create policy "pdg_insert_authenticated" on public.product_dev_gates for insert to authenticated with check (true);
create policy "pdg_update_authenticated" on public.product_dev_gates for update to authenticated using (true);
create policy "pdg_delete_authenticated" on public.product_dev_gates for delete to authenticated using (true);

alter table public.product_dev_tasks enable row level security;
create policy "pdt_select_authenticated" on public.product_dev_tasks for select to authenticated using (true);
create policy "pdt_insert_authenticated" on public.product_dev_tasks for insert to authenticated with check (true);
create policy "pdt_update_authenticated" on public.product_dev_tasks for update to authenticated using (true);
create policy "pdt_delete_authenticated" on public.product_dev_tasks for delete to authenticated using (true);

alter table public.product_dev_packaging enable row level security;
create policy "pdp_select_authenticated" on public.product_dev_packaging for select to authenticated using (true);
create policy "pdp_insert_authenticated" on public.product_dev_packaging for insert to authenticated with check (true);
create policy "pdp_update_authenticated" on public.product_dev_packaging for update to authenticated using (true);
create policy "pdp_delete_authenticated" on public.product_dev_packaging for delete to authenticated using (true);

alter table public.product_dev_risks enable row level security;
create policy "pdr_select_authenticated" on public.product_dev_risks for select to authenticated using (true);
create policy "pdr_insert_authenticated" on public.product_dev_risks for insert to authenticated with check (true);
create policy "pdr_update_authenticated" on public.product_dev_risks for update to authenticated using (true);
create policy "pdr_delete_authenticated" on public.product_dev_risks for delete to authenticated using (true);

alter table public.product_dev_decisions enable row level security;
create policy "pdd_select_authenticated" on public.product_dev_decisions for select to authenticated using (true);
create policy "pdd_insert_authenticated" on public.product_dev_decisions for insert to authenticated with check (true);
create policy "pdd_update_authenticated" on public.product_dev_decisions for update to authenticated using (true);
create policy "pdd_delete_authenticated" on public.product_dev_decisions for delete to authenticated using (true);

alter table public.product_dev_documents enable row level security;
create policy "pdoc_select_authenticated" on public.product_dev_documents for select to authenticated using (true);
create policy "pdoc_insert_authenticated" on public.product_dev_documents for insert to authenticated with check (true);
create policy "pdoc_update_authenticated" on public.product_dev_documents for update to authenticated using (true);
create policy "pdoc_delete_authenticated" on public.product_dev_documents for delete to authenticated using (true);
