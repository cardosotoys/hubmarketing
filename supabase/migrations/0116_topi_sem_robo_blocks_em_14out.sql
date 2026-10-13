-- Cardoso Marketing Hub — a Tópi não abre o plano com Robô-Blocks (postado recentemente).
--
-- Sai o assunto "Robô-Blocks: monta, desmonta e vira outro" de 14/10/2026 (Reels 12h, Stories 19h30,
-- TikTok 15/10 e YouTube 17/10). A Tópi passa a começar em 16/10 com o Carrinho de Boneca Passeio do Bebê.
-- Os Robô-Blocks de 25/11 e 23/12 continuam no plano.
-- Antes de apagar, o assunto e os destinos vão para o backup.
--
-- Roda depois de 0115. Idempotente. Não rode a 0115 de novo depois desta (ela traria o assunto de volta).

set lock_timeout = '10s';

insert into public.backup_plano_20261013_topics
  select t.* from public.social_topics t
   where t.ext_key = 'plano-2026-10b:t002' and t.title like 'Robô-Blocks%'
     and not exists (select 1 from public.backup_plano_20261013_topics b where b.id = t.id);

insert into public.backup_plano_20261013_items
  select i.* from public.social_plan_items i
    join public.social_topics t on t.id = i.topic_id
   where t.ext_key = 'plano-2026-10b:t002' and t.title like 'Robô-Blocks%'
     and not exists (select 1 from public.backup_plano_20261013_items b where b.id = i.id);

-- apagar o assunto leva junto os destinos (on delete cascade)
delete from public.social_topics
 where ext_key = 'plano-2026-10b:t002' and title like 'Robô-Blocks%';

-- Conferência: deve dar 0 em 14/10 e 2 assuntos Robô-Blocks restantes (25/11 e 23/12)
--   select (select count(*) from social_plan_items where brand = 'Tópi' and pub_date = '2026-10-14') as topi_14_10,
--          (select count(*) from social_topics where title like 'Robô-Blocks%') as robo_blocks_restantes;
