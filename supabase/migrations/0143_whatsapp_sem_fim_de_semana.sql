-- WHATSAPP NÃO VAI NO FIM DE SEMANA (regra do Aldair, 02/11/2026): todo item de WhatsApp (Status, clientes por região,
-- representantes) que caía no sábado ou no domingo passa para a segunda seguinte, no mesmo horário.
-- Segunda foi melhor que sexta: a sexta já é cheia e assim o WhatsApp sempre vem depois do post de origem. Pode rodar de novo.

update public.social_plan_items i
   set pub_date = d.nova,
       weekday = 'Segunda',
       month_label = (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from d.nova)::int] || '/' || to_char(d.nova, 'YY'),
       updated_at = now()
  from (select x.id, x.pub_date + case extract(dow from x.pub_date)::int when 6 then 2 else 1 end as nova
          from public.social_plan_items x
         where x.channel_id like 'wa-%' and extract(dow from x.pub_date) in (0, 6)) d
 where d.id = i.id and not i.archived and i.stage <> 'publicado' and i.pub_date >= '2026-11-02';

-- CONFERÊNCIA — WhatsApp por dia da semana daqui para a frente (sábado e domingo têm que sumir)
select weekday, count(*) as itens_whatsapp
  from public.social_plan_items
 where channel_id like 'wa-%' and not archived and stage <> 'publicado' and pub_date >= '2026-11-02'
 group by 1
 order by 2 desc;
