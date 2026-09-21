-- Cardoso Hub — governanca de edicao do catalogo central.
--
-- O problema: can_edit_products() liberava por DEPARTAMENTO, com
--
--     ... or p.department <> 'assistente' ...
--
-- Na pratica isso quer dizer "todo mundo que nao e assistente edita o
-- catalogo". Pior: a tela de Configuracoes tem um botao Liberado/Bloqueado por
-- pessoa (profiles.can_edit_products) que, por causa desse OR, so tinha efeito
-- sobre assistentes. Hoje o botao esta BLOQUEADO para as 10 pessoas e mesmo
-- assim 9 delas conseguem editar produto. O controle existia sem funcionar.
--
-- A regra passa a ser explicita:
--   - cargo diretoria ou administrador: edita (e o mesmo conjunto de
--     is_privileged(), que ja manda na exclusao);
--   - qualquer outra pessoa: so com o botao ligado em Configuracoes.
--
-- Continuidade: quem edita hoje continua editando. As duas pessoas de cargo
-- "equipe" que entravam pelo furo (Design e Produto/Engenharia) recebem o
-- botao ligado, de modo que a permissao delas passa a estar escrita no
-- cadastro em vez de escondida num OR. A partir daqui, desligar o botao
-- realmente tira o acesso.
--
-- Leitura nao muda: products_select_authenticated continua com using = true.
-- Idempotente.

set lock_timeout = '5s';

begin;

-- 1. Quem edita hoje e nao seria contemplado pela regra nova recebe a
--    liberacao explicita. Nao amplia acesso de ninguem: so escreve no cadastro
--    o que o OR antigo ja concedia na pratica.
update public.profiles
   set can_edit_products = true
 where role not in ('diretoria', 'administrador')
   and department <> 'assistente'
   and can_edit_products = false;

-- 2. A regra.
create or replace function public.can_edit_products()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role in ('diretoria', 'administrador') or p.can_edit_products)
  );
$fn$;

comment on function public.can_edit_products() is
  'Quem pode criar/editar produto: cargo diretoria ou administrador, ou liberacao por pessoa em Configuracoes. Usada pelas policies de INSERT e UPDATE de public.products.';

-- Mantem os mesmos grants que a funcao ja tinha.
grant execute on function public.can_edit_products() to public, anon, authenticated, service_role;

-- 3. Travas: ninguem pode perder acesso nesta migration, e o furo tem que
--    ter sumido de verdade.
do $$
declare
  n_perdeu int;
  n_antes  int;
  n_depois int;
begin
  -- quem editava pelo modelo antigo e nao edita mais pelo novo
  select count(*) into n_perdeu
    from public.profiles p
   where (p.role in ('diretoria','administrador') or p.department <> 'assistente' or p.can_edit_products)
     and not (p.role in ('diretoria','administrador') or p.can_edit_products);
  if n_perdeu > 0 then
    raise exception 'ABORTADO: % pessoa(s) perderiam o acesso de editar produto', n_perdeu;
  end if;

  -- o departamento nao pode mais, sozinho, dar acesso
  select count(*) into n_antes
    from public.profiles where department <> 'assistente';
  select count(*) into n_depois
    from public.profiles where role in ('diretoria','administrador') or can_edit_products;
  if n_depois > n_antes then
    raise exception 'ABORTADO: a regra nova liberou % pessoas, mais que as % de antes', n_depois, n_antes;
  end if;

  if exists (
    select 1 from pg_proc
     where proname = 'can_edit_products' and pronamespace = 'public'::regnamespace
       and prosrc ~* 'department'
  ) then
    raise exception 'ABORTADO: can_edit_products() ainda decide por departamento';
  end if;
end $$;

commit;
