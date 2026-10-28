-- TETO SEMANAL DO INSTAGRAM (post de feed ou Reels; Stories não contam), semana de segunda a domingo:
--   Playmi no máximo 3, Tópi no máximo 3, Cardoso no máximo 2.
-- Passavam do teto: Playmi semana 26/10 (4) e semana 02/11 (4); Tópi semana 26/10 (5); Cardoso semana 16/11 (3).
--   · Playmi: Totokinha Bolinha (31/10) e Doce Cozinha Gourmet (07/11) ficam em espera
--     (as Totokinhas já saem em 03 e 05/11; a Doce Cozinha Plus sai em 12/11)
--   · Tópi: Mesinha de Atividades vai de 31/10 para sex 18/12 (a semana de 14/12 tinha só 2);
--     o carrossel do Boliche (30/10) fica em espera (o Boliche sai no Shorts de 30/11)
--   · Cardoso: "Personagens que vendem: as licenças" (16/11) fica em espera (licenciados já saem em 03, 09 e 30/11 e 07/12)
-- Pode rodar de novo.

-- 1) em espera: o assunto fica marcado e os destinos dele saem do calendário
update public.social_topics t
   set paused_at = now()
  from (values
    ('plano-2026-10b:t019', 'Totokinha Bolinha%'),
    ('plano-2026-10b:t028', 'Doce Cozinha Gourmet%'),
    ('plano-2026-10b:t006', '3 jeitos de brincar com o Boliche%'),
    ('plano-2026-10b:t031', 'Personagens que vendem%')
  ) as v (ext_key, titulo)
 where t.ext_key = v.ext_key and t.title like v.titulo and t.paused_at is null;

update public.social_plan_items i
   set archived = true, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.paused_at is not null and not i.archived and i.stage <> 'publicado'
   and t.ext_key in ('plano-2026-10b:t019', 'plano-2026-10b:t028', 'plano-2026-10b:t006', 'plano-2026-10b:t031');

-- 2) Mesinha de Atividades (Tópi): de sáb 31/10 para sex 18/12, com o Stories junto
update public.social_plan_items i
   set pub_date = i.pub_date + 48,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + 48)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from i.pub_date + 48)::int] || '/26',
       updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t015' and t.title like 'Mesinha de Atividades%'
   and i.pub_date = '2026-10-31' and not i.archived and i.stage <> 'publicado';

-- CONFERÊNCIA — posts de Instagram por semana; a coluna "passou" tem que vir vazia em todas as linhas
select date_trunc('week', i.pub_date)::date as semana,
       count(*) filter (where i.channel_id = 'pl-ig') as playmi,
       count(*) filter (where i.channel_id = 'tp-ig') as topi,
       count(*) filter (where i.channel_id = 'cd-ig') as cardoso,
       concat_ws(' ',
         case when count(*) filter (where i.channel_id = 'pl-ig') > 3 then 'PLAYMI' end,
         case when count(*) filter (where i.channel_id = 'tp-ig') > 3 then 'TÓPI' end,
         case when count(*) filter (where i.channel_id = 'cd-ig') > 2 then 'CARDOSO' end) as passou
  from public.social_plan_items i
 where i.channel_id in ('pl-ig', 'tp-ig', 'cd-ig') and i.piece_type <> 'Stories' and not i.archived
   and i.pub_date >= '2026-10-26'
 group by 1
 order by 1;
