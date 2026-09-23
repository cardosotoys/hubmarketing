-- Cardoso Hub — o IPI entra no cadastro do produto.
-- Roda depois da 0104. Idempotente e aditivo.
--
-- A regra, como o Aldair passou: o preco da tabela e LIQUIDO, e sobre ele
-- incide IPI de 6,5% — exceto a ref 8401 (Alvo Certo), que e 13%.
--
-- Mora no produto, e nao na tabela de preco, porque IPI e atributo fiscal do
-- item: muda por NCM, nao por regiao nem por regime do cliente. As quatro
-- tabelas continuam liquidas, como os PDFs dizem no cabecalho.
--
-- Fica editavel no Hub: quando a regra mudar para outro produto, e um UPDATE,
-- nao um deploy.

set lock_timeout = '5s';

begin;

alter table public.products
  add column if not exists ipi_pct numeric(5,2) not null default 6.5
  check (ipi_pct >= 0 and ipi_pct <= 100);

comment on column public.products.ipi_pct is
  'IPI em % sobre o preco liquido da tabela. Padrao 6,5. A ref 8401 (Alvo Certo) e 13.';

update public.products set ipi_pct = 13 where code = '8401' and ipi_pct <> 13;

do $$
declare n int;
begin
  select count(*) into n from public.products where code = '8401' and ipi_pct = 13;
  if n <> 1 then raise exception 'ABORTADO: a ref 8401 nao ficou com 13%% de IPI'; end if;

  select count(*) into n from public.products where code <> '8401' and ipi_pct <> 6.5;
  if n > 0 then
    raise exception 'ABORTADO: % produto(s) fora do padrao de 6,5%% sem a gente ter mandado', n;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
