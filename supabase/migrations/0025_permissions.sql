-- Cardoso Marketing Hub — visibilidade por participação + permissões granulares por usuário
-- Roda uma vez no SQL Editor, depois de 0001..0024 já terem rodado.
--
-- 1) Projetos: só quem participa (project_members) enxerga o projeto — exceto Diretoria e
--    Administrador, que continuam vendo tudo. O autor de um projeto agora entra
--    automaticamente como membro dele (senão deixaria de ver o próprio projeto criado).
-- 2) Demandas: reforça em RLS (antes só filtrava no app, o que não impedia acesso via API
--    direta). Dentro de um projeto que você participa, continua vendo todas as demandas
--    daquele projeto (colaboração/kanban intactos); demanda avulsa (sem projeto) só é
--    visível pra quem é responsável por ela.
-- 3) checklist_items/comments/project_files/audit_items/stages seguem a mesma regra de
--    "só quem participa do projeto" (mesmo princípio, consistente).
-- 4) profiles ganha duas listas: hidden_modules (remove acesso que o papel/departamento já
--    dariam) e extra_modules (concede acesso a um módulo além do papel/departamento — ex.:
--    convidar alguém da equipe pro módulo Redes Sociais). Só Diretoria/Administrador podem
--    alterar essas duas colunas (reforçado por trigger, igual ao guard de `role`).

alter table public.profiles
  add column hidden_modules text[] not null default '{}',
  add column extra_modules text[] not null default '{}';

create function public.prevent_module_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.hidden_modules is distinct from old.hidden_modules or new.extra_modules is distinct from old.extra_modules)
     and not public.is_privileged() then
    raise exception 'Apenas Diretoria/Administrador podem alterar os módulos liberados/ocultos de um usuário.';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_modules
  before update on public.profiles
  for each row execute function public.prevent_module_self_change();

-- Autor de um projeto entra como membro automaticamente (backfill pros projetos existentes).
insert into public.project_members (project_id, user_id, role_label)
select p.id, p.created_by, ''
from public.projects p
where p.created_by is not null
on conflict (project_id, user_id) do nothing;

drop policy "projects_select_authenticated" on public.projects;
create policy "projects_select_member_or_privileged" on public.projects
  for select to authenticated using (
    public.is_privileged()
    or exists (select 1 from public.project_members m where m.project_id = projects.id and m.user_id = auth.uid())
  );

drop policy "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_member_or_own_or_privileged" on public.tasks
  for select to authenticated using (
    public.is_privileged()
    or (project_id is not null and exists (select 1 from public.project_members m where m.project_id = tasks.project_id and m.user_id = auth.uid()))
    or (project_id is null and assignee_id = auth.uid())
  );

drop policy "checklist_select_authenticated" on public.checklist_items;
create policy "checklist_select_member_or_privileged" on public.checklist_items
  for select to authenticated using (
    public.is_privileged()
    or exists (select 1 from public.project_members m where m.project_id = checklist_items.project_id and m.user_id = auth.uid())
  );

drop policy "comments_select_authenticated" on public.comments;
create policy "comments_select_member_or_privileged" on public.comments
  for select to authenticated using (
    public.is_privileged()
    or exists (select 1 from public.project_members m where m.project_id = comments.project_id and m.user_id = auth.uid())
  );

drop policy "project_files_select_authenticated" on public.project_files;
create policy "project_files_select_member_or_privileged" on public.project_files
  for select to authenticated using (
    public.is_privileged()
    or exists (select 1 from public.project_members m where m.project_id = project_files.project_id and m.user_id = auth.uid())
  );

drop policy "audit_items_select_authenticated" on public.audit_items;
create policy "audit_items_select_member_or_privileged" on public.audit_items
  for select to authenticated using (
    public.is_privileged()
    or exists (select 1 from public.project_members m where m.project_id = audit_items.project_id and m.user_id = auth.uid())
  );

drop policy "stages_select_authenticated" on public.stages;
create policy "stages_select_member_or_global_or_privileged" on public.stages
  for select to authenticated using (
    project_id is null
    or public.is_privileged()
    or exists (select 1 from public.project_members m where m.project_id = stages.project_id and m.user_id = auth.uid())
  );
