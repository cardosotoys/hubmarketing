-- Cardoso Marketing Hub — Natal Musical e Cardoso Black ficam em espera (decisão do Aldair, 18/10/2026).
--
-- O comercial não conseguiu avançar com as duas campanhas. Elas saem do calendário por ora e voltam
-- quando o plano novo delas chegar. Nada é apagado:
--   · social_topics.paused_at marca o assunto parado;
--   · os destinos do assunto ficam arquivados (somem do calendário, da fila e das prévias);
--   · as datas comerciais das duas campanhas ficam com o selo "Em espera" (status 'pausado').
--
-- Param 12 assuntos:
--   Natal Musical: lançamento (19/10), os 4 kits (26/10), reposição até 28/11 (10/11), última semana (16/11)
--     e os dois posts de consumidor que apoiavam a campanha: Banda em casa (Tópi, 07/11) e
--     Musicais Playmi (14/11).
--   Cardoso Black (interno): esquenta (26/10), largada (03/11), faltam 18 dias (09/11), corte de
--     faturamento (16/11), reta final (23/11) e encerramento (30/11).
--
-- Para voltar uma campanha: ver o bloco "Para voltar" no fim. Idempotente.

set lock_timeout = '10s';

alter table public.social_topics add column if not exists paused_at timestamptz;

alter table public.social_plan_deadlines drop constraint if exists social_plan_deadlines_status_check;
alter table public.social_plan_deadlines add constraint social_plan_deadlines_status_check
  check (status in ('pendente', 'andamento', 'feito', 'pausado'));

-- assuntos parados (o título confere que é o assunto certo)
update public.social_topics t
   set paused_at = now()
  from (values
    ('plano-2026-10b:t007', 'Natal Musical%'),
    ('plano-2026-10b:t017', 'Natal Musical%'),
    ('plano-2026-10b:t038', 'Natal Musical%'),
    ('plano-2026-10b:t047', 'Natal Musical%'),
    ('plano-2026-10b:t035', 'Banda em casa%'),
    ('plano-2026-10b:t044', 'Musicais Playmi%'),
    ('plano-2026-10b:t016', '%Cardoso Black%'),
    ('plano-2026-10b:t026', '%Cardoso Black%'),
    ('plano-2026-10b:t036', 'Cardoso Black%'),
    ('plano-2026-10b:t046', 'Cardoso Black%'),
    ('plano-2026-10b:t056', 'Cardoso Black%'),
    ('plano-2026-10b:t066', 'Cardoso Black%')
  ) as v(ext_key, titulo)
 where t.ext_key = v.ext_key
   and t.title like v.titulo
   and t.paused_at is null;

-- destinos dos assuntos parados saem do calendário (o que já foi publicado fica como está)
update public.social_plan_items i
   set archived = true, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id
   and t.paused_at is not null
   and not i.archived
   and i.stage <> 'publicado';

-- datas comerciais das duas campanhas: "Em espera"
update public.social_plan_deadlines
   set status = 'pausado', status_at = now()
 where (marco like 'Natal Musical%' or marco like 'Cardoso Black%' or marco like 'Faturamento Black%')
   and status <> 'feito';

notify pgrst, 'reload schema';

-- Conferência: 12 assuntos parados, nenhum destino deles no calendário
--   select (select count(*) from social_topics where paused_at is not null) as assuntos_parados,
--          (select count(*) from social_plan_items i join social_topics t on t.id = i.topic_id
--            where t.paused_at is not null and not i.archived) as destinos_ainda_no_calendario,
--          (select count(*) from social_plan_deadlines where status = 'pausado') as datas_em_espera;
--
-- Para voltar (exemplo: Natal Musical). Reveja as datas antes, porque elas terão passado:
--   update social_plan_items i set archived = false from social_topics t
--    where t.id = i.topic_id and t.paused_at is not null and t.title like 'Natal Musical%' and i.merged_into is null;
--   update social_topics set paused_at = null where paused_at is not null and title like 'Natal Musical%';
--   update social_plan_deadlines set status = 'pendente' where status = 'pausado' and marco like 'Natal Musical%';
