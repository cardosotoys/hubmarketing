-- 1) o que saiu em 22 e 23/10 fica como publicado
update public.social_plan_items
   set stage = 'publicado', stage_at = now(), updated_at = now()
 where not archived and pub_date between '2026-10-22' and '2026-10-23' and stage <> 'publicado';

-- 2) o que não saiu no sábado 24/10 vai para segunda 26 e terça 27/10
update public.social_plan_items i
   set pub_date = v.data, pub_time = v.hora::time, weekday = v.dia, updated_at = now()
  from public.social_topics t,
       (values
        ('plano-2026-10b:t009', 'Playmi · Instagram', 'matriz', '2026-10-26'::date, '10:30', 'Segunda'),
        ('plano-2026-10b:t009', 'Playmi · Instagram', 'reaproveita', '2026-10-26'::date, '15:30', 'Segunda'),
        ('plano-2026-10b:t009', 'Cardoso · YouTube · playlist Playmi', 'reaproveita', '2026-10-27'::date, '10:00', 'Terça'),
        ('plano-2026-10b:t009', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-27'::date, '16:30', 'Terça'),
        ('plano-2026-10b:t006', 'Tópi · Instagram', 'matriz', '2026-10-27'::date, '10:30', 'Terça'),
        ('plano-2026-10b:t006', 'Tópi · Instagram', 'reaproveita', '2026-10-27'::date, '15:30', 'Terça'),
        ('plano-2026-10d:t01', 'Tópi · Instagram', 'adapta', '2026-10-26'::date, '10:00', 'Segunda'),
        ('plano-2026-10e:t01', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-26'::date, '14:30', 'Segunda')
       ) as v (ext_key, canal, vinculo, data, hora, dia)
 where t.id = i.topic_id and t.ext_key = v.ext_key
   and i.channel = v.canal and i.link_kind = v.vinculo
   and not i.archived and i.stage <> 'publicado';

-- 3) as 13 trocas de conteúdo (mesmo dia e horário, produto novo)
update public.social_topics t
   set title = v.titulo, sku = v.sku, licensed = false, product_id = null, product = '',
       objective = v.meta, strategy = v.porque,
       brief = t.brief || jsonb_build_object('meta', v.meta, 'porque', v.porque, 'mensagem', v.mensagem, 'gancho', v.gancho,
                 'legenda', v.legenda, 'enquete', v.enquete, 'texto_arte', split_part(v.titulo, ':', 1) || ' · A partir de ' || v.idade,
                 'material_base', 'Gerar imagens IA a partir da foto do produto + Reels com imagens',
                 'material_status', 'Gerar imagens IA + Reels com imagens')
  from (values
  ('plano-2026-10d:t02', 'Open Tracks Retroescavadeira: a obra tem operador', '1059', '3 anos', 'Apresentar no feed um veículo Tópi de alto giro que ainda não tinha post', 'Curva A: 47 mil unidades no ano e ainda sem post', 'O Open Tracks Trator Retroescavadeira vem com bonequinho operador para a criança comandar a obra de faz de conta.', 'Chegou o operador da obra! 🚜👷', 'Chegou o operador da obra! 🚜👷
O Open Tracks Trator Retroescavadeira vem com o bonequinho operador: é só começar a escavação de faz de conta.
A partir de 3 anos.
O que a obra vai construir hoje?
Brincar é Tópi! 🧡
#Tópi #Retroescavadeira #BrincarDeObra', 'O que a obra vai construir? 🏗️ [enquete: Casa / Estrada]', null),
  ('plano-2026-10d:t06', 'Air Truck Caçamba e Escavadeira: dupla de obra', '1062 · 1063', '3 anos', 'Apresentar no feed os caminhões Air Truck, de alto giro e sem post', 'Curva A: 40,9 mil + 34,6 mil unidades no ano', 'Os caminhões Air Truck Caçamba e Escavadeira formam a dupla da obra de faz de conta.', 'Uma cava, a outra carrega! 🚧🚚', 'Uma cava, a outra carrega! 🚧🚚
Os caminhões Air Truck Caçamba e Escavadeira são a dupla perfeita para a obra de faz de conta.
A partir de 3 anos.
Qual dos dois chega primeiro na obra?
Brincar é Tópi! 🧡
#Tópi #AirTruck #Caminhão', 'Caçamba ou escavadeira? 🚚 [enquete: Caçamba / Escavadeira]', null),
  ('plano-2026-10d:t09', 'Invictus Basculante: levanta e despeja', '1042', '3 anos', 'Apresentar no feed um veículo Tópi de alto giro que ainda não tinha post', 'Curva A: 29,7 mil unidades no ano', 'O Invictus Basculante levanta a caçamba e despeja a carga na brincadeira de transporte.', 'Levanta, inclina e despeja! 🚚', 'Levanta, inclina e despeja! 🚚
O Invictus Basculante leva a carga e despeja onde a brincadeira mandar.
A partir de 3 anos.
Areia ou pedrinha?
Brincar é Tópi! 🧡
#Tópi #Invictus #Caminhão', 'Areia ou pedrinha? 🚚 [enquete: Areia / Pedrinha]', null),
  ('plano-2026-10d:t12', 'Baldico e Dino Praia: o verão chegou', '209 · 1052', '18 meses', 'Abrir o verão da Tópi com os itens de praia de maior giro', 'Baldico (42,7 mil) e Dino Praia (19,1 mil unidades no ano); praia vende de dezembro a fevereiro', 'O Baldico de Praia e o Dino Praia levam a brincadeira para a areia, a partir de 18 meses.', 'O verão chegou na brincadeira! ☀️🏖️', 'O verão chegou na brincadeira! ☀️🏖️
Baldico de Praia e Dino Praia: balde, pá e muita areia para os pequenos.
A partir de 18 meses.
Praia ou piscina aí?
Brincar é Tópi! 🧡
#Tópi #Verão #BrincarNaPraia', 'Praia ou piscina? ☀️ [enquete: Praia / Piscina]', null),
  ('plano-2026-10b:t003', 'Roda Livre: os veículos que mais giram', '1040 · 9055 · 1058', '3 anos', 'Gerar contato de novos revendedores mostrando os veículos de giro comprovado', 'Combo Trator Escavadeira (109 mil), Comboio Bombeiro (75 mil) e Invictus Super Cegonheiro (72,5 mil) estão entre os mais vendidos do ano', 'Os veículos da linha Roda Livre estão entre os mais vendidos da Cardoso no ano: giro comprovado para a loja e o e-commerce.', 'Qual brinquedo sai da prateleira primeiro? 🚚', 'Qual brinquedo sai da prateleira primeiro? 🚚
Na Cardoso, os veículos da linha Roda Livre estão entre os mais vendidos do ano: Combo Trator Escavadeira, Comboio Bombeiro e Invictus Super Cegonheiro.
Giro comprovado para a sua loja ou e-commerce.
Quer revender? Toque em Enviar mensagem e fale com o nosso comercial.
Construímos muito mais que brinquedos. Construímos confiança.
#Cardoso #Revenda #Brinquedos', 'Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]', null),
  ('plano-2026-10b:t024', 'Dino Escolar e Dino Bombeirinho: os dinos que ensinam', '3028 · 3027', '18 meses', 'Dar vitrine à linha Play&Learn com os dinos de maior giro', 'Curva A: 23,4 mil + 22,4 mil unidades no ano e sem post', 'O Dino Escolar (com braille) e o Dino Bombeirinho são da linha Play&Learn: encaixar, apertar e descobrir brincando.', 'Dois dinos, mil descobertas! 🦕📚', 'Dois dinos, mil descobertas! 🦕📚
O Dino Escolar (com braille) e o Dino Bombeirinho são da linha Play&Learn: encaixar, apertar e descobrir brincando.
A partir de 18 meses.
Qual dos dois é a cara do seu pequeno?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PlayAndLearn #Dino', 'Escolar ou Bombeirinho? 🦕 [enquete: Escolar / Bombeirinho]', null),
  ('plano-2026-10b:t039', 'T-Rex Relâmpago: o dino mais rápido da pista', '7165', '3 anos', 'Levar ao feed o Play&Drive de maior giro que ainda não tinha post', 'Curva A: 23,9 mil unidades no ano', 'O T-Rex Relâmpago junta dinossauro e velocidade na brincadeira.', 'Rugido e velocidade! 🦖⚡', 'Rugido e velocidade! 🦖⚡
O T-Rex Relâmpago junta dinossauro e corrida: a sala vira pista.
A partir de 3 anos.
Seu pequeno é time dino ou time carrinho?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #TRex #Dinossauro', 'Time dino ou time carrinho? 🦖 [enquete: Dino / Carrinho]', 'T-Rex Relâmpago Playmi | Dinossauro e velocidade na brincadeira, para crianças a partir de 3 anos. Ideia de presente de Natal.'),
  ('plano-2026-10b:t032', 'Trenzinho Didático: 28 peças para montar', '8015', '2 anos', 'Dar vitrine à linha Play&Molto com o item de maior giro', 'Curva A: 20,7 mil unidades no ano e sem post', 'O Trenzinho Didático vem com 28 peças para montar, encaixar e inventar o caminho.', 'Piuí! O trem da imaginação vai partir! 🚂', 'Piuí! O trem da imaginação vai partir! 🚂
O Trenzinho Didático vem com 28 peças para montar, encaixar e inventar o caminho.
A partir de 2 anos.
Qual vagão vai na frente?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PlayMolto #Trenzinho', 'Montar ou desmontar? 🚂 [enquete: Montar / Desmontar]', null),
  ('plano-2026-10b:t049', 'Estação de Bombeiro: alerta na cidade', '7138 · 7139', '3 anos', 'Levar ao feed o faz de conta de bombeiro, de alto giro e sem post', 'Curva A: 15,1 mil (Estação) + 8,3 mil (Plus) unidades no ano', 'Na Estação de Bombeiro, a criança comanda o resgate e inventa a missão do dia.', 'Alerta na cidade! Os bombeiros estão a caminho! 🚒', 'Alerta na cidade! Os bombeiros estão a caminho! 🚒
Na Estação de Bombeiro da Playmi, a criança comanda o resgate e inventa a missão do dia.
A partir de 3 anos.
Qual seria o primeiro resgate aí?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Bombeiro #FazDeConta', 'Qual o primeiro resgate? 🚒 [caixinha]', 'Estação de Bombeiro Playmi | Faz de conta de resgate para crianças a partir de 3 anos. Ideia de presente de Natal.'),
  ('plano-2026-10b:t052', 'Mesinha Criativa: 20 blocos para criar', '8003 · 8023', '2 anos', 'Mostrar a Mesinha Criativa como presente para os pequenos construtores', 'Linha Play&Molto em curva A, sem post', 'A Mesinha Criativa vem com 20 blocos e espaço para construir, em azul ou rosa.', 'Montar, encaixar, criar! 🧱✨', 'Montar, encaixar, criar! 🧱✨
A Mesinha Criativa vem com 20 blocos e espaço para construir à vontade, em azul ou rosa.
A partir de 2 anos.
O que vai sair dessa construção?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PlayMolto #Blocos', 'Azul ou rosa? 🧱 [enquete: Azul / Rosa]', null),
  ('plano-2026-10b:t078', 'City Truck: os caminhões da cidade', '7132 · 7133 · 7134', '3 anos', 'Levar ao feed os City Truck como presente de Natal', 'Curva A: cerca de 11,4 mil unidades de cada modelo no ano', 'Os City Truck Bombeiro, Construção e Reciclagem colocam a cidade inteira na brincadeira.', 'Bombeiro, construção ou reciclagem? 🚒🚧♻️', 'Bombeiro, construção ou reciclagem? 🚒🚧♻️
Os City Truck da Playmi colocam a cidade inteira na brincadeira.
A partir de 3 anos.
Qual é o favorito aí?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #CityTruck #PresenteDeNatal', 'Qual City Truck é o favorito? 🚚 [enquete: Bombeiro / Construção]', 'City Truck Playmi | Caminhões de bombeiro, construção e reciclagem para crianças a partir de 3 anos. Presente de Natal.'),
  ('plano-2026-10b:t087', 'Belinha Studio: ainda dá tempo para o Natal', '8102', '3 anos', 'Última janela de compra de Natal com um item de giro que ainda não tinha post', 'Curva B: 27,5 mil unidades no ano; Natal D-10', 'O Belinha Studio é o cantinho de faz de conta para brincar de cuidar, arrumar e criar o visual.', 'Ainda dá tempo para o Natal! 🎁', 'Ainda dá tempo para o Natal! 🎁
O Belinha Studio é o cantinho de faz de conta para brincar de cuidar, arrumar e criar o visual.
A partir de 3 anos.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Belinha #PresenteDeNatal', 'Presente já está pronto? 🎁 [enquete: Sim / Ainda não]', 'Belinha Studio Playmi | Faz de conta para crianças a partir de 3 anos. Presente de Natal que ainda dá tempo.'),
  ('plano-2026-10b:t090', 'Girafa de Atividades: 15 blocos de descoberta', '8016', '2 anos', 'Fechar a temporada de presentes com um Play&Molto de giro e sem post', 'Curva A: 6,3 mil unidades no ano; presente para os pequenos', 'A Girafa de Atividades vem com 15 blocos para encaixar, empilhar e descobrir.', 'A girafa mais divertida da casa! 🦒', 'A girafa mais divertida da casa! 🦒
A Girafa de Atividades vem com 15 blocos para encaixar, empilhar e descobrir.
A partir de 2 anos.
Presente certo para o Natal dos pequenos.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PlayMolto #PresenteDeNatal', 'Encaixar ou empilhar? 🦒 [enquete: Encaixar / Empilhar]', null)
  ) as v (ext_key, titulo, sku, idade, meta, porque, mensagem, gancho, legenda, enquete, pin)
 where t.ext_key = v.ext_key;

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key in ('plano-2026-10d:t02', 'plano-2026-10d:t06', 'plano-2026-10d:t09', 'plano-2026-10d:t12', 'plano-2026-10b:t003', 'plano-2026-10b:t024', 'plano-2026-10b:t039', 'plano-2026-10b:t032', 'plano-2026-10b:t049', 'plano-2026-10b:t052', 'plano-2026-10b:t078', 'plano-2026-10b:t087', 'plano-2026-10b:t090')
   and t.sku ~ '^[0-9]+$' and ltrim(p.code, '0') = ltrim(t.sku, '0');

update public.social_plan_items i
   set pauta = t.title, sku = t.sku, product = t.product, product_id = t.product_id,
       objective = t.objective,
       caption = case when i.link_kind = 'matriz' then t.brief->>'legenda'
                      when i.link_kind = 'adapta' and i.piece_type = 'Stories' then t.brief->>'enquete'
                      when i.link_kind = 'adapta' and i.network = 'Pinterest' then coalesce(v.pin, i.caption)
                      else i.caption end,
       updated_at = now()
  from public.social_topics t
  join (values

    ('plano-2026-10d:t02', null),
    ('plano-2026-10d:t06', null),
    ('plano-2026-10d:t09', null),
    ('plano-2026-10d:t12', null),
    ('plano-2026-10b:t003', null),
    ('plano-2026-10b:t024', null),
    ('plano-2026-10b:t039', 'T-Rex Relâmpago Playmi | Dinossauro e velocidade na brincadeira, para crianças a partir de 3 anos. Ideia de presente de Natal.'),
    ('plano-2026-10b:t032', null),
    ('plano-2026-10b:t049', 'Estação de Bombeiro Playmi | Faz de conta de resgate para crianças a partir de 3 anos. Ideia de presente de Natal.'),
    ('plano-2026-10b:t052', null),
    ('plano-2026-10b:t078', 'City Truck Playmi | Caminhões de bombeiro, construção e reciclagem para crianças a partir de 3 anos. Presente de Natal.'),
    ('plano-2026-10b:t087', 'Belinha Studio Playmi | Faz de conta para crianças a partir de 3 anos. Presente de Natal que ainda dá tempo.'),
    ('plano-2026-10b:t090', null)
  ) as v (ext_key, pin) on v.ext_key = t.ext_key
 where t.id = i.topic_id and not i.archived and i.stage <> 'publicado';

-- CONFERÊNCIA — as 13 trocas, na ordem das datas
select i.pub_date, to_char(i.pub_time, 'HH24:MI') as hora, i.brand, i.pauta
  from public.social_plan_items i join public.social_topics t on t.id = i.topic_id
 where t.ext_key in ('plano-2026-10d:t02', 'plano-2026-10d:t06', 'plano-2026-10d:t09', 'plano-2026-10d:t12', 'plano-2026-10b:t003', 'plano-2026-10b:t024', 'plano-2026-10b:t039', 'plano-2026-10b:t032', 'plano-2026-10b:t049', 'plano-2026-10b:t052', 'plano-2026-10b:t078', 'plano-2026-10b:t087', 'plano-2026-10b:t090') and i.link_kind = 'matriz' and not i.archived
 order by 1, 2;
