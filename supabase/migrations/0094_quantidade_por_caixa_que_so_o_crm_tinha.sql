-- Cardoso Hub — preenche a quantidade por caixa de 3 produtos que a FICHA
-- TECNICA 2026 deixou em branco e que so o catalogo impresso sabia.
--
-- 4030, 4031 e 4032: a planilha vem sem QUANTIDADE e sem PESO BRUTO. O CRM
-- mostrava "6 unidades" porque o numero veio do catalogo 2026. Como o produto
-- passa a ser do Hub, o numero precisa morar aqui — senao esses tres ficariam
-- sem informacao de embalagem na vitrine.
--
-- Idempotente e conservador: so escreve onde o Hub esta vazio.

set lock_timeout = '5s';

update public.products p
   set carton_quantity = 6
 where p.code in ('4030', '4031', '4032')
   and p.carton_quantity is null;

do $$
declare n int;
begin
  select count(*) into n from public.products
   where code in ('4030','4031','4032') and carton_quantity is distinct from 6;
  if n > 0 then
    raise exception 'ABORTADO: % dos 3 produtos continuam sem quantidade por caixa', n;
  end if;
end $$;
