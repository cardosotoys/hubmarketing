-- Horários em horário comercial e variados (pedido do Aldair, 23/10/2026), para depois comparar resultado por horário.
-- Vale para tudo o que ainda não saiu, de amanhã (24/10) em diante, nas três marcas:
--   · post principal (Reels, carrossel, feed, LinkedIn, aviso): gira entre 8h30 e 17h, sem almoço;
--   · Stories que repete o post no mesmo dia: depois do post, fora do almoço;
--   · os demais (Stories novo, TikTok, YouTube, Status, Pinterest, Google): giram entre 8h e 17h30.
-- Cada marca tem a sua própria rotação. Nada entre 12h e 13h59 nem depois das 18h.
-- Hoje (23/10): o Reels da Tópi (Cegonheiro) vai para 16h e o Stories dele para 18h.
-- Pode rodar de novo (mantém a mesma rotação).

-- 1) post principal
with m as (
  select id, row_number() over (partition by brand order by pub_date, coalesce(ext_id, id::text)) as rn
    from public.social_plan_items
   where link_kind = 'matriz' and not archived and stage not in ('agendado', 'publicado')
     and pub_date >= '2026-10-24'
)
update public.social_plan_items i
   set pub_time = ((array['09:00','14:00','10:30','16:00','11:00','15:00','08:30','17:00'])[((m.rn - 1) % 8) + 1])::time,
       updated_at = now()
  from m where i.id = m.id;

-- 2) Stories que repete o post no mesmo dia: 2h depois, ou 2h antes se passar das 18h
update public.social_plan_items s
   set pub_time = case to_char(r.pub_time, 'HH24:MI')
                    when '08:30' then '10:30' when '09:00' then '11:00' when '10:30' then '15:30' when '11:00' then '16:30'
                    when '14:00' then '16:00' when '15:00' then '17:00' when '16:00' then '18:00' else '18:00' end::time,
       updated_at = now()
  from public.social_plan_items r
 where r.topic_id = s.topic_id and r.link_kind = 'matriz' and not r.archived
   and s.link_kind = 'reaproveita' and s.piece_type = 'Stories' and s.pub_date = r.pub_date
   and not s.archived and s.stage not in ('agendado', 'publicado')
   and s.pub_date >= '2026-10-24';

-- 3) os demais destinos
with d as (
  select s.id, row_number() over (partition by s.brand order by s.pub_date, coalesce(s.ext_id, s.id::text)) as rn
    from public.social_plan_items s
   where s.link_kind <> 'matriz' and not s.archived and s.stage not in ('agendado', 'publicado')
     and s.pub_date >= '2026-10-24'
     and not (s.link_kind = 'reaproveita' and s.piece_type = 'Stories'
              and exists (select 1 from public.social_plan_items r
                           where r.topic_id = s.topic_id and r.link_kind = 'matriz' and r.pub_date = s.pub_date and not r.archived))
)
update public.social_plan_items i
   set pub_time = ((array['10:00','15:30','09:30','14:30','11:30','16:30','08:00','17:30'])[((d.rn - 1) % 8) + 1])::time,
       updated_at = now()
  from d where i.id = d.id;

-- 4) hoje: Reels da Tópi às 16h e o Stories às 18h
update public.social_plan_items s
   set pub_time = case when s.link_kind = 'matriz' then '16:00'::time else '18:00'::time end, updated_at = now()
  from public.social_topics t
 where t.id = s.topic_id and t.ext_key = 'plano-2026-10d:t01' and s.pub_date = '2026-10-23'
   and not s.archived and s.stage not in ('agendado', 'publicado');

-- CONFERÊNCIA 1 — deve mostrar 0 (nada à noite nem no almoço, de hoje em diante)
select count(*) as fora_do_comercial
  from public.social_plan_items
 where not archived and stage not in ('agendado', 'publicado') and pub_date >= '2026-10-24'
   and (pub_time >= '18:01' or pub_time < '08:00' or (pub_time >= '12:00' and pub_time < '14:00'));

-- CONFERÊNCIA 2 — quantos posts em cada horário, por marca (para ver a variedade)
select brand, to_char(pub_time, 'HH24:MI') as horario, count(*) as posts
  from public.social_plan_items
 where not archived and stage not in ('agendado', 'publicado') and pub_date >= '2026-10-24'
 group by 1, 2 order by 1, 2;
