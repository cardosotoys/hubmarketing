-- Cardoso Marketing Hub — Social: fluxo de aprovação com aprovador oficial.
-- "Enviar para aprovação" marca a peça, atribui ao aprovador oficial e o notifica
-- automaticamente (sem depender de @menção). Roda depois de 0076..0079. Idempotente.

set lock_timeout = '5s';

-- estado de revisão na peça
alter table public.social_plan_items add column if not exists awaiting_review boolean not null default false;
alter table public.social_plan_items add column if not exists approver_id uuid references public.profiles (id);
alter table public.social_plan_items add column if not exists review_by uuid references public.profiles (id);
alter table public.social_plan_items add column if not exists review_at timestamptz;
create index if not exists social_plan_items_review_idx on public.social_plan_items (approver_id, awaiting_review);

-- singleton de configuração: quem é o aprovador oficial do Social
create table if not exists public.social_plan_settings (
  id int primary key default 1,
  approver_id uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint social_plan_settings_singleton check (id = 1)
);
insert into public.social_plan_settings (id) values (1) on conflict (id) do nothing;

alter table public.social_plan_settings enable row level security;
drop policy if exists "sps_select" on public.social_plan_settings;
create policy "sps_select" on public.social_plan_settings for select to authenticated using (true);
drop policy if exists "sps_write" on public.social_plan_settings;
create policy "sps_write" on public.social_plan_settings for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

-- trigger: ao entrar em "aguardando aprovação", notifica o aprovador atribuído
create or replace function public.notify_on_social_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ititle text;
begin
  if new.awaiting_review and not coalesce(old.awaiting_review, false)
     and new.approver_id is not null and new.approver_id <> coalesce(new.review_by, '00000000-0000-0000-0000-000000000000') then
    ititle := coalesce(nullif(new.pauta, ''), new.product, 'uma peça');
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    values (new.approver_id, new.review_by, 'approval', ititle, 'Pediu sua aprovação nesta peça.',
            '/redes-sociais?item=' || new.id::text || '&focus=comments');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_social_review on public.social_plan_items;
create trigger trg_notify_social_review
  after update on public.social_plan_items
  for each row execute function public.notify_on_social_review();
