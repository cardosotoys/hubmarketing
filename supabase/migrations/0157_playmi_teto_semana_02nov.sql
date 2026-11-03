-- PLAYMI: NO MÁXIMO 3 POSTS NO FEED POR SEMANA — SEMANA DE 02 A 08/11 (03/11/2026)
-- A semana tinha 4 (o 4º era a Doce Cozinha Gourmet, sábado 07/11, e sábado é dia só da Tópi). Todas as semanas
-- seguintes até 05/01 já estão com 3, então a fila de produto anda uma vaga: a Doce Cozinha entra na seg 09/11 e
-- cada post de produto sem data pega a vaga do seguinte. Os de data fixa (Guias de Natal, "Presente para…",
-- Smurfs de Natal, Última chamada, Belinha, Natal, Ano-Novo, férias, volta às aulas) não mudam.
-- O último da fila, Girafa de Atividades (17/12), fica em espera para depois de 05/01.
-- Stories, Status e Pinterest de cada assunto andam junto (mesma diferença de dias); LinkedIn, Google e Shorts não.
-- WhatsApp que cair no fim de semana vai para a segunda. Datas fixas: pode rodar de novo.

set lock_timeout = '5s';

-- 1) Girafa de Atividades em espera
update public.social_topics set paused_at = now(), updated_at = now()
 where ext_key = 'plano-2026-10b:t090' and paused_at is null;

update public.social_plan_items i
   set archived = true, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t090' and t.paused_at is not null
   and not i.archived and i.stage <> 'publicado' and i.channel_id not like 'cd-yt-%';

-- 2) a fila: cada assunto na sua vaga
with vaga (k, data, hora) as (values
  ('plano-2026-10b:t028', '2026-11-09'::date, '10:30'),   -- Doce Cozinha Gourmet
  ('plano-2026-10b:t032', '2026-11-10'::date, '09:00'),   -- Trenzinho Didático
  ('plano-2026-10b:t039', '2026-11-17'::date, '16:00'),   -- Eletronic Parking Bombeiro
  ('plano-2026-10b:t049', '2026-11-19'::date, '11:00'),   -- Estação de Bombeiro
  ('plano-2026-10b:t052', '2026-11-24'::date, '08:30'),   -- Mesinha Criativa
  ('plano-2026-10b:t059', '2026-11-26'::date, '17:00'),   -- Fofush Falante
  ('plano-2026-10b:t062', '2026-12-01'::date, '14:00'),   -- Totokinha Princesas
  ('plano-2026-10b:t069', '2026-12-03'::date, '10:30'),   -- Bonecas Luna
  ('plano-2026-10b:t072', '2026-12-08'::date, '11:00'),   -- Moto Speed XR
  ('plano-2026-10b:t078', '2026-12-10'::date, '15:00'),   -- City Truck
  ('plano-2026-10b:t081', '2026-12-17'::date, '09:00')    -- Dino Jurássico
),
alvo as (
  select t.id as topic_id, v.data, v.hora,
         v.data - (select m.pub_date from public.social_plan_items m
                    where m.topic_id = t.id and m.channel_id = 'pl-ig' and m.link_kind = 'matriz' and not m.archived
                    order by m.pub_date desc limit 1) as dias
    from vaga v join public.social_topics t on t.ext_key = v.k
)
update public.social_plan_items i
   set pub_date = i.pub_date + a.dias,
       pub_time = case when i.channel_id = 'pl-ig' and i.link_kind = 'matriz' then a.hora::time else i.pub_time end,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + a.dias)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from i.pub_date + a.dias)::int] || '/26',
       updated_at = now()
  from alvo a
 where i.topic_id = a.topic_id and a.dias is not null and a.dias <> 0
   and not i.archived and i.stage <> 'publicado'
   and i.channel_id not in ('cd-li', 'cd-gmn') and i.channel_id not like 'cd-yt-%';

-- 3) WhatsApp nunca no fim de semana
update public.social_plan_items
   set pub_date = pub_date + case extract(dow from pub_date)::int when 6 then 2 else 1 end, weekday = 'Segunda', updated_at = now()
 where channel_id like 'wa-%' and extract(dow from pub_date) in (0, 6) and not archived and stage <> 'publicado' and pub_date >= '2026-11-03';

-- CONFERÊNCIA — Playmi no feed do Instagram por semana (nenhuma pode passar de 3)
select date_trunc('week', i.pub_date)::date as semana, count(*) as posts_playmi,
       string_agg(to_char(i.pub_date, 'DD/MM') || ' ' || left(i.pauta, 28), ' · ' order by i.pub_date, i.pub_time) as ordem
  from public.social_plan_items i
 where i.channel_id = 'pl-ig' and i.piece_type <> 'Stories' and not i.archived and i.pub_date between '2026-11-02' and '2027-01-10'
 group by 1
 order by 1;
