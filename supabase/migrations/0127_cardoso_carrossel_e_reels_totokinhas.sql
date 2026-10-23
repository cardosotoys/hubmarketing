-- CARDOSO: dois conteúdos prontos entram na frente da fila do Instagram
--   1º sex 23/10 11h — Carrossel "Você conhece a Cardoso?" (3 cards)
--   2º seg 26/10 11h — Reels "Totokinhas mais desejadas" (licenciadas: Spidey e Bluey)
-- e a fila anda: Totokinhas qui 29/10 · Do molde à caixa qui 05/11 · Uma indústria, duas marcas qui 12/11 ·
-- Personagens que vendem seg 16/11 · Quase 40 anos ter 17/11. Datas comerciais não mudam. Pode rodar de novo.

-- 1) os dois assuntos novos
insert into public.social_topics (ext_key, title, brand, sku, front, objective, strategy, cta, media_use, licensed, brief)
values
 ('plano-2026-10e:t01', 'Você conhece a Cardoso?', 'Cardoso', 'Institucional', 'Outubro · Por que revender: fábrica',
  'Apresentar a Cardoso a novos revendedores', 'Abre a fila da Cardoso com quem somos: indústria, portfólio e parceria com o varejo',
  'Quero revender: fale no WhatsApp Comercial', 'Mídia paga liberada', false,
  jsonb_build_object('formato_medida', 'Carrossel 1080×1350, 3 cards (arte panorâmica)', 'material_base', 'Carrossel produzido pelo Aldair (22/10)',
    'material_status', 'Pronto (carrossel produzido)', 'meta', 'Apresentar a Cardoso a novos revendedores',
    'mensagem', 'Somos a indústria de brinquedos que impulsiona o varejo em todo o Brasil: portfólio completo, suporte comercial, abastecimento com agilidade e relacionamento de longo prazo.',
    'gancho', 'Você conhece a Cardoso?', 'texto_arte', 'Você conhece a Cardoso? · Mais que brinquedos, parceria de verdade.',
    'publico', 'Novos revendedores: donos de loja e de e-commerce')),
 ('plano-2026-10e:t02', 'Totokinhas mais desejadas: os personagens que vendem', 'Cardoso', 'Totokinhas licenciadas (Spidey · Bluey)', 'Outubro · Por que revender: o que gira',
  'Mostrar ao lojista as Totokinhas licenciadas que puxam a venda', 'A Totokinha é a linha que mais gira da Cardoso; com personagem, o desejo vem pronto',
  'Fale com o seu representante', 'Orgânico', true,
  jsonb_build_object('formato_medida', 'Reels 1080×1920', 'material_base', 'Reels produzido pelo Aldair (22/10)',
    'material_status', 'Pronto (Reels produzido)', 'meta', 'Mostrar ao lojista as Totokinhas licenciadas que puxam a venda',
    'mensagem', 'Spidey e Bluey levam o personagem favorito para o primeiro carrinho: a licença puxa a venda na loja.',
    'gancho', 'Saiba quais são as Totokinhas mais desejadas', 'texto_arte', 'Saiba quais são as Totokinhas mais desejadas',
    'publico', 'Lojistas e novos revendedores', 'obrigatorio_evitar', 'Licenciado: publicar só com o aval do licenciador (Marvel e Bluey).'))
on conflict (ext_key) do nothing;

-- 2) os posts dos dois assuntos
insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label,
  week_theme, brand, network, channel, piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook)
select v.ext_id, t.id, c.id, v.kind, v.data, v.hora::time,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1], 'Out/26',
       t.front, t.brand, c.network, c.account || ' · ' || c.name, v.tipo, v.formato, v.origem, t.title, t.product, t.sku, t.objective, t.cta, t.media_use,
       v.legenda, false, v.espelho
  from (values
   ('plano-2026-10e:t01:0', 'plano-2026-10e:t01', 'cd-ig', 'matriz', '2026-10-23'::date, '11:00', 'Feed', 'Carrossel', 'Original', true,
    'Você conhece a Cardoso? 👋' || chr(10) || 'Somos a indústria de brinquedos que impulsiona o varejo em todo o Brasil: um portfólio completo, com marcas que fazem parte da infância de milhões de famílias.' || chr(10) || 'Para quem revende, isso significa suporte comercial especializado, abastecimento com agilidade e relacionamento de longo prazo.' || chr(10) || 'Quer revender Cardoso? Toque em Enviar mensagem e fale com o nosso comercial.' || chr(10) || 'Construímos muito mais que brinquedos. Construímos confiança.' || chr(10) || '#Cardoso #Brinquedos #Varejo #Revenda'),
   ('plano-2026-10e:t01:1', 'plano-2026-10e:t01', 'cd-ig', 'reaproveita', '2026-10-23'::date, '18:00', 'Stories', 'Stories', 'Reaproveitamento', false, null),
   ('plano-2026-10e:t01:2', 'plano-2026-10e:t01', 'wa-st', 'reaproveita', '2026-10-24'::date, '18:00', 'Status', 'Status', 'Reaproveitamento', false, null),
   ('plano-2026-10e:t02:0', 'plano-2026-10e:t02', 'cd-ig', 'matriz', '2026-10-26'::date, '11:00', 'Reels', 'Reels', 'Original', true,
    'Saiba quais são as Totokinhas mais desejadas! 🚗' || chr(10) || 'Spidey e Bluey levam o personagem favorito para o primeiro carrinho: é a licença puxando a venda na sua loja.' || chr(10) || 'Quer as Totokinhas licenciadas no seu mix? Fale com o seu representante ou toque em Enviar mensagem.' || chr(10) || 'Construímos muito mais que brinquedos. Construímos confiança.' || chr(10) || '#Cardoso #Totokinha #Licenciados #Lojista'),
   ('plano-2026-10e:t02:1', 'plano-2026-10e:t02', 'cd-ig', 'reaproveita', '2026-10-26'::date, '18:00', 'Stories', 'Stories', 'Reaproveitamento', false, null),
   ('plano-2026-10e:t02:2', 'plano-2026-10e:t02', 'wa-st', 'reaproveita', '2026-10-27'::date, '18:00', 'Status', 'Status', 'Reaproveitamento', false, null),
   ('plano-2026-10e:t02:3', 'plano-2026-10e:t02', 'cd-yt-pl', 'reaproveita', '2026-10-28'::date, '18:00', 'Shorts', 'Shorts', 'Reaproveitamento', false, null)
  ) as v (ext_id, topic_key, canal, kind, data, hora, tipo, formato, origem, espelho, legenda)
  join public.social_topics t on t.ext_key = v.topic_key
  join public.social_channels c on c.id = v.canal
on conflict (ext_id) do nothing;

-- 3) a fila do Instagram da Cardoso anda (cada post leva junto o Stories e o Status dele)
update public.social_plan_items i
   set pub_date = v.data, weekday = v.dia,
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/26',
       updated_at = now()
  from public.social_topics t,
       (values
        ('plano-2026-10b:t003', 'Cardoso · Instagram', 'matriz',          '2026-10-29'::date, 'Quinta'),
        ('plano-2026-10b:t003', 'Cardoso · Instagram', 'adapta',          '2026-10-30'::date, 'Sexta'),
        ('plano-2026-10b:t003', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-10-31'::date, 'Sábado'),
        ('plano-2026-10b:t011', 'Cardoso · Instagram', 'matriz',          '2026-11-05'::date, 'Quinta'),
        ('plano-2026-10b:t011', 'Cardoso · Instagram', 'adapta',          '2026-11-06'::date, 'Sexta'),
        ('plano-2026-10b:t011', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-07'::date, 'Sábado'),
        ('plano-2026-10b:t021', 'Cardoso · Instagram', 'matriz',          '2026-11-12'::date, 'Quinta'),
        ('plano-2026-10b:t021', 'Cardoso · Instagram', 'adapta',          '2026-11-13'::date, 'Sexta'),
        ('plano-2026-10b:t021', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-14'::date, 'Sábado'),
        ('plano-2026-10b:t031', 'Cardoso · Instagram', 'matriz',          '2026-11-16'::date, 'Segunda'),
        ('plano-2026-10b:t031', 'Cardoso · Instagram', 'adapta',          '2026-11-17'::date, 'Terça'),
        ('plano-2026-10b:t031', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-18'::date, 'Quarta'),
        ('plano-2026-10b:t041', 'Cardoso · Instagram', 'matriz',          '2026-11-17'::date, 'Terça'),
        ('plano-2026-10b:t041', 'Cardoso · Instagram', 'adapta',          '2026-11-18'::date, 'Quarta'),
        ('plano-2026-10b:t041', 'Cardoso · WhatsApp · Status', 'reaproveita', '2026-11-19'::date, 'Quinta')
       ) as v (ext_key, canal, vinculo, data, dia)
 where t.id = i.topic_id and t.ext_key = v.ext_key
   and i.channel = v.canal and i.link_kind = v.vinculo
   and not i.archived and i.stage not in ('agendado', 'publicado');

-- 4) CONFERÊNCIA — a fila do Instagram da Cardoso, em ordem
select i.pub_date, i.weekday, i.pub_time, i.piece_type, i.pauta
  from public.social_plan_items i
 where i.brand = 'Cardoso' and i.channel = 'Cardoso · Instagram' and i.link_kind = 'matriz'
   and not i.archived and i.pub_date between '2026-10-22' and '2026-11-20'
 order by 1, 3;
