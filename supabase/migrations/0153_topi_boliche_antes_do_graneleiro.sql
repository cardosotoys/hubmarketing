-- TÓPI: O BOLICHE VEM ANTES DO GRANELEIRO (03/11/2026)
-- O carrossel "3 jeitos de brincar com o Boliche" tinha ficado em espera. Ele volta na qua 04/11, na vaga do Graneleiro,
-- e a fila da Tópi anda uma vaga. Posts com data (Amigo secreto, Guia de Natal, Presente até 3 anos, verão, Natal,
-- férias, Ano-Novo) não mudam. Para caber no teto de 3 por semana, a "Tópi Chef Cozinha: preparar, cozinhar e servir"
-- (a sexta peça Tópi Chef) fica em espera.
-- Cada assunto vai para a data e a hora da vaga; Stories e Status andam junto (mesma diferença de dias).
-- WhatsApp que cair no fim de semana vai para a segunda. Datas fixas: pode rodar de novo.

-- 1) Boliche sai da espera (o carrossel e o Stories dele)
update public.social_topics set paused_at = null, updated_at = now()
 where ext_key = 'plano-2026-10b:t006' and paused_at is not null;

update public.social_plan_items i
   set archived = false, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t006' and i.channel_id = 'tp-ig' and i.stage <> 'publicado' and i.archived;

-- 2) Tópi Chef Cozinha em espera
update public.social_topics set paused_at = now(), updated_at = now()
 where ext_key = 'plano-2026-10d:t11' and title like 'Tópi Chef Cozinha%' and paused_at is null;

update public.social_plan_items i
   set archived = true, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10d:t11' and t.paused_at is not null and not i.archived and i.stage <> 'publicado';

-- 3) a fila: cada assunto na sua vaga (a diferença de dias vale para o Stories e o Status do assunto)
with vaga (k, data, hora) as (values
  ('plano-2026-10b:t006', '2026-11-04'::date, '11:00'),   -- Boliche (carrossel)
  ('plano-2026-10d:t04',  '2026-11-06'::date, '15:00'),   -- Invictus Graneleiro
  ('plano-2026-10d:t05',  '2026-11-07'::date, '08:30'),   -- Tópi Chef Chá da Tarde
  ('plano-2026-10b:t025', '2026-11-11'::date, '15:00'),   -- Monte a cozinha de faz de conta
  ('plano-2026-10d:t02',  '2026-11-13'::date, '09:00'),   -- Open Tracks Retroescavadeira
  ('plano-2026-10d:t07',  '2026-11-18'::date, '10:30'),   -- Tópi Chef Brunch
  ('plano-2026-10d:t08',  '2026-11-20'::date, '16:00'),   -- Jeep Rally
  ('plano-2026-10d:t09',  '2026-11-25'::date, '15:00'),   -- Invictus Basculante
  ('plano-2026-10d:t10',  '2026-11-27'::date, '08:30'),   -- Invictus Caçamba
  ('plano-2026-10d:t13',  '2026-12-04'::date, '14:00'),   -- Tópi Chef Cozinha Forno
  ('plano-2026-10d:t14',  '2026-12-09'::date, '16:00'),   -- Bolofante, Bololéo e Bolopótamo
  ('plano-2026-10d:t15',  '2026-12-11'::date, '11:00'),   -- Tópi Chef Cozinhas (legumes, mar e terra)
  ('plano-2026-10b:t015', '2026-12-18'::date, '16:00')    -- Mesinha de Atividades
),
alvo as (
  select t.id as topic_id, v.data, v.hora,
         v.data - (select m.pub_date from public.social_plan_items m
                    where m.topic_id = t.id and m.channel_id = 'tp-ig' and m.link_kind = 'matriz' and not m.archived
                    order by m.pub_date desc limit 1) as dias
    from vaga v join public.social_topics t on t.ext_key = v.k
)
update public.social_plan_items i
   set pub_date = i.pub_date + a.dias,
       pub_time = case when i.channel_id = 'tp-ig' and i.link_kind = 'matriz' then a.hora::time else i.pub_time end,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from i.pub_date + a.dias)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from i.pub_date + a.dias)::int] || '/26',
       updated_at = now()
  from alvo a
 where i.topic_id = a.topic_id and a.dias is not null and a.dias <> 0
   and not i.archived and i.stage <> 'publicado' and i.channel_id not in ('cd-li', 'cd-gmn');

-- 4) Stories do Boliche: a tarde do mesmo dia; WhatsApp nunca no fim de semana
update public.social_plan_items i
   set pub_date = '2026-11-04', pub_time = '16:30', weekday = 'Quarta', month_label = 'Nov/26', updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t006' and i.channel_id = 'tp-ig' and i.link_kind <> 'matriz'
   and i.stage <> 'publicado' and not i.archived and i.pub_date <> '2026-11-04';

update public.social_plan_items
   set pub_date = pub_date + case extract(dow from pub_date)::int when 6 then 2 else 1 end, weekday = 'Segunda', updated_at = now()
 where channel_id like 'wa-%' and extract(dow from pub_date) in (0, 6) and not archived and stage <> 'publicado' and pub_date >= '2026-11-03';

-- CONFERÊNCIA — Tópi no Instagram por semana (no máximo 3) e a ordem
select date_trunc('week', i.pub_date)::date as semana, count(*) as posts_topi,
       string_agg(to_char(i.pub_date, 'DD/MM') || ' ' || left(i.pauta, 32), ' · ' order by i.pub_date, i.pub_time) as ordem
  from public.social_plan_items i
 where i.channel_id = 'tp-ig' and i.piece_type <> 'Stories' and not i.archived and i.pub_date between '2026-11-02' and '2026-12-20'
 group by 1
 order by 1;
