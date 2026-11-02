-- RODA LIVRE SEM O REELS NO CALENDÁRIO: no banco de produção só ficou o LinkedIn. A 0141 só mudava a data quando o Reels
-- estava em 29/10; se ele estava em outra data, não andou, ficou para trás e saiu do calendário junto com os atrasados.
-- Aqui as datas são fixadas sem depender de onde cada item estava (vale também para os outros dois que a 0141 moveu).
--   Roda Livre (Cardoso):            Reels ter 03/11 10h · Stories qua 04/11 11h30 · Status qui 05/11 16h30 · LinkedIn ter 03/11 14h30
--   Licenciados no Natal (Cardoso):  Reels seg 09/11 16h · Status seg 09/11 17h
--   Open Tracks (Tópi):              Reels qua 11/11 15h · Stories qua 11/11 17h
-- Pode rodar de novo.

update public.social_topics set paused_at = null, updated_at = now()
 where ext_key in ('plano-2026-10b:t003', 'plano-2026-10b:t027', 'plano-2026-10d:t02') and paused_at is not null;

update public.social_plan_items i
   set archived = false, pub_date = v.data, pub_time = v.hora::time,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       month_label = 'Nov/26', updated_at = now()
  from public.social_topics t,
       (values ('plano-2026-10b:t003', 'cd-ig', 'matriz',      '2026-11-03'::date, '10:00'),
               ('plano-2026-10b:t003', 'cd-ig', 'adapta',      '2026-11-04'::date, '11:30'),
               ('plano-2026-10b:t003', 'wa-st', 'reaproveita', '2026-11-05'::date, '16:30'),
               ('plano-2026-10b:t003', 'cd-li', 'adapta',      '2026-11-03'::date, '14:30'),
               ('plano-2026-10b:t027', 'cd-ig', 'matriz',      '2026-11-09'::date, '16:00'),
               ('plano-2026-10b:t027', 'wa-st', 'reaproveita', '2026-11-09'::date, '17:00'),
               ('plano-2026-10d:t02',  'tp-ig', 'matriz',      '2026-11-11'::date, '15:00'),
               ('plano-2026-10d:t02',  'tp-ig', 'reaproveita', '2026-11-11'::date, '17:00')) as v (k, canal, tipo, data, hora)
 where t.id = i.topic_id and t.ext_key = v.k and i.channel_id = v.canal and i.link_kind = v.tipo and i.stage <> 'publicado';

-- CONFERÊNCIA — os três assuntos, com tudo o que está no calendário (archived tem que vir false)
select t.title, i.channel, i.piece_type, i.pub_date, i.weekday, to_char(i.pub_time, 'HH24:MI') as hora, i.archived, i.stage
  from public.social_plan_items i
  join public.social_topics t on t.id = i.topic_id
 where t.ext_key in ('plano-2026-10b:t003', 'plano-2026-10b:t027', 'plano-2026-10d:t02') and i.pub_date >= '2026-11-02'
 order by i.pub_date, i.pub_time;
