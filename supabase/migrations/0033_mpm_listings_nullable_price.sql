-- Cardoso Marketing Hub — permite anúncio do MPM sem preço confirmado
--
-- A busca via Google geral (site:mercadolivre.com.br/site:shopee.com.br) acha a página do
-- produto, mas não tem preço estruturado como o Google Shopping — só um trecho de texto
-- indexado, que pode conter frete, parcela ou preço com cupom em vez do preço real do produto
-- (já vimos isso acontecer: extraiu o valor do frete achando que era o preço). Em vez de
-- arriscar mostrar um preço errado, esses anúncios agora entram com preço nulo, marcados como
-- "não verificado" — alguém confere manualmente abrindo o link.

alter table public.mpm_listings
  alter column current_price drop not null;
