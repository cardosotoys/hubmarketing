-- Cardoso Hub — os campos que faltavam no cadastro central do produto.
--
-- Por que: o CRM guardava descricao e diferenciais por conta propria, porque o
-- Hub nao tinha onde por. A partir daqui o produto e do Hub inteiro: quem
-- escreve a frase de venda e o Hub, e o CRM so le.
--
-- Tres colunas vem da FICHA TECNICA 2026, que ja e a fonte dos outros campos:
-- NOME ANTIGO, NOME PARA EMBALAGEM (MARKETING) e SUB-CATEGORIA.
--
-- Idempotente. Nao altera nenhum dado existente.

set lock_timeout = '5s';

alter table public.products add column if not exists description   text    not null default '';
alter table public.products add column if not exists differentials text[]  not null default '{}';
alter table public.products add column if not exists active        boolean not null default true;
alter table public.products add column if not exists previous_name text    not null default '';
alter table public.products add column if not exists packaging_name text   not null default '';
alter table public.products add column if not exists sub_category  text    not null default '';

comment on column public.products.description   is 'Frase de venda que o lojista le na vitrine do CRM. Preenchida aqui, nunca no CRM.';
comment on column public.products.differentials is 'Destaques do produto, um por item. Aparecem na vitrine do CRM.';
comment on column public.products.active        is 'false = fora do catalogo vigente: some das novas selecoes, mas o historico comercial continua.';
comment on column public.products.previous_name is 'FICHA TECNICA 2026, coluna NOME ANTIGO.';
comment on column public.products.packaging_name is 'FICHA TECNICA 2026, coluna NOME PARA EMBALAGEM (MARKETING).';
comment on column public.products.sub_category  is 'FICHA TECNICA 2026, coluna SUB-CATEGORIA.';

-- Tabela de apoio da carga da ficha. E temporaria por natureza: a 0091 usa e
-- deixa de lado. Fica sem grant nenhum para anon/authenticated.
create table if not exists public.ficha_2026_stage (
  ref            text primary key,
  cadastro       text not null default '',
  nome_antigo    text not null default '',
  nome_embalagem text not null default '',
  sub_categoria  text not null default '',
  nome_tecnico   text not null default '',
  idade          text not null default '',
  ean            text not null default '',
  categoria      text not null default '',
  linha          text not null default '',
  marca          text not null default ''
);
revoke all on public.ficha_2026_stage from anon, authenticated;
