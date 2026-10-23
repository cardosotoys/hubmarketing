-- TÓPI: sem TikTok até o fim de 2026 (decisão do Aldair, 23/10/2026).
-- Os posts de TikTok da Tópi até 31/12 saem do calendário (ficam arquivados, dá para voltar).
-- Os Reels do Instagram continuam iguais. Pode rodar de novo.

update public.social_plan_items
   set archived = true, updated_at = now()
 where channel_id = 'tp-tt'
   and pub_date <= '2026-12-31'
   and not archived
   and stage <> 'publicado';

-- CONFERÊNCIA — deve mostrar 0 (nenhum TikTok da Tópi no calendário até dezembro)
select count(*) as tiktok_topi_ate_dezembro
  from public.social_plan_items
 where channel_id = 'tp-tt' and pub_date <= '2026-12-31' and not archived;
