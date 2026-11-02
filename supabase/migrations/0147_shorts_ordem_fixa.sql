-- YOUTUBE SHORTS NA ORDEM CERTA: em produção a sequência não andou na 0141 (ela só movia se o nº 1 estivesse em 28/10),
-- e o nº 1 e o nº 2 (Tandy Bombeiro) saíram do calendário com os atrasados; o nº 3 (Bluey) ficou como o primeiro.
-- Aqui cada Short ganha a data fixa pela própria ordem, sem depender de onde estava:
--   nº 1 ter 03/11 · nº 2 sex 06/11 · nº 3 seg 09/11 · ... de 3 em 3 dias ... nº 21 sáb 02/01. Hora = a do assunto.
-- Pode rodar de novo.

update public.social_plan_items i
   set archived = false,
       pub_date = d.dia,
       pub_time = (t.brief->>'hora')::time,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from d.dia)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from d.dia)::int] || '/' || to_char(d.dia, 'YY'),
       updated_at = now()
  from public.social_topics t,
       lateral (select '2026-11-03'::date + 3 * (substring(t.ext_key from 'shorts-2026:(\d+)')::int - 1) as dia) d
 where t.id = i.topic_id and t.ext_key like 'shorts-2026:%' and i.ext_id = t.ext_key || ':yt' and i.stage <> 'publicado';

-- CONFERÊNCIA — os 21 Shorts na ordem (archived tem que vir false em todos)
select substring(i.ext_id from 'shorts-2026:(\d+)') as n, i.pub_date, i.weekday, to_char(i.pub_time, 'HH24:MI') as hora, i.pauta, i.archived
  from public.social_plan_items i
 where i.ext_id like 'shorts-2026:%'
 order by 1;
