-- Cardoso Marketing Hub — o plano recomeça em 16/10/2026 (nada foi postado de 14 a 15/10).
--
-- Regra (decidida pelo Aldair em 16/10): empurrar a fila, sem descartar nada e sem mexer nas datas comerciais.
--   · Playmi (Reels das 12h): cada assunto anda uma vaga, em ordem. Miniaturas Spidey sai hoje (16/10) e a
--     fila anda até sábado 07/11 12h, uma vaga que estava livre. Daí em diante nada muda (Bluey 10/11 fica).
--   · Cardoso: Totokinhas (era 15/10) sai hoje 11h, numa vaga livre; o resto não muda.
--   · Tópi: nada atrasou (o Robô-Blocks de 14/10 já tinha saído do plano na 0116).
-- Os destinos de cada assunto (Stories, YouTube, TikTok, Status, Pinterest…) andam junto com a matriz,
-- mantendo a distância em dias; o que cairia num domingo vai para a segunda.
--
-- Só mexe em destino que ainda está na data antiga e não foi agendado nem publicado. Idempotente.

update public.social_plan_items i
   set pub_date = v.nova, weekday = v.dia, month_label = v.mes, updated_at = now()
  from (values
  ('plano-2026-10b:t001:0', '2026-10-14'::date, '2026-10-16'::date, 'Sexta', 'Out/26'),
  ('plano-2026-10b:t001:1', '2026-10-14'::date, '2026-10-16'::date, 'Sexta', 'Out/26'),
  ('plano-2026-10b:t001:2', '2026-10-15'::date, '2026-10-17'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t001:3', '2026-10-16'::date, '2026-10-19'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t004:0', '2026-10-16'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t004:1', '2026-10-16'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t004:2', '2026-10-17'::date, '2026-10-21'::date, 'Quarta', 'Out/26'),
  ('plano-2026-10b:t004:3', '2026-10-17'::date, '2026-10-21'::date, 'Quarta', 'Out/26'),
  ('plano-2026-10b:t009:0', '2026-10-20'::date, '2026-10-22'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t009:1', '2026-10-20'::date, '2026-10-22'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t009:2', '2026-10-21'::date, '2026-10-23'::date, 'Sexta', 'Out/26'),
  ('plano-2026-10b:t009:3', '2026-10-22'::date, '2026-10-24'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t012:0', '2026-10-22'::date, '2026-10-24'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t012:1', '2026-10-22'::date, '2026-10-24'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t012:2', '2026-10-23'::date, '2026-10-26'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t012:3', '2026-10-24'::date, '2026-10-26'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t014:0', '2026-10-24'::date, '2026-10-27'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t014:1', '2026-10-24'::date, '2026-10-27'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t014:2', '2026-10-26'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t014:3', '2026-10-26'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t019:0', '2026-10-27'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t019:1', '2026-10-27'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t019:2', '2026-10-28'::date, '2026-10-30'::date, 'Sexta', 'Out/26'),
  ('plano-2026-10b:t019:3', '2026-10-29'::date, '2026-10-31'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t022:0', '2026-10-29'::date, '2026-10-31'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t022:1', '2026-10-29'::date, '2026-10-31'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t022:2', '2026-10-30'::date, '2026-11-02'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t022:3', '2026-10-31'::date, '2026-11-02'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t024:0', '2026-10-31'::date, '2026-11-03'::date, 'Terça', 'Nov/26'),
  ('plano-2026-10b:t024:1', '2026-10-31'::date, '2026-11-03'::date, 'Terça', 'Nov/26'),
  ('plano-2026-10b:t024:2', '2026-11-02'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t024:3', '2026-11-02'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t028:0', '2026-11-03'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t028:1', '2026-11-03'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t028:2', '2026-11-04'::date, '2026-11-06'::date, 'Sexta', 'Nov/26'),
  ('plano-2026-10b:t028:3', '2026-11-06'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t028:4', '2026-11-06'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t032:0', '2026-11-05'::date, '2026-11-07'::date, 'Sábado', 'Nov/26'),
  ('plano-2026-10b:t032:1', '2026-11-05'::date, '2026-11-07'::date, 'Sábado', 'Nov/26'),
  ('plano-2026-10b:t032:2', '2026-11-06'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t032:3', '2026-11-06'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t032:4', '2026-11-07'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t003:0', '2026-10-15'::date, '2026-10-16'::date, 'Sexta', 'Out/26'),
  ('plano-2026-10b:t003:1', '2026-10-16'::date, '2026-10-17'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t003:2', '2026-10-17'::date, '2026-10-19'::date, 'Segunda', 'Out/26')
  ) as v(ext_id, antiga, nova, dia, mes)
 where i.ext_id = v.ext_id
   and i.pub_date = v.antiga
   and i.stage not in ('agendado', 'publicado');

-- Conferência: nada antes de hoje e 45 destinos nas datas novas
--   select count(*) filter (where pub_date < '2026-10-16') as atrasados,
--          count(*) filter (where ext_id in ('plano-2026-10b:t001:0','plano-2026-10b:t001:1','plano-2026-10b:t001:2', ...)) as exemplo
--     from public.social_plan_items where not archived;
