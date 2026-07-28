-- Cardoso Marketing Hub — Monitor de Preços agora busca via SerpApi (Google Shopping),
-- cobrindo qualquer loja que o Google indexe, não só Mercado Livre. O Mercado Livre bloqueou
-- busca de app terceiro por política (mesmo autenticado), então trocamos a fonte — as colunas
-- de OAuth do ML não servem mais pra nada.
-- Roda uma vez no SQL Editor, depois de 0001..0020 já terem rodado.

alter table public.mpm_settings drop column if exists ml_access_token;
alter table public.mpm_settings drop column if exists ml_access_token_expires_at;
alter table public.mpm_settings drop column if exists ml_refresh_token;
