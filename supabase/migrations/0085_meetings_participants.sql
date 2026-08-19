-- Cardoso Marketing Hub — Reuniões: horário + participantes (usuários do hub) + notificação.
-- Participantes selecionados entram no Calendário deles e recebem notificação. Roda depois de 0084.
-- Idempotente.

set lock_timeout = '5s';

alter table public.meetings add column if not exists meeting_time time;
alter table public.meetings add column if not exists participant_ids uuid[] not null default '{}';

-- Notifica quem foi incluído como participante (na criação ou ao adicionar depois).
create or replace function public.notify_meeting_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid; added uuid[]; actor uuid; quando text;
begin
  if tg_op = 'INSERT' then
    added := new.participant_ids;
  else
    added := array(select unnest(new.participant_ids) except select unnest(old.participant_ids));
  end if;
  actor := coalesce(new.updated_by, new.created_by);
  quando := case when new.meeting_date is not null
                 then ' em ' || to_char(new.meeting_date, 'DD/MM')
                      || case when new.meeting_time is not null then ' às ' || to_char(new.meeting_time, 'HH24:MI') else '' end
                 else '' end;
  foreach uid in array coalesce(added, '{}'::uuid[])
  loop
    if uid is not null and uid <> coalesce(actor, '00000000-0000-0000-0000-000000000000') then
      insert into public.notifications (user_id, actor_id, type, title, body, link)
      values (uid, actor, 'mention',
              'Reunião: ' || coalesce(nullif(new.agency, ''), nullif(new.brand, ''), 'sem título'),
              'Você foi incluído em uma reunião' || quando || '.',
              '/reunioes?meeting=' || new.id::text);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_meeting_participants on public.meetings;
create trigger trg_notify_meeting_participants
  after insert or update of participant_ids on public.meetings
  for each row execute function public.notify_meeting_participants();
