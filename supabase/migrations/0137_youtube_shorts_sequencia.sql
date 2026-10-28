-- YOUTUBE SHORTS: sequência de 21 Shorts (as capas numeradas), um a cada 3 dias, de 28/10 a 27/12.
-- Título = nome do produto no catálogo | marca. Descrição = legenda sobre o produto. Playmi vai na playlist Playmi; Tópi na playlist Tópi.
-- Os Shorts que reaproveitavam Reels a partir de hoje saem do calendário; os Reels novos entram no YouTube depois desta sequência.
-- Pode rodar de novo.

-- 1) Shorts antigos (reaproveitando Reels) saem a partir de hoje
update public.social_plan_items
   set archived = true, updated_at = now()
 where channel_id in ('cd-yt-pl', 'cd-yt-tp') and pub_date >= '2026-10-28'
   and stage <> 'publicado' and not archived and coalesce(ext_id, '') not like 'shorts-2026:%';

-- 2) os 21 Shorts
insert into public.social_topics (ext_key, title, brand, sku, front, objective, strategy, cta, media_use, licensed, brief)
select 'shorts-2026:' || lpad(n::text, 2, '0'), titulo, marca, sku, 'YouTube Shorts · sequência', 'Equalizar o YouTube Shorts com o que já saiu nas redes',
       'Sequência definida pelo Aldair (capas numeradas de 1 a 21)', 'Onde comprar: link no perfil', 'Orgânico', lic,
       jsonb_build_object('formato_medida', 'Shorts 1080×1920', 'material_status', 'Pronto (vídeo e capa)', 'legenda', descricao,
                          'obrigatorio_evitar', case when lic then 'Licenciado: publicar só com o aval do licenciador.' else 'Sem preço.' end)
  from (values
  (1, 'Playmi', '8025', 'Estação de Resgate 10 Blocos | Playmi', false, '2026-10-28'::date, '16:30', 'A Estação de Resgate vem com 10 blocos para montar a central de resgate e inventar a missão do dia. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (2, 'Playmi', '1049', 'Tandy Bombeiro | Playmi', false, '2026-10-31'::date, '10:00', 'O Tandy Bombeiro é o caminhão de bombeiro com escadas, maca de salvamento, cones e extintores para a criança comandar o resgate. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (3, 'Playmi', '3113', 'Little Figs Bluey | Playmi', true, '2026-11-03'::date, '15:30', 'Bluey e a turma em miniatura para colecionar, montar a cena e brincar de contar histórias. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (4, 'Tópi', '0133', 'Mini Mercado | Tópi', false, '2026-11-06'::date, '11:30', 'A cestinha do Mini Mercado leva a brincadeira de fazer compras para dentro de casa: escolher, pagar e guardar. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (5, 'Tópi', '4029', 'Tópi Invictus Super Cegonheiro | Tópi', false, '2026-11-09'::date, '14:30', 'O Tópi Invictus Super Cegonheiro leva a frota inteira de carrinhos para a próxima aventura. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (6, 'Tópi', '8401', 'Alvo Certo | Tópi', false, '2026-11-12'::date, '09:30', 'O Alvo Certo é o jogo de dardos para a família toda testar a mira e marcar pontos. A partir de 14 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (7, 'Playmi', '3103', 'Little Figs Marvel Spidey | Playmi', true, '2026-11-15'::date, '17:30', 'Spidey e seus amigos em miniatura para colecionar e inventar a próxima missão de super-herói. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (8, 'Playmi', '1062', 'Caminhão Air Truck Caçamba | Playmi', false, '2026-11-18'::date, '10:30', 'O Caminhão Air Truck Caçamba carrega, levanta e despeja tudo na obra de faz de conta. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (9, 'Playmi', '7229', 'Patinete Bluey | Playmi', true, '2026-11-21'::date, '16:30', 'O Patinete Bluey leva a criança para passear com equilíbrio e com a personagem favorita. A partir de 2 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (10, 'Tópi', '7173', 'Robô-Blocks Serviço Delivery | Tópi', false, '2026-11-24'::date, '10:00', 'Monta, desmonta e vira outro: o Robô-Blocks Serviço Delivery é peça para todo lado e criatividade para dar e vender. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (11, 'Tópi', '3054', 'Mesinha de Atividades Azul | Tópi', false, '2026-11-27'::date, '15:30', 'A Mesinha de Atividades reúne várias brincadeiras num lugar só para os pequenos explorarem com as mãos. A partir de 18 meses.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (12, 'Tópi', '7001', 'Boliche | Tópi', false, '2026-11-30'::date, '11:30', 'O Boliche é a brincadeira certa para juntar a família: arrumar os pinos, mirar e derrubar todos. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (13, 'Playmi', '3090', 'Fofilhotes | Playmi', false, '2026-12-03'::date, '14:30', 'Os Fofilhotes são os bichinhos fofos para as primeiras descobertas: cavalinho, girafinha e muitos outros. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (14, 'Playmi', '6006', 'Totokinha Bolinha Azul | Playmi', false, '2026-12-06'::date, '09:30', 'A Totokinha Bolinha é o primeiro carrinho da criança: ela senta, impulsiona com os pés e sai explorando a casa. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (15, 'Playmi', '3101', 'Little Figs O Show da Luna | Playmi', true, '2026-12-09'::date, '17:30', 'Luna, Júpiter, Cláudio e a turma em miniatura para colecionar e brincar de descobrir o mundo. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (16, 'Tópi', '4015', 'Tópi Pata Bota Ovo | Tópi', false, '2026-12-12'::date, '10:30', 'A Pata Bota Ovo ensina formas e cores enquanto a criança encaixa, empurra e brinca. A partir de 18 meses.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (17, 'Tópi', '7175', 'Robô-Blocks Serviço Ambulância | Tópi', false, '2026-12-15'::date, '16:30', 'Monta, desmonta e vira outro: o Robô-Blocks Serviço Ambulância sai em missão de resgate e vira robô. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (18, 'Tópi', '3059', 'Tópi Sabidinho Plus | Tópi', false, '2026-12-18'::date, '10:00', 'O Tópi Sabidinho Plus é o carrinho de descobertas para os pequenos empurrarem e explorarem. A partir de 18 meses.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (19, 'Playmi', '2012', 'Geladeira Sonho de Menina | Playmi', false, '2026-12-21'::date, '15:30', 'A Geladeira Sonho de Menina completa a cozinha de faz de conta: guardar, servir e brincar de casinha. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (20, 'Playmi', '3123', 'Totokinha Bluey | Playmi', true, '2026-12-24'::date, '11:30', 'A Totokinha Bluey é o primeiro carrinho com a personagem favorita: senta, impulsiona e sai passeando. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (21, 'Playmi', '7205', 'Doce Cozinha Plus Chá com Biscoitos | Playmi', false, '2026-12-27'::date, '14:30', 'Chá com biscoitos servido! A Doce Cozinha Plus transforma a tarde em festa de faz de conta. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos')
  ) as v (n, marca, sku, titulo, lic, data, hora, descricao)
on conflict (ext_key) do nothing;

insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook)
select t.ext_key || ':yt', t.id, case when t.brand = 'Tópi' then 'cd-yt-tp' else 'cd-yt-pl' end, 'matriz', v.data, v.hora::time,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/26',
       t.front, t.brand, 'YouTube Shorts', case when t.brand = 'Tópi' then 'Cardoso · YouTube · playlist Tópi' else 'Cardoso · YouTube · playlist Playmi' end,
       'Shorts', 'Shorts', 'Original', t.title, '', t.sku, t.objective, t.cta, t.media_use, t.brief->>'legenda', false, false
  from (values
  (1, 'Playmi', '8025', 'Estação de Resgate 10 Blocos | Playmi', false, '2026-10-28'::date, '16:30', 'A Estação de Resgate vem com 10 blocos para montar a central de resgate e inventar a missão do dia. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (2, 'Playmi', '1049', 'Tandy Bombeiro | Playmi', false, '2026-10-31'::date, '10:00', 'O Tandy Bombeiro é o caminhão de bombeiro com escadas, maca de salvamento, cones e extintores para a criança comandar o resgate. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (3, 'Playmi', '3113', 'Little Figs Bluey | Playmi', true, '2026-11-03'::date, '15:30', 'Bluey e a turma em miniatura para colecionar, montar a cena e brincar de contar histórias. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (4, 'Tópi', '0133', 'Mini Mercado | Tópi', false, '2026-11-06'::date, '11:30', 'A cestinha do Mini Mercado leva a brincadeira de fazer compras para dentro de casa: escolher, pagar e guardar. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (5, 'Tópi', '4029', 'Tópi Invictus Super Cegonheiro | Tópi', false, '2026-11-09'::date, '14:30', 'O Tópi Invictus Super Cegonheiro leva a frota inteira de carrinhos para a próxima aventura. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (6, 'Tópi', '8401', 'Alvo Certo | Tópi', false, '2026-11-12'::date, '09:30', 'O Alvo Certo é o jogo de dardos para a família toda testar a mira e marcar pontos. A partir de 14 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (7, 'Playmi', '3103', 'Little Figs Marvel Spidey | Playmi', true, '2026-11-15'::date, '17:30', 'Spidey e seus amigos em miniatura para colecionar e inventar a próxima missão de super-herói. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (8, 'Playmi', '1062', 'Caminhão Air Truck Caçamba | Playmi', false, '2026-11-18'::date, '10:30', 'O Caminhão Air Truck Caçamba carrega, levanta e despeja tudo na obra de faz de conta. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (9, 'Playmi', '7229', 'Patinete Bluey | Playmi', true, '2026-11-21'::date, '16:30', 'O Patinete Bluey leva a criança para passear com equilíbrio e com a personagem favorita. A partir de 2 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (10, 'Tópi', '7173', 'Robô-Blocks Serviço Delivery | Tópi', false, '2026-11-24'::date, '10:00', 'Monta, desmonta e vira outro: o Robô-Blocks Serviço Delivery é peça para todo lado e criatividade para dar e vender. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (11, 'Tópi', '3054', 'Mesinha de Atividades Azul | Tópi', false, '2026-11-27'::date, '15:30', 'A Mesinha de Atividades reúne várias brincadeiras num lugar só para os pequenos explorarem com as mãos. A partir de 18 meses.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (12, 'Tópi', '7001', 'Boliche | Tópi', false, '2026-11-30'::date, '11:30', 'O Boliche é a brincadeira certa para juntar a família: arrumar os pinos, mirar e derrubar todos. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (13, 'Playmi', '3090', 'Fofilhotes | Playmi', false, '2026-12-03'::date, '14:30', 'Os Fofilhotes são os bichinhos fofos para as primeiras descobertas: cavalinho, girafinha e muitos outros. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (14, 'Playmi', '6006', 'Totokinha Bolinha Azul | Playmi', false, '2026-12-06'::date, '09:30', 'A Totokinha Bolinha é o primeiro carrinho da criança: ela senta, impulsiona com os pés e sai explorando a casa. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (15, 'Playmi', '3101', 'Little Figs O Show da Luna | Playmi', true, '2026-12-09'::date, '17:30', 'Luna, Júpiter, Cláudio e a turma em miniatura para colecionar e brincar de descobrir o mundo. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (16, 'Tópi', '4015', 'Tópi Pata Bota Ovo | Tópi', false, '2026-12-12'::date, '10:30', 'A Pata Bota Ovo ensina formas e cores enquanto a criança encaixa, empurra e brinca. A partir de 18 meses.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (17, 'Tópi', '7175', 'Robô-Blocks Serviço Ambulância | Tópi', false, '2026-12-15'::date, '16:30', 'Monta, desmonta e vira outro: o Robô-Blocks Serviço Ambulância sai em missão de resgate e vira robô. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (18, 'Tópi', '3059', 'Tópi Sabidinho Plus | Tópi', false, '2026-12-18'::date, '10:00', 'O Tópi Sabidinho Plus é o carrinho de descobertas para os pequenos empurrarem e explorarem. A partir de 18 meses.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (19, 'Playmi', '2012', 'Geladeira Sonho de Menina | Playmi', false, '2026-12-21'::date, '15:30', 'A Geladeira Sonho de Menina completa a cozinha de faz de conta: guardar, servir e brincar de casinha. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (20, 'Playmi', '3123', 'Totokinha Bluey | Playmi', true, '2026-12-24'::date, '11:30', 'A Totokinha Bluey é o primeiro carrinho com a personagem favorita: senta, impulsiona e sai passeando. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (21, 'Playmi', '7205', 'Doce Cozinha Plus Chá com Biscoitos | Playmi', false, '2026-12-27'::date, '14:30', 'Chá com biscoitos servido! A Doce Cozinha Plus transforma a tarde em festa de faz de conta. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos')
  ) as v (n, marca, sku, titulo, lic, data, hora, descricao)
  join public.social_topics t on t.ext_key = 'shorts-2026:' || lpad(v.n::text, 2, '0')
on conflict (ext_id) do nothing;

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key like 'shorts-2026:%' and t.product_id is null and ltrim(p.code, '0') = ltrim(t.sku, '0');

-- CONFERÊNCIA — os 21 Shorts na ordem
select i.pub_date, i.weekday, to_char(i.pub_time, 'HH24:MI') as hora, i.pauta
  from public.social_plan_items i
 where i.ext_id like 'shorts-2026:%' and not i.archived
 order by 1;
