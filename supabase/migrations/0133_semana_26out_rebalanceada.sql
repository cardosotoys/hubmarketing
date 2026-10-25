-- Semana de 26/10: terça estava lotada e sexta vazia; o Cegonheiro (Tópi) não foi ao ar em 23/10.
--   · Boliche (carrossel Tópi) ter → sex 30/10 15h, Stories 17h
--   · Status do WhatsApp: Estação de Resgate ter → sex 30/10 9h30; Totokinhas licenciadas ter → sex 30/10 16h30
--   · Cegonheiro volta a "não publicado": Reels qui 29/10 15h, Stories 17h, Stories com caixinha sex 30/10 9h
-- Pode rodar de novo.

-- 1) o Cegonheiro não saiu: volta a ficar pendente de publicação
update public.social_plan_items i
   set stage = 'planejamento', updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10d:t01' and i.stage = 'publicado';

-- 2) novas datas
update public.social_plan_items i
   set pub_date = v.data, pub_time = v.hora::time, weekday = v.dia, updated_at = now()
  from public.social_topics t,
       (values
        ('plano-2026-10b:t006', 'Tópi · Instagram', 'matriz', '2026-10-30'::date, '15:00', 'Sexta'),
        ('plano-2026-10b:t006', 'Tópi · Instagram', 'reaproveita', '2026-10-30'::date, '17:00', 'Sexta'),
        ('plano-2026-10b:t009', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-30'::date, '09:30', 'Sexta'),
        ('plano-2026-10e:t02', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-30'::date, '16:30', 'Sexta'),
        ('plano-2026-10d:t01', 'Tópi · Instagram', 'matriz', '2026-10-29'::date, '15:00', 'Quinta'),
        ('plano-2026-10d:t01', 'Tópi · Instagram', 'reaproveita', '2026-10-29'::date, '17:00', 'Quinta'),
        ('plano-2026-10d:t01', 'Tópi · Instagram', 'adapta', '2026-10-30'::date, '09:00', 'Sexta')
       ) as v (ext_key, canal, vinculo, data, hora, dia)
 where t.id = i.topic_id and t.ext_key = v.ext_key
   and i.channel = v.canal and i.link_kind = v.vinculo
   and not i.archived and i.stage <> 'publicado';

-- CONFERÊNCIA — quantos posts por dia na semana (terça e sexta devem ficar parecidas)
select pub_date, weekday, count(*) as posts
  from public.social_plan_items
 where not archived and pub_date between '2026-10-26' and '2026-11-01'
 group by 1, 2 order by 1;
