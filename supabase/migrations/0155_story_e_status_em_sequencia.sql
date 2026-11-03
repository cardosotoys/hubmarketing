-- STORY E STATUS EM SEQUÊNCIA (03/11/2026)
-- No Story do Instagram e no Status do WhatsApp sobem 2 ou 3 artes próprias antes do repost do post do feed.
-- As telas próprias usam as colunas que já existem (creative_url = tela 1, creative_slides = todas, creative_changed = true);
-- esta coluna diz se a sequência termina com o repost do feed. Padrão: termina (é o que se faz quase sempre).
-- Idempotente.

set lock_timeout = '5s';

alter table public.social_plan_items
  add column if not exists story_repost boolean not null default true;

comment on column public.social_plan_items.story_repost is
  'Story/Status com telas próprias: true = depois das telas, reposta o post do feed (matriz).';

notify pgrst, 'reload schema';

-- CONFERÊNCIA — a coluna existe e todos começam terminando com o repost
select count(*) as destinos, count(*) filter (where story_repost) as com_repost
  from public.social_plan_items;
