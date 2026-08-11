-- Cardoso Marketing Hub — notificar participantes da demanda (não só menção explícita)
-- Roda depois de 0001..0065. Retry-safe/idempotente.
--
-- Antes: só quem era @mencionado recebia notificação. Agora, ao comentar/responder numa demanda,
-- também são notificados: o RESPONSÁVEL pela demanda e QUEM JÁ COMENTOU nela (participantes),
-- além de quem teve o comentário respondido (thread). Sempre excluindo o autor e evitando duplicar
-- com quem já foi @mencionado. A movimentação automática (Monday, edições em massa) continua fora —
-- só aparece na Auditoria / "Nos seus projetos".

set lock_timeout = '5s';

create or replace function public.notify_on_task_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  tname text;
  parent_author uuid;
  mentioned uuid[] := coalesce(new.mentioned_ids, '{}'::uuid[]);
  already uuid[] := coalesce(new.mentioned_ids, '{}'::uuid[]); -- quem já vai receber (evita duplicar)
begin
  select title into tname from public.tasks where id = new.task_id;

  -- 1) Menções explícitas (@) — tipo 'mention'
  foreach uid in array mentioned loop
    if uid is not null and uid <> new.author_id then
      insert into public.notifications (user_id, actor_id, type, title, body, task_id)
      values (uid, new.author_id, 'mention', coalesce(tname, 'uma demanda'), new.body, new.task_id);
    end if;
  end loop;

  -- 2) Resposta em thread: avisa o autor do comentário respondido — tipo 'reply'
  if new.parent_id is not null then
    select author_id into parent_author from public.task_comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id and not (parent_author = any(already)) then
      insert into public.notifications (user_id, actor_id, type, title, body, task_id)
      values (parent_author, new.author_id, 'reply', coalesce(tname, 'uma demanda'), new.body, new.task_id);
      already := already || parent_author;
    end if;
  end if;

  -- 3) Participantes da demanda: responsável + quem já comentou — tipo 'comment'
  for uid in
    select distinct p from (
      select assignee_id as p from public.tasks where id = new.task_id and assignee_id is not null
      union
      select author_id from public.task_comments where task_id = new.task_id and author_id is not null
    ) s
    where p <> new.author_id and not (p = any(already))
  loop
    insert into public.notifications (user_id, actor_id, type, title, body, task_id)
    values (uid, new.author_id, 'comment', coalesce(tname, 'uma demanda'), new.body, new.task_id);
    already := already || uid;
  end loop;

  return new;
end;
$$;
