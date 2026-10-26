-- PLAYMI qui 05/11 (15h): volta "Primeiros passos, grandes descobertas" com a arte já produzida (post estático das Totokinhas).
-- Troca o Dino Escolar e Bombeirinho que estava no lugar. Como é post e não vídeo, sai o Shorts do YouTube. Pode rodar de novo.

update public.social_topics
   set title = 'Primeiros passos, grandes descobertas: as Totokinhas',
       sku = 'Linha Totokinha (0300 · 0301 · 6010 · 6011)', licensed = false, product_id = null, product = 'Totokinhas',
       objective = 'Fazer da Totokinha o primeiro carrinho da criança, com a mensagem de desenvolvimento',
       strategy = 'Totokinha é a linha que mais gira da Cardoso (curva A, Sport e Clássica entre os mais vendidos); arte pronta',
       brief = brief || jsonb_build_object(
         'formato_medida', 'Post 1080×1350 (arte estática)',
         'material_base', 'Arte produzida pelo Aldair (25/10)', 'material_status', 'Pronto (arte produzida)',
         'meta', 'Fazer da Totokinha o primeiro carrinho da criança, com a mensagem de desenvolvimento',
         'gancho', 'Primeiros passos, grandes descobertas', 'texto_arte', 'Primeiros passos, grandes descobertas · Mover, sentir e crescer com liberdade',
         'mensagem', 'As Totokinhas acompanham cada nova aventura: a criança explora, se movimenta e descobre o mundo brincando.')
 where ext_key = 'plano-2026-10b:t024';

-- o post principal vira post estático, com a legenda nova
update public.social_plan_items i
   set piece_type = 'Feed', format = 'Feed', pauta = t.title, sku = t.sku, product = t.product, product_id = null,
       objective = t.objective,
       caption = 'Primeiros passos, grandes descobertas! 💙' || chr(10) ||
                 'As Totokinhas acompanham cada nova aventura: a criança explora, se movimenta e descobre o mundo brincando.' || chr(10) ||
                 'Mover, sentir e crescer com liberdade.' || chr(10) ||
                 'A partir de 18 meses. Confira os modelos e escolha o favorito.' || chr(10) ||
                 'Onde comprar: link na bio.' || chr(10) ||
                 'Brincar é crescer, juntos! 💙' || chr(10) ||
                 '#Playmi #Totokinha #PrimeirosPassos',
       updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t024' and i.link_kind = 'matriz' and i.stage <> 'publicado';

-- os outros destinos pegam o título novo; o Shorts do YouTube sai (post estático não vai para o YouTube)
update public.social_plan_items i
   set pauta = t.title, sku = t.sku, product = t.product, product_id = null, objective = t.objective,
       archived = (i.channel like '%YouTube%'), updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t024' and i.link_kind <> 'matriz' and i.stage <> 'publicado';

-- TÓPI: Open Tracks Retroescavadeira antecipado de qua 28/10 para ter 27/10 (Reels 10h30, Stories 15h30)
update public.social_plan_items i
   set pub_date = '2026-10-27', weekday = 'Terça',
       pub_time = case when i.link_kind = 'matriz' then '10:30'::time else '15:30'::time end, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10d:t02' and i.channel = 'Tópi · Instagram'
   and not i.archived and i.stage <> 'publicado';

-- CONFERÊNCIA — 05/11 15:00 Feed (post) + Stories; Status do WhatsApp em 07/11; o YouTube aparece como arquivado
-- e o Open Tracks em 27/10
select i.pub_date, to_char(i.pub_time, 'HH24:MI') as hora, i.channel, i.piece_type, i.archived, i.pauta
  from public.social_plan_items i join public.social_topics t on t.id = i.topic_id
 where t.ext_key in ('plano-2026-10b:t024', 'plano-2026-10d:t02')
 order by i.archived, 1, 2;
