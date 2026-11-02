-- TOTOKINHA BOLINHA VOLTA (o post está pronto e não foi ao ar): entra na qui 12/11 às 14h, no lugar da Doce Cozinha Plus,
-- que fica em espera (a Doce Cozinha Plus Chá já saiu na Playmi em 31/08 e ainda sai no Shorts nº 21).
-- A semana de 09/11 da Playmi continua com 3 posts. Totokinhas antes: Sport Azul 03/11 e carrossel 05/11.
-- Stories no mesmo dia às 16h; Status do WhatsApp na sex 13/11 às 10h30 (WhatsApp não vai no fim de semana).
-- Pode rodar de novo.

-- Doce Cozinha Plus em espera
update public.social_topics set paused_at = now(), updated_at = now()
 where ext_key = 'plano-2026-10b:t042' and title like 'Doce Cozinha Plus%' and paused_at is null;

update public.social_plan_items i
   set archived = true, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t042' and t.paused_at is not null and not i.archived and i.stage <> 'publicado';

-- Totokinha Bolinha de volta
update public.social_topics set paused_at = null, updated_at = now()
 where ext_key = 'plano-2026-10b:t019' and paused_at is not null;

update public.social_plan_items i
   set archived = false, pub_date = v.data, pub_time = v.hora::time,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       month_label = 'Nov/26', updated_at = now()
  from public.social_topics t,
       (values ('pl-ig', 'matriz', '2026-11-12'::date, '14:00'),
               ('pl-ig', 'reaproveita', '2026-11-12'::date, '16:00'),
               ('wa-st', 'reaproveita', '2026-11-13'::date, '10:30')) as v (canal, tipo, data, hora)
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t019' and i.channel_id = v.canal and i.link_kind = v.tipo
   and i.stage <> 'publicado';

-- CONFERÊNCIA — Playmi por semana (até 3) e onde a Bolinha ficou
select date_trunc('week', i.pub_date)::date as semana, count(*) as posts_playmi,
       string_agg(to_char(i.pub_date, 'DD/MM') || ' ' || left(i.pauta, 30), ' · ' order by i.pub_date) as posts
  from public.social_plan_items i
 where i.channel_id = 'pl-ig' and i.piece_type <> 'Stories' and not i.archived and i.pub_date between '2026-11-02' and '2026-11-29'
 group by 1
 order by 1;
