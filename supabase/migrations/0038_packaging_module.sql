-- Cardoso Marketing Hub — módulo Embalagens (independente, dentro de Design de Produto)
-- Roda uma vez no SQL Editor, depois de 0001..0037 já terem rodado.
-- Versão retry-safe/idempotente (pode rodar de novo sem erro). lock_timeout evita deadlock com o app.
--
-- O módulo Embalagens organiza TODAS as embalagens de TODOS os SKUs, em duas trilhas
-- (criação/melhoria). Cada embalagem é uma demanda própria do módulo — NÃO é projeto e NÃO
-- aparece no board global de Demandas nem na lista de Projetos. Reaproveita o motor de demandas
-- (tasks/stages/checklist/comentários/menções) para que menção, notificação e push funcionem de
-- verdade, mas com etapas próprias e escopo isolado por packaging_track.

set lock_timeout = '5s';

-- 1) Demandas e etapas ganham a marca de trilha de embalagem (nulo = demanda/etapa normal).
--    Demanda de embalagem: project_id null + packaging_track preenchido.
--    Etapa de embalagem: project_id null + packaging_track preenchido (compartilhada pela trilha).
alter table public.tasks
  add column if not exists packaging_track text check (packaging_track in ('criacao', 'melhoria'));
alter table public.stages
  add column if not exists packaging_track text check (packaging_track in ('criacao', 'melhoria'));
create index if not exists tasks_packaging_track_idx on public.tasks (packaging_track);
create index if not exists stages_packaging_track_idx on public.stages (packaging_track);

-- 2) Checklist por demanda + item-gate (limitador de avanço de etapa)
create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  is_gate boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_checklist_items_task_id_idx on public.task_checklist_items (task_id);

alter table public.task_checklist_items enable row level security;
drop policy if exists "tci_select_authenticated" on public.task_checklist_items;
create policy "tci_select_authenticated" on public.task_checklist_items for select to authenticated using (true);
drop policy if exists "tci_insert_authenticated" on public.task_checklist_items;
create policy "tci_insert_authenticated" on public.task_checklist_items for insert to authenticated with check (true);
drop policy if exists "tci_update_authenticated" on public.task_checklist_items;
create policy "tci_update_authenticated" on public.task_checklist_items for update to authenticated using (true);
drop policy if exists "tci_delete_authenticated" on public.task_checklist_items;
create policy "tci_delete_authenticated" on public.task_checklist_items for delete to authenticated using (true);

-- 3) Fluxo de aprovação por menção na demanda
alter table public.tasks
  add column if not exists approval_state text not null default 'none'
    check (approval_state in ('none', 'aguardando', 'aprovado', 'correcao')),
  add column if not exists approval_requested_to uuid references public.profiles (id),
  add column if not exists approval_note text not null default '';

-- 4) Etapas-padrão das duas trilhas (semeadas uma vez; editáveis depois no módulo)
insert into public.stages (project_id, packaging_track, name, position, is_final)
select null, 'criacao', v.name, v.position::int, v.is_final::boolean
from (values
  ('Planejamento', 1, false),
  ('Planificação', 2, false),
  ('Aprovado para Impressão', 3, false),
  ('Impressão da Embalagem', 4, false),
  ('Produção', 5, true)
) as v(name, position, is_final)
where not exists (select 1 from public.stages where packaging_track = 'criacao');

insert into public.stages (project_id, packaging_track, name, position, is_final)
select null, 'melhoria', v.name, v.position::int, v.is_final::boolean
from (values
  ('Recebido', 1, false),
  ('Planejamento', 2, false),
  ('Produção', 3, false),
  ('Revisão', 4, false),
  ('Aprovação', 5, false),
  ('Finalizado', 6, true)
) as v(name, position, is_final)
where not exists (select 1 from public.stages where packaging_track = 'melhoria');
