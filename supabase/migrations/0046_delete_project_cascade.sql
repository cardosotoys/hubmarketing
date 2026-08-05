-- Cardoso Marketing Hub — excluir projeto em cascata (pela tela, sem travar em FK)
-- Roda depois de 0001..0045. Retry-safe/idempotente.
--
-- O app só fazia "delete from projects" — que trava quando o projeto tem demandas,
-- relatórios, etc. (FK RESTRICT), falhando em silêncio. Esta função apaga todos os
-- filhos antes e só pode ser executada por Diretoria/Administrador.

set lock_timeout = '5s';

create or replace function public.delete_project_cascade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_privileged() then
    raise exception 'Apenas Diretoria/Administrador podem excluir projetos.';
  end if;

  delete from public.task_comments        where task_id in (select id from public.tasks where project_id = p_id);
  delete from public.task_checklist_items where task_id in (select id from public.tasks where project_id = p_id);
  delete from public.activity_log         where task_id in (select id from public.tasks where project_id = p_id);
  delete from public.project_files        where project_id = p_id or task_id in (select id from public.tasks where project_id = p_id);
  update public.daily_reports set project_id = null where project_id = p_id;
  delete from public.campaign_budget_items where project_id = p_id;
  delete from public.campaign_risks        where project_id = p_id;
  delete from public.campaign_decisions    where project_id = p_id;
  delete from public.audit_items           where project_id = p_id;
  delete from public.tasks                 where project_id = p_id;
  delete from public.stages                where project_id = p_id;
  delete from public.project_members       where project_id = p_id;
  delete from public.comments              where project_id = p_id;
  delete from public.checklist_items       where project_id = p_id;
  delete from public.activity_log          where project_id = p_id;
  delete from public.projects              where id = p_id;
end;
$$;

grant execute on function public.delete_project_cascade(uuid) to authenticated;
