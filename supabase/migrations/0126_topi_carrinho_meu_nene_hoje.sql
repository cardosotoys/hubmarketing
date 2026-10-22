-- TÓPI: Carrinho de Boneca Meu Nenê (REF 2001) entra hoje, quinta 22/10, às 19h (Reels já produzido).
-- Reaproveita o assunto que estava em espera (plano-2026-10b:t073): tira da espera e muda as datas.
-- Pode rodar de novo sem problema.

-- 1) o assunto volta, só com a REF 2001, legenda com idade
update public.social_topics
   set paused_at = null, sku = '2001',
       front = 'Outubro · Novo no feed Tópi',
       brief = brief || jsonb_build_object(
         'gancho', 'O nenê vai passear! 👶💗',
         'mensagem', 'O Carrinho de Boneca Meu Nenê leva a brincadeira de cuidar para o passeio. A partir de 3 anos.',
         'texto_arte', 'Carrinho de Boneca Meu Nenê · A partir de 3 anos',
         'material_base', 'Reels produzido pelo Aldair (22/10)',
         'material_status', 'Pronto (Reels produzido)')
 where ext_key = 'plano-2026-10b:t073';

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key = 'plano-2026-10b:t073' and ltrim(p.code, '0') = '2001';

-- 2) os destinos: Reels hoje 19h, Stories hoje 21h, Stories com enquete sex 10h30, TikTok sex 19h
update public.social_plan_items i
   set archived = false, pub_date = v.data, pub_time = v.hora::time, weekday = v.dia, month_label = 'Out/26',
       week_theme = 'Outubro · Novo no feed Tópi', sku = '2001',
       caption = coalesce(v.legenda, i.caption), updated_at = now()
  from public.social_topics t,
       (values
         ('Tópi · Instagram', 'matriz',      '2026-10-22'::date, '19:00', 'Quinta',
          'O nenê vai passear! 👶💗' || chr(10) || 'Com o Carrinho de Boneca Meu Nenê, a brincadeira de cuidar sai do quarto e ganha a rua.' || chr(10) || 'A partir de 3 anos.' || chr(10) || 'Qual é o nome do nenê aí?' || chr(10) || 'Brincar é Tópi! 🧡' || chr(10) || '#Tópi #CarrinhoDeBoneca #BrincarDeCuidar'),
         ('Tópi · Instagram', 'reaproveita', '2026-10-22'::date, '21:00', 'Quinta', null),
         ('Tópi · Instagram', 'adapta',      '2026-10-23'::date, '10:30', 'Sexta', 'Qual o nome do nenê aí? 💗 [caixinha]'),
         ('Tópi · TikTok',    'reaproveita', '2026-10-23'::date, '19:00', 'Sexta', null)
       ) as v (canal, vinculo, data, hora, dia, legenda)
 where t.id = i.topic_id
   and t.ext_key = 'plano-2026-10b:t073'
   and i.channel = v.canal and i.link_kind = v.vinculo
   and i.stage <> 'publicado';

-- 3) CONFERÊNCIA — deve listar 4 linhas: 22/10 19:00 Reels, 22/10 21:00 Stories, 23/10 10:30 Stories, 23/10 19:00 TikTok
select i.pub_date, i.pub_time, i.network, i.piece_type, i.link_kind, i.archived
  from public.social_plan_items i join public.social_topics t on t.id = i.topic_id
 where t.ext_key = 'plano-2026-10b:t073'
 order by 1, 2;
