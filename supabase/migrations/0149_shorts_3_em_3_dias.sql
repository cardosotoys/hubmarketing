-- YOUTUBE SHORTS DE 3 EM 3 DIAS a partir de ter 03/11, começando pelo Tandy Bombeiro (nº 2).
-- O nº 1 (Estação de Resgate) já saiu em 28/10 e fica como publicado. Depois do nº 21 seguem os Reels prontos (nº 22 a 32).
-- 03/11 · 06/11 · 09/11 · 12/11 ... até 01/02. Datas fixas pela ordem. Pode rodar de novo.

update public.social_plan_items
   set stage = 'publicado', stage_at = coalesce(stage_at, now()), archived = false,
       pub_date = '2026-10-28', pub_time = '16:30', weekday = 'Quarta', month_label = 'Out/26', updated_at = now()
 where ext_id = 'shorts-2026:01:yt' and stage <> 'publicado';

update public.social_plan_items i
   set archived = false, pub_date = v.data, pub_time = v.hora::time,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/' || to_char(v.data, 'YY'),
       updated_at = now()
  from (values
  ('shorts-2026:02:yt', '2026-11-03'::date, '10:00'),
  ('shorts-2026:03:yt', '2026-11-06'::date, '15:30'),
  ('shorts-2026:04:yt', '2026-11-09'::date, '11:30'),
  ('shorts-2026:05:yt', '2026-11-12'::date, '16:30'),
  ('shorts-2026:06:yt', '2026-11-15'::date, '09:30'),
  ('shorts-2026:07:yt', '2026-11-18'::date, '14:30'),
  ('shorts-2026:08:yt', '2026-11-21'::date, '17:00'),
  ('shorts-2026:09:yt', '2026-11-24'::date, '10:30'),
  ('shorts-2026:10:yt', '2026-11-27'::date, '10:00'),
  ('shorts-2026:11:yt', '2026-11-30'::date, '15:30'),
  ('shorts-2026:12:yt', '2026-12-03'::date, '11:30'),
  ('shorts-2026:13:yt', '2026-12-06'::date, '16:30'),
  ('shorts-2026:14:yt', '2026-12-09'::date, '09:30'),
  ('shorts-2026:15:yt', '2026-12-12'::date, '14:30'),
  ('shorts-2026:16:yt', '2026-12-15'::date, '17:00'),
  ('shorts-2026:17:yt', '2026-12-18'::date, '10:30'),
  ('shorts-2026:18:yt', '2026-12-21'::date, '10:00'),
  ('shorts-2026:19:yt', '2026-12-24'::date, '15:30'),
  ('shorts-2026:20:yt', '2026-12-27'::date, '11:30'),
  ('shorts-2026:21:yt', '2026-12-30'::date, '16:30'),
  ('shorts-2026:22:yt', '2027-01-02'::date, '09:30'),
  ('shorts-2026:23:yt', '2027-01-05'::date, '14:30'),
  ('shorts-2026:24:yt', '2027-01-08'::date, '17:00'),
  ('shorts-2026:25:yt', '2027-01-11'::date, '10:30'),
  ('shorts-2026:26:yt', '2027-01-14'::date, '10:00'),
  ('shorts-2026:27:yt', '2027-01-17'::date, '15:30'),
  ('shorts-2026:28:yt', '2027-01-20'::date, '11:30'),
  ('shorts-2026:29:yt', '2027-01-23'::date, '16:30'),
  ('shorts-2026:30:yt', '2027-01-26'::date, '09:30'),
  ('shorts-2026:31:yt', '2027-01-29'::date, '14:30'),
  ('shorts-2026:32:yt', '2027-02-01'::date, '17:00')
  ) as v (e, data, hora)
 where i.ext_id = v.e and i.stage <> 'publicado';

update public.social_topics t
   set brief = t.brief || jsonb_build_object('data', i.pub_date, 'hora', to_char(i.pub_time, 'HH24:MI')), updated_at = now()
  from public.social_plan_items i
 where i.ext_id = t.ext_key || ':yt' and t.ext_key like 'shorts-2026:%' and (t.brief->>'data') is distinct from i.pub_date::text;

-- CONFERÊNCIA — os Shorts na ordem, de 3 em 3 dias (o nº 1 aparece como publicado)
select substring(i.ext_id from 'shorts-2026:(\d+)') as n, i.pub_date, i.weekday, to_char(i.pub_time, 'HH24:MI') as hora,
       split_part(i.pauta, ' |', 1) as short, i.stage
  from public.social_plan_items i
 where i.ext_id like 'shorts-2026:%' and not i.archived
 order by i.pub_date;
