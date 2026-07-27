-- Cardoso Marketing Hub — demandas no padrão Monday (notas, orçamento, arquivos, quem/quando atualizou)
-- Roda uma vez no SQL Editor, depois de 0001..0013 já terem rodado.

alter table public.tasks add column notes text not null default '';
alter table public.tasks add column budget numeric(12, 2);
alter table public.tasks add column updated_by uuid references public.profiles (id);

-- project_files passa a servir também pra arquivos anexados direto numa demanda
-- (sem projeto, se a demanda for avulsa) — mesmo padrão de FK dupla nullable já
-- usado em activity_log.
alter table public.project_files alter column project_id drop not null;
alter table public.project_files add column task_id uuid references public.tasks (id) on delete cascade;
create index on public.project_files (task_id);
