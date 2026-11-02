-- YOUTUBE SHORTS: 3 POR SEMANA a partir de ter 03/11 (terça, quinta e sexta; nas semanas de Natal e Ano-Novo, segunda a quarta).
-- Primeiro a sequência das 21 capas do print, na ordem; depois os Reels que já estão prontos (já saíram no Instagram e ainda não
-- foram para o YouTube), do mais antigo para o mais novo (nº 22 a 32). Os Reels novos entram depois desses.
-- Datas fixas pela ordem, sem depender de onde cada Short estava. Pode rodar de novo.

-- 1) os Shorts nº 22 a 32 (Reels prontos)
insert into public.social_topics (ext_key, title, brand, sku, product, front, objective, strategy, cta, media_use, licensed, brief)
select 'shorts-2026:' || lpad(n::text, 2, '0'), titulo, marca, sku, '', 'YouTube Shorts · sequência', 'Equalizar o YouTube Shorts com o que já saiu nas redes',
       'Reels já publicado no Instagram, levado para o Shorts depois da sequência das capas', 'Onde comprar: link no perfil', 'Orgânico', lic,
       jsonb_build_object('formato_medida', 'Shorts 1080×1920', 'material_status', 'Pronto (Reels já publicado)', 'legenda', descricao,
                          'obrigatorio_evitar', case when lic then 'Licenciado: publicar só com o aval do licenciador.' else 'Sem preço.' end)
  from (values
  (22, 'Tópi', '', 'Combo Escavadeira | Tópi', false, 'A Combo Escavadeira tem design inspirado nos grandes veículos de construção para a criança cavar, carregar e inventar a obra do dia. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (23, 'Playmi', '', 'Studio Fashion Celebridades Corte & Escova | Playmi', false, 'Secador, escova, pente e espelho: o Studio Fashion vira um salão de beleza de faz de conta para criar novos looks. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (24, 'Tópi', '4028', 'Tópi Combo Construction | Tópi', false, 'Construir, carregar e descarregar: o Tópi Combo Construction transforma a brincadeira em uma obra de verdade. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (25, 'Playmi', '3122', 'Little Figs Galinha Pintadinha O Filme | Playmi', true, 'A turma da Galinha Pintadinha em miniatura para colecionar, cantar e criar histórias na ponta dos dedos. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (26, 'Tópi', '7120', 'Pet Home com Blocos | Tópi', false, 'Com o Pet Home, a criança monta a casinha com blocos e cuida de um pet superfofo, inventando suas próprias histórias. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (27, 'Playmi', '7203', 'Fofush Encantado | Playmi', false, 'Com a lanterna de LED, a criança desenha na barriguinha do Fofush Encantado e apaga para criar de novo quantas vezes quiser. A partir de 3 anos.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (28, 'Tópi', '', 'Tópi Blocos de Montar | Tópi', false, 'Abriu, montou, brincou: com os Blocos de Montar Tópi cada peça se encaixa e uma nova aventura aparece. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (29, 'Playmi', '3098', 'Totokinha Marvel Spidey | Playmi', true, 'A Totokinha do Spidey leva o pequeno herói para passear, e o baú abre de verdade para guardar os tesouros da brincadeira. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (30, 'Tópi', '2001', 'Carrinho de Boneca Meu Nenê | Tópi', false, 'Empurrar, passear e cuidar da bonequinha: o Carrinho de Boneca Meu Nenê leva o faz de conta para todo canto da casa. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Shorts #Brinquedos'),
  (31, 'Playmi', '8028', 'Carrinho de Puxar com 20 Blocos | Playmi', false, 'O Carrinho de Puxar acompanha os primeiros passos e ainda vem com 20 blocos para montar as próprias torres. A partir de 18 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos'),
  (32, 'Playmi', '8018', 'Totokross | Playmi', false, 'Antes da bicicleta, vem o equilíbrio: na Totokross a criança senta, apoia os pés e ganha confiança a cada volta. A partir de 12 meses.
Onde comprar: link no perfil.
#Playmi #Shorts #Brinquedos')
  ) as v (n, marca, sku, titulo, lic, descricao)
on conflict (ext_key) do nothing;

insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook)
select t.ext_key || ':yt', t.id, case when t.brand = 'Tópi' then 'cd-yt-tp' else 'cd-yt-pl' end, 'matriz', '2027-01-01', 'Sexta', 'Jan/27',
       t.front, t.brand, 'YouTube Shorts', case when t.brand = 'Tópi' then 'Cardoso · YouTube · playlist Tópi' else 'Cardoso · YouTube · playlist Playmi' end,
       'Shorts', 'Shorts', 'Original', t.title, '', t.sku, t.objective, t.cta, t.media_use, t.brief->>'legenda', false, false
  from public.social_topics t
 where t.ext_key like 'shorts-2026:%' and substring(t.ext_key from 'shorts-2026:(\d+)')::int between 22 and 32
on conflict (ext_id) do nothing;

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key like 'shorts-2026:%' and t.product_id is null and t.sku <> '' and split_part(p.code, ' ', 1) = t.sku;

-- 2) data e hora de cada Short pela ordem
update public.social_plan_items i
   set archived = false, pub_date = v.data, pub_time = v.hora::time,
       weekday = (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/' || to_char(v.data, 'YY'),
       updated_at = now()
  from (values
  ('shorts-2026:01:yt', '2026-11-03'::date, '10:00'),
  ('shorts-2026:02:yt', '2026-11-05'::date, '15:30'),
  ('shorts-2026:03:yt', '2026-11-06'::date, '11:30'),
  ('shorts-2026:04:yt', '2026-11-10'::date, '16:30'),
  ('shorts-2026:05:yt', '2026-11-12'::date, '09:30'),
  ('shorts-2026:06:yt', '2026-11-13'::date, '14:30'),
  ('shorts-2026:07:yt', '2026-11-17'::date, '17:00'),
  ('shorts-2026:08:yt', '2026-11-19'::date, '10:30'),
  ('shorts-2026:09:yt', '2026-11-20'::date, '10:00'),
  ('shorts-2026:10:yt', '2026-11-24'::date, '15:30'),
  ('shorts-2026:11:yt', '2026-11-26'::date, '11:30'),
  ('shorts-2026:12:yt', '2026-11-27'::date, '16:30'),
  ('shorts-2026:13:yt', '2026-12-01'::date, '09:30'),
  ('shorts-2026:14:yt', '2026-12-03'::date, '14:30'),
  ('shorts-2026:15:yt', '2026-12-04'::date, '17:00'),
  ('shorts-2026:16:yt', '2026-12-08'::date, '10:30'),
  ('shorts-2026:17:yt', '2026-12-10'::date, '10:00'),
  ('shorts-2026:18:yt', '2026-12-11'::date, '15:30'),
  ('shorts-2026:19:yt', '2026-12-15'::date, '11:30'),
  ('shorts-2026:20:yt', '2026-12-17'::date, '16:30'),
  ('shorts-2026:21:yt', '2026-12-18'::date, '09:30'),
  ('shorts-2026:22:yt', '2026-12-21'::date, '14:30'),
  ('shorts-2026:23:yt', '2026-12-22'::date, '17:00'),
  ('shorts-2026:24:yt', '2026-12-23'::date, '10:30'),
  ('shorts-2026:25:yt', '2026-12-28'::date, '10:00'),
  ('shorts-2026:26:yt', '2026-12-29'::date, '15:30'),
  ('shorts-2026:27:yt', '2026-12-30'::date, '11:30'),
  ('shorts-2026:28:yt', '2027-01-05'::date, '16:30'),
  ('shorts-2026:29:yt', '2027-01-07'::date, '09:30'),
  ('shorts-2026:30:yt', '2027-01-08'::date, '14:30'),
  ('shorts-2026:31:yt', '2027-01-12'::date, '17:00'),
  ('shorts-2026:32:yt', '2027-01-14'::date, '10:30')
  ) as v (e, data, hora)
 where i.ext_id = v.e and i.stage <> 'publicado';

update public.social_topics t
   set brief = t.brief || jsonb_build_object('data', i.pub_date, 'hora', to_char(i.pub_time, 'HH24:MI')), updated_at = now()
  from public.social_plan_items i
 where i.ext_id = t.ext_key || ':yt' and t.ext_key like 'shorts-2026:%' and (t.brief->>'data') is distinct from i.pub_date::text;

-- CONFERÊNCIA — Shorts por semana (3 em cada) e a ordem
select date_trunc('week', i.pub_date)::date as semana, count(*) as shorts,
       string_agg(substring(i.ext_id from 'shorts-2026:(\d+)') || ' ' || to_char(i.pub_date, 'DD/MM') || ' ' || split_part(i.pauta, ' |', 1), ' · ' order by i.pub_date) as ordem
  from public.social_plan_items i
 where i.ext_id like 'shorts-2026:%' and not i.archived
 group by 1
 order by 1;
