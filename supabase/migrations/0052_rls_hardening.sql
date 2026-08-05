-- Cardoso Marketing Hub — endurecimento de RLS (fase 1, não-quebra-nada) + unificar desativação
-- Roda depois de 0001..0051. Retry-safe/idempotente.
--
-- Fecha buracos estruturais achados na auditoria, sem mudar o comportamento do time de hoje:
--  P1) project_members: qualquer autenticado se auto-inseria em QUALQUER projeto e passava a ler
--      tudo dele (o isolamento por membro de 0025 era contornável). Agora só privilegiado, dono do
--      projeto, ou quem JÁ é membro pode gerenciar membros.
--  P5) task_comments: os comentários de tarefa eram legíveis por todos, mesmo com a tarefa restrita.
--      Agora seguem a visibilidade da tarefa (ou quem foi mencionado).
--  (a) Unificar "desativado × banido": marca disabled=true quem já está bloqueado no login.
--
-- Os itens P2/P3/P4 da auditoria (delete/update abertos e isolamento por SETOR) mudam comportamento
-- e precisam de uma dimensão de "departamento" — ficam pra fase 2, junto com a entrada do 2º setor.

set lock_timeout = '5s';

-- Helper: checa participação SEM disparar RLS (evita recursão numa policy da própria tabela)
create or replace function public.is_project_member(p_project uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members m where m.project_id = p_project and m.user_id = p_user
  );
$$;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;

-- P1) project_members: só privilegiado, dono do projeto ou membro atual pode inserir/remover
drop policy if exists "project_members_write_authenticated" on public.project_members;
drop policy if exists "project_members_insert_owner_or_privileged" on public.project_members;
create policy "project_members_insert_owner_or_privileged" on public.project_members
  for insert to authenticated with check (
    public.is_privileged()
    or exists (select 1 from public.projects p where p.id = project_members.project_id and p.created_by = auth.uid())
    or public.is_project_member(project_members.project_id, auth.uid())
  );

drop policy if exists "project_members_delete_authenticated" on public.project_members;
drop policy if exists "project_members_delete_owner_or_privileged" on public.project_members;
create policy "project_members_delete_owner_or_privileged" on public.project_members
  for delete to authenticated using (
    public.is_privileged()
    or exists (select 1 from public.projects p where p.id = project_members.project_id and p.created_by = auth.uid())
    or public.is_project_member(project_members.project_id, auth.uid())
  );

-- P5) task_comments: leitura segue a visibilidade da tarefa; mencionado sempre vê (pra não perder notificação)
drop policy if exists "task_comments_select_authenticated" on public.task_comments;
drop policy if exists "task_comments_select_via_task" on public.task_comments;
create policy "task_comments_select_via_task" on public.task_comments
  for select to authenticated using (
    public.is_privileged()
    or auth.uid() = any (mentioned_ids)
    or exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and (
          (t.project_id is not null and exists (
            select 1 from public.project_members m where m.project_id = t.project_id and m.user_id = auth.uid()
          ))
          or (t.project_id is null and t.packaging_track is not null)
          or (t.project_id is null and t.packaging_track is null and t.assignee_id = auth.uid())
        )
    )
  );

-- (a) Unificar desativação: quem já está banido no login vira "desativado" (some dos seletores, etc.)
update public.profiles p
set disabled = true
from auth.users u
where u.id = p.id
  and u.banned_until is not null
  and u.banned_until > now()
  and p.disabled = false;
