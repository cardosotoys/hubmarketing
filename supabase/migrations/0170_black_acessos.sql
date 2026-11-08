-- Cardoso Black: quantas vezes cada link foi aberto (pré-cadastro geral e de cada representante).
-- Conta a partir desta versão (não há registro das aberturas anteriores).
-- visitante = id anônimo guardado no navegador (sem dado pessoal): separa "aberturas" de "pessoas".
begin;

create table if not exists public.black_acessos (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  pagina text not null check (pagina in ('precadastro', 'pedido', 'ficha')),
  rep text not null default '',
  visitante text not null default '',
  codigo text not null default ''
);
create index if not exists black_acessos_rep_idx on public.black_acessos (pagina, rep);
alter table public.black_acessos enable row level security;
drop policy if exists black_acessos_staff on public.black_acessos;
create policy black_acessos_staff on public.black_acessos for select using (public.black_staff());

-- registra uma abertura; a mesma pessoa abrindo a mesma página em menos de 30 min conta uma vez
create or replace function public.black_registrar_acesso(p_pagina text, p_rep text default '', p_visitante text default '', p_codigo text default '')
returns void language plpgsql security definer set search_path = public
as $fn$
declare v_rep text := left(coalesce(p_rep, ''), 80); v_vis text := left(coalesce(p_visitante, ''), 40); v_cod text := left(coalesce(p_codigo, ''), 12);
begin
  if p_pagina not in ('precadastro', 'pedido', 'ficha') then return; end if;
  if v_vis <> '' and exists (select 1 from public.black_acessos
      where visitante = v_vis and pagina = p_pagina and rep = v_rep and codigo = v_cod and criado_em > now() - interval '30 minutes') then
    return;
  end if;
  insert into public.black_acessos (pagina, rep, visitante, codigo) values (p_pagina, v_rep, v_vis, v_cod);
end;
$fn$;
grant execute on function public.black_registrar_acesso(text, text, text, text) to anon, authenticated;

-- resumo para o Hub: aberturas e pessoas por link de representante ('' = link geral)
create or replace function public.black_acessos_resumo()
returns table (rep text, aberturas bigint, pessoas bigint, primeira timestamptz, ultima timestamptz)
language sql stable security definer set search_path = public
as $fn$
  select a.rep, count(*), count(distinct nullif(a.visitante, '')), min(a.criado_em), max(a.criado_em)
    from public.black_acessos a
   where a.pagina = 'precadastro' and public.black_staff()
   group by a.rep;
$fn$;
grant execute on function public.black_acessos_resumo() to authenticated;

commit;
