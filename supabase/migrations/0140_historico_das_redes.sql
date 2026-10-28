-- HISTÓRICO DAS REDES (Meta Business Suite, lido em 28/10/2026): tudo o que saiu no Instagram e no Facebook
-- da Cardoso, da Playmi e da Tópi de 01/09 a 27/10 entra no calendário como PUBLICADO, com data, hora, onde saiu,
-- formato, legenda e visualizações (na época da leitura).
--   1) posts que saíram antes do plano do Hub viram assuntos de histórico (prefixo meta-hist:)
--   2) os posts do plano que já saíram ganham a hora real, a legenda publicada e o selo de publicado
--   3) Stories: um item por dia em que a marca postou Stories (o Business Suite não guarda legenda de Stories)
-- Post cruzado (Instagram + Facebook) fica no Instagram com "espelho no Facebook"; post só no Facebook fica no canal Facebook.
-- Pode rodar de novo.

-- 1) posts antes do plano
insert into public.social_topics (ext_key, title, brand, product, sku, front, objective, strategy, cta, media_use, licensed, brief)
select v.k, v.titulo, v.marca, '', v.sku, 'Histórico · ' || v.mes || '/26', 'Publicado antes do plano do Hub', 'Histórico das redes', '', 'Orgânico', v.lic,
       jsonb_build_object('medicao', v.views || ' visualizações (leitura de 28/10)', 'legenda', v.legenda)
  from (values
  ('meta-hist:playmi:2026-09-03-0920', 'Playmi', 'pl-ig', '2026-09-03'::date, '09:20', 'Feed', 'Foto', true, '2012', 'Geladeira Sonho de Menina', false, '997', 'Set', $q$Tem sempre um espacinho para mais diversão! 💗🩵 A Geladeira Sonho de Menina transforma o faz de conta em uma brincadeira cheia de descobertas. Com prateleiras, ovos, alimentos e espaço para organizar tudo do jeitinho que a criança imaginar, ela pode brincar de casinha, mercado e criar suas próprias histórias. Organizar, imaginar e brincar: tudo começa na brincadeira! ✨ Qual seria a primeira coisa que não poderia faltar na geladeira da sua filha? 🥚🥛🍎$q$),
  ('meta-hist:playmi:2026-09-05-1130', 'Playmi', 'pl-fb', '2026-09-05'::date, '11:30', 'Reels', 'Reels', false, '2012', 'Geladeira Sonho de Menina por dentro', false, '245', 'Set', $q$Já imaginou uma geladeira feita para deixar o faz de conta ainda mais completo? 💗🩵 Por dentro, cada detalhe foi pensado para transformar a brincadeira em uma experiência cheia de possibilidades! Prateleiras para organizar, espaço para os alimentos e compartimentos que deixam tudo mais divertido e realista. ✨ Porque quando a brincadeira começa, até a hora de organizar a geladeira vira diversão! 🥰$q$),
  ('meta-hist:playmi:2026-09-11-0930', 'Playmi', 'pl-ig', '2026-09-11'::date, '09:30', 'Feed', 'Carrossel', true, '', 'Queridinhos de agosto', false, '293', 'Set', $q$Agosto passou voando… e deixou um montão de queridinhos por aqui! 💙✨ Separamos os produtos que mais fizeram sucesso no mês — aqueles que conquistaram os pequenos e ganharam um espacinho especial no coração das famílias. 🥰🧸 Será que o seu favorito está nessa lista? 👀💫 Conta pra gente nos comentários: qual desses você escolheria para a sua próxima aventura? 💙$q$),
  ('meta-hist:playmi:2026-09-14-1508', 'Playmi', 'pl-fb', '2026-09-14'::date, '15:08', 'Reels', 'Reels', false, '', 'Studio Fashion Celebridades Corte & Escova', false, '246', 'Set', $q$Seu próprio salão de beleza, do jeitinho que ela imaginou! 💕💇‍♀️ Com o Studio Fashion Celebridades Corte & Escova, cada momento vira uma oportunidade para criar, cuidar e soltar a imaginação. São acessórios e ferramentas para brincar de salão e inventar novos looks, sempre com muito estilo. Porque quando a brincadeira ganha espaço, a criatividade também cresce. 💖$q$),
  ('meta-hist:playmi:2026-09-16-1119', 'Playmi', 'pl-ig', '2026-09-16'::date, '11:19', 'Reels', 'Reels', true, '', 'Studio Fashion: hoje tem salão', false, '1.582', 'Set', $q$Hoje tem salão! 💗✨ Secador, escova, pente, espelho e muita imaginação: o Studio Fashion transforma a brincadeira em um verdadeiro momento de beleza. 💇‍♀️🎀$q$),
  ('meta-hist:playmi:2026-09-22-1619', 'Playmi', 'pl-ig', '2026-09-22'::date, '16:19', 'Feed', 'Foto', true, '', 'Brincar de cozinhar', false, '1.225', 'Set', $q$Brincar de cozinhar é muito mais do que fazer de conta! 🍳💗 É criar receitas, experimentar, imaginar histórias e descobrir um mundo inteiro através da brincadeira. ✨ Com nossos brinquedos, cada ingrediente vira uma ideia, cada receita vira uma aventura e cada momento é uma oportunidade de criar, aprender e se divertir. Porque brincar também é uma forma de crescer. 💕$q$),
  ('meta-hist:playmi:2026-09-25-1535', 'Playmi', 'pl-ig', '2026-09-25'::date, '15:35', 'Reels', 'Reels', true, '3122', 'Little Figs Galinha Pintadinha O Filme', true, '5.062', 'Set', $q$A turma da Galinha Pintadinha está pronta para ganhar vida de um jeito diferente: na ponta dos dedos! 🐔✨ Os Dedoches Galinha Pintadinha o Filme, reúnem os personagens favoritos em miniaturas que cabem nas mãos e abrem espaço para criar histórias, cantar, brincar e soltar a imaginação. 🎬 Dia 1º de outubro, a Galinha Pintadinha estreia nos cinemas, mas na Playmi, ela já está pronta para brincar. Pó pó pó pó! Quem vai escolher o primeiro personagem? 💙$q$),
  ('meta-hist:playmi:2026-09-30-1151', 'Playmi', 'pl-ig', '2026-09-30'::date, '11:51', 'Feed', 'Carrossel', true, '', 'Totokinha Galinha Pintadinha', true, '3.399', 'Set', $q$A Totokinha Galinha Pintadinha foi pensada para acompanhar os pequenos em momentos de muita diversão — e também de descobertas. Com encaixes de formas e cores, porta-malas, buzina e detalhes que tornam cada brincadeira ainda mais especial, ela transforma o faz de conta em uma experiência cheia de possibilidades. 🐣✨ E tem um detalhe que deixa tudo ainda mais encantador: a companhia da Galinha Pintadinha para fazer parte dessas primeiras aventuras. 💙 Vamos brincar com a Popó?$q$),
  ('meta-hist:playmi:2026-10-01-0950', 'Playmi', 'pl-ig', '2026-10-01'::date, '09:50', 'Reels', 'Reels', true, '3123', 'Totokinha Bluey', true, '9.911', 'Out', $q$A brincadeira ficou ainda mais divertida com a Bluey! A Totokinha Bluey da Playmi foi pensada para transformar os momentos de brincadeira em aventuras cheias de imaginação. Com detalhes que aproximam o produto do universo da personagem, ela combina design, diversão e o encanto de uma das personagens mais queridas pelas crianças. É a Bluey que as crianças conhecem, agora pronta para acompanhar novas histórias, passeios e muitas brincadeiras. 🐾✨ Bingo! Vamos brincar? 💙$q$),
  ('meta-hist:playmi:2026-10-01-1917', 'Playmi', 'pl-ig', '2026-10-01'::date, '19:17', 'Reels', 'Reels', true, '7229', 'Patinete Bluey', true, '3.358', 'Out', $q$Bora passear com a Bluey? A aventura fica ainda mais divertida sobre três rodas! 🛴✨ O Patinete Bluey da Playmi foi pensado para acompanhar as crianças em seus primeiros passeios, com 3 rodas para mais estabilidade, guidão com regulagem de altura, rodas com luzes e estrutura dobrável. Um produto que une o universo da Bluey a uma experiência de brincadeira cheia de movimento e diversão. A Bluey está pronta para acompanhar seu filho em diversas aventuras! 🐾$q$),
  ('meta-hist:playmi:2026-10-04-2007', 'Playmi', 'pl-ig', '2026-10-04'::date, '20:07', 'Reels', 'Reels', true, '7203', 'Fofush Encantado: desenho na barriguinha', false, '2.877', 'Out', $q$A brincadeira fica ainda mais divertida quando a criança pode deixar sua própria marca. 💗 Com a lanterna de LED, é possível desenhar na barriguinha do Fofush e criar diferentes desenhos para cada momento da brincadeira. Hoje é um coração. ❤️ Amanhã, uma estrelinha. ⭐ Depois… quem sabe o que a imaginação vai inventar? Uma Fofush. Mil possibilidades para criar. ✨$q$),
  ('meta-hist:playmi:2026-10-05-0859', 'Playmi', 'pl-ig', '2026-10-05'::date, '08:59', 'Reels', 'Reels', true, '7203', 'Fofushs Encantados', false, '5.057', 'Out', $q$Conheça os Fofushs Encantados da Playmi: bichinhos fofos que deixam a imaginação ganhar forma — literalmente! 🦄🐻🐘 Com a lanterna de LED e os moldes encantadores, a criança pode criar desenhos na barriguinha da Fofush e, depois, apagar para começar uma nova criação. 🎨✨ É desenhar, inventar, transformar e criar de novo quantas vezes quiser!$q$),
  ('meta-hist:playmi:2026-10-06-1719', 'Playmi', 'pl-ig', '2026-10-06'::date, '17:19', 'Reels', 'Reels', true, '3101', 'Little Figs O Show da Luna', true, '189.206 (com anúncio)', 'Out', $q$As aventuras de Luna, Júpiter e Cláudio agora cabem na palma da sua mão! Com os Dedoches O Show da Luna! da Playmi, você vai participar com o trio mais curioso dos mais incríveis faz de conta! 🔎 O que está acontecendo aqui? Eu quero saber! Eu quero muuuito saber! Toda brincadeira pode começar com uma pergunta e terminar em uma grande descoberta! 💛 Preparados para toda essa diversão?$q$),
  ('meta-hist:playmi:2026-10-07-1624', 'Playmi', 'pl-ig', '2026-10-07'::date, '16:24', 'Reels', 'Reels', true, '', 'Bonecas Playmi: o mundo do faz de conta', false, '110.233 (com anúncio)', 'Out', $q$E, se por alguns minutos a gente pudesse entrar no mundo da imaginação e da brincadeira? Trocar de personagem, inventar histórias, criar cenários e deixar a imaginação conduzir cada aventura. 💭💕 Porque no faz de conta, não existe certo ou errado — existe espaço para criar. Na Playmi, cada boneca é um convite para imaginar um novo mundo. Agora é sua vez: qual história vamos criar? 🧸✨$q$),
  ('meta-hist:playmi:2026-10-09-1124', 'Playmi', 'pl-ig', '2026-10-09'::date, '11:24', 'Reels', 'Reels', true, '', 'O Show da Luna: brincar também é descobrir', true, '5.231', 'Out', $q$Toda criança é naturalmente curiosa. Uma pergunta leva a outra, uma descoberta abre caminho para uma nova aventura — e é assim que o aprendizado acontece também durante a brincadeira. Inspirado no universo de O Show da Luna, o brincar ganha espaço para explorar, observar, perguntar e descobrir. 🌙🔬 Porque, para as crianças, um brinquedo pode ser muito mais do que diversão: pode ser uma oportunidade para estimular a curiosidade e transformar cada “por quê?” em uma nova descoberta. Na Playmi, brincar também é descobrir. 💜$q$),
  ('meta-hist:playmi:2026-10-10-1252', 'Playmi', 'pl-ig', '2026-10-10'::date, '12:52', 'Feed', 'Carrossel', true, '1017', 'Tandy Tractor', false, '11.971', 'Out', $q$Com o Tandy Tractor, a brincadeira ganha novos caminhos para imaginar, construir e descobrir. 💙 Com braço de carregadeira móvel e caçamba que levanta, cada movimento convida a criança a criar novas histórias e transformar a brincadeira em uma verdadeira aventura. Porque brincar também é acelerar a imaginação, imaginar possibilidades e descobrir novos caminhos. Tandy Tractor: pronto para qualquer aventura! ✨$q$),
  ('meta-hist:playmi:2026-10-11-1316', 'Playmi', 'pl-ig', '2026-10-11'::date, '13:16', 'Reels', 'Reels', true, '1049', 'Tandy Bombeiro: campeão de vendas', false, '3.209', 'Out', $q$Um verdadeiro campeão de vendas! 🧑🏽‍🚒 O Tandy Bombeiro é sucesso na Playmi e transforma cada brincadeira em uma nova missão. 🔥 Para imaginar, explorar e criar histórias de resgate sem limites. Tandy Bombeiro. A brincadeira entra em ação! ❤️‍🔥$q$),
  ('meta-hist:cardoso:2026-09-15-1331', 'Cardoso', 'cd-ig', '2026-09-15'::date, '13:31', 'Feed', 'Foto', true, 'Institucional', 'Feliz Dia do Cliente', false, '560', 'Set', $q$Hoje é dia de celebrar quem faz parte da nossa história. Mais do que clientes, temos parceiros que confiam no nosso trabalho, compartilham desafios e constroem resultados ao nosso lado. Cada parceria nos inspira a buscar soluções melhores, evoluir e seguir entregando excelência todos os dias. Feliz Dia do Cliente! ❤️ Nosso muito obrigado pela confiança e por fazer parte da nossa jornada.$q$),
  ('meta-hist:cardoso:2026-09-22-0836', 'Cardoso', 'cd-ig', '2026-09-22'::date, '08:36', 'Reels', 'Reels', true, '1049', 'Tandy Bombeiro: da fábrica para a prateleira', false, '4.750', 'Set', $q$Por trás de um campeão de vendas, existe muita engenharia, desenvolvimento e produção. O Tandy Bombeiro, comercializado pela Playmi, é um dos grandes sucessos fabricados pela Cardoso. Neste Reels, mostramos um pouco do processo que transforma nosso desenvolvimento em um produto que conquista o mercado. 🏭🚒 Você já viu este gigante na prateleira?$q$),
  ('meta-hist:cardoso:2026-09-24-1944', 'Cardoso', 'cd-ig', '2026-09-24'::date, '19:44', 'Reels', 'Reels', true, '', 'Galinha Pintadinha nos cinemas (collab com a Playmi)', true, '4.446', 'Set', $q$Faltam 7 dias para a Galinha Pintadinha chegar às telonas em seu primeiro filme nos cinemas. 🎬💙 Uma personagem que há anos faz parte da infância brasileira e que também está presente no portfólio da @cardoso.playmi E por trás desses produtos está a Cardoso, indústria que transforma grandes personagens e licenças em brinquedos que chegam ao varejo e ganham espaço na hora de brincar. Agora, a Galinha Pintadinha ganha uma nova história no cinema. E, na Playmi e na Cardoso, ela também ganha forma através dos brinquedos. 🐔🧸 📅 01 de outubro | Estreia da Galinha Pintadinha nos cinemas.$q$),
  ('meta-hist:cardoso:2026-09-30-0949', 'Cardoso', 'cd-ig', '2026-09-30'::date, '09:49', 'Feed', 'Carrossel', true, 'Institucional', 'Dia das Crianças: o mix que não pode faltar na loja', false, '4.623', 'Set', $q$O Dia das Crianças está chegando — e sua loja precisa estar preparada! Até 12 de outubro, a procura por brinquedos ganha ainda mais força. Por isso, ter um mix diversificado, com produtos que despertam o interesse das crianças e diferentes faixas de preço, faz toda a diferença no ponto de venda. 🧸✨ Neste carrossel, reunimos alguns dos produtos que podem fazer parte do seu mix para a data — de brinquedos para os pequenos construtores a opções de faz de conta, totokinhas, pelúcias e muito mais. Na Cardoso, desenvolvemos um portfólio pensado para acompanhar as diferentes formas de brincar e ajudar o varejo a aproveitar os grandes momentos do calendário. 📲 Deslize e confira alguns dos produtos que não podem faltar na sua loja.$q$),
  ('meta-hist:cardoso:2026-10-01-1500', 'Cardoso', 'cd-ig', '2026-10-01'::date, '15:00', 'Feed', 'Foto', true, 'Institucional', 'Feliz Dia do Vendedor', false, '699', 'Out', $q$Hoje celebramos quem transforma oportunidades em grandes conquistas! No Dia do Vendedor, nosso reconhecimento a quem está na linha de frente, construindo relacionamentos, fortalecendo parcerias e levando a Cardoso cada vez mais longe. Mais do que vender, vocês conectam pessoas, criam oportunidades e ajudam a levar a alegria de brincar para mais famílias. ❤️ Nosso muito obrigado por fazerem parte dessa jornada. Feliz Dia do Vendedor! 🚀$q$),
  ('meta-hist:cardoso:2026-10-03-0853', 'Cardoso', 'cd-ig', '2026-10-03'::date, '08:53', 'Reels', 'Reels', true, '3113', 'Little Figs Bluey (collab com a Playmi)', true, '5.790', 'Out', $q$A Bluey e sua turma agora cabem na ponta dos dedos! ✨ Com as Miniaturas Dedoches Bluey da @cardoso.playmi, cada personagem pode ganhar uma nova história e uma nova aventura. É brincar de faz de conta, inventar situações e deixar a imaginação comandar a diversão. 🧸🐾 Porque com a Bluey, qualquer momento pode virar uma brincadeira! Escolha seu personagem e… bora brincar? 💙$q$),
  ('meta-hist:cardoso:2026-10-05-1605', 'Cardoso', 'cd-ig', '2026-10-05'::date, '16:05', 'Feed', 'Carrossel', true, 'Institucional', 'Produto certo no lugar certo', false, '14.688', 'Out', $q$Produto certo no lugar certo faz diferença no resultado. 📈 Na Cardoso, nosso trabalho não termina quando o produto sai da fábrica. Pensamos em toda a jornada até o ponto de venda: sortimento, apresentação, materiais de PDV, sugestões de mix e suporte comercial para ajudar nossos parceiros a transformar produtos em oportunidades de venda. Porque uma indústria parceira não entrega apenas brinquedos. Entrega estratégia, suporte e soluções para o varejo vender mais.$q$),
  ('meta-hist:cardoso:2026-10-06-1316', 'Cardoso', 'cd-ig', '2026-10-06'::date, '13:16', 'Reels', 'Reels', true, 'Institucional', 'Display Playmi no ponto de venda (collab com a Playmi)', false, '6.988', 'Out', $q$Da indústria ao ponto de venda, estratégia que ganha forma. 🚀 No último conteúdo, mostramos como pensamos cada etapa para que nossos produtos cheguem ao varejo preparados para gerar resultados. Aqui, você vê isso na prática: um display desenvolvido para destacar o portfólio @cardoso.playmi dentro de uma rede parceira, valorizando os produtos, organizando a exposição e facilitando a escolha no ponto de venda. Porque para a Cardoso, desenvolver um produto também é pensar em como ele será apresentado, encontrado e escolhido pelo consumidor. Mais do que produzir brinquedos. Criamos soluções para o varejo.$q$),
  ('meta-hist:cardoso:2026-10-10-1056', 'Cardoso', 'cd-fb', '2026-10-10'::date, '10:56', 'Feed', 'Carrossel', false, '1017', 'Tandy Tractor: da indústria para a brincadeira', false, '71 e 98 (2 publicações)', 'Out', $q$Da indústria para a brincadeira. 🚀 O Tandy Tractor, da Playmi, foi desenvolvido para transformar cada movimento em uma nova possibilidade de brincar. Com braço de carregadeira móvel e caçamba que levanta, o produto combina funcionalidade, interação e design pensado para estimular a imaginação e ampliar as possibilidades de brincadeira. É assim que a Cardoso trabalha: desenvolvendo produtos que unem experiência de brincar, diferenciais que valorizam o produto e oportunidades para o varejo. Acesse nosso site e conheça nosso portfólio! Link na bio ✨$q$),
  ('meta-hist:cardoso:2026-10-10-1808', 'Cardoso', 'cd-ig', '2026-10-10'::date, '18:08', 'Reels', 'Reels', true, '1062', 'Air Truck Caçamba: experiência e resultado no varejo (collab com a Playmi)', false, '10.201', 'Out', $q$Um produto pensado para gerar experiência — e resultado no varejo. O Air Truck Caçamba, da Playmi, reúne design, funcionalidade e um diferencial que valoriza a experiência de brincar. Para a Cardoso, desenvolver um brinquedo vai além do produto. Pensamos em diferenciais que agregam valor à linha, comunicação que facilita a escolha e soluções que ajudam o varejo a vender. Da indústria ao ponto de venda, cada detalhe importa. 🚀$q$),
  ('meta-hist:cardoso:2026-10-12-0824', 'Cardoso', 'cd-ig', '2026-10-12'::date, '08:24', 'Feed', 'Foto', true, 'Institucional', 'Feliz Dia das Crianças (collab com Playmi e Tópi)', false, '662', 'Out', $q$Feliz Dia das Crianças! ❤️✨ O brincar começa com uma ideia, ganha forma pelas mãos de quem cria e chega até as crianças para se transformar em histórias, descobertas e possibilidades. Na Cardoso, transformamos ideias em brinquedos. Na Playmi e na Topi, essas ideias ganham diferentes formas de brincar e chegam a cada vez mais famílias. Hoje, celebramos aquilo que conecta tudo isso: a infância e a magia de brincar. 🧸 Que a imaginação de hoje construa um futuro com mais possibilidades. Cardoso + Playmi + Topi. Juntos, fazendo o brincar acontecer ❤️$q$),
  ('meta-hist:topi:2026-09-08-1321', 'Tópi', 'tp-ig', '2026-09-08'::date, '13:21', 'Reels', 'Reels', true, '', 'Combo Escavadeira', false, '2.155', 'Set', $q$Detalhes que fazem a brincadeira acontecer. 🚜 A nossa escavadeira foi pensada para deixar a imaginação tomar conta: com design inspirado nos grandes veículos de construção, detalhes que chamam a atenção e muita diversão para criar novas aventuras. É brincar de construir, explorar e transformar cada história em uma nova descoberta. 💛 🚜 Combo Escavadeira: pronta para entrar em ação.$q$),
  ('meta-hist:topi:2026-09-11-0811', 'Tópi', 'tp-ig', '2026-09-11'::date, '08:11', 'Feed', 'Foto', false, '9055', 'Comboio Bombeiro', false, '264', 'Set', $q$Chamado para a diversão! 🚒 Com o Comboio Bombeiro Topi, a imaginação entra em ação! 🔥✨ Cheio de detalhes que deixam a brincadeira ainda mais divertida, ele transforma cada momento em uma nova missão para pequenos heróis. 🚒 Caminhão pronto. 👨‍🚒 Agora só falta escolher a próxima missão!$q$),
  ('meta-hist:topi:2026-09-22-0805', 'Tópi', 'tp-ig', '2026-09-22'::date, '08:05', 'Reels', 'Reels', true, '4028', 'Tópi Combo Construction', false, '4.504', 'Set', $q$🚧 Construir, carregar e descarregar: a diversão não para! 💛 O Combo Construction chegou para transformar a brincadeira em uma verdadeira obra! 🚜🏗️ Com visual de veículo de construção e espaço para muita imaginação, cada brincadeira pode virar uma nova missão: transportar, construir e criar aventuras do seu jeito.$q$),
  ('meta-hist:topi:2026-09-29-1906', 'Tópi', 'tp-ig', '2026-09-29'::date, '19:06', 'Reels', 'Reels', true, '7120', 'Pet Home com Blocos', false, '2.430', 'Set', $q$O Pet Home TOPI transforma a brincadeira em um mundo de possibilidades! 🧱🐶 Com peças para montar e um pet superfofo, a criançada pode criar, explorar e inventar suas próprias histórias. Montou? Brincou? Agora é só deixar a imaginação acontecer! 💛 *Vídeo ilustrativo gerado por IA$q$),
  ('meta-hist:topi:2026-10-03-2050', 'Tópi', 'tp-ig', '2026-10-03'::date, '20:50', 'Reels', 'Reels', true, '0133', 'Mini Mercado', false, '2.792', 'Out', $q$Quem aí já brincou de fazer comprinhas? O Mini Mercado Tópi transforma o faz de conta em uma brincadeira cheia de imaginação, descobertas e diversão! 💛 Com 10 peças + 15 caixinhas, a criançada pode inventar histórias, brincar de casinha, fazer compras e criar seu próprio mercadinho. 🥰 Um clássico que atravessa gerações e continua fazendo a infância acontecer. Brincar é Tópi! 🧡$q$),
  ('meta-hist:topi:2026-10-05-0732', 'Tópi', 'tp-ig', '2026-10-05'::date, '07:32', 'Reels', 'Reels', true, '7173', 'Robô-Blocks Serviço Delivery', false, '2.202', 'Out', $q$Entrega de diversão em dobro! 💛 Com o Robô-Blocks Serviço Delivery, a brincadeira começa na construção e continua na transformação. 🔧🤖 São 45 peças para montar um veículo de delivery e, depois, transformar tudo em um robô! 🔄 2 em 1: monte, transforme e crie novas aventuras. Um brinquedo que combina construção, criatividade e diversão em uma única experiência. 📦 E aí, qual vai ser a primeira entrega desse robô?$q$),
  ('meta-hist:topi:2026-10-10-1414', 'Tópi', 'tp-ig', '2026-10-10'::date, '14:14', 'Reels', 'Reels', true, '', 'Blocos de montar Tópi', false, '4.949', 'Out', $q$Abriu. Montou. A brincadeira começou! 🚜🧱✨ Com os blocos Topi, cada peça se encaixa e uma nova aventura aparece. É construir do seu jeito, imaginar sem limites e se divertir a cada montagem! 💛 E aí: o que você construiria primeiro? 👀$q$),
  ('meta-hist:topi:2026-10-11-1602', 'Tópi', 'tp-ig', '2026-10-11'::date, '16:02', 'Reels', 'Reels', true, '4015', 'Tópi Pata Bota Ovo', false, '618', 'Out', $q$Com o Pata Bota Ovo, cada forma tem seu lugar e cada descoberta vira uma nova brincadeira. 🐣✨ A criança explora cores, formas e coordenação de um jeito divertido — e no final ainda tem uma surpresa: a Pata bota o ovo! 🥚💛 Uma brincadeira gostosa de descobrir, experimentar e repetir! 🛒 Gostou? Encontre o Pata Bota Ovo e leve essa diversão para casa!$q$),
  ('meta-hist:topi:2026-10-11-2112', 'Tópi', 'tp-ig', '2026-10-11'::date, '21:12', 'Reels', 'Reels', true, '3059', 'Tópi Sabidinho Plus', false, '5.075', 'Out', $q$Bora brincar de aprender? O Tôpi Sabidinho Plus transforma formas e cores em uma brincadeira cheia de descobertas! 💚 Um carrinho divertido para os pequenos encaixarem, explorarem e aprenderem brincando. Sabidinho Plus: diversão que também ensina! 💛$q$)
  ) as v (k, marca, canal, data, hora, peca, formato, espelho, sku, titulo, lic, views, mes, legenda)
on conflict (ext_key) do nothing;

insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook, stage, stage_at)
select t.ext_key, t.id, v.canal, 'matriz', v.data, v.hora::time,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/26',
       t.front, t.brand, case when v.canal like '%-fb' then 'Facebook' else 'Instagram' end,
       t.brand || case when v.canal like '%-fb' then ' · Facebook · post nativo' else ' · Instagram' end,
       v.peca, v.formato, 'Original', t.title, '', t.sku, t.objective, '', 'Orgânico', t.brief->>'legenda', false, v.espelho, 'publicado', now()
  from (values
  ('meta-hist:playmi:2026-09-03-0920', 'pl-ig', '2026-09-03'::date, '09:20', 'Feed', 'Foto', true),
  ('meta-hist:playmi:2026-09-05-1130', 'pl-fb', '2026-09-05'::date, '11:30', 'Reels', 'Reels', false),
  ('meta-hist:playmi:2026-09-11-0930', 'pl-ig', '2026-09-11'::date, '09:30', 'Feed', 'Carrossel', true),
  ('meta-hist:playmi:2026-09-14-1508', 'pl-fb', '2026-09-14'::date, '15:08', 'Reels', 'Reels', false),
  ('meta-hist:playmi:2026-09-16-1119', 'pl-ig', '2026-09-16'::date, '11:19', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-09-22-1619', 'pl-ig', '2026-09-22'::date, '16:19', 'Feed', 'Foto', true),
  ('meta-hist:playmi:2026-09-25-1535', 'pl-ig', '2026-09-25'::date, '15:35', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-09-30-1151', 'pl-ig', '2026-09-30'::date, '11:51', 'Feed', 'Carrossel', true),
  ('meta-hist:playmi:2026-10-01-0950', 'pl-ig', '2026-10-01'::date, '09:50', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-10-01-1917', 'pl-ig', '2026-10-01'::date, '19:17', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-10-04-2007', 'pl-ig', '2026-10-04'::date, '20:07', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-10-05-0859', 'pl-ig', '2026-10-05'::date, '08:59', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-10-06-1719', 'pl-ig', '2026-10-06'::date, '17:19', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-10-07-1624', 'pl-ig', '2026-10-07'::date, '16:24', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-10-09-1124', 'pl-ig', '2026-10-09'::date, '11:24', 'Reels', 'Reels', true),
  ('meta-hist:playmi:2026-10-10-1252', 'pl-ig', '2026-10-10'::date, '12:52', 'Feed', 'Carrossel', true),
  ('meta-hist:playmi:2026-10-11-1316', 'pl-ig', '2026-10-11'::date, '13:16', 'Reels', 'Reels', true),
  ('meta-hist:cardoso:2026-09-15-1331', 'cd-ig', '2026-09-15'::date, '13:31', 'Feed', 'Foto', true),
  ('meta-hist:cardoso:2026-09-22-0836', 'cd-ig', '2026-09-22'::date, '08:36', 'Reels', 'Reels', true),
  ('meta-hist:cardoso:2026-09-24-1944', 'cd-ig', '2026-09-24'::date, '19:44', 'Reels', 'Reels', true),
  ('meta-hist:cardoso:2026-09-30-0949', 'cd-ig', '2026-09-30'::date, '09:49', 'Feed', 'Carrossel', true),
  ('meta-hist:cardoso:2026-10-01-1500', 'cd-ig', '2026-10-01'::date, '15:00', 'Feed', 'Foto', true),
  ('meta-hist:cardoso:2026-10-03-0853', 'cd-ig', '2026-10-03'::date, '08:53', 'Reels', 'Reels', true),
  ('meta-hist:cardoso:2026-10-05-1605', 'cd-ig', '2026-10-05'::date, '16:05', 'Feed', 'Carrossel', true),
  ('meta-hist:cardoso:2026-10-06-1316', 'cd-ig', '2026-10-06'::date, '13:16', 'Reels', 'Reels', true),
  ('meta-hist:cardoso:2026-10-10-1056', 'cd-fb', '2026-10-10'::date, '10:56', 'Feed', 'Carrossel', false),
  ('meta-hist:cardoso:2026-10-10-1808', 'cd-ig', '2026-10-10'::date, '18:08', 'Reels', 'Reels', true),
  ('meta-hist:cardoso:2026-10-12-0824', 'cd-ig', '2026-10-12'::date, '08:24', 'Feed', 'Foto', true),
  ('meta-hist:topi:2026-09-08-1321', 'tp-ig', '2026-09-08'::date, '13:21', 'Reels', 'Reels', true),
  ('meta-hist:topi:2026-09-11-0811', 'tp-ig', '2026-09-11'::date, '08:11', 'Feed', 'Foto', false),
  ('meta-hist:topi:2026-09-22-0805', 'tp-ig', '2026-09-22'::date, '08:05', 'Reels', 'Reels', true),
  ('meta-hist:topi:2026-09-29-1906', 'tp-ig', '2026-09-29'::date, '19:06', 'Reels', 'Reels', true),
  ('meta-hist:topi:2026-10-03-2050', 'tp-ig', '2026-10-03'::date, '20:50', 'Reels', 'Reels', true),
  ('meta-hist:topi:2026-10-05-0732', 'tp-ig', '2026-10-05'::date, '07:32', 'Reels', 'Reels', true),
  ('meta-hist:topi:2026-10-10-1414', 'tp-ig', '2026-10-10'::date, '14:14', 'Reels', 'Reels', true),
  ('meta-hist:topi:2026-10-11-1602', 'tp-ig', '2026-10-11'::date, '16:02', 'Reels', 'Reels', true),
  ('meta-hist:topi:2026-10-11-2112', 'tp-ig', '2026-10-11'::date, '21:12', 'Reels', 'Reels', true)
  ) as v (k, canal, data, hora, peca, formato, espelho)
  join public.social_topics t on t.ext_key = v.k
on conflict (ext_id) do nothing;

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key like 'meta-hist:%' and t.product_id is null and t.sku ~ '^[0-9]+$' and split_part(p.code, ' ', 1) = t.sku;

-- 2) posts do plano que já saíram: hora real, legenda publicada e selo de publicado
update public.social_plan_items i
   set pub_date = v.data, pub_time = v.hora::time,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       caption = v.legenda, mirror_facebook = true, stage = 'publicado', stage_at = coalesce(i.stage_at, now()), updated_at = now()
  from public.social_topics t, (values
  ('plano-2026-10b:t001', 'pl-ig', '2026-10-20'::date, '11:21', $q$O Spidey agora cabe na palma da mão! 🕷️ As miniaturas da Little Figs - Marvel Spidey são para colecionar, montar a cena e inventar a próxima missão. Me diz aí, qual herói é o favorito aí na sua casa?$q$),
  ('plano-2026-10b:t004', 'pl-ig', '2026-10-22'::date, '14:30', $q$A aventura fica ainda mais incrível com a Totokinha do Spidey! 🕷️🚗 Além de acelerar a imaginação, ela tem um detalhe especial que faz toda a diferença: o baú abre de verdade! 🤩 É só abrir, guardar os tesouros da brincadeira e partir para novas aventuras com o herói favorito. ❤️$q$),
  ('plano-2026-10b:t073', 'tp-ig', '2026-10-22'::date, '11:42', $q$Tem passeio que vira uma grande aventura! 🩷👶🏻 Com seu carrinho TOPI, cuidar da bonequinha fica ainda mais divertido! 🎀✨ Empurrar, passear e inventar mil historinhas: é assim que a imaginação ganha espaço nas brincadeiras do dia a dia. Porque brincar de faz de conta é descobrir o mundo do jeitinho mais divertido! 💕$q$),
  ('plano-2026-10e:t01', 'cd-ig', '2026-10-23'::date, '18:01', $q$Você conhece a Cardoso? 👋 Somos a indústria de brinquedos que impulsiona o varejo em todo o Brasil: um portfólio completo, com marcas que fazem parte da infância de milhões de famílias. Para quem revende, isso significa suporte comercial especializado, abastecimento com agilidade e relacionamento de longo prazo. Quer revender Cardoso? Toque em Enviar mensagem e fale com o nosso comercial. Construímos muito mais que brinquedos. Construímos confiança. 🚀$q$),
  ('plano-2026-10b:t009', 'pl-ig', '2026-10-26'::date, '10:45', $q$Alerta na cidade: hora de montar o resgate! 🚒🧱 A Estação de Resgate vem com 10 blocos para construir, desmontar e criar uma missão nova a cada brincadeira. Qual seria o primeiro resgate de hoje? Onde encontrar: link na bio.$q$),
  ('plano-2026-10e:t02', 'cd-ig', '2026-10-26'::date, '15:34', $q$Os personagens favoritos da criançada ganham vida nas Totokinhas da Playmi, marca do portfólio da indústria Cardoso. ❤️ Para o varejo, as licenças agregam atratividade ao mix de produtos e criam novas oportunidades para impulsionar as vendas. 🛒 Quer levar essas opções para a sua loja? Entre em contato com nosso time comercial ou fale com seu representante.$q$),
  ('plano-2026-10d:t01', 'tp-ig', '2026-10-27'::date, '09:18', $q$Todos os carrinhos a bordo! 🚚🚗 O Invictus Super Cegonheiro leva a frota inteira para a próxima aventura, e você pode ser o motorista desta brincadeira! Conseguiu ver quantos carrinhos cabem aí? Me diz nos comentários!$q$),
  ('plano-2026-10b:t012', 'pl-ig', '2026-10-27'::date, '14:11', $q$Anda, puxa, empilha e começa tudo de novo! 💗🧱 O Carrinho de Puxar vem com 20 blocos e acompanha os primeiros passos: a criança leva o carrinho pela casa e ainda monta as próprias torres. Onde encontrar: link na bio.$q$)
  ) as v (k, canal, data, hora, legenda)
 where t.id = i.topic_id and t.ext_key = v.k and i.channel_id = v.canal and i.link_kind = 'matriz' and not i.archived;

update public.social_topics t
   set brief = t.brief || jsonb_build_object('medicao', v.views || ' visualizações (leitura de 28/10)')
  from (values ('plano-2026-10b:t001', '2.573'), ('plano-2026-10b:t004', '1.329'), ('plano-2026-10b:t073', '2.715'), ('plano-2026-10e:t01', '681'), ('plano-2026-10b:t009', '1.333'), ('plano-2026-10e:t02', '810'), ('plano-2026-10d:t01', '3.108'), ('plano-2026-10b:t012', '521')) as v (k, views)
 where t.ext_key = v.k;

update public.social_plan_items i
   set pub_time = v.hora::time, stage = 'publicado', stage_at = coalesce(i.stage_at, now()), updated_at = now()
  from public.social_topics t, (values ('plano-2026-10b:t004', 'pl-ig', '2026-10-22'::date, '14:52'), ('plano-2026-10b:t073', 'tp-ig', '2026-10-22'::date, '11:43'), ('plano-2026-10b:t009', 'pl-ig', '2026-10-26'::date, '15:47'), ('plano-2026-10e:t02', 'cd-ig', '2026-10-26'::date, '15:58')) as v (k, canal, data, hora)
 where t.id = i.topic_id and t.ext_key = v.k and i.channel_id = v.canal and i.piece_type = 'Stories' and i.pub_date = v.data and not i.archived;

-- 3) Stories do Instagram por dia
insert into public.social_topics (ext_key, title, brand, product, sku, front, objective, strategy, cta, media_use, licensed, brief)
values ('meta-hist:stories:cardoso', 'Stories do Instagram (histórico)', 'Cardoso', '', 'Institucional', 'Histórico · Stories', 'Publicado antes do plano do Hub', 'Histórico das redes', '', 'Orgânico', false, '{}'::jsonb), ('meta-hist:stories:playmi', 'Stories do Instagram (histórico)', 'Playmi', '', 'Institucional', 'Histórico · Stories', 'Publicado antes do plano do Hub', 'Histórico das redes', '', 'Orgânico', false, '{}'::jsonb), ('meta-hist:stories:topi', 'Stories do Instagram (histórico)', 'Tópi', '', 'Institucional', 'Histórico · Stories', 'Publicado antes do plano do Hub', 'Histórico das redes', '', 'Orgânico', false, '{}'::jsonb)
on conflict (ext_key) do nothing;

insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook, stage, stage_at)
select t.ext_key || ':' || v.data, t.id, v.canal, 'matriz', v.data, v.hora::time,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/26',
       t.front, t.brand, 'Instagram', t.brand || ' · Instagram', 'Stories', 'Stories', 'Original',
       'Stories do dia: ' || v.n || case when v.n = 1 then ' story' else ' stories' end, '', t.sku, t.objective, '', 'Orgânico', null, false, false, 'publicado', now()
  from (values
  ('cardoso', 'cd-ig', '2026-09-03'::date, 1, '07:56'),
  ('cardoso', 'cd-ig', '2026-09-04'::date, 1, '13:47'),
  ('cardoso', 'cd-ig', '2026-09-08'::date, 1, '13:24'),
  ('cardoso', 'cd-ig', '2026-09-15'::date, 1, '12:02'),
  ('cardoso', 'cd-ig', '2026-09-16'::date, 1, '11:22'),
  ('cardoso', 'cd-ig', '2026-09-19'::date, 2, '08:44'),
  ('cardoso', 'cd-ig', '2026-09-22'::date, 3, '08:36'),
  ('cardoso', 'cd-ig', '2026-09-25'::date, 2, '15:37'),
  ('cardoso', 'cd-ig', '2026-09-29'::date, 3, '10:31'),
  ('cardoso', 'cd-ig', '2026-09-30'::date, 13, '10:04'),
  ('cardoso', 'cd-ig', '2026-10-01'::date, 4, '09:41'),
  ('cardoso', 'cd-ig', '2026-10-06'::date, 6, '07:05'),
  ('cardoso', 'cd-ig', '2026-10-10'::date, 18, '18:28'),
  ('cardoso', 'cd-ig', '2026-10-12'::date, 1, '08:19'),
  ('cardoso', 'cd-ig', '2026-10-20'::date, 1, '11:22'),
  ('playmi', 'pl-ig', '2026-09-04'::date, 1, '13:50'),
  ('playmi', 'pl-ig', '2026-09-05'::date, 1, '13:42'),
  ('playmi', 'pl-ig', '2026-09-11'::date, 10, '12:39'),
  ('playmi', 'pl-ig', '2026-09-16'::date, 1, '11:19'),
  ('playmi', 'pl-ig', '2026-09-18'::date, 2, '13:59'),
  ('playmi', 'pl-ig', '2026-09-22'::date, 3, '16:19'),
  ('playmi', 'pl-ig', '2026-09-24'::date, 1, '19:46'),
  ('playmi', 'pl-ig', '2026-09-25'::date, 4, '07:10'),
  ('playmi', 'pl-ig', '2026-09-29'::date, 1, '08:09'),
  ('playmi', 'pl-ig', '2026-10-01'::date, 2, '07:44'),
  ('playmi', 'pl-ig', '2026-10-06'::date, 1, '18:00'),
  ('playmi', 'pl-ig', '2026-10-10'::date, 1, '18:23'),
  ('playmi', 'pl-ig', '2026-10-12'::date, 1, '14:27'),
  ('playmi', 'pl-ig', '2026-10-14'::date, 1, '12:10'),
  ('topi', 'tp-ig', '2026-09-08'::date, 2, '08:55'),
  ('topi', 'tp-ig', '2026-09-14'::date, 2, '10:04'),
  ('topi', 'tp-ig', '2026-09-29'::date, 6, '08:08'),
  ('topi', 'tp-ig', '2026-10-01'::date, 1, '07:25'),
  ('topi', 'tp-ig', '2026-10-07'::date, 1, '13:18'),
  ('topi', 'tp-ig', '2026-10-10'::date, 1, '14:14'),
  ('topi', 'tp-ig', '2026-10-12'::date, 1, '14:29')
  ) as v (marca, canal, data, n, hora)
  join public.social_topics t on t.ext_key = 'meta-hist:stories:' || v.marca
on conflict (ext_id) do nothing;

-- CONFERÊNCIA — o que saiu de 01/09 a 27/10 por marca e mês (posts de feed/Reels e dias com Stories)
select i.brand, to_char(i.pub_date, 'MM/YYYY') as mes,
       count(*) filter (where i.piece_type <> 'Stories' and i.channel_id like '%-ig') as posts_instagram,
       count(*) filter (where i.channel_id like '%-fb') as so_facebook,
       count(*) filter (where i.piece_type = 'Stories') as dias_com_stories
  from public.social_plan_items i
 where i.stage = 'publicado' and not i.archived and i.pub_date between '2026-09-01' and '2026-10-27'
   and i.channel_id in ('cd-ig', 'pl-ig', 'tp-ig', 'cd-fb', 'pl-fb', 'tp-fb')
 group by 1, 2
 order by 1, 2;
