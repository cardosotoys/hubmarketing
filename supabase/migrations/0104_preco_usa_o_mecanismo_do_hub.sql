-- Cardoso Hub — a permissao de preco passa a usar o mecanismo que o Hub ja tem.
-- Roda depois da 0103. Idempotente.
--
-- Na 0102 eu criei profiles.can_see_prices. Era um segundo interruptor: o Hub ja
-- tem extra_modules, que e como Reunioes ja restringe acesso a pessoas
-- especificas, e a tela de Configuracoes ja sabe ligar e desligar isso por
-- pessoa. Dois interruptores para a mesma porta e defeito esperando acontecer —
-- um dia alguem liga um e nao o outro.
--
-- Fica so o extra_modules. Quem liberar a pessoa em Configuracoes libera de uma
-- vez o menu e o banco.

set lock_timeout = '5s';

begin;

-- Quem ja tinha o acesso nominal leva junto para o mecanismo novo.
update public.profiles
   set extra_modules = array_append(extra_modules, 'tabela-precos')
 where can_see_prices
   and not ('tabela-precos' = any (extra_modules));

create or replace function public.pode_ver_precos()
returns boolean language sql stable security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and 'tabela-precos' = any (p.extra_modules)
       and not coalesce(p.disabled, false)
  );
$fn$;

comment on function public.pode_ver_precos() is
  'Quem ve e mexe em preco: quem tem o modulo tabela-precos liberado em Configuracoes. Nem diretoria ve sem liberacao — e de proposito.';

alter table public.profiles drop column if exists can_see_prices;

do $$
declare n int;
begin
  select count(*) into n from public.profiles where 'tabela-precos' = any (extra_modules);
  if n <> 1 then
    raise exception 'ABORTADO: % pessoa(s) com acesso a preco, e o combinado era exatamente 1', n;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='profiles' and column_name='can_see_prices') then
    raise exception 'ABORTADO: o interruptor antigo can_see_prices continua de pe';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
