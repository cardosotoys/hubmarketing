-- Cardoso Marketing Hub — nada de post no horário de almoço (pedido do Aldair, 21/10/2026).
--
-- Os Reels de Playmi e Tópi estavam às 12h. Passam para:
--   · dia de semana: Reels 19h e o Stories que reaproveita o Reels 21h (era 19h30);
--   · sábado: Reels 10h (manhã de fim de semana); o Stories reaproveitado continua 19h30, antes do
--     carrossel das 20h30.
-- Cardoso fica como está (Instagram 11h, LinkedIn 8h30). Só mexe no que ainda não saiu. Idempotente.

-- 1) Stories que reaproveitam um Reels de dia de semana: 19h30 → 21h (antes de mudar o Reels)
update public.social_plan_items s
   set pub_time = '21:00', updated_at = now()
  from public.social_plan_items r
 where r.topic_id = s.topic_id
   and r.link_kind = 'matriz' and r.piece_type = 'Reels' and r.network = 'Instagram'
   and r.brand in ('Playmi', 'Tópi') and r.pub_time = '12:00'
   and extract(dow from r.pub_date) between 1 and 5
   and s.link_kind = 'reaproveita' and s.piece_type = 'Stories' and s.network = 'Instagram'
   and s.pub_date = r.pub_date and s.pub_time = '19:30'
   and not s.archived and s.stage not in ('agendado', 'publicado');

-- 2) Reels 12h → 19h (dia de semana) ou 10h (sábado)
update public.social_plan_items
   set pub_time = case when extract(dow from pub_date) = 6 then '10:00'::time else '19:00'::time end,
       updated_at = now()
 where brand in ('Playmi', 'Tópi') and pub_time = '12:00'
   and not archived and stage not in ('agendado', 'publicado');

-- Conferência: deve dar 0 (nada às 12h)
--   select count(*) from public.social_plan_items where not archived and stage <> 'publicado' and pub_time = '12:00';
