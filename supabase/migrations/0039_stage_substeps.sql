-- Cardoso Marketing Hub — sub-etapas configuráveis por etapa (com prazo e condicional)
-- Roda depois de 0001..0038. Retry-safe/idempotente.
--
-- Cada etapa (stage) pode ter um TEMPLATE de sub-etapas (stage_substeps): label, prazo relativo
-- (dias após a demanda entrar na etapa) e "condicional" (bloqueia o avanço enquanto não concluída).
-- Ao entrar numa etapa, a demanda materializa essas sub-etapas como itens do seu checklist
-- (task_checklist_items ganha stage_id/substep_id/due_date). Sub-etapa condicional vira item-gate,
-- reaproveitando o limitador de avanço que já existe.

set lock_timeout = '5s';

-- checklist da demanda ganha vínculo com a etapa/sub-etapa de origem e prazo próprio
alter table public.task_checklist_items
  add column if not exists stage_id uuid references public.stages (id) on delete set null,
  add column if not exists substep_id uuid,
  add column if not exists due_date date;

-- Template de sub-etapas por etapa
create table if not exists public.stage_substeps (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages (id) on delete cascade,
  label text not null,
  position integer not null default 0,
  is_conditional boolean not null default false,   -- condicional: trava o avanço enquanto não concluída
  due_offset_days integer,                          -- prazo: dias após a demanda entrar na etapa (null = sem prazo)
  created_at timestamptz not null default now()
);
create index if not exists stage_substeps_stage_id_idx on public.stage_substeps (stage_id);

alter table public.stage_substeps enable row level security;
drop policy if exists "ss_select" on public.stage_substeps;
create policy "ss_select" on public.stage_substeps for select to authenticated using (true);
drop policy if exists "ss_insert" on public.stage_substeps;
create policy "ss_insert" on public.stage_substeps for insert to authenticated with check (true);
drop policy if exists "ss_update" on public.stage_substeps;
create policy "ss_update" on public.stage_substeps for update to authenticated using (true);
drop policy if exists "ss_delete" on public.stage_substeps;
create policy "ss_delete" on public.stage_substeps for delete to authenticated using (true);

-- ============================================================
-- Semeia o fluxo da trilha Criação (editável depois no módulo)
-- ============================================================

-- Planejamento
insert into public.stage_substeps (stage_id, label, position, is_conditional)
select s.id, v.label, v.position::int, v.cond::boolean
from public.stages s
cross join (values
  ('Entender prazos das demandas, metas, prioridades e atribuições', 1, false)
) as v(label, position, cond)
where s.packaging_track = 'criacao' and s.name = 'Planejamento'
  and not exists (select 1 from public.stage_substeps ss where ss.stage_id = s.id);

-- Planificação: V1 → Aprovação/Correção → V2 → … (aprovação segue pelo fluxo de menção)
insert into public.stage_substeps (stage_id, label, position, is_conditional)
select s.id, v.label, v.position::int, v.cond::boolean
from public.stages s
cross join (values
  ('Versão 1', 1, false),
  ('Aprovação/Correção — V1', 2, false),
  ('Versão 2', 3, false),
  ('Aprovação/Correção — V2', 4, false),
  ('Versão 3', 5, false),
  ('Aprovação/Correção — V3', 6, false)
) as v(label, position, cond)
where s.packaging_track = 'criacao' and s.name = 'Planificação'
  and not exists (select 1 from public.stage_substeps ss where ss.stage_id = s.id);

-- Aprovado para Impressão
insert into public.stage_substeps (stage_id, label, position, is_conditional)
select s.id, v.label, v.position::int, v.cond::boolean
from public.stages s
cross join (values
  ('Envia arquivo para a gráfica', 1, false),
  ('Recebe a arte virtual', 2, false),
  ('Aprovam o que a gráfica enviou', 3, false),
  ('Prova de cor física', 4, false)
) as v(label, position, cond)
where s.packaging_track = 'criacao' and s.name = 'Aprovado para Impressão'
  and not exists (select 1 from public.stage_substeps ss where ss.stage_id = s.id);

-- Impressão da Embalagem: limitador de avanço — 2 tarefas condicionais "a definir"
insert into public.stage_substeps (stage_id, label, position, is_conditional)
select s.id, v.label, v.position::int, v.cond::boolean
from public.stages s
cross join (values
  ('A definir (checklist do Drive) — 1', 1, true),
  ('A definir (checklist do Drive) — 2', 2, true)
) as v(label, position, cond)
where s.packaging_track = 'criacao' and s.name = 'Impressão da Embalagem'
  and not exists (select 1 from public.stage_substeps ss where ss.stage_id = s.id);
