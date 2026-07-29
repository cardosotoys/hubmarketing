-- Cardoso Marketing Hub — etapas editáveis por projeto
-- Substitui o enum fixo de 6 estágios (tasks.stage / project_template_tasks.stage) por uma
-- tabela real de etapas por projeto (CRUD completo: adicionar, renomear, reordenar, remover),
-- e uma tabela equivalente por modelo de projeto. Faz backfill de tudo que já existe (projetos
-- reais, incluindo "Conferência de Embalagens", e os 4 modelos já cadastrados) pro novo sistema
-- — nada se perde, mas o enum fixo deixa de existir depois desta migration.
-- Roda uma vez no SQL Editor, depois de 0001..0021 já terem rodado.

-- 1) Etapas reais, por projeto. project_id nulo = "etapas globais", usadas por demandas avulsas
-- (sem projeto). Editáveis livremente, sem afetar outros projetos.
create table public.stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.stages (project_id);

-- 2) Etapas por modelo de projeto (cada modelo tem sua própria lista, não mais um enum fixo).
create table public.project_template_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.project_template_stages (template_id);

-- 3) tasks e project_template_tasks passam a apontar pra uma etapa real em vez do enum fixo.
alter table public.tasks add column stage_id uuid references public.stages (id) on delete set null;
alter table public.project_template_tasks
  add column stage_template_id uuid references public.project_template_stages (id) on delete set null;

-- 4) Backfill — etapas "globais" (project_id nulo) pras demandas avulsas existentes.
insert into public.stages (project_id, name, position, is_final) values
  (null, 'Recebido', 1, false),
  (null, 'Planejamento', 2, false),
  (null, 'Produção', 3, false),
  (null, 'Revisão', 4, false),
  (null, 'Aprovação', 5, false),
  (null, 'Finalizado', 6, true);

update public.tasks t set stage_id = s.id
from public.stages s
where t.project_id is null and s.project_id is null and (
  (t.stage = 'recebido' and s.name = 'Recebido') or
  (t.stage = 'planejamento' and s.name = 'Planejamento') or
  (t.stage = 'producao' and s.name = 'Produção') or
  (t.stage = 'revisao' and s.name = 'Revisão') or
  (t.stage = 'aprovacao' and s.name = 'Aprovação') or
  (t.stage = 'finalizado' and s.name = 'Finalizado')
);

-- 5) Backfill — uma cópia das 6 etapas fixas por projeto existente, ligando as demandas de cada
-- projeto às etapas do próprio projeto (mesmo texto, agora editável independentemente depois).
do $$
declare
  proj record;
begin
  for proj in select id from public.projects loop
    insert into public.stages (project_id, name, position, is_final) values
      (proj.id, 'Recebido', 1, false),
      (proj.id, 'Planejamento', 2, false),
      (proj.id, 'Produção', 3, false),
      (proj.id, 'Revisão', 4, false),
      (proj.id, 'Aprovação', 5, false),
      (proj.id, 'Finalizado', 6, true);

    update public.tasks t set stage_id = s.id
    from public.stages s
    where t.project_id = proj.id and s.project_id = proj.id and (
      (t.stage = 'recebido' and s.name = 'Recebido') or
      (t.stage = 'planejamento' and s.name = 'Planejamento') or
      (t.stage = 'producao' and s.name = 'Produção') or
      (t.stage = 'revisao' and s.name = 'Revisão') or
      (t.stage = 'aprovacao' and s.name = 'Aprovação') or
      (t.stage = 'finalizado' and s.name = 'Finalizado')
    );
  end loop;
end $$;

-- 6) Backfill — modelos de projeto já existentes (os 4 criados antes desta migration) ganham
-- as mesmas 6 etapas fixas como stage_templates, e as demandas-padrão deles passam a apontar
-- pra essas etapas.
do $$
declare
  tmpl record;
begin
  for tmpl in select id from public.project_templates loop
    if not exists (select 1 from public.project_template_stages where template_id = tmpl.id) then
      insert into public.project_template_stages (template_id, name, position, is_final) values
        (tmpl.id, 'Recebido', 1, false),
        (tmpl.id, 'Planejamento', 2, false),
        (tmpl.id, 'Produção', 3, false),
        (tmpl.id, 'Revisão', 4, false),
        (tmpl.id, 'Aprovação', 5, false),
        (tmpl.id, 'Finalizado', 6, true);

      update public.project_template_tasks t set stage_template_id = s.id
      from public.project_template_stages s
      where t.template_id = tmpl.id and s.template_id = tmpl.id and (
        (t.stage = 'recebido' and s.name = 'Recebido') or
        (t.stage = 'planejamento' and s.name = 'Planejamento') or
        (t.stage = 'producao' and s.name = 'Produção') or
        (t.stage = 'revisao' and s.name = 'Revisão') or
        (t.stage = 'aprovacao' and s.name = 'Aprovação') or
        (t.stage = 'finalizado' and s.name = 'Finalizado')
      );
    end if;
  end loop;
end $$;

-- 7) Agora que tudo foi migrado, tasks.stage_id e project_template_tasks.stage_template_id
-- passam a ser obrigatórios, e o enum fixo antigo é removido de vez.
alter table public.tasks alter column stage_id set not null;
alter table public.tasks drop constraint if exists tasks_stage_check;
alter table public.tasks drop column stage;

alter table public.project_template_tasks alter column stage_template_id set not null;
alter table public.project_template_tasks drop constraint if exists project_template_tasks_stage_check;
alter table public.project_template_tasks drop column stage;

-- 8) RLS — mesmo padrão de tasks/checklist_items (times todo colaborativo, escrita liberada).
alter table public.stages enable row level security;
create policy "stages_select_authenticated" on public.stages for select to authenticated using (true);
create policy "stages_insert_authenticated" on public.stages for insert to authenticated with check (true);
create policy "stages_update_authenticated" on public.stages for update to authenticated using (true);
create policy "stages_delete_authenticated" on public.stages for delete to authenticated using (true);

alter table public.project_template_stages enable row level security;
create policy "project_template_stages_select" on public.project_template_stages for select to authenticated using (true);
create policy "project_template_stages_insert" on public.project_template_stages for insert to authenticated with check (true);
create policy "project_template_stages_update" on public.project_template_stages for update to authenticated using (true);
create policy "project_template_stages_delete" on public.project_template_stages for delete to authenticated using (public.is_privileged());
