-- Cardoso Marketing Hub — o plano recomeça na segunda, 19/10/2026 (nada foi postado de 14 a 18/10).
--
-- Substitui a 0118 (recomeço em 16/10, que não vai acontecer). Funciona tenha a 0118 rodado ou não:
-- cada destino é aceito na data original do plano ou na data que a 0118 gravou.
--
-- Regra (Aldair, 16/10): empurrar a fila, sem descartar nada e sem mexer nas datas comerciais.
--   · Segunda 19/10: Natal Musical (Cardoso, 11h, já era), Miniaturas Spidey (Playmi, 12h) e Carrinho de
--     Boneca (Tópi, 12h).
--   · Playmi (Reels das 12h): a fila anda uma vaga, em ordem, até Fofilhotes no sábado 07/11 12h (vaga
--     livre). Do Bluey (10/11) em diante nada muda.
--   · Cardoso: Totokinhas vai para terça 20/10 11h (horário livre). O resto não muda.
--   · Tópi: Carrinho de Boneca na segunda 19/10 12h e o carrossel do Boliche na terça 20/10 20h30
--     (horários livres). O resto não muda.
-- Os destinos de cada assunto (Stories, YouTube, TikTok, Status, Pinterest…) andam junto com a matriz,
-- mantendo a distância em dias; o que cairia num domingo vai para a segunda.
--
-- Só mexe em destino que não foi agendado nem publicado. Idempotente.

update public.social_plan_items i
   set pub_date = v.nova, weekday = v.dia, month_label = v.mes, updated_at = now()
  from (values
  ('plano-2026-10b:t001:0', '2026-10-14'::date, '2026-10-16'::date, '2026-10-19'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t001:1', '2026-10-14'::date, '2026-10-16'::date, '2026-10-19'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t001:2', '2026-10-15'::date, '2026-10-17'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t001:3', '2026-10-16'::date, '2026-10-19'::date, '2026-10-21'::date, 'Quarta', 'Out/26'),
  ('plano-2026-10b:t004:0', '2026-10-16'::date, '2026-10-20'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t004:1', '2026-10-16'::date, '2026-10-20'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t004:2', '2026-10-17'::date, '2026-10-21'::date, '2026-10-21'::date, 'Quarta', 'Out/26'),
  ('plano-2026-10b:t004:3', '2026-10-17'::date, '2026-10-21'::date, '2026-10-21'::date, 'Quarta', 'Out/26'),
  ('plano-2026-10b:t009:0', '2026-10-20'::date, '2026-10-22'::date, '2026-10-22'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t009:1', '2026-10-20'::date, '2026-10-22'::date, '2026-10-22'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t009:2', '2026-10-21'::date, '2026-10-23'::date, '2026-10-23'::date, 'Sexta', 'Out/26'),
  ('plano-2026-10b:t009:3', '2026-10-22'::date, '2026-10-24'::date, '2026-10-24'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t012:0', '2026-10-22'::date, '2026-10-24'::date, '2026-10-24'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t012:1', '2026-10-22'::date, '2026-10-24'::date, '2026-10-24'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t012:2', '2026-10-23'::date, '2026-10-26'::date, '2026-10-26'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t012:3', '2026-10-24'::date, '2026-10-26'::date, '2026-10-26'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t014:0', '2026-10-24'::date, '2026-10-27'::date, '2026-10-27'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t014:1', '2026-10-24'::date, '2026-10-27'::date, '2026-10-27'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t014:2', '2026-10-26'::date, '2026-10-29'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t014:3', '2026-10-26'::date, '2026-10-29'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t019:0', '2026-10-27'::date, '2026-10-29'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t019:1', '2026-10-27'::date, '2026-10-29'::date, '2026-10-29'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t019:2', '2026-10-28'::date, '2026-10-30'::date, '2026-10-30'::date, 'Sexta', 'Out/26'),
  ('plano-2026-10b:t019:3', '2026-10-29'::date, '2026-10-31'::date, '2026-10-31'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t022:0', '2026-10-29'::date, '2026-10-31'::date, '2026-10-31'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t022:1', '2026-10-29'::date, '2026-10-31'::date, '2026-10-31'::date, 'Sábado', 'Out/26'),
  ('plano-2026-10b:t022:2', '2026-10-30'::date, '2026-11-02'::date, '2026-11-02'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t022:3', '2026-10-31'::date, '2026-11-02'::date, '2026-11-02'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t024:0', '2026-10-31'::date, '2026-11-03'::date, '2026-11-03'::date, 'Terça', 'Nov/26'),
  ('plano-2026-10b:t024:1', '2026-10-31'::date, '2026-11-03'::date, '2026-11-03'::date, 'Terça', 'Nov/26'),
  ('plano-2026-10b:t024:2', '2026-11-02'::date, '2026-11-05'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t024:3', '2026-11-02'::date, '2026-11-05'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t028:0', '2026-11-03'::date, '2026-11-05'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t028:1', '2026-11-03'::date, '2026-11-05'::date, '2026-11-05'::date, 'Quinta', 'Nov/26'),
  ('plano-2026-10b:t028:2', '2026-11-04'::date, '2026-11-06'::date, '2026-11-06'::date, 'Sexta', 'Nov/26'),
  ('plano-2026-10b:t028:3', '2026-11-06'::date, '2026-11-09'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t028:4', '2026-11-06'::date, '2026-11-09'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t032:0', '2026-11-05'::date, '2026-11-07'::date, '2026-11-07'::date, 'Sábado', 'Nov/26'),
  ('plano-2026-10b:t032:1', '2026-11-05'::date, '2026-11-07'::date, '2026-11-07'::date, 'Sábado', 'Nov/26'),
  ('plano-2026-10b:t032:2', '2026-11-06'::date, '2026-11-09'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t032:3', '2026-11-06'::date, '2026-11-09'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t032:4', '2026-11-07'::date, '2026-11-09'::date, '2026-11-09'::date, 'Segunda', 'Nov/26'),
  ('plano-2026-10b:t003:0', '2026-10-15'::date, '2026-10-16'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t003:1', '2026-10-16'::date, '2026-10-17'::date, '2026-10-21'::date, 'Quarta', 'Out/26'),
  ('plano-2026-10b:t003:2', '2026-10-17'::date, '2026-10-19'::date, '2026-10-22'::date, 'Quinta', 'Out/26'),
  ('plano-2026-10b:t005:0', '2026-10-16'::date, '2026-10-16'::date, '2026-10-19'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t005:1', '2026-10-16'::date, '2026-10-16'::date, '2026-10-19'::date, 'Segunda', 'Out/26'),
  ('plano-2026-10b:t005:2', '2026-10-17'::date, '2026-10-17'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t005:3', '2026-10-17'::date, '2026-10-17'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t006:0', '2026-10-17'::date, '2026-10-17'::date, '2026-10-20'::date, 'Terça', 'Out/26'),
  ('plano-2026-10b:t006:1', '2026-10-17'::date, '2026-10-17'::date, '2026-10-20'::date, 'Terça', 'Out/26')
  ) as v(ext_id, original, data_0118, nova, dia, mes)
 where i.ext_id = v.ext_id
   and i.pub_date in (v.original, v.data_0118)
   and i.pub_date <> v.nova
   and i.stage not in ('agendado', 'publicado');

-- Conferência: deve dar 0 (nenhum post antes de segunda)
--   select count(*) from public.social_plan_items where not archived and pub_date < '2026-10-19';
