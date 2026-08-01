-- Cardoso Marketing Hub — sub-módulo Embalagem (Demandas) + fluxo de aprovação/gate na demanda
-- Roda uma vez no SQL Editor, depois de 0001..0037 já terem rodado.
--
-- Reaproveita a base de Projetos: um "projeto de embalagem" é um project com kind='embalagem' e
-- uma trilha (criação/melhoria). Assim Kanban/Lista, filtros, ordenação, etapas editáveis e as
-- abas Financeiro/Arquivos/Histórico vêm de graça. O projeto pode ser espelhado num produto do
-- módulo Design de Produto (product_dev_item_id) — mesma fonte de dado nos dois lugares.
--
-- Também adiciona, na demanda: checklist com item-gate (limitador de avanço de etapa) e um fluxo
-- de aprovação por menção (solicitar → aprovar/corrigir → seguir o fluxo).

-- ============================================================
-- Projetos: marcador de embalagem, trilha e espelho com Design de Produto
-- ============================================================
alter table public.projects
  add column if not exists kind text not null default 'normal' check (kind in ('normal', 'embalagem')),
  add column if not exists packaging_track text check (packaging_track in ('criacao', 'melhoria')),
  add column if not exists product_dev_item_id uuid references public.product_dev_items (id) on delete set null;
create index if not exists projects_kind_idx on public.projects (kind);
create index if not exists projects_product_dev_item_id_idx on public.projects (product_dev_item_id);

-- O projeto "Conferência de Embalagens" que já existe passa a ser um projeto de embalagem
-- (trilha de melhoria — corrigir/aprovar embalagem de produto existente).
update public.projects
  set kind = 'embalagem', packaging_track = 'melhoria'
  where name = 'Conferência de Embalagens';

-- ============================================================
-- Checklist por demanda + item-gate (limitador de avanço de etapa)
-- ============================================================
create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  -- item-gate: enquanto não concluído, a demanda não avança para uma etapa posterior
  is_gate boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.task_checklist_items (task_id);

alter table public.task_checklist_items enable row level security;
create policy "tci_select_authenticated" on public.task_checklist_items for select to authenticated using (true);
create policy "tci_insert_authenticated" on public.task_checklist_items for insert to authenticated with check (true);
create policy "tci_update_authenticated" on public.task_checklist_items for update to authenticated using (true);
create policy "tci_delete_authenticated" on public.task_checklist_items for delete to authenticated using (true);

-- ============================================================
-- Fluxo de aprovação por menção na demanda
-- ============================================================
alter table public.tasks
  add column if not exists approval_state text not null default 'none'
    check (approval_state in ('none', 'aguardando', 'aprovado', 'correcao')),
  add column if not exists approval_requested_to uuid references public.profiles (id),
  add column if not exists approval_note text not null default '';
