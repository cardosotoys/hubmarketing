-- 1) YOUTUBE SHORTS: os 4 produtos confirmados pelo Aldair
--    nº 8 Air Truck Caçamba (1062) e nº 10 Robô-Blocks Delivery (7173) ficam; nº 14 vira Totokinha Sport Azul (3067)
--    e nº 17 vira Robô-Blocks Serviço Caminhão Pipa (7174)
-- 2) GOOGLE MEU NEGÓCIO: 1 post por semana reaproveitando um post que já foi (ou vai antes) para as redes.
--    Mesma arte, só o texto adaptado para o Google. Os posts próprios do Google, que pediam arte nova, saem.
-- Pode rodar de novo.

-- 1) Shorts nº 14 e nº 17
update public.social_topics t
   set title = v.titulo, sku = v.sku, product_id = null, product = '',
       brief = t.brief || jsonb_build_object('legenda', v.legenda), updated_at = now()
  from (values
   ('shorts-2026:14', '3067', 'Totokinha Sport Azul | Playmi',
    'A Totokinha Sport Azul é o primeiro carrinho da criança: ela senta, impulsiona com os pés e sai explorando a casa. A partir de 18 meses.' || chr(10) ||
    'Onde comprar: link no perfil.' || chr(10) || '#Playmi #Shorts #Brinquedos'),
   ('shorts-2026:17', '7174', 'Robô-Blocks Serviço Caminhão Pipa | Tópi',
    'Monta, desmonta e vira outro: o Robô-Blocks Serviço Caminhão Pipa sai para regar a cidade e vira robô. A partir de 3 anos.' || chr(10) ||
    'Brincar é Tópi! 🧡' || chr(10) || '#Tópi #Shorts #Brinquedos')
  ) as v (ext_key, sku, titulo, legenda)
 where t.ext_key = v.ext_key;

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key in ('shorts-2026:14', 'shorts-2026:17') and split_part(p.code, ' ', 1) = t.sku;

update public.social_plan_items i
   set pauta = t.title, sku = t.sku, product_id = t.product_id, caption = t.brief->>'legenda', updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key in ('shorts-2026:14', 'shorts-2026:17') and i.stage <> 'publicado';

-- 2a) os posts próprios do Google saem a partir de hoje
update public.social_plan_items
   set archived = true, updated_at = now()
 where channel_id = 'cd-gmn' and pub_date >= '2026-10-28' and stage <> 'publicado' and not archived
   and coalesce(ext_id, '') not like 'gmn-2026:%';

-- 2b) o Google da semana, reaproveitando o post das redes (creative_changed = false: usa a mesma arte)
insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook)
select 'gmn-2026:' || v.n, t.id, 'cd-gmn', 'adapta', v.data, v.hora::time,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/26',
       t.front, 'Cardoso', 'Google Meu Negócio', 'Cardoso · Google Meu Negócio', 'Post', v.formato, 'Reaproveitado', t.title, t.product, t.sku,
       t.objective, v.botao, 'Orgânico', v.texto, false, false
  from (values
   ('01', 'plano-2026-10e:t01', '2026-10-29'::date, '10:00', 'Atualização', 'Botão: Saiba mais (site)',
    'Você conhece a Cardoso? Somos uma fábrica de brinquedos em São Paulo, fazendo brinquedo desde 1987.' || chr(10) || chr(10) ||
    'Aqui nascem as marcas Playmi e Tópi e os brinquedos de personagens licenciados que estão nas lojas de todo o Brasil.' || chr(10) || chr(10) ||
    'Lojista ou e-commerce? Fale com o nosso time comercial e conheça as nossas linhas.'),
   ('02', 'plano-2026-10b:t011', '2026-11-06'::date, '15:30', 'Atualização', 'Botão: Saiba mais (site)',
    'Do molde à caixa: é assim que um brinquedo Cardoso ganha forma.' || chr(10) || chr(10) ||
    'Na nossa fábrica em São Paulo acompanhamos cada etapa, do projeto à embalagem, passando pelo controle de qualidade.' || chr(10) || chr(10) ||
    'Quer revender Cardoso? Fale com o nosso time comercial.'),
   ('03', 'plano-2026-10b:t021', '2026-11-13'::date, '10:00', 'Atualização', 'Botão: Saiba mais (site)',
    'Uma indústria, duas marcas: Playmi e Tópi.' || chr(10) || chr(10) ||
    'A Playmi acompanha a criança do primeiro ano em diante, com blocos, carrinhos e brinquedos de descoberta. A Tópi traz veículos, cozinhas de faz de conta e jogos para brincar em família.' || chr(10) || chr(10) ||
    'Conheça as duas linhas com o nosso time comercial.'),
   ('04', 'plano-2026-10b:t041', '2026-11-18'::date, '16:30', 'Atualização', 'Botão: Saiba mais (site)',
    'Quase 40 anos fazendo brinquedo em São Paulo.' || chr(10) || chr(10) ||
    'Desde 1987 a Cardoso produz brinquedos que atravessam gerações, com fábrica própria e atendimento a lojistas e e-commerces de todo o país.' || chr(10) || chr(10) ||
    'Fale com o nosso time comercial.'),
   ('05', 'plano-2026-10f:t01', '2026-11-25'::date, '10:30', 'Atualização', 'Botão: Saiba mais (site)',
    'A Cardoso foi patrocinadora do Prêmio Top Kids 2026, realizado em 24 de novembro.' || chr(10) || chr(10) ||
    'Foi um dia para celebrar as marcas, os produtos e as pessoas que movimentam o mercado infantil. Obrigado a todos que estiveram com a gente.'),
   ('06', 'plano-2026-10b:t054', '2026-12-01'::date, '14:30', 'Atualização', 'Botão: Saiba mais (site)',
    'Guia de Natal Playmi: um presente para cada idade.' || chr(10) || chr(10) ||
    'Para o primeiro ano, brinquedos de descoberta. Dos 18 meses em diante, as Totokinhas e os blocos para montar. Para os maiores, veículos e faz de conta.' || chr(10) || chr(10) ||
    'Os brinquedos Playmi são feitos pela Cardoso, em São Paulo. Encontre nas lojas e e-commerces parceiros.'),
   ('07', 'plano-2026-10b:t055', '2026-12-09'::date, '09:30', 'Atualização', 'Botão: Saiba mais (site)',
    'Guia de Natal Tópi: achadinhos por idade.' || chr(10) || chr(10) ||
    'Cozinhas Tópi Chef, caminhões Invictus, jogos como Boliche e Alvo Certo: tem presente Tópi para cada fase da criança.' || chr(10) || chr(10) ||
    'Os brinquedos Tópi são feitos pela Cardoso, em São Paulo. Encontre nas lojas e e-commerces parceiros.'),
   ('08', 'plano-2026-10b:t089', '2026-12-18'::date, '11:00', 'Atualização', 'Botão: Saiba mais (site)',
    'Brinquedo Cardoso em todos os estados do Brasil.' || chr(10) || chr(10) ||
    'Lojistas, redes e e-commerces de norte a sul revendem Playmi, Tópi e os nossos licenciados, com atendimento de representantes em cada região.' || chr(10) || chr(10) ||
    'Quer ser um deles? Fale com o nosso time comercial.'),
   ('09', 'plano-2026-10b:t094', '2026-12-22'::date, '10:00', 'Atualização', 'Botão: Saiba mais (site)',
    'Feliz Natal! A Cardoso agradece a cada família que levou um brinquedo nosso para casa e a cada lojista que fez esse brinquedo chegar até ela.' || chr(10) || chr(10) ||
    'Boas festas e muitas brincadeiras.'),
   ('10', 'plano-2026-10b:t103', '2026-12-30'::date, '15:30', 'Evento', 'Botão: Saiba mais (site)',
    'Anote na agenda: ABRIN 2027, de 4 a 7 de abril, em São Paulo.' || chr(10) || chr(10) ||
    'A Cardoso estará na maior feira de brinquedos do país com os lançamentos Playmi e Tópi. Lojista, venha nos visitar.')
  ) as v (n, ext_key, data, hora, formato, botao, texto)
  join public.social_topics t on t.ext_key = v.ext_key
on conflict (ext_id) do nothing;

-- CONFERÊNCIA 1 — Shorts nº 14 e nº 17
select i.pub_date, i.pauta, i.sku from public.social_plan_items i
 where i.ext_id in ('shorts-2026:14:yt', 'shorts-2026:17:yt') order by 1;

-- CONFERÊNCIA 2 — o Google Meu Negócio da semana e o post das redes de onde ele vem
select g.pub_date, g.weekday, to_char(g.pub_time, 'HH24:MI') as hora, g.pauta,
       (select string_agg(m.channel || ' ' || to_char(m.pub_date, 'DD/MM'), ', ' order by m.pub_date)
          from public.social_plan_items m where m.topic_id = g.topic_id and m.id <> g.id and not m.archived
           and m.channel_id in ('cd-ig', 'pl-ig', 'tp-ig', 'cd-li')) as vem_de
  from public.social_plan_items g
 where g.channel_id = 'cd-gmn' and not g.archived and g.pub_date >= '2026-10-20'
 order by 1;
