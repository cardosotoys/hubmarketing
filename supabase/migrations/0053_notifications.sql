-- Cardoso Marketing Hub — central de notificações persistida (lida/não-lida no banco)
-- Roda depois de 0001..0052. Retry-safe/idempotente.
--
-- Antes o "lido" ficava no localStorage (por aparelho) e as menções sumiam em 7 dias. Agora cada
-- notificação é uma linha em public.notifications, com read no banco (vale em qualquer aparelho) e
-- sem prazo pra sumir. Um trigger gera a notificação automaticamente quando alguém é mencionado
-- num comentário de tarefa.

set lock_timeout = '5s';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade, -- destinatário
  actor_id uuid references public.profiles (id),                           -- quem gerou
  type text not null default 'mention',
  title text not null default '',
  body text not null default '',
  task_id uuid,
  project_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notif_insert" on public.notifications;
create policy "notif_insert" on public.notifications for insert to authenticated with check (true);
drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own" on public.notifications for update to authenticated using (user_id = auth.uid());
drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_delete_own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Gera notificação de menção quando um comentário de tarefa é criado (security definer p/ ignorar RLS)
create or replace function public.notify_on_task_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  tname text;
begin
  select title into tname from public.tasks where id = new.task_id;
  foreach uid in array coalesce(new.mentioned_ids, '{}'::uuid[])
  loop
    if uid is not null and uid <> new.author_id then
      insert into public.notifications (user_id, actor_id, type, title, body, task_id)
      values (uid, new.author_id, 'mention', coalesce(tname, 'uma demanda'), new.body, new.task_id);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_task_comment on public.task_comments;
create trigger trg_notify_task_comment
  after insert on public.task_comments
  for each row execute function public.notify_on_task_comment();
