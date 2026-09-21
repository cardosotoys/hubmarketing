-- Cardoso Hub — a observacao da caixa master, que o cadastro nao comportava.
--
-- De onde vem: o catalogo impresso 2026 diz, em dois produtos (paginas 9 e 10),
-- que a caixa de 6 unidades vem com composicao de cor — "4 unissex e 2 rosas".
-- A FICHA TECNICA 2026 nao tem coluna para isso, e nenhum campo existente
-- serve: carton_quantity e o numero (6, que ja esta certo), color diz "Cor
-- diversa", e package_contents e o que vem dentro do PRODUTO ("1 trenzinho,
-- 1 animal de vinil"), nao a composicao da caixa.
--
-- Sao os dois unicos produtos do catalogo com observacao de embalagem; o campo
-- fica vazio nos outros 313. Compativel com o que ja existe: nada e
-- reinterpretado, so ganha um lugar proprio.
--
-- Fonte conferida no historico do repositorio do CRM
-- (src/data/catalogo2026.json, commit cba44c6): codigos 3082 e 3084,
-- embalagem = "6 unidades (4 unissex e 2 rosas)".
--
-- Idempotente e conservador: so escreve onde esta vazio.

set lock_timeout = '5s';

begin;

alter table public.products add column if not exists carton_note text not null default '';

comment on column public.products.carton_note is
  'Observacao da caixa master, quando houver — ex.: "4 unissex e 2 rosas". Entra entre parenteses depois da quantidade.';

update public.products
   set carton_note = '4 unissex e 2 rosas'
 where code in ('3082', '3084')
   and carton_note = '';

do $$
declare n int;
begin
  select count(*) into n from public.products
   where code in ('3082','3084') and carton_note <> '4 unissex e 2 rosas';
  if n > 0 then
    raise exception 'ABORTADO: % dos 2 produtos continuam sem a observacao da caixa', n;
  end if;

  select count(*) into n from public.products where carton_note <> '' and code not in ('3082','3084');
  if n > 0 then
    raise exception 'ABORTADO: % produto(s) ganharam observacao de caixa sem fonte', n;
  end if;
end $$;

commit;
