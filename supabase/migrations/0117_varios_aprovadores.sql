-- Cardoso Marketing Hub — Centro de Conteúdo: um ou mais aprovadores.
--
-- Regra (decidida em 14/10/2026): QUALQUER aprovador decide. Todos veem a mesma fila; o primeiro que
-- aprovar ou pedir ajuste resolve o post, e ele sai da fila dos outros. O Hub guarda quem decidiu
-- (status_by / creative_by, que já existem).
--
-- social_plan_settings.approver_ids é a lista. approver_id continua existindo (= o primeiro da lista)
-- para nada antigo quebrar. Idempotente.

set lock_timeout = '5s';

alter table public.social_plan_settings add column if not exists approver_ids uuid[] not null default '{}';

-- quem já era o aprovador único vira o primeiro da lista
update public.social_plan_settings
   set approver_ids = array[approver_id]
 where id = 1 and approver_id is not null and cardinality(approver_ids) = 0;

-- é aprovador do Social?
create or replace function public.is_social_approver(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.social_plan_settings s
     where s.id = 1 and (uid = any (s.approver_ids) or s.approver_id = uid)
  )
$$;

-- liberação de materiais e banners: diretoria ou qualquer aprovador
create or replace function public.can_release_content()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_privileged() or public.is_social_approver(auth.uid())
$$;

-- pedido de aprovação avisa TODOS os aprovadores (menos quem pediu)
create or replace function public.notify_on_social_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ititle text;
  alvos uuid[];
begin
  if new.awaiting_review and not coalesce(old.awaiting_review, false) then
    select coalesce(nullif(s.approver_ids, '{}'), case when s.approver_id is null then '{}'::uuid[] else array[s.approver_id] end)
      into alvos
      from public.social_plan_settings s where s.id = 1;
    if new.approver_id is not null and not (new.approver_id = any (coalesce(alvos, '{}'))) then
      alvos := coalesce(alvos, '{}') || new.approver_id;
    end if;
    ititle := coalesce(nullif(new.pauta, ''), new.product, 'uma peça');
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    select a, new.review_by, 'approval', ititle, 'Pediu sua aprovação nesta peça.',
           '/redes-sociais?item=' || new.id::text || '&focus=comments'
      from unnest(coalesce(alvos, '{}')) as a
     where a <> coalesce(new.review_by, '00000000-0000-0000-0000-000000000000');
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

-- Conferência:
--   select approver_id, approver_ids from public.social_plan_settings;
