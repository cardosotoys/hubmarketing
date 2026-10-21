-- TÓPI: Reels novos (produtos que ainda não estão no feed) — quartas e sextas às 19h, de 23/10 a 30/12.
-- Substitui a versão anterior da Tópi (prefixo plano-2026-10c), se ela tiver rodado. Pode rodar de novo sem duplicar.

-- 1) tira a versão anterior, se existir (nada dela foi publicado)
delete from public.social_topics where ext_key like 'plano-2026-10c:%';

-- 2) os 18 assuntos (a legenda, o Stories com enquete e a data ficam no briefing)
insert into public.social_topics (ext_key, title, brand, sku, front, objective, strategy, cta, media_use, licensed, brief)
select 'plano-2026-10d:t' || lpad(n::text, 2, '0'), titulo, 'Tópi', sku,
       (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'])[extract(month from data::date)::int] || ' · Novo no feed Tópi',
       'Apresentar no feed um produto Tópi que gira no varejo e ainda não tinha post',
       'Produto Tópi que ainda não apareceu no perfil (' || giro || '); conteúdo novo apoia o giro no bazar',
       'Onde comprar (link na bio)', 'Orgânico', false,
       jsonb_build_object(
         'data', data, 'legenda', legenda, 'enquete', enquete,
         'formato_medida', 'Reels 1080×1920, 12 a 15 s',
         'material_base', 'Gerar imagens IA a partir da foto do produto + Reels com imagens',
         'material_status', 'Gerar imagens IA + Reels com imagens',
         'meta', 'Apresentar no feed um produto Tópi que gira no varejo e ainda não tinha post',
         'medicao', 'Retenção nos 3 primeiros segundos, compartilhamentos e cliques no link da bio',
         'porque', 'Produto Tópi que ainda não apareceu no perfil (' || giro || ')',
         'estrategia', 'Pilar: Novo no feed. Criança brincando de verdade e o detalhe que diferencia o produto; termina com idade e onde comprar.',
         'publico', 'Famílias C–D, compra por impulso em Lojas Bazar. Usuário: criança de 1 a 10 anos.',
         'mensagem', mensagem, 'gancho', gancho,
         'estrutura', '0–3 s: produto em movimento e o gancho na tela.' || chr(10) || '3–10 s: criança brincando, close no diferencial.' || chr(10) || '10–15 s: produto inteiro + A partir de ' || idade || '.' || chr(10) || 'Fim: logo Tópi + Onde comprar: link na bio.',
         'texto_arte', split_part(titulo, ':', 1) || ' · A partir de ' || idade,
         'direcao_visual', 'Títulos: Chill Kids · Textos: Maven Pro · Laranja #EA5C18 · Amarelo #F3D22A · Azul #2EBADA · Céu azul com nuvens ou laranja com desenhos, rodapé amarelo ondulado, selo azul Brincar é Tópi!',
         'obrigatorio_evitar', 'Vídeo curto (até 15 s). Logo Tópi no fim. Sem preço na arte. Conferir a descrição com o produto real antes de publicar.',
         'derivadas', 'Stories, TikTok e YouTube reaproveitam o Reels; nas sextas, Stories novo com enquete no sábado')
  from (values
  (1,'2026-10-23','4024','Tópi Trator Agro: a fazenda chegou','3 anos','curva A, 21 mil un. no ano','Bora trabalhar na fazenda? 🚜🌾','O Tópi Trator Agro leva a brincadeira de fazenda para o quintal: puxa, empurra e transporta a colheita de faz de conta.','O Tópi Trator Agro leva a fazenda para o quintal: puxa, empurra e transporta toda a colheita de faz de conta. 🌽
A partir de 3 anos.
Qual seria a primeira colheita aí na sua casa?
Brincar é Tópi! 🧡
#Tópi #TratorAgro #BrincarNaFazenda','Qual a colheita de hoje? 🌽 [enquete: Milho / Morango]'),
  (2,'2026-10-28','0078','Tandy Bombeiro: alerta de resgate','3 anos','curva A, 19 mil un. no ano','Alerta! O bombeiro mirim já está a caminho! 🚒','O Tandy Bombeiro é o caminhão para a criança brincar de salvar o dia, com escada e acessórios de resgate.','Alerta! O bombeiro mirim já está a caminho! 🚒
Com o Tandy Bombeiro, a criança comanda o resgate e salva o dia na sala de casa.
A partir de 3 anos.
Quem é o herói da brincadeira aí?
Brincar é Tópi! 🧡
#Tópi #TandyBombeiro #Bombeiro','Bombeiro ou policial: qual é o seu herói? 🚒🚓 [enquete: Bombeiro / Policial]'),
  (3,'2026-10-30','7214','Tópi Chef Menu: o restaurante está aberto','3 anos','linha Tópi Chef, a que mais gira (8 mil un.)','O restaurante da criançada está aberto! 🍽️','O Tópi Chef Menu traz comidinhas e utensílios para a criança montar o próprio restaurante de faz de conta.','O restaurante da criançada está aberto! 🍽️
Com o Tópi Chef Menu, ela escolhe o prato, monta a mesa e serve a família inteira.
A partir de 3 anos.
Qual prato sairia primeiro do seu restaurante?
Brincar é Tópi! 🧡
#Tópi #TópiChef #FazDeConta','Qual prato sai primeiro? 🍽️ [enquete: Macarrão / Pizza]'),
  (4,'2026-11-04','4025','Tópi Invictus Graneleiro: carga completa','3 anos','curva B, 16,8 mil un. no ano','Carrega, transporta e descarrega! 🚛','O Tópi Invictus Graneleiro é o caminhão de carga para a brincadeira de transportar tudo pela casa.','Carrega, transporta e descarrega! 🚛
O Tópi Invictus Graneleiro leva a carga de um canto ao outro da casa, e a estrada é a imaginação.
A partir de 3 anos.
O que vai na caçamba hoje?
Brincar é Tópi! 🧡
#Tópi #Invictus #Caminhão','Que carga o caminhão leva hoje? 🚛 [enquete: Brinquedos / Frutinhas]'),
  (5,'2026-11-06','7213','Tópi Chef Chá da Tarde: hora do lanchinho','3 anos','linha Tópi Chef (7,3 mil un.)','Já é hora do chá? ☕🧁','O Tópi Chef Chá da Tarde transforma a tarde em festa de faz de conta com xícaras e comidinhas.','Já é hora do chá? ☕🧁
Com o Tópi Chef Chá da Tarde, as bonecas, os bichinhos e a vovó estão convidados.
A partir de 3 anos.
Quem vem para o chá aí na sua casa?
Brincar é Tópi! 🧡
#Tópi #TópiChef #ChaDaTarde','Quem vem para o chá? ☕ [enquete: Bonecas / Vovó]'),
  (6,'2026-11-11','4029','Tópi Invictus Super Cegonheiro: leva todo mundo','3 anos','curva B, 13,4 mil un. no ano','Todos os carrinhos a bordo! 🚚🚗','O Tópi Invictus Super Cegonheiro é o caminhão-cegonha que leva os carrinhos para a próxima aventura.','Todos os carrinhos a bordo! 🚚🚗
O Tópi Invictus Super Cegonheiro leva a frota inteira para a próxima aventura.
A partir de 3 anos.
Quantos carrinhos cabem aí?
Brincar é Tópi! 🧡
#Tópi #Invictus #Cegonheiro','Quantos carrinhos tem aí? 🚗 [caixinha]'),
  (7,'2026-11-13','7212','Tópi Chef Brunch: café da manhã de faz de conta','3 anos','linha Tópi Chef (7,3 mil un.)','Bom dia, chef! O café da manhã está servido. 🥞','O Tópi Chef Brunch tem comidinhas de café da manhã para a criança preparar e servir.','Bom dia, chef! O café da manhã está servido. 🥞
Com o Tópi Chef Brunch, a criança prepara a mesa e serve quem acordou.
A partir de 3 anos.
Panqueca ou pão de queijo?
Brincar é Tópi! 🧡
#Tópi #TópiChef #FazDeConta','Panqueca ou pão de queijo? 🥞 [enquete: Panqueca / Pão de queijo]'),
  (8,'2026-11-18','1036','Jeep Rally Tópi: aventura sem estrada','3 anos','8,8 mil un. no ano','Prepara que a trilha começa agora! 🚙💨','O Jeep Rally é o carrinho de aventura para a criança inventar a própria trilha.','Prepara que a trilha começa agora! 🚙💨
O Jeep Rally encara tapete, quintal e qualquer trilha inventada.
A partir de 3 anos.
Para onde vai a próxima aventura?
Brincar é Tópi! 🧡
#Tópi #JeepRally #Aventura','Trilha na lama ou na areia? 🚙 [enquete: Lama / Areia]'),
  (9,'2026-11-20','4019 · 4020','Tópi Batedeira e Liquidificador: a cozinha ganha vida','3 anos','5,5 mil + 4,4 mil un. no ano','Bate, mistura e serve! 🍰','A Tópi Batedeira e o Tópi Liquidificador completam a cozinha de faz de conta.','Bate, mistura e serve! 🍰
A Tópi Batedeira e o Tópi Liquidificador completam a cozinha de faz de conta para preparar a receita favorita.
A partir de 3 anos.
Bolo ou vitamina?
Brincar é Tópi! 🧡
#Tópi #FazDeConta #Cozinha','Bolo ou vitamina? 🍰 [enquete: Bolo / Vitamina]'),
  (10,'2026-11-25','4018','Tópi Invictus Caçamba: obra na sala','3 anos','8,1 mil un. no ano','Abre a caçamba que a obra começou! 🚧','O Tópi Invictus Caçamba é o caminhão para a brincadeira de construir e transportar.','Abre a caçamba que a obra começou! 🚧
O Tópi Invictus Caçamba carrega, levanta e despeja tudo na obra de faz de conta.
A partir de 3 anos.
O que a obra vai construir?
Brincar é Tópi! 🧡
#Tópi #Invictus #Construção','O que a obra vai construir? 🏗️ [enquete: Casa / Ponte]'),
  (11,'2026-11-27','7221 · 7219','Tópi Chef Cozinha: preparar, cozinhar e servir','3 anos','linha Tópi Chef (5 mil un. cada)','Avental pronto? A cozinha é sua! 👩‍🍳','As cozinhas Tópi Chef têm tudo para preparar, cozinhar e servir a refeição de faz de conta.','Avental pronto? A cozinha é sua! 👩‍🍳
Com as cozinhas Tópi Chef, a criança prepara, cozinha e serve a família inteira.
A partir de 3 anos.
Qual é a especialidade do chef aí?
Brincar é Tópi! 🧡
#Tópi #TópiChef #FazDeConta','Qual a especialidade do chef? 👩‍🍳 [caixinha]'),
  (12,'2026-12-02','4012','Tópi Pandeiro: o som da festa','3 anos','6,3 mil un. no ano','Quem chega primeiro na roda? 🎶','O Tópi Pandeiro é o instrumento para a criança puxar a festa e a cantoria em família.','Quem chega primeiro na roda? 🎶
Com o Tópi Pandeiro, a criança puxa a cantoria e a família inteira entra na festa.
A partir de 3 anos.
Qual música não pode faltar?
Brincar é Tópi! 🧡
#Tópi #Pandeiro #Musical','Qual música não pode faltar na festa? 🎶 [caixinha]'),
  (13,'2026-12-04','7215','Tópi Chef Cozinha Forno: direto do forno','3 anos','linha Tópi Chef (3 mil un.)','Saindo quentinho do forno! 🍕','A Tópi Chef Cozinha Forno é a cozinha para assar a receita de faz de conta.','Saindo quentinho do forno! 🍕
Com a Tópi Chef Cozinha Forno, a criança assa a pizza, o bolo e o que mais inventar.
A partir de 3 anos.
Pizza ou bolo?
Brincar é Tópi! 🧡
#Tópi #TópiChef #FazDeConta','Pizza ou bolo? 🍕 [enquete: Pizza / Bolo]'),
  (14,'2026-12-09','4030 · 4031 · 4032','Bolofante, Bololéo e Bolopótamo: aprender brincando','18 meses','linha Bolo, estoque para girar','Formas, letras e números: tudo vira brincadeira! 🐘🦁🦛','Bolofante (formas), Bololéo (letras) e Bolopótamo (números) são os bichinhos da Tópi para aprender brincando a partir de 18 meses.','Formas, letras e números: tudo vira brincadeira! 🐘🦁🦛
O Bolofante ensina as formas, o Bololéo as letras e o Bolopótamo os números.
A partir de 18 meses.
Qual desses é a cara do seu pequeno?
Brincar é Tópi! 🧡
#Tópi #AprenderBrincando #Bebê','Formas, letras ou números? 🐘🦁🦛 [enquete: Formas / Letras / Números]'),
  (15,'2026-12-11','7216 · 7217 · 7218','Tópi Chef Cozinhas: legumes, mar e terra','3 anos','linha Tópi Chef','Hoje o cardápio vem da feira! 🥕🐟','As cozinhas Tópi Chef Legumes, Legumes e Mar e Terra e Mar trazem comidinhas para variar o cardápio de faz de conta.','Hoje o cardápio vem da feira! 🥕🐟
As cozinhas Tópi Chef Legumes, Legumes e Mar e Terra e Mar deixam o cardápio de faz de conta bem variado.
A partir de 3 anos.
Qual prato a criança inventaria?
Brincar é Tópi! 🧡
#Tópi #TópiChef #FazDeConta','Legumes ou peixinho? 🥕🐟 [enquete: Legumes / Peixe]'),
  (16,'2026-12-16','4025 · 4029 · 4018 · 1036','Frota Tópi: presente para quem ama caminhão','3 anos','Invictus + Jeep (giro de Natal)','Tem fã de caminhão aí? O presente está aqui! 🚛🎁','Graneleiro, Super Cegonheiro, Caçamba e Jeep Rally: a frota da Tópi para o Natal de quem ama veículos.','Tem fã de caminhão aí? O presente está aqui! 🚛🎁
Graneleiro, Super Cegonheiro, Caçamba e Jeep Rally: a frota da Tópi para o Natal.
A partir de 3 anos.
Qual vai para debaixo da árvore?
Brincar é Tópi! 🧡
#Tópi #PresenteDeNatal #Caminhão','Qual vai para debaixo da árvore? 🎄 [enquete: Cegonheiro / Jeep Rally]'),
  (17,'2026-12-23','7212 · 7213 · 7214','Ceia de faz de conta com o Tópi Chef','3 anos','linha Tópi Chef','A ceia de Natal da criançada está servida! 🎄🍽️','Com a linha Tópi Chef, a criança prepara a própria ceia de faz de conta junto com a família.','A ceia de Natal da criançada está servida! 🎄🍽️
Com a linha Tópi Chef, a criança prepara a própria ceia e serve a família inteira.
A partir de 3 anos.
O que não pode faltar na ceia aí?
Brincar é Tópi! 🧡
#Tópi #Natal #TópiChef','O que não pode faltar na ceia? 🎄 [caixinha]'),
  (18,'2026-12-30','4024 · 1036','Férias no quintal: Trator Agro e Jeep Rally','3 anos','curva A + aventura','Férias começaram: bora pro quintal! ☀️🚜','Trator Agro e Jeep Rally são a dupla para as férias ao ar livre.','Férias começaram: bora pro quintal! ☀️🚜
Trator Agro na colheita, Jeep Rally na trilha: a brincadeira das férias é lá fora.
A partir de 3 anos.
Qual é a brincadeira favorita das férias?
Brincar é Tópi! 🧡
#Tópi #Férias #BrincarAoArLivre','Trator ou Jeep nas férias? ☀️ [enquete: Trator / Jeep]')
  ) as v (n, data, sku, titulo, idade, giro, gancho, mensagem, legenda, enquete)
on conflict (ext_key) do nothing;

-- 3) liga ao cadastro do produto quando a REF é uma só
update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key like 'plano-2026-10d:%' and t.product_id is null
   and t.sku ~ '^[0-9]+$' and ltrim(p.code, '0') = ltrim(t.sku, '0');

-- 4) os destinos de cada Reels
--    quarta: Reels 19h + Stories 21h + TikTok quinta 19h + YouTube (playlist Tópi) sábado 18h
--    sexta:  Reels 19h + Stories 21h + Stories com enquete sábado 10h30 + TikTok sábado 19h
insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label,
  week_theme, brand, network, channel, piece_type, format, origin, pauta, product, sku, objective, cta, media_use,
  product_id, caption, creative_changed, mirror_facebook)
select t.ext_key || ':' || d.k, t.id, c.id, d.kind, dia, d.hora::time,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from dia)::int + 1],
       (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from dia)::int] || '/' || to_char(dia, 'YY'),
       t.front, t.brand, c.network, c.account || ' · ' || c.name, d.tipo, d.formato, d.origem, t.title, t.product, t.sku, t.objective, t.cta, t.media_use,
       t.product_id,
       case d.legenda when 'reels' then t.brief->>'legenda' when 'enquete' then t.brief->>'enquete' end,
       false, d.k = 0
  from public.social_topics t
  cross join lateral (values
    (0, 0, '19:00', 'tp-ig',    'matriz',      'Reels',   'Reels',   'Original',         'reels',   null::int),
    (1, 0, '21:00', 'tp-ig',    'reaproveita', 'Stories', 'Stories', 'Reaproveitamento', null,      null),
    (2, 1, '19:00', 'tp-tt',    'reaproveita', 'Reels',   'Vídeo',   'Reaproveitamento', null,      3),
    (3, 3, '18:00', 'cd-yt-tp', 'reaproveita', 'Shorts',  'Shorts',  'Reaproveitamento', null,      3),
    (4, 1, '10:30', 'tp-ig',    'adapta',      'Stories', 'Stories', 'Original',         'enquete', 5),
    (5, 1, '19:00', 'tp-tt',    'reaproveita', 'Reels',   'Vídeo',   'Reaproveitamento', null,      5)
  ) as d (k, dias, hora, canal, kind, tipo, formato, origem, legenda, so_no_dia)
  cross join lateral (select (t.brief->>'data')::date + d.dias as dia) x
  join public.social_channels c on c.id = d.canal
 where t.ext_key like 'plano-2026-10d:%'
   and (d.so_no_dia is null or d.so_no_dia = extract(dow from (t.brief->>'data')::date))
on conflict (ext_id) do nothing;

-- 5) nada no horário de almoço (Playmi e Tópi): dia de semana 19h e Stories 21h; sábado 10h
update public.social_plan_items s
   set pub_time = '21:00', updated_at = now()
  from public.social_plan_items r
 where r.topic_id = s.topic_id
   and r.link_kind = 'matriz' and r.piece_type = 'Reels' and r.network = 'Instagram'
   and r.brand in ('Playmi', 'Tópi') and r.pub_time = '12:00'
   and extract(dow from r.pub_date) between 1 and 5
   and s.link_kind = 'reaproveita' and s.piece_type = 'Stories' and s.network = 'Instagram'
   and s.pub_date = r.pub_date and s.pub_time = '19:30'
   and not s.archived and s.stage not in ('agendado', 'publicado');

update public.social_plan_items
   set pub_time = case when extract(dow from pub_date) = 6 then '10:00'::time else '19:00'::time end,
       updated_at = now()
 where brand in ('Playmi', 'Tópi') and pub_time = '12:00'
   and not archived and stage not in ('agendado', 'publicado');

-- 6) CONFERÊNCIA — deve mostrar: 18 assuntos | 72 posts | 0 no almoço
select (select count(*) from public.social_topics where ext_key like 'plano-2026-10d:%') as assuntos_topi,
       (select count(*) from public.social_plan_items where ext_id like 'plano-2026-10d:%') as posts_topi,
       (select count(*) from public.social_plan_items where not archived and stage <> 'publicado' and pub_time = '12:00') as no_almoco;
