-- TÓPI: hoje (sex 23/10, 19h) sai o Invictus Super Cegonheiro (REF 1058) no lugar do Trator Agro.
-- Os dois trocam de lugar: o Trator Agro vai para qua 11/11, onde estava o Cegonheiro. Pode rodar de novo.

-- 1) os dois assuntos trocam de conteúdo
update public.social_topics t
   set title = v.titulo, sku = v.sku, product_id = null, product = '',
       brief = t.brief || jsonb_build_object('legenda', v.legenda, 'enquete', v.enquete, 'gancho', v.gancho, 'mensagem', v.mensagem,
                                            'texto_arte', split_part(v.titulo, ':', 1) || ' · A partir de 3 anos')
  from (values
    ('plano-2026-10d:t01', 'Invictus Super Cegonheiro: leva todo mundo', '1058',
     'Todos os carrinhos a bordo! 🚚🚗',
     'O Invictus Super Cegonheiro é o caminhão-cegonha que leva os carrinhos para a próxima aventura.',
     'Todos os carrinhos a bordo! 🚚🚗' || chr(10) || 'O Invictus Super Cegonheiro leva a frota inteira para a próxima aventura.' || chr(10) || 'A partir de 3 anos.' || chr(10) || 'Quantos carrinhos cabem aí?' || chr(10) || 'Brincar é Tópi! 🧡' || chr(10) || '#Tópi #Invictus #Cegonheiro',
     'Quantos carrinhos tem aí? 🚗 [caixinha]'),
    ('plano-2026-10d:t06', 'Tópi Trator Agro: a fazenda chegou', '4024',
     'Bora trabalhar na fazenda? 🚜🌾',
     'O Tópi Trator Agro leva a brincadeira de fazenda para o quintal: puxa, empurra e transporta a colheita de faz de conta.',
     'O Tópi Trator Agro leva a fazenda para o quintal: puxa, empurra e transporta toda a colheita de faz de conta. 🌽' || chr(10) || 'A partir de 3 anos.' || chr(10) || 'Qual seria a primeira colheita aí na sua casa?' || chr(10) || 'Brincar é Tópi! 🧡' || chr(10) || '#Tópi #TratorAgro #BrincarNaFazenda',
     'Qual a colheita de hoje? 🌽 [enquete: Milho / Morango]')
  ) as v (ext_key, titulo, sku, gancho, mensagem, legenda, enquete)
 where t.ext_key = v.ext_key;

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key in ('plano-2026-10d:t01', 'plano-2026-10d:t06')
   and ltrim(p.code, '0') = ltrim(t.sku, '0');

-- 2) os posts dos dois assuntos pegam o título, a legenda e a enquete novos
update public.social_plan_items i
   set pauta = t.title, sku = t.sku, product = t.product, product_id = t.product_id,
       caption = case when i.link_kind = 'matriz' then t.brief->>'legenda'
                      when i.link_kind = 'adapta' then t.brief->>'enquete'
                      else i.caption end,
       updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key in ('plano-2026-10d:t01', 'plano-2026-10d:t06')
   and i.stage <> 'publicado';

-- CONFERÊNCIA — 23/10 deve ser o Cegonheiro e 11/11 o Trator Agro
select i.pub_date, i.pub_time, i.network, i.piece_type, i.pauta
  from public.social_plan_items i join public.social_topics t on t.id = i.topic_id
 where t.ext_key in ('plano-2026-10d:t01', 'plano-2026-10d:t06') and not i.archived
 order by 1, 2;
