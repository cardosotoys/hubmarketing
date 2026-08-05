-- Cardoso Marketing Hub — módulo Embalagens: todos veem o andamento de TODAS as demandas
-- Roda depois de 0001..0047. Retry-safe/idempotente.
--
-- Em 0025 o SELECT de tasks passou a: privilegiado, OU membro do projeto, OU (sem projeto e
-- responsável = você). Como as demandas de embalagem têm project_id nulo, o usuário comum só
-- enxergava as demandas atribuídas a ELE — enquanto o admin (privilegiado) via todas. Aqui o
-- módulo é colaborativo: todo mundo acompanha todas as demandas de embalagem (packaging_track
-- não nulo). O mesmo vale pros arquivos dessas demandas (aba Arquivos).
--
-- Demandas avulsas normais (project_id nulo E packaging_track nulo) seguem restritas ao responsável.

set lock_timeout = '5s';

drop policy if exists "tasks_select_member_or_own_or_privileged" on public.tasks;
create policy "tasks_select_member_or_own_or_privileged" on public.tasks
  for select to authenticated using (
    public.is_privileged()
    or (project_id is not null and exists (select 1 from public.project_members m where m.project_id = tasks.project_id and m.user_id = auth.uid()))
    or (project_id is null and packaging_track is not null)  -- demandas de embalagem: todos acompanham
    or (project_id is null and packaging_track is null and assignee_id = auth.uid())
  );

drop policy if exists "project_files_select_member_or_privileged" on public.project_files;
create policy "project_files_select_member_or_privileged" on public.project_files
  for select to authenticated using (
    public.is_privileged()
    or exists (select 1 from public.project_members m where m.project_id = project_files.project_id and m.user_id = auth.uid())
    or exists (select 1 from public.tasks t where t.id = project_files.task_id and t.packaging_track is not null)  -- arquivos de embalagem: todos veem
  );
