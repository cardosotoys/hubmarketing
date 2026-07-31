-- Cardoso Marketing Hub — notificações em tempo real
--
-- O sino de notificações (menções + atividade recente) só carregava dado ao abrir o painel ou
-- recarregar a página (F5) — nada avisava o navegador quando uma linha nova era inserida. Pra
-- isso funcionar em tempo real via Supabase Realtime, as tabelas precisam estar na publicação
-- `supabase_realtime` (não vêm nela por padrão).

alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.activity_log;
