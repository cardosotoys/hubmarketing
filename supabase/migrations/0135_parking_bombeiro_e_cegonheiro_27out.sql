-- PLAYMI ter 10/11 (9h): sai o T-Rex Relâmpago, entra o Eletronic Parking Bombeiro (REF 7193, elevador eletrônico).
-- TÓPI: o Cegonheiro troca de lugar com o Open Tracks — Cegonheiro ter 27/10, Open Tracks qui 29/10. Pode rodar de novo.

-- 1) 10/11: Eletronic Parking Bombeiro
update public.social_topics
   set title = 'Eletronic Parking Bombeiro: o elevador da garagem', sku = '7193', licensed = false, product_id = null, product = '',
       objective = 'Levar ao feed a garagem de bombeiro com elevador eletrônico como presente de Natal',
       strategy = 'Curva A na linha Play&Drive e ainda sem post; presente forte para 3 anos ou mais no Natal',
       brief = brief || jsonb_build_object(
         'meta', 'Levar ao feed a garagem de bombeiro com elevador eletrônico como presente de Natal',
         'porque', 'Curva A na linha Play&Drive e ainda sem post',
         'mensagem', 'O Eletronic Parking Bombeiro tem elevador eletrônico para levar os carrinhos até o topo da garagem.',
         'gancho', 'Sobe, desce e sai para o resgate! 🚒',
         'texto_arte', 'Eletronic Parking Bombeiro · A partir de 3 anos',
         'material_base', 'Gerar imagens IA a partir da foto do produto + Reels com imagens',
         'material_status', 'Gerar imagens IA + Reels com imagens')
 where ext_key = 'plano-2026-10b:t039';

update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key = 'plano-2026-10b:t039' and ltrim(p.code, '0') = '7193';

update public.social_plan_items i
   set pauta = t.title, sku = t.sku, product = t.product, product_id = t.product_id, objective = t.objective,
       caption = case
         when i.link_kind = 'matriz' then
           'Sobe, desce e sai para o resgate! 🚒' || chr(10) ||
           'O Eletronic Parking Bombeiro tem elevador eletrônico para levar os carrinhos até o topo da garagem.' || chr(10) ||
           'A partir de 3 anos.' || chr(10) ||
           'Qual carrinho sobe primeiro?' || chr(10) ||
           'Onde comprar: link na bio.' || chr(10) ||
           'Brincar é crescer, juntos! 💙' || chr(10) ||
           '#Playmi #Bombeiro #PresenteDeNatal'
         when i.network = 'Pinterest' then
           'Eletronic Parking Bombeiro Playmi | Garagem de bombeiro com elevador eletrônico para crianças a partir de 3 anos. Ideia de presente de Natal.'
         else i.caption end,
       updated_at = now()
  from public.social_topics t
 where t.id = i.topic_id and t.ext_key = 'plano-2026-10b:t039' and not i.archived and i.stage <> 'publicado';

-- 2) Cegonheiro na terça 27/10 e Open Tracks na quinta 29/10
update public.social_plan_items i
   set pub_date = v.data, pub_time = v.hora::time, weekday = v.dia, updated_at = now()
  from public.social_topics t,
       (values
        ('plano-2026-10d:t01', 'matriz',      '2026-10-27'::date, '10:30', 'Terça'),
        ('plano-2026-10d:t01', 'reaproveita', '2026-10-27'::date, '15:30', 'Terça'),
        ('plano-2026-10d:t01', 'adapta',      '2026-10-28'::date, '10:00', 'Quarta'),
        ('plano-2026-10d:t02', 'matriz',      '2026-10-29'::date, '15:00', 'Quinta'),
        ('plano-2026-10d:t02', 'reaproveita', '2026-10-29'::date, '17:00', 'Quinta')
       ) as v (ext_key, vinculo, data, hora, dia)
 where t.id = i.topic_id and t.ext_key = v.ext_key
   and i.channel = 'Tópi · Instagram' and i.link_kind = v.vinculo
   and not i.archived and i.stage <> 'publicado';

-- CONFERÊNCIA — Cegonheiro em 27/10, Open Tracks em 29/10 e o Parking Bombeiro em 10/11
select i.pub_date, to_char(i.pub_time, 'HH24:MI') as hora, i.channel, i.piece_type, i.pauta
  from public.social_plan_items i join public.social_topics t on t.id = i.topic_id
 where t.ext_key in ('plano-2026-10d:t01', 'plano-2026-10d:t02', 'plano-2026-10b:t039') and not i.archived
 order by 1, 2;
