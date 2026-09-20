-- Cardoso Hub — traz para o cadastro central a descricao e os diferenciais que
-- hoje so existem dentro do CRM.
--
-- Depende da 0090. Idempotente e nao destrutivo: so preenche onde o Hub esta
-- vazio, nunca sobrescreve texto ja escrito aqui. Roda antes de o CRM parar de
-- ser dono desses campos — nada e apagado no CRM por esta migration.
--
-- Volume no dia da migracao: 19 produtos com descricao, nenhum com diferencial.

set lock_timeout = '5s';

begin;

update public.products p set description = btrim(c.descricao)
  from crm.produtos c
 where c.codigo = p.code
   and btrim(c.descricao) <> ''
   and p.description = '';

update public.products p set differentials = c.diferenciais
  from crm.produtos c
 where c.codigo = p.code
   and coalesce(array_length(c.diferenciais, 1), 0) > 0
   and coalesce(array_length(p.differentials, 1), 0) = 0;

-- Trava: nenhum texto do CRM pode ficar para tras.
do $$
declare n_desc int; n_dif int;
begin
  select count(*) into n_desc
    from crm.produtos c join public.products p on p.code = c.codigo
   where btrim(c.descricao) <> '' and p.description = '';
  select count(*) into n_dif
    from crm.produtos c join public.products p on p.code = c.codigo
   where coalesce(array_length(c.diferenciais,1),0) > 0
     and coalesce(array_length(p.differentials,1),0) = 0;
  if n_desc > 0 or n_dif > 0 then
    raise exception 'ABORTADO: % descricao(oes) e % diferencial(is) do CRM ficaram sem destino no Hub', n_desc, n_dif;
  end if;
end $$;

commit;
