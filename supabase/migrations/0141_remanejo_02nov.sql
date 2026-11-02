-- REMANEJO DE 02/11/2026: de 29/10 em diante só saíram a Totokross (Playmi, qui 29/10 10h30, conferido no Business Suite)
-- e o Boliche (Tópi, sex 30/10, informado pelo Aldair). Roda Livre e o resto não saíram.
-- Mantém o teto semanal do Instagram (Playmi 3, Tópi 3, Cardoso 2), horário comercial, Google 1 por semana e LinkedIn semanal.
--   · Cardoso: Roda Livre vai para ter 03/11 10h; "Licenciados no Natal" vai para seg 09/11 no lugar de
--     "Licenciados que mais giram no Natal", que fica em espera (os dois falavam a mesma coisa)
--   · Tópi: Open Tracks vai para qua 11/11 no lugar do Air Truck (que já saiu na Cardoso em 10/10 e sai no Shorts);
--     Air Truck e Tópi Chef Menu ficam em espera (a linha Tópi Chef ainda tem 6 posts até o Natal)
--   · Google Meu Negócio: "Você conhece a Cardoso?" vai para qua 04/11; o de 06/11 sai para não ter 2 na semana
--   · YouTube Shorts: a sequência recomeça na ter 03/11 com o nº 1, de 3 em 3 dias (termina em 02/01)
--   · o que ficou para trás (Stories, Status) sai do calendário
-- Pode rodar de novo.

-- 1) o que saiu
update public.social_plan_items i
   set stage = 'publicado', stage_at = coalesce(i.stage_at, now()), pub_time = '10:30', mirror_facebook = true, updated_at = now(),
       caption = 'Antes da bicicleta, vem o equilíbrio. 🏍️❤️ A Totokross é a moto de equilíbrio desenvolvida para os pequenos a partir de 12 meses: senta, apoia os pés e ganha confiança a cada volta. Um presente que acompanha o crescimento. Onde encontrar: link na bio.'
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t014' and i.channel_id = 'pl-ig' and i.link_kind = 'matriz' and i.pub_date = '2026-10-29';

update public.social_topics set paused_at = null, updated_at = now()
 where ext_key = 'plano-2026-10b:t006' and paused_at is not null;

update public.social_plan_items i
   set archived = false, stage = 'publicado', stage_at = coalesce(i.stage_at, now()), updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t006' and i.channel_id = 'tp-ig' and i.link_kind = 'matriz' and i.pub_date = '2026-10-30';

-- 2) em espera
update public.social_topics t
   set paused_at = now(), updated_at = now()
  from (values ('plano-2026-10b:t037', 'Licenciados que mais giram%'), ('plano-2026-10d:t06', 'Air Truck%'), ('plano-2026-10d:t03', 'Tópi Chef Menu%')) as v (k, titulo)
 where t.ext_key = v.k and t.title like v.titulo and t.paused_at is null;

update public.social_plan_items i
   set archived = true, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key in ('plano-2026-10b:t037', 'plano-2026-10d:t06', 'plano-2026-10d:t03')
   and t.paused_at is not null and not i.archived and i.stage <> 'publicado';

-- 3) mudam de data com o Stories e o Status juntos (LinkedIn e Google têm data própria)
update public.social_plan_items i
   set pub_date = i.pub_date + v.dias,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + v.dias)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from i.pub_date + v.dias)::int] || '/26',
       updated_at = now()
  from public.social_topics t,
       (values ('plano-2026-10b:t003', 'cd-ig', '2026-10-29'::date, 5),
               ('plano-2026-10b:t027', 'cd-ig', '2026-11-03'::date, 6),
               ('plano-2026-10d:t02',  'tp-ig', '2026-10-29'::date, 13)) as v (k, canal, era, dias)
 where t.id = i.topic_id and t.ext_key = v.k and not i.archived and i.stage <> 'publicado'
   and i.channel_id not in ('cd-li', 'cd-gmn')
   and exists (select 1 from public.social_plan_items m
                where m.topic_id = t.id and m.channel_id = v.canal and m.link_kind = 'matriz' and m.pub_date = v.era and not m.archived);

update public.social_plan_items i
   set pub_time = '10:00', updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t003' and i.channel_id = 'cd-ig' and i.link_kind = 'matriz' and i.pub_date = '2026-11-03';

-- o LinkedIn da Roda Livre (03/11) passa para depois do Reels
update public.social_plan_items i
   set pub_time = '14:30', updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t003' and i.channel_id = 'cd-li' and i.pub_date = '2026-11-03' and i.stage <> 'publicado';

-- 4) Google Meu Negócio
update public.social_plan_items
   set pub_date = '2026-11-04', pub_time = '10:00', weekday = 'Quarta', month_label = 'Nov/26', updated_at = now()
 where ext_id = 'gmn-2026:01' and pub_date = '2026-10-29' and stage <> 'publicado';

update public.social_plan_items
   set archived = true, updated_at = now()
 where ext_id = 'gmn-2026:02' and stage <> 'publicado';

-- 5) YouTube Shorts: recomeça na ter 03/11 (o nº 1 estava em 28/10)
update public.social_plan_items i
   set pub_date = i.pub_date + 6,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + 6)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from i.pub_date + 6)::int]
                     || '/' || to_char(i.pub_date + 6, 'YY'),
       updated_at = now()
 where i.ext_id like 'shorts-2026:%' and not i.archived and i.stage <> 'publicado'
   and exists (select 1 from public.social_plan_items s where s.ext_id = 'shorts-2026:01:yt' and s.pub_date = '2026-10-28' and s.stage <> 'publicado');

-- 6) o que ficou para trás e não saiu sai do calendário
update public.social_plan_items
   set archived = true, updated_at = now()
 where pub_date < '2026-11-02' and stage <> 'publicado' and not archived;

-- CONFERÊNCIA — Instagram por semana a partir de hoje; a coluna "passou" tem que vir vazia
select date_trunc('week', i.pub_date)::date as semana,
       count(*) filter (where i.channel_id = 'pl-ig') as playmi,
       count(*) filter (where i.channel_id = 'tp-ig') as topi,
       count(*) filter (where i.channel_id = 'cd-ig') as cardoso,
       count(*) filter (where i.channel_id = 'cd-gmn') as google,
       count(*) filter (where i.channel_id = 'cd-li') as linkedin,
       concat_ws(' ',
         case when count(*) filter (where i.channel_id = 'pl-ig' and i.piece_type <> 'Stories') > 3 then 'PLAYMI' end,
         case when count(*) filter (where i.channel_id = 'tp-ig' and i.piece_type <> 'Stories') > 3 then 'TÓPI' end,
         case when count(*) filter (where i.channel_id = 'cd-ig' and i.piece_type <> 'Stories') > 2 then 'CARDOSO' end,
         case when count(*) filter (where i.channel_id = 'cd-gmn') > 1 then 'GOOGLE' end) as passou
  from public.social_plan_items i
 where i.channel_id in ('pl-ig', 'tp-ig', 'cd-ig', 'cd-gmn', 'cd-li') and (i.piece_type <> 'Stories') and not i.archived
   and i.pub_date >= '2026-11-02'
 group by 1
 order by 1;
