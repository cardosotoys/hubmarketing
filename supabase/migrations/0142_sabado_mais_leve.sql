-- SÁBADO MAIS LEVE: o sábado concentrava o feed da Playmi e o da Tópi (era o dia mais cheio do calendário, 56 itens até
-- dezembro, contra 24 da segunda). O post de sábado da Playmi passa para a segunda (ou quarta) da MESMA semana, então o teto
-- semanal (Playmi 3, Tópi 3, Cardoso 2) não muda. O Stories e o Status vão junto. No sábado fica só a Tópi.
--   07/11 Dino Sabidinho → qua 04/11 · 14/11 Trenzinho → seg 09/11 · 21/11 Guia de Natal → seg 16/11
--   28/11 Smurfs → seg 23/11 · 05/12 Guia 3+ → seg 30/11 · 12/12 Primeiro ano → seg 07/12 · 19/12 Última chamada → seg 14/12
--   26/12 e 02/01 (semanas de Natal e Ano-Novo) ficam no sábado.
-- Pode rodar de novo.

update public.social_plan_items i
   set pub_date = i.pub_date + v.dias,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + v.dias)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from i.pub_date + v.dias)::int] || '/26',
       updated_at = now()
  from public.social_topics t,
       (values ('plano-2026-10b:t034', '2026-11-07'::date, -3),
               ('plano-2026-10b:t032', '2026-11-14'::date, -5),
               ('plano-2026-10b:t054', '2026-11-21'::date, -5),
               ('plano-2026-10b:t064', '2026-11-28'::date, -5),
               ('plano-2026-10b:t074', '2026-12-05'::date, -5),
               ('plano-2026-10b:t083', '2026-12-12'::date, -5),
               ('plano-2026-10b:t092', '2026-12-19'::date, -5)) as v (k, era, dias)
 where t.id = i.topic_id and t.ext_key = v.k and not i.archived and i.stage <> 'publicado'
   and i.channel_id not in ('cd-li', 'cd-gmn')
   and exists (select 1 from public.social_plan_items m
                where m.topic_id = t.id and m.channel_id = 'pl-ig' and m.link_kind = 'matriz' and m.pub_date = v.era and not m.archived);

-- CONFERÊNCIA 1 — quantos itens por dia da semana (até 31/12)
select weekday, count(*) as itens
  from public.social_plan_items
 where not archived and stage <> 'publicado' and pub_date between '2026-11-02' and '2026-12-31'
 group by 1
 order by 2 desc;

-- CONFERÊNCIA 2 — Instagram por semana; a coluna "passou" tem que vir vazia
select date_trunc('week', i.pub_date)::date as semana,
       count(*) filter (where i.channel_id = 'pl-ig') as playmi,
       count(*) filter (where i.channel_id = 'tp-ig') as topi,
       count(*) filter (where i.channel_id = 'cd-ig') as cardoso,
       concat_ws(' ',
         case when count(*) filter (where i.channel_id = 'pl-ig') > 3 then 'PLAYMI' end,
         case when count(*) filter (where i.channel_id = 'tp-ig') > 3 then 'TÓPI' end,
         case when count(*) filter (where i.channel_id = 'cd-ig') > 2 then 'CARDOSO' end) as passou
  from public.social_plan_items i
 where i.channel_id in ('pl-ig', 'tp-ig', 'cd-ig') and i.piece_type <> 'Stories' and not i.archived and i.pub_date >= '2026-11-02'
 group by 1
 order by 1;
