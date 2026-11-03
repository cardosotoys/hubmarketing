-- REPOST DO FEED NO STORY/STATUS: AUTOMÁTICO PELO FORMATO DO FEED (03/11/2026)
-- Quando o post do feed é carrossel, o Story/Status normalmente não termina com o repost; post único e Reels, sim.
-- story_repost passa a aceitar vazio (null) = automático; true/false = escolha feita na peça.
-- Roda com ou sem a 0155 antes. Idempotente.

set lock_timeout = '5s';

alter table public.social_plan_items add column if not exists story_repost boolean;
alter table public.social_plan_items alter column story_repost drop not null;
alter table public.social_plan_items alter column story_repost drop default;

-- o "true" que veio do padrão da 0155 vira automático (só o "false" foi escolha de alguém)
update public.social_plan_items set story_repost = null where story_repost is true;

comment on column public.social_plan_items.story_repost is
  'Story/Status com telas próprias: null = automático (repost do feed no fim, menos quando o feed é carrossel); true/false = escolha da peça.';

notify pgrst, 'reload schema';

-- CONFERÊNCIA — quantos estão no automático e quantos têm escolha
select count(*) filter (where story_repost is null) as automatico,
       count(*) filter (where story_repost = false) as sem_repost,
       count(*) filter (where story_repost = true) as com_repost
  from public.social_plan_items;
