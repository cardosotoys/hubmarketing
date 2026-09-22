-- Cardoso Hub — tabela de preco por cliente, e a pausa de venda de produto.
-- Roda depois de 0001..0101. Idempotente e aditivo: nada existente muda.
--
-- O que motiva: o preco de atacado muda por regiao e por regime tributario. Sao
-- quatro tabelas hoje (SP Simples, SP RPA, Sul/Sudeste, Norte/Nordeste), com o
-- mesmo produto custando diferente em cada uma. Isso vivia em PDF, fora do
-- sistema, entao ninguem conseguia montar um pre-pedido sem abrir o arquivo.
--
-- Tres decisoes que este SQL materializa:
--
-- 1. PRECO NUNCA VAZA. Nenhuma permissao para anon, e a vitrine do lojista nao
--    encosta nestas tabelas. O lojista continua escolhendo produto sem ver
--    preco, que e como a Cardoso vende.
--
-- 2. QUEM VE E DECISAO NOMINAL, nao cargo. Nasce liberado so para uma pessoa,
--    e o proprio Hub permite liberar outras depois — mesma mecanica que o
--    can_edit_products ganhou na 0095, pelo mesmo motivo: liberar por
--    departamento e liberar para quase todo mundo sem querer.
--
-- 3. A REGRA DE QUAL TABELA E DADO, NAO CODIGO. Fica em colunas (ufs, simples),
--    entao mudar a divisao comercial e um UPDATE, nao um deploy. E quando a UF
--    nao cai em nenhuma tabela — Centro-Oeste hoje — a funcao devolve NULO de
--    proposito. Sistema de preco que chuta preco e pior que sistema sem preco.

set lock_timeout = '5s';

begin;

-- ------------------------------------------------------------ quem enxerga
alter table public.profiles add column if not exists can_see_prices boolean not null default false;

comment on column public.profiles.can_see_prices is
  'Libera a area de tabela de preco. Nasce false para todo mundo; liberacao e nominal.';

create or replace function public.pode_ver_precos()
returns boolean language sql stable security definer set search_path = public
as $fn$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.can_see_prices);
$fn$;

comment on function public.pode_ver_precos() is
  'Quem pode ver e mexer em preco. Usada pelas policies de price_tables, price_table_items e product_sale_pauses.';

grant execute on function public.pode_ver_precos() to public, anon, authenticated, service_role;

-- --------------------------------------------------------------- as tabelas
create table if not exists public.price_tables (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null,                    -- sp_simples, sp_rpa, sul_sudeste, norte_nordeste
  nome          text not null,
  ufs           text[] not null default '{}',     -- a quais estados atende
  simples       boolean,                          -- true = so optante; false = so nao optante; null = tanto faz
  vigente_desde date not null default (now() at time zone 'America/Sao_Paulo')::date,
  vigente_ate   date,                             -- null = e a que vale hoje
  origem        text not null default '',         -- de que arquivo veio
  observacao    text not null default '',
  criado_por    uuid references public.profiles (id),
  criado_em     timestamptz not null default now()
);

-- So pode existir UMA versao vigente de cada tabela por vez. Subir uma nova
-- exige encerrar a anterior, e e isso que preserva o historico do que foi
-- cotado no mes passado.
create unique index if not exists price_tables_uma_vigente
  on public.price_tables (codigo) where vigente_ate is null;

create table if not exists public.price_table_items (
  price_table_id uuid not null references public.price_tables (id) on delete cascade,
  codigo         text not null,                   -- codigo do produto
  descricao      text not null default '',        -- como veio na tabela de origem
  preco          numeric(10,2) not null check (preco >= 0),
  qtd_caixa      integer check (qtd_caixa is null or qtd_caixa > 0),
  primary key (price_table_id, codigo)
);

comment on table public.price_table_items is
  'Um preco por produto por tabela. O codigo nao tem FK para products de proposito: a tabela de preco tem itens que o catalogo ainda nao tem, e perder esse preco na importacao seria pior que guardar um orfao visivel.';

-- ----------------------------------------------------------- pausa de venda
create table if not exists public.product_sale_pauses (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null,
  price_table_id uuid references public.price_tables (id) on delete cascade,  -- null = pausa em todas
  desde          date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ate            date,                            -- null = sem previsao de volta
  motivo         text not null default '',
  criado_por     uuid references public.profiles (id),
  criado_em      timestamptz not null default now(),
  check (ate is null or ate >= desde)
);

comment on table public.product_sale_pauses is
  'Produto fora de venda por um periodo. Sem price_table_id vale para todas as tabelas. Nao apaga preco: quando a pausa vence, o produto volta sozinho.';

create index if not exists product_sale_pauses_codigo on public.product_sale_pauses (codigo);

-- ------------------------------------------------------------- as consultas
create or replace function public.tabela_de_preco_do_cliente(p_uf text, p_simples boolean)
returns uuid language sql stable
as $fn$
  select t.id from public.price_tables t
   where t.vigente_ate is null
     and upper(coalesce(p_uf,'')) = any (t.ufs)
     and (t.simples is null or t.simples = coalesce(p_simples, false))
   order by (t.simples is not null) desc   -- regra especifica ganha da geral
   limit 1
$fn$;

comment on function public.tabela_de_preco_do_cliente(text, boolean) is
  'Qual tabela vale para um cliente, pela UF e pela opcao do Simples. Devolve NULO quando a UF nao esta em tabela nenhuma — e para dizer "sem tabela", nunca para chutar preco.';

create or replace function public.produto_pausado(p_codigo text, p_tabela uuid)
returns boolean language sql stable
as $fn$
  select exists (
    select 1 from public.product_sale_pauses p
     where p.codigo = p_codigo
       and (p.price_table_id is null or p.price_table_id = p_tabela)
       and p.desde <= (now() at time zone 'America/Sao_Paulo')::date
       and (p.ate is null or p.ate >= (now() at time zone 'America/Sao_Paulo')::date)
  )
$fn$;

-- ---------------------------------------------------------------- seguranca
alter table public.price_tables       enable row level security;
alter table public.price_table_items  enable row level security;
alter table public.product_sale_pauses enable row level security;

do $$
declare t text; c text;
begin
  foreach t in array array['price_tables','price_table_items','product_sale_pauses'] loop
    foreach c in array array['select','insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', t || '_' || c, t);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (public.pode_ver_precos())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.pode_ver_precos())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.pode_ver_precos())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.pode_ver_precos())', t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- A liberacao inicial: so o Aldair. O e-mail mora em auth.users, nao em
-- profiles — profiles so tem id, nome, cargo e departamento.
update public.profiles p set can_see_prices = true
 where exists (
   select 1 from auth.users u
    where u.id = p.id and lower(u.email) = 'marketing.digital@cardosotoys.com.br'
 );

-- ------------------------------------------------------------------ travas
do $$
declare n int;
begin
  select count(*) into n from public.profiles where can_see_prices;
  if n <> 1 then
    raise exception 'ABORTADO: % pessoa(s) com acesso a preco, e o combinado era exatamente 1', n;
  end if;

  select count(*) into n
    from information_schema.role_table_grants
   where table_schema='public' and grantee='anon'
     and table_name in ('price_tables','price_table_items','product_sale_pauses');
  if n > 0 then
    raise exception 'ABORTADO: anon ficou com % permissao(oes) em tabela de preco', n;
  end if;

  select count(*) into n from pg_class
   where relname in ('price_tables','price_table_items','product_sale_pauses') and not relrowsecurity;
  if n > 0 then
    raise exception 'ABORTADO: % tabela(s) de preco sem RLS', n;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
