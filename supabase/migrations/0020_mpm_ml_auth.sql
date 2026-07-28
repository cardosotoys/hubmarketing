-- Cardoso Marketing Hub — autenticação OAuth do Mercado Livre pro Monitor de Preços
-- O Mercado Livre passou a exigir OAuth até pra busca pública (bloqueou acesso anônimo).
-- Guardamos o access_token/refresh_token aqui porque o refresh_token do ML é rotativo — ele
-- muda a cada uso, então precisa ficar em algo que a Edge Function possa atualizar sozinha
-- (um secret estático não serviria).
-- Roda uma vez no SQL Editor, depois de 0001..0019 já terem rodado.

alter table public.mpm_settings add column ml_access_token text not null default '';
alter table public.mpm_settings add column ml_access_token_expires_at timestamptz;
alter table public.mpm_settings add column ml_refresh_token text not null default '';
