-- Cardoso Marketing Hub — calendário revisto em 21/10/2026 (recomeço na quinta 22/10).
--
-- O que saiu de fato: Miniaturas Spidey no Instagram em 20/10 e no Status do WhatsApp em 21/10.
-- Nada mais foi postado de 20 a 21/10.
--   1) Miniaturas Spidey: Reels, Stories e Status ficam como PUBLICADOS; o Shorts do YouTube vai para qui 22/10.
--   2) Playmi: a fila de Reels anda uma vaga (Totokinha Spidey qui 22/10 … Doce Cozinha sáb 07/11) e o
--      Fofilhotes vai para sáb 14/11 12h, vaga livre. Bluey (10/11) em diante não muda.
--   3) Cardoso: Totokinhas qui 22/10 11h; Do molde à caixa seg 26/10 11h (vaga livre do Natal Musical);
--      LinkedIn "Desde 1987" qui 22/10 08h30 e Google Meu Negócio sex 23/10.
--   4) Tópi: os produtos dos Reels do plano já foram postados no perfil. Os Reels de produto
--      (21 assuntos, frentes "Achadinho" e "Curva A") ficam EM ESPERA até o plano novo da Tópi.
--      Ficam os carrosséis de ideia de brincadeira e as datas; Boliche sáb 24/10, Mesinha sáb 31/10,
--      Cozinha de faz de conta sáb 07/11 (vaga livre da Banda em casa).
-- Cada destino anda junto com a sua matriz; o que cairia num domingo vai para a segunda.
-- Casa por assunto + canal + vínculo (não depende da data que está no banco). Não mexe em publicado/agendado.
-- Idempotente.

set lock_timeout = '10s';

alter table public.social_topics add column if not exists paused_at timestamptz;

-- 1) o que já saiu
update public.social_plan_items i
   set stage = 'publicado', stage_at = now(), pub_date = v.data, weekday = v.dia, updated_at = now()
  from public.social_topics t,
       (values ('Instagram', 'Reels', '2026-10-20'::date, 'Terça'),
               ('Instagram', 'Stories', '2026-10-20'::date, 'Terça'),
               ('WhatsApp', null, '2026-10-21'::date, 'Quarta')) as v(rede, tipo, data, dia)
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t001'
   and i.network like v.rede || '%' and (v.tipo is null or i.piece_type = v.tipo)
   and i.stage <> 'publicado';

-- 2) e 3) datas novas
update public.social_plan_items i
   set pub_date = v.nova, weekday = v.dia, month_label = v.mes, updated_at = now()
  from public.social_topics t,
       (values
    ('plano-2026-10b:t004', 'Playmi · Instagram', 'matriz', '2026-10-22'::date, 'Quinta', 'Out/26'),
    ('plano-2026-10b:t004', 'Playmi · Instagram', 'reaproveita', '2026-10-22'::date, 'Quinta', 'Out/26'),
    ('plano-2026-10b:t004', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-23'::date, 'Sexta', 'Out/26'),
    ('plano-2026-10b:t004', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-10-23'::date, 'Sexta', 'Out/26'),
    ('plano-2026-10b:t009', 'Playmi · Instagram', 'matriz', '2026-10-24'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t009', 'Playmi · Instagram', 'reaproveita', '2026-10-24'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t009', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-10-26'::date, 'Segunda', 'Out/26'),
    ('plano-2026-10b:t009', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-26'::date, 'Segunda', 'Out/26'),
    ('plano-2026-10b:t012', 'Playmi · Instagram', 'matriz', '2026-10-27'::date, 'Terça', 'Out/26'),
    ('plano-2026-10b:t012', 'Playmi · Instagram', 'reaproveita', '2026-10-27'::date, 'Terça', 'Out/26'),
    ('plano-2026-10b:t012', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-10-28'::date, 'Quarta', 'Out/26'),
    ('plano-2026-10b:t012', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-29'::date, 'Quinta', 'Out/26'),
    ('plano-2026-10b:t014', 'Playmi · Instagram', 'matriz', '2026-10-29'::date, 'Quinta', 'Out/26'),
    ('plano-2026-10b:t014', 'Playmi · Instagram', 'reaproveita', '2026-10-29'::date, 'Quinta', 'Out/26'),
    ('plano-2026-10b:t014', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-31'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t014', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-10-31'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t019', 'Playmi · Instagram', 'matriz', '2026-10-31'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t019', 'Playmi · Instagram', 'reaproveita', '2026-10-31'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t019', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-11-02'::date, 'Segunda', 'Nov/26'),
    ('plano-2026-10b:t019', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-02'::date, 'Segunda', 'Nov/26'),
    ('plano-2026-10b:t022', 'Playmi · Instagram', 'matriz', '2026-11-03'::date, 'Terça', 'Nov/26'),
    ('plano-2026-10b:t022', 'Playmi · Instagram', 'reaproveita', '2026-11-03'::date, 'Terça', 'Nov/26'),
    ('plano-2026-10b:t022', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-11-04'::date, 'Quarta', 'Nov/26'),
    ('plano-2026-10b:t022', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-05'::date, 'Quinta', 'Nov/26'),
    ('plano-2026-10b:t024', 'Playmi · Instagram', 'matriz', '2026-11-05'::date, 'Quinta', 'Nov/26'),
    ('plano-2026-10b:t024', 'Playmi · Instagram', 'reaproveita', '2026-11-05'::date, 'Quinta', 'Nov/26'),
    ('plano-2026-10b:t024', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-07'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t024', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-11-07'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t028', 'Playmi · Instagram', 'matriz', '2026-11-07'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t028', 'Playmi · Instagram', 'reaproveita', '2026-11-07'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t028', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-11-09'::date, 'Segunda', 'Nov/26'),
    ('plano-2026-10b:t028', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-10'::date, 'Terça', 'Nov/26'),
    ('plano-2026-10b:t028', 'Cardoso · Pinterest', 'adapta', '2026-11-10'::date, 'Terça', 'Nov/26'),
    ('plano-2026-10b:t032', 'Playmi · Instagram', 'matriz', '2026-11-14'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t032', 'Playmi · Instagram', 'reaproveita', '2026-11-14'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t032', 'Playmi · Instagram', 'adapta', '2026-11-16'::date, 'Segunda', 'Nov/26'),
    ('plano-2026-10b:t032', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-11-16'::date, 'Segunda', 'Nov/26'),
    ('plano-2026-10b:t032', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-16'::date, 'Segunda', 'Nov/26'),
    ('plano-2026-10b:t003', 'Cardoso · Instagram', 'matriz', '2026-10-22'::date, 'Quinta', 'Out/26'),
    ('plano-2026-10b:t003', 'Cardoso · Instagram', 'adapta', '2026-10-23'::date, 'Sexta', 'Out/26'),
    ('plano-2026-10b:t003', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-24'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t011', 'Cardoso · Instagram', 'matriz', '2026-10-26'::date, 'Segunda', 'Out/26'),
    ('plano-2026-10b:t011', 'Cardoso · Instagram', 'adapta', '2026-10-27'::date, 'Terça', 'Out/26'),
    ('plano-2026-10b:t011', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-28'::date, 'Quarta', 'Out/26'),
    ('plano-2026-10b:t008', 'Cardoso · LinkedIn', 'matriz', '2026-10-22'::date, 'Quinta', 'Out/26'),
    ('plano-2026-10b:t008', 'Cardoso · Google Meu Negócio', 'adapta', '2026-10-23'::date, 'Sexta', 'Out/26'),
    ('plano-2026-10b:t006', 'Tópi · Instagram', 'matriz', '2026-10-24'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t006', 'Tópi · Instagram', 'reaproveita', '2026-10-24'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t015', 'Tópi · Instagram', 'matriz', '2026-10-31'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t015', 'Tópi · Instagram', 'reaproveita', '2026-10-31'::date, 'Sábado', 'Out/26'),
    ('plano-2026-10b:t025', 'Tópi · Instagram', 'matriz', '2026-11-07'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t025', 'Tópi · Instagram', 'reaproveita', '2026-11-07'::date, 'Sábado', 'Nov/26'),
    ('plano-2026-10b:t001', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-10-22'::date, 'Quinta', 'Out/26')
       ) as v(ext_key, canal, vinculo, nova, dia, mes)
 where t.id = i.topic_id
   and t.ext_key = v.ext_key
   and i.channel = v.canal
   and i.link_kind = v.vinculo
   and not i.archived
   and i.stage not in ('agendado', 'publicado')
   and i.pub_date <> v.nova;

-- 4) Tópi: Reels de produto em espera (o título confere o assunto)
update public.social_topics t
   set paused_at = now()
  from (values
    ('plano-2026-10b:t005', 'Carrinho de Boneca Passeio do Bebê: hora do passeio'),
    ('plano-2026-10b:t010', 'Teltaluga e Tortuga: as tartarugas da Tópi'),
    ('plano-2026-10b:t013', 'Tópi Sabidinho Plus: descoberta que cabe no bolso'),
    ('plano-2026-10b:t020', 'Dino Sabidinho: o dino companheiro'),
    ('plano-2026-10b:t023', 'Tópi Escolar e Tópi Bombeirinho'),
    ('plano-2026-10b:t030', 'Invictus Sky: decolagem autorizada'),
    ('plano-2026-10b:t033', 'Tópi Trator Escavadeira e Retroescavadeira'),
    ('plano-2026-10b:t040', 'Tandy Caçamba e Tandy Tractor'),
    ('plano-2026-10b:t043', 'Leva Papinha: brincar de cuidar'),
    ('plano-2026-10b:t050', 'Mesinha de Atividades em ação'),
    ('plano-2026-10b:t053', 'Tópi Blocos de Montar: construa o que quiser'),
    ('plano-2026-10b:t060', 'Robô-Blocks Corrida: montou, acelerou'),
    ('plano-2026-10b:t063', 'Tópi Festa: festa de faz de conta'),
    ('plano-2026-10b:t070', 'Pet Home com Blocos: a casinha do pet'),
    ('plano-2026-10b:t073', 'Carrinho de Boneca Meu Nenê'),
    ('plano-2026-10b:t079', 'Boliche em ação'),
    ('plano-2026-10b:t082', 'Tópi Combo Construction'),
    ('plano-2026-10b:t088', 'Baldão de Praia: o verão chegou'),
    ('plano-2026-10b:t091', 'Tópi Mileva'),
    ('plano-2026-10b:t097', 'Robô-Blocks na ceia de Natal'),
    ('plano-2026-10b:t105', 'Baldão de Praia: férias na areia')
       ) as v(ext_key, titulo)
 where t.ext_key = v.ext_key and t.title = v.titulo and t.paused_at is null;

update public.social_plan_items i
   set archived = true, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.paused_at is not null
   and not i.archived and i.stage <> 'publicado';

-- Conferência: a primeira linha deve dar 0 (nada atrasado); a segunda mostra quinta e sexta
--   select count(*) from social_plan_items where not archived and stage <> 'publicado' and pub_date < '2026-10-22';
--   select pub_date, pub_time, brand, network, piece_type, pauta from social_plan_items
--    where not archived and pub_date between '2026-10-22' and '2026-10-24' order by 1, 2;
