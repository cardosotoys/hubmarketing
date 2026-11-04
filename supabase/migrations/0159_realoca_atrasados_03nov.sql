-- REALOCAÇÃO DO QUE NÃO SAIU EM 03/11/2026 (rodado em 04/11)
-- Saiu: Playmi Shorts Tandy Bombeiro, Cardoso Reels Roda Livre.
-- Não saiu:
--   Playmi Feed "Totokinha Bolinha" (t019): legenda ainda pendente de aprovação → sex 06/11 11:00.
--     Os reposts dele (Stories e Status de hoje) não podem sair antes do feed → Stories 06/11 17:00, Status seg 09/11 10:00.
--     Semana 02–08/11 da Playmi segue com 3 no Instagram (t019, t022, t024).
--   Cardoso LinkedIn "Roda Livre" (t003): aprovado, só não foi publicado → hoje 04/11 14:30.
-- Só move o que ainda está na data antiga e não foi agendado/publicado: rodar de novo não faz nada.

set lock_timeout = '5s';

update public.social_plan_items i
   set pub_date = v.nova, pub_time = v.hora
  from (values
    ('plano-2026-10b:t019', 'Instagram', 'Feed',     date '2026-11-03', date '2026-11-06', time '11:00'),
    ('plano-2026-10b:t019', 'Instagram', 'Stories',  date '2026-11-04', date '2026-11-06', time '17:00'),
    ('plano-2026-10b:t019', 'WhatsApp',  'WhatsApp', date '2026-11-04', date '2026-11-09', time '10:00'),
    ('plano-2026-10b:t003', 'LinkedIn',  'LinkedIn', date '2026-11-03', date '2026-11-04', time '14:30')
  ) v(ext_key, rede, peca, antiga, nova, hora),
       public.social_topics t, public.social_channels c
 where t.id = i.topic_id and t.ext_key = v.ext_key
   and c.id = i.channel_id and c.network = v.rede
   and i.piece_type = v.peca
   and i.pub_date = v.antiga
   and not i.archived
   and i.stage not in ('agendado', 'publicado');

-- CONFERÊNCIA
select i.pub_date, to_char(i.pub_time, 'HH24:MI') hora, i.brand, c.network, i.piece_type, t.ext_key, i.stage, i.status
  from public.social_plan_items i
  join public.social_topics t on t.id = i.topic_id
  join public.social_channels c on c.id = i.channel_id
 where t.ext_key in ('plano-2026-10b:t019', 'plano-2026-10b:t003') and not i.archived
 order by i.pub_date, i.pub_time;
