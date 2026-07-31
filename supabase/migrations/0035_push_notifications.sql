-- Cardoso Marketing Hub — notificações push (funcionam com o app fechado/celular bloqueado)
--
-- Guarda a inscrição push (Web Push API) de cada aparelho por usuário, e dispara automaticamente
-- via trigger quando alguém é mencionado num comentário de tarefa — mesmo mecanismo já usado pelo
-- mpm-sync (pg_net chamando uma Edge Function via HTTP), só que acionado por um trigger de
-- INSERT em vez de um agendamento cron.

create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_id_idx on public.push_subscriptions(profile_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = profile_id);

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = profile_id);

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = profile_id);

-- Troque <project-ref> e <service-role-key> pelos valores reais do seu projeto (Settings → API)
-- antes de rodar esta migration — igual ao passo do pg_cron do Monitor de Preços. Nunca cole a
-- service-role-key em nenhum arquivo do repositório, só aqui no SQL Editor.
create or replace function public.notify_push_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(array_length(new.mentioned_ids, 1), 0) > 0 then
    perform net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <service-role-key>',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'mentioned_ids', new.mentioned_ids,
        'comment_id', new.id
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists task_comment_push_notify on public.task_comments;

create trigger task_comment_push_notify
  after insert on public.task_comments
  for each row execute function public.notify_push_on_mention();
