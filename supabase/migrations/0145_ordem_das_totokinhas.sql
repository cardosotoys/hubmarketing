-- ORDEM DAS TOTOKINHAS NA PLAYMI (pedido do Aldair, 02/11/2026):
--   1) ter 03/11 11h   Totokinha Bolinha (CARROSSEL)
--   2) qua 04/11 15h30 Totokinha Sport Azul
--   3) qui 05/11 15h   "Primeiros passos, grandes descobertas" (carrossel com todos os modelos de Totokinha)
--   e segue normal: o Dino Sabidinho Plus (que estava em 04/11) vai para qui 12/11 14h, a vaga que era da Bolinha.
-- As duas semanas da Playmi continuam com 3 posts. WhatsApp só de segunda a sexta. Pode rodar de novo.

-- Totokinha Sport Azul: um dia depois (Stories e Status juntos)
update public.social_plan_items i
   set pub_date = i.pub_date + 1,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + 1)::int + 1],
       pub_time = case when i.link_kind = 'matriz' and i.channel_id = 'pl-ig' then '15:30'::time else i.pub_time end,
       updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t022' and not i.archived and i.stage <> 'publicado'
   and i.channel_id not in ('cd-li', 'cd-gmn')
   and exists (select 1 from public.social_plan_items m
                where m.topic_id = t.id and m.channel_id = 'pl-ig' and m.link_kind = 'matriz' and m.pub_date = '2026-11-03' and not m.archived);

-- Dino Sabidinho Plus: de qua 04/11 para qui 12/11 (Stories e Status juntos)
update public.social_plan_items i
   set pub_date = i.pub_date + 8,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + 8)::int + 1],
       pub_time = case when i.link_kind = 'matriz' and i.channel_id = 'pl-ig' then '14:00'::time
                       when i.channel_id = 'pl-ig' and i.piece_type = 'Stories' and i.pub_date = '2026-11-04' then '16:00'::time
                       else i.pub_time end,
       updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t034' and not i.archived and i.stage <> 'publicado'
   and i.channel_id not in ('cd-li', 'cd-gmn')
   and exists (select 1 from public.social_plan_items m
                where m.topic_id = t.id and m.channel_id = 'pl-ig' and m.link_kind = 'matriz' and m.pub_date = '2026-11-04' and not m.archived);

-- Totokinha Bolinha: primeira da fila, em carrossel
update public.social_topics set paused_at = null, updated_at = now()
 where ext_key = 'plano-2026-10b:t019' and paused_at is not null;

update public.social_plan_items i
   set archived = false, pub_date = v.data, pub_time = v.hora::time,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       month_label = 'Nov/26',
       piece_type = case when v.tipo = 'matriz' then 'Feed' else i.piece_type end,
       format = case when v.tipo = 'matriz' then 'Carrossel' else i.format end,
       updated_at = now()
  from public.social_topics t,
       (values ('pl-ig', 'matriz', '2026-11-03'::date, '11:00'),
               ('pl-ig', 'reaproveita', '2026-11-03'::date, '15:30'),
               ('wa-st', 'reaproveita', '2026-11-04'::date, '10:30')) as v (canal, tipo, data, hora)
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t019' and i.channel_id = v.canal and i.link_kind = v.tipo
   and i.stage <> 'publicado';

-- "Primeiros passos, grandes descobertas" é carrossel
update public.social_plan_items i
   set piece_type = 'Feed', format = 'Carrossel', updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t024' and i.channel_id = 'pl-ig' and i.link_kind = 'matriz'
   and i.stage <> 'publicado' and (i.piece_type <> 'Feed' or i.format <> 'Carrossel');

-- WhatsApp que tenha caído no fim de semana vai para a segunda
update public.social_plan_items
   set pub_date = pub_date + case extract(dow from pub_date)::int when 6 then 2 else 1 end, weekday = 'Segunda', updated_at = now()
 where channel_id like 'wa-%' and extract(dow from pub_date) in (0, 6) and not archived and stage <> 'publicado' and pub_date >= '2026-11-02';

-- CONFERÊNCIA — Playmi nas duas semanas (3 posts cada) na ordem
select i.pub_date, i.weekday, to_char(i.pub_time, 'HH24:MI') as hora, i.format, i.pauta
  from public.social_plan_items i
 where i.channel_id = 'pl-ig' and i.piece_type <> 'Stories' and not i.archived and i.pub_date between '2026-11-02' and '2026-11-15'
 order by 1, 3;
