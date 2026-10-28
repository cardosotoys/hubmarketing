-- LINKEDIN da Cardoso: 1 post por semana, em geral reaproveitando um post do Instagram (como o Aldair já faz),
-- e 2 por semana na semana antes e na semana do Prêmio Top Kids (24/11), do qual a Cardoso é patrocinadora.
--   1) registra como PUBLICADO o que já está na página (15/09 a 27/10)
--   2) tira do calendário os LinkedIn próprios que não saíram ou foram substituídos (o Google Meu Negócio deles fica)
--   3) entra o LinkedIn novo: 03/11, 10/11, 17 e 19/11 (Top Kids), 24 e 26/11 (Top Kids), 01/12, 08/12, 15/12;
--      22/12 (Obrigado) e 29/12 (ABRIN) continuam
-- Pode rodar de novo.

-- 1) o que já está no ar
insert into public.social_topics (ext_key, title, brand, sku, front, objective, strategy, cta, media_use, licensed, brief)
values
 ('linkedin-hist:2026-09-15', 'Feliz Dia do Cliente', 'Cardoso', 'Institucional', 'Setembro · Datas', 'Relacionamento com clientes', 'Data comemorativa', '', 'Orgânico', false, '{"medicao":"337 impressões"}'::jsonb),
 ('linkedin-hist:2026-09-30', 'Galinha Pintadinha nos cinemas: personagem nas prateleiras', 'Cardoso', 'Licenciados Playmi', 'Setembro · Licenciados', 'Mostrar o licenciamento como oportunidade para o varejo', 'Lançamento do filme', '', 'Orgânico', true, '{"medicao":"65 visualizações do vídeo"}'::jsonb),
 ('linkedin-hist:2026-10-01', 'Feliz Dia do Vendedor', 'Cardoso', 'Institucional', 'Outubro · Datas', 'Reconhecer quem vende Cardoso', 'Data comemorativa', '', 'Orgânico', false, '{"medicao":"147 impressões"}'::jsonb),
 ('linkedin-hist:2026-10-06', 'Produto certo no lugar certo: a Cardoso no ponto de venda', 'Cardoso', 'Institucional', 'Outubro · Por que revender', 'Mostrar o apoio da Cardoso no PDV', 'Argumento de revenda', '', 'Orgânico', false, '{"medicao":"134 impressões"}'::jsonb),
 ('linkedin-hist:2026-10-12', 'Feliz Dia das Crianças', 'Cardoso', 'Institucional', 'Outubro · Datas', 'Relacionamento na data mais importante do setor', 'Data comemorativa', '', 'Orgânico', false, '{"medicao":"181 impressões, 6 reações, 1 compartilhamento"}'::jsonb)
on conflict (ext_key) do nothing;

insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook, stage, stage_at)
select t.ext_key || ':li', t.id, 'cd-li', 'matriz', substr(t.ext_key, 15)::date,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from substr(t.ext_key, 15)::date)::int + 1],
       (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from substr(t.ext_key, 15)::date)::int] || '/26',
       t.front, 'Cardoso', 'LinkedIn', 'Cardoso · LinkedIn', 'LinkedIn', 'Post', 'Original', t.title, '', t.sku, t.objective, '', 'Orgânico',
       null, false, false, 'publicado', now()
  from public.social_topics t
 where t.ext_key like 'linkedin-hist:%'
on conflict (ext_id) do nothing;

-- 27/10: o carrossel "Você conhece a Cardoso?" reaproveitado no LinkedIn
insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook, stage, stage_at)
select t.ext_key || ':li', t.id, 'cd-li', 'adapta', '2026-10-27', '09:00', 'Terça', 'Out/26', t.front, 'Cardoso', 'LinkedIn', 'Cardoso · LinkedIn',
       'LinkedIn', 'Post', 'Original', t.title, '', t.sku, t.objective, t.cta, t.media_use,
       'O que está por trás de um brinquedo vai muito além da brincadeira. 🚀 (texto publicado na página em 27/10)', false, false, 'publicado', now()
  from public.social_topics t where t.ext_key = 'plano-2026-10e:t01'
on conflict (ext_id) do nothing;

-- 2) LinkedIn próprios que saem do calendário (o "Desde 1987" de 22/10 não foi para o LinkedIn)
update public.social_plan_items i
   set archived = true, stage = case when i.stage = 'publicado' then 'planejamento' else i.stage end, updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and i.channel = 'Cardoso · LinkedIn' and i.link_kind = 'matriz'
   and t.ext_key in ('plano-2026-10b:t008', 'plano-2026-10b:t018', 'plano-2026-10b:t029', 'plano-2026-10b:t048',
                     'plano-2026-10b:t058', 'plano-2026-10b:t068', 'plano-2026-10b:t077', 'plano-2026-10b:t086');

-- 3a) Prêmio Top Kids 2026: o assunto
insert into public.social_topics (ext_key, title, brand, sku, front, objective, strategy, cta, media_use, licensed, brief)
values ('plano-2026-10f:t01', 'Prêmio Top Kids 2026: a Cardoso é patrocinadora', 'Cardoso', 'Institucional', 'Novembro · Prêmio Top Kids',
  'Divulgar o patrocínio da Cardoso no Prêmio Top Kids (24/11) e reforçar a marca no mercado infantil',
  'Evento do setor em 24/11 com a Cardoso como patrocinadora: 2 posts na semana anterior e 2 na semana do evento',
  'Venha conversar com o nosso time', 'Orgânico', false,
  jsonb_build_object('formato_medida', 'Post LinkedIn 1080×1350', 'meta', 'Divulgar o patrocínio da Cardoso no Prêmio Top Kids',
    'material_base', '17 e 19/11: arte de patrocínio com a marca do prêmio; 24 e 26/11: fotos do evento',
    'material_status', 'Arte de patrocínio a produzir; fotos no dia',
    'obrigatorio_evitar', 'Usar a marca do Prêmio Top Kids conforme o material do patrocínio. Conferir data, local e nome oficial da edição antes de publicar.'))
on conflict (ext_key) do nothing;

-- 3b) os posts novos do LinkedIn
insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label, week_theme, brand, network, channel,
  piece_type, format, origin, pauta, product, sku, objective, cta, media_use, caption, creative_changed, mirror_facebook)
select v.ext_key || ':li' || v.n, t.id, 'cd-li', v.kind, v.data, v.hora::time,
       (array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[extract(dow from v.data)::int + 1],
       (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from v.data)::int] || '/26',
       t.front, 'Cardoso', 'LinkedIn', 'Cardoso · LinkedIn', 'LinkedIn', 'Post', 'Original', t.title, t.product, t.sku, t.objective, t.cta, t.media_use,
       v.legenda, false, false
  from (values
   ('plano-2026-10b:t003', '', 'adapta', '2026-11-03'::date, '09:00',
    'Quais brinquedos mais giram no varejo? 🚚' || chr(10) || chr(10) ||
    'No último ano, os veículos da linha Roda Livre estiveram entre os itens mais vendidos da Cardoso: Combo Trator Escavadeira, Comboio Bombeiro e Invictus Super Cegonheiro.' || chr(10) || chr(10) ||
    'Para quem revende, giro comprovado significa menos risco na compra e mais previsibilidade no estoque.' || chr(10) || chr(10) ||
    'Quer saber quais linhas fazem sentido para a sua loja ou e-commerce? Fale com o nosso time comercial. 🤝' || chr(10) || chr(10) ||
    '#Cardoso #IndustriaDeBrinquedos #Varejo #Revenda'),
   ('plano-2026-10b:t011', '', 'adapta', '2026-11-10'::date, '10:30',
    'Do molde à caixa: é assim que um brinquedo Cardoso ganha forma. 🏭' || chr(10) || chr(10) ||
    'Com fábrica própria em São Paulo desde 1987, acompanhamos cada etapa: projeto, produção, controle de qualidade e embalagem.' || chr(10) || chr(10) ||
    'Para o varejo, isso se traduz em constância de entrega, padrão de qualidade e um parceiro que conhece o produto de ponta a ponta.' || chr(10) || chr(10) ||
    'Quer conhecer nossas linhas? Fale com o nosso time comercial.' || chr(10) || chr(10) ||
    '#Cardoso #FabricaDeBrinquedos #IndustriaDeBrinquedos #Varejo'),
   ('plano-2026-10f:t01', '1', 'matriz', '2026-11-17'::date, '09:00',
    'A Cardoso é patrocinadora do Prêmio Top Kids 2026! 🏆' || chr(10) || chr(10) ||
    'No dia 24 de novembro, o prêmio reúne quem faz o mercado infantil acontecer, e temos orgulho de fazer parte disso.' || chr(10) || chr(10) ||
    'Apoiar iniciativas que valorizam o brincar é parte do que acreditamos como indústria: brinquedo de qualidade, marcas que acompanham gerações e parceria com todo o setor.' || chr(10) || chr(10) ||
    'Nos vemos no dia 24! 🤝' || chr(10) || chr(10) ||
    '#Cardoso #TopKids #PremioTopKids #IndustriaDeBrinquedos'),
   ('plano-2026-10f:t01', '2', 'adapta', '2026-11-19'::date, '10:30',
    'Faltam 5 dias para o Prêmio Top Kids 2026. ⏳' || chr(10) || chr(10) ||
    'Como patrocinadora, a Cardoso estará presente no dia 24 de novembro para celebrar as marcas, os produtos e as pessoas que movimentam o mercado infantil.' || chr(10) || chr(10) ||
    'Vai estar lá também? Conte nos comentários e venha conversar com o nosso time. 👋' || chr(10) || chr(10) ||
    '#Cardoso #TopKids #PremioTopKids #MercadoInfantil'),
   ('plano-2026-10f:t01', '3', 'adapta', '2026-11-24'::date, '09:00',
    'Hoje é dia de Prêmio Top Kids! 🏆✨' || chr(10) || chr(10) ||
    'A Cardoso, patrocinadora desta edição, está presente para celebrar quem faz o mercado infantil acontecer.' || chr(10) || chr(10) ||
    'Acompanhe por aqui: vamos compartilhar os melhores momentos.' || chr(10) || chr(10) ||
    '#Cardoso #TopKids #PremioTopKids'),
   ('plano-2026-10f:t01', '4', 'adapta', '2026-11-26'::date, '10:30',
    'Obrigado, Prêmio Top Kids 2026! 💙' || chr(10) || chr(10) ||
    'Foi um dia de celebrar o brincar e as pessoas que constroem o mercado infantil. Para a Cardoso, como patrocinadora, foi uma honra fazer parte desta edição.' || chr(10) || chr(10) ||
    'Parabéns a todos os vencedores e participantes. Seguimos juntos fazendo o brincar acontecer.' || chr(10) || chr(10) ||
    '#Cardoso #TopKids #PremioTopKids'),
   ('plano-2026-10b:t051', '', 'adapta', '2026-12-01'::date, '09:00',
    'Ainda dá tempo de vender Cardoso neste Natal. 🎄' || chr(10) || chr(10) ||
    'Dezembro é o mês de maior movimento do varejo de brinquedos, e a reposição feita agora chega a tempo das vendas de fim de ano.' || chr(10) || chr(10) ||
    'Com mix que vai do primeiro ano aos 10 anos, marcas próprias (Playmi e Tópi) e personagens licenciados, a Cardoso ajuda a montar a gôndola certa para cada público.' || chr(10) || chr(10) ||
    'Fale com o seu representante ou com o nosso time comercial.' || chr(10) || chr(10) ||
    '#Cardoso #Natal #Varejo #Brinquedos'),
   ('plano-2026-10b:t057', '', 'adapta', '2026-12-08'::date, '10:30',
    'Atendimento perto de você faz diferença no dia a dia da loja. 📍' || chr(10) || chr(10) ||
    'A Cardoso conta com representantes nas regiões do Brasil, prontos para apoiar no sortimento, nos pedidos e no pós-venda.' || chr(10) || chr(10) ||
    'Quer saber quem atende a sua região? Envie uma mensagem para o nosso time.' || chr(10) || chr(10) ||
    '#Cardoso #Representantes #Varejo #Brinquedos'),
   ('plano-2026-10b:t085', '', 'adapta', '2026-12-15'::date, '09:00',
    'O verão começa no dia 21, mas a reposição começa agora. ☀️' || chr(10) || chr(10) ||
    'Brinquedos de praia e água vendem de dezembro a fevereiro, e quem abastece cedo aproveita toda a temporada.' || chr(10) || chr(10) ||
    'Na Cardoso, a linha de verão tem Baldão e Baldico de Praia, Dino Praia e Acqua Bubble, entre outros.' || chr(10) || chr(10) ||
    'Fale com o nosso time comercial e prepare a sua loja para a temporada.' || chr(10) || chr(10) ||
    '#Cardoso #Verão #Varejo #Brinquedos')
  ) as v (ext_key, n, kind, data, hora, legenda)
  join public.social_topics t on t.ext_key = v.ext_key
on conflict (ext_id) do nothing;

-- CONFERÊNCIA — o LinkedIn de set/26 a dez/26, semana a semana
select i.pub_date, i.weekday, to_char(i.pub_time, 'HH24:MI') as hora, i.stage, i.pauta
  from public.social_plan_items i
 where i.channel = 'Cardoso · LinkedIn' and not i.archived and i.pub_date between '2026-09-01' and '2026-12-31'
 order by 1;
