-- Cardoso Marketing Hub — diagnóstico visível de falhas na sincronização do MPM
-- Roda uma vez no SQL Editor, depois de 0001..0029 já terem rodado.
--
-- Antes, uma busca que falhasse (rate limit da SerpApi, cota mensal esgotada, chave
-- inválida etc.) era só logada no console da Edge Function — invisível pra quem usa o Hub.
-- Essas colunas guardam quantas buscas falharam e a primeira mensagem de erro, mostradas
-- direto na tela do Monitor de Preços.

alter table public.mpm_sync_runs
  add column queries_attempted integer not null default 0,
  add column queries_failed integer not null default 0,
  add column last_error_sample text not null default '';
