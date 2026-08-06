-- Cardoso Marketing Hub — módulo Marcas: demandas por marca (mesmo motor das de embalagem)
-- Roda depois de 0001..0054. Retry-safe/idempotente.
--
-- Demanda de marca = task com project_id null, packaging_track = 'marca' e brand_id da marca.
-- Reaproveita etapas/sub-etapas/checklist com gate/aprovações/comentários já existentes em tasks.

set lock_timeout = '5s';

-- brand_id nas tasks (só usado nas demandas de marca)
alter table public.tasks add column if not exists brand_id uuid references public.brands (id);
create index if not exists tasks_brand_id_idx on public.tasks (brand_id);

-- libera o valor 'marca' no packaging_track (tasks + stages)
alter table public.tasks drop constraint if exists tasks_packaging_track_check;
alter table public.tasks add constraint tasks_packaging_track_check
  check (packaging_track in ('criacao', 'melhoria', 'criacao_teste', 'melhoria_teste', 'marca'));
alter table public.stages drop constraint if exists stages_packaging_track_check;
alter table public.stages add constraint stages_packaging_track_check
  check (packaging_track in ('criacao', 'melhoria', 'criacao_teste', 'melhoria_teste', 'marca'));

-- pipeline padrão das demandas de marca (compartilhado entre as marcas) — só se ainda não existir
insert into public.stages (project_id, packaging_track, name, position, is_final)
select null, 'marca', v.name, v.position, v.is_final
from (values
  ('Briefing', 0, false),
  ('Em produção', 1, false),
  ('Revisão', 2, false),
  ('Aprovação', 3, false),
  ('Entregue', 4, true)
) as v(name, position, is_final)
where not exists (select 1 from public.stages where packaging_track = 'marca');
