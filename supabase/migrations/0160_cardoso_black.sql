-- Cardoso Marketing Hub — Cardoso Black (nov/2026): pré-cadastro, ficha do produto pelo QR e pedido.
-- Roda depois de 0001..0159. Idempotente.
--
-- O que este SQL cria:
--   black_config        uma linha só: datas de abertura/fechamento, pedido mínimo, links da live e do canal
--   black_carteira      clientes que podem entrar na Black (importada no módulo, nunca versionada no Git)
--   black_produtos      os ~79 produtos da Black: ordem na live, preço por peça, caixa, estoque
--   black_inscritos     quem fez o pré-cadastro, com status aprovado / em análise / recusado
--   black_credenciais   senha (hash) e token de troca de senha — SEM política nenhuma: só as funções abaixo leem
--   black_sessoes       login do lojista (CNPJ + senha) — também sem política
--   black_pedidos       pedidos enviados pelo link, com itens em black_pedido_itens
--   black_eventos       aberturas da ficha pelo QR (para a medição)
--
-- Decisões:
--   1) O lojista NÃO vira usuário do Supabase Auth. Muita tabela do Hub libera leitura para qualquer
--      "authenticated"; um lojista logado ali enxergaria o Hub. O acesso dele é por sessão própria
--      (token em black_sessoes), só por funções security definer, como o /campo e as /pecas.
--   2) Preço da Black mora em black_produtos, separado da Tabela de Preços (que segue restrita).
--      O lojista só vê o preço Black, e só depois de entrar com CNPJ e senha.
--   3) Dados técnicos, fotos e materiais vêm das tabelas que já existem: products (ficha técnica 2026),
--      content_materials com status 'liberado' e library_assets (cópia de vitrine). Nada é copiado.
--   4) A carteira do painel comercial não tem CNPJ. A checagem é: CNPJ (quando houver) ou razão social
--      oficial (consulta pública da Receita, feita pela função black-cadastro) + UF, com tolerância
--      a pequenas diferenças de escrita (pg_trgm).
--   5) Aprovação automática = checagem antifraude por regras, sem custo de IA: cadastro completo,
--      CNPJ ativo na Receita, empresa na carteira, e-mail e celular sem uso em outro CNPJ, e-mail não
--      descartável e links válidos. Qualquer alerta que bloqueia manda para análise, com o motivo à vista
--      no Hub. DDD de outro estado aparece como aviso, mas não bloqueia.
--   6) Quem administra: Diretoria/Administrador ou quem tiver o módulo 'cardoso-black' liberado
--      em Configurações (extra_modules), o mesmo mecanismo do resto do Hub.

set lock_timeout = '5s';

create extension if not exists pgcrypto;
create extension if not exists pg_trgm with schema extensions;

begin;

-- ------------------------------------------------------------------ quem administra
create or replace function public.black_staff()
returns boolean language sql stable security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and not coalesce(p.disabled, false)
       and (p.role in ('diretoria', 'administrador') or 'cardoso-black' = any (p.extra_modules))
  );
$fn$;

-- ------------------------------------------------------------------ normalização de nome
-- "Comércio de Brinquedos Vila Ltda." e "COMERCIO DE BRINQUEDOS VILA LTDA" viram a mesma coisa.
create or replace function public.black_norm(t text)
returns text language sql immutable
as $fn$
  select trim(regexp_replace(
           regexp_replace(
             regexp_replace(
               translate(upper(coalesce(t, '')),
                 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN'),
               '[^A-Z0-9 ]', ' ', 'g'),
             '\s+', ' ', 'g'),
           '( (LTDA|ME|EPP|EIRELI|SA|S A|MEI|SS|SOCIEDADE LIMITADA|LIMITADA))+$', '', 'g'));
$fn$;

create or replace function public.black_so_digitos(t text)
returns text language sql immutable
as $fn$ select regexp_replace(coalesce(t, ''), '\D', '', 'g'); $fn$;

-- ------------------------------------------------------------------ configuração
create table if not exists public.black_config (
  id integer primary key default 1 check (id = 1),
  inscricoes_ate timestamptz not null default '2026-11-15 23:59:59-03',
  abre_em timestamptz not null default '2026-11-13 00:00:00-03',
  fecha_em timestamptz not null default '2026-11-15 23:59:59-03',
  pedido_minimo numeric(12, 2) not null default 2500,
  frete_gratis_sp_rj numeric(12, 2) not null default 5000,
  live_data text not null default 'Sexta-feira, 13/11 · horário a confirmar',
  live_link text not null default '',
  canal_link text not null default '',
  desconto_pct numeric(5, 2) not null default 0 check (desconto_pct >= 0 and desconto_pct < 100),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles (id)
);
insert into public.black_config (id) values (1) on conflict (id) do nothing;


-- ------------------------------------------------------------------ carteira
create table if not exists public.black_carteira (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  razao_norm text generated always as (public.black_norm(razao_social)) stored,
  cnpj text unique,
  fantasia text not null default '',
  cidade text not null default '',
  uf text not null default '',
  representante text not null default '',
  grupo text not null default '',
  situacao text not null default '',
  dias_sem_compra integer,
  faturamento_12m numeric(14, 2),
  importado_em timestamptz not null default now()
);
create unique index if not exists black_carteira_nome_uf on public.black_carteira (razao_norm, uf);
create index if not exists black_carteira_trgm on public.black_carteira using gin (razao_norm extensions.gin_trgm_ops);

comment on table public.black_carteira is
  'Clientes que podem entrar na Black. Importada pelo módulo Cardoso Black (CSV). Nunca versionar estes dados no Git: o repositório é público.';

-- ------------------------------------------------------------------ produtos da Black
create table if not exists public.black_produtos (
  codigo text primary key,
  ordem integer not null default 0,
  familia text not null default '',
  preco_peca numeric(12, 2) check (preco_peca is null or preco_peca > 0),
  desconto_pct numeric(5, 2) check (desconto_pct is null or (desconto_pct >= 0 and desconto_pct < 100)),
  caixa_qtd integer check (caixa_qtd is null or caixa_qtd > 0),
  estoque_caixas integer check (estoque_caixas is null or estoque_caixas >= 0),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles (id)
);
alter table public.black_produtos alter column preco_peca drop not null;
alter table public.black_produtos add column if not exists desconto_pct numeric(5, 2);
alter table public.black_config add column if not exists desconto_pct numeric(5, 2) not null default 0;
comment on column public.black_produtos.preco_peca is
  'Preço Black fixo por peça. Vazio = Tabela de Preços vigente da UF do cliente com o desconto da Black (do produto ou geral).';
comment on column public.black_produtos.caixa_qtd is 'Vazio = usa products.carton_quantity (caixa master da ficha técnica).';
comment on column public.black_produtos.estoque_caixas is 'Vazio = sem limite. Conta os pedidos não cancelados.';

-- ------------------------------------------------------------------ inscritos
create table if not exists public.black_inscritos (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null unique,
  razao_social text not null default '',
  fantasia text not null default '',
  cidade text not null default '',
  uf text not null default '',
  carteira_id uuid references public.black_carteira (id) on delete set null,
  representante text not null default '',
  rep_link text not null default '',
  comprador text not null default '',
  email text not null default '',
  celular text not null default '',
  canais jsonb not null default '{}',
  status text not null default 'analise' check (status in ('aprovado', 'analise', 'recusado')),
  origem text not null default '' check (origem in ('', 'carteira', 'fora_carteira', 'situacao')),
  alertas text[] not null default '{}',
  motivo text not null default '',
  aceite_lgpd_em timestamptz,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references public.profiles (id)
);
create index if not exists black_inscritos_status on public.black_inscritos (status);
alter table public.black_inscritos add column if not exists alertas text[] not null default '{}';

create table if not exists public.black_credenciais (
  inscrito_id uuid primary key references public.black_inscritos (id) on delete cascade,
  senha_hash text not null,
  reset_token text unique,
  reset_ate timestamptz
);

create table if not exists public.black_sessoes (
  token text primary key,
  inscrito_id uuid not null references public.black_inscritos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);
create index if not exists black_sessoes_inscrito on public.black_sessoes (inscrito_id);

-- ------------------------------------------------------------------ pedidos
create sequence if not exists public.black_pedido_seq start 1001;

create table if not exists public.black_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('CB-' || nextval('public.black_pedido_seq')),
  inscrito_id uuid not null references public.black_inscritos (id),
  cnpj text not null,
  razao_social text not null default '',
  fantasia text not null default '',
  cidade text not null default '',
  uf text not null default '',
  representante text not null default '',
  comprador text not null default '',
  email text not null default '',
  celular text not null default '',
  observacao text not null default '',
  caixas integer not null default 0,
  pecas integer not null default 0,
  total numeric(14, 2) not null default 0,
  frete text not null default '',
  status text not null default 'recebido' check (status in ('recebido', 'confirmado', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles (id)
);
create index if not exists black_pedidos_inscrito on public.black_pedidos (inscrito_id);

create table if not exists public.black_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.black_pedidos (id) on delete cascade,
  codigo text not null,
  nome text not null default '',
  caixas integer not null check (caixas > 0),
  pecas_caixa integer not null,
  preco_peca numeric(12, 2) not null,
  total numeric(14, 2) not null
);
create index if not exists black_pedido_itens_pedido on public.black_pedido_itens (pedido_id);

create table if not exists public.black_eventos (
  id bigserial primary key,
  tipo text not null,
  codigo text not null default '',
  inscrito_id uuid references public.black_inscritos (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists black_eventos_tipo on public.black_eventos (tipo, codigo);

-- ------------------------------------------------------------------ RLS
alter table public.black_config enable row level security;
alter table public.black_carteira enable row level security;
alter table public.black_produtos enable row level security;
alter table public.black_inscritos enable row level security;
alter table public.black_credenciais enable row level security;
alter table public.black_sessoes enable row level security;
alter table public.black_pedidos enable row level security;
alter table public.black_pedido_itens enable row level security;
alter table public.black_eventos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['black_config', 'black_carteira', 'black_produtos', 'black_inscritos',
                           'black_pedidos', 'black_pedido_itens', 'black_eventos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.black_staff()) with check (public.black_staff())', t || '_staff', t);
  end loop;
end
$$;
-- credenciais e sessões: nenhuma política (ninguém lê direto, nem a equipe).
revoke all on public.black_credenciais, public.black_sessoes from anon, authenticated;
revoke all on public.black_carteira, public.black_produtos, public.black_inscritos, public.black_pedidos,
              public.black_pedido_itens, public.black_eventos, public.black_config from anon;

-- ------------------------------------------------------------------ funções internas
create or replace function public.black_carteira_match(p_razao text, p_uf text, p_cnpj text)
returns setof public.black_carteira
language sql stable security definer set search_path = public, extensions
as $fn$
  (select c.* from public.black_carteira c
    where c.cnpj is not null and c.cnpj = public.black_so_digitos(p_cnpj)
    limit 1)
  union all
  (select c.* from public.black_carteira c
    where not exists (select 1 from public.black_carteira x where x.cnpj = public.black_so_digitos(p_cnpj))
      and c.uf = upper(coalesce(p_uf, ''))
      and public.black_norm(p_razao) <> ''
      and (c.razao_norm = public.black_norm(p_razao)
           or extensions.similarity(c.razao_norm, public.black_norm(p_razao)) >= 0.75)
    order by (c.razao_norm = public.black_norm(p_razao)) desc,
             extensions.similarity(c.razao_norm, public.black_norm(p_razao)) desc
    limit 1)
  limit 1;
$fn$;
revoke all on function public.black_carteira_match(text, text, text) from public, anon, authenticated;
grant execute on function public.black_carteira_match(text, text, text) to service_role;

create or replace function public.black_inscrito_da_sessao(p_token text)
returns uuid language sql stable security definer set search_path = public
as $fn$
  select s.inscrito_id from public.black_sessoes s
    join public.black_inscritos i on i.id = s.inscrito_id
   where s.token = p_token and s.expira_em > now() and i.status = 'aprovado';
$fn$;
revoke all on function public.black_inscrito_da_sessao(text) from public, anon, authenticated;


-- preço Black de um produto para uma UF: fixo (black_produtos.preco_peca) ou Tabela de Preços da região - desconto
create or replace function public.black_preco(p_codigo text, p_uf text)
returns numeric language sql stable security definer set search_path = public
as $fn$
  select coalesce(
    bp.preco_peca,
    round((select i.preco from public.price_table_items i
             join public.price_tables t on t.id = i.price_table_id
            where i.codigo = bp.codigo and t.vigente_ate is null and upper(p_uf) = any (t.ufs)
            order by (t.simples is null) desc, t.nome
            limit 1)
          * (1 - coalesce(bp.desconto_pct, (select desconto_pct from public.black_config where id = 1), 0) / 100), 2))
  from public.black_produtos bp where bp.codigo = p_codigo;
$fn$;
revoke all on function public.black_preco(text, text) from public, anon;
grant execute on function public.black_preco(text, text) to authenticated;

create or replace function public.black_frete(p_uf text, p_cidade text, p_total numeric)
returns text language plpgsql stable set search_path = public
as $fn$
declare lim numeric := (select frete_gratis_sp_rj from public.black_config where id = 1);
begin
  if upper(p_uf) = 'SP' and public.black_norm(p_cidade) = 'SAO PAULO' then
    return 'Frete grátis para SP capital';
  elsif upper(p_uf) in ('SP', 'RJ') then
    if p_total >= lim then return 'Frete grátis: pedido acima de R$ ' || replace(to_char(lim::int, 'FM999,999'), ',', '.'); end if;
    return 'Frete por conta da loja · grátis a partir de R$ ' || replace(to_char(lim::int, 'FM999,999'), ',', '.');
  end if;
  return 'Transportadora, frete por conta da loja';
end
$fn$;

drop function if exists public.black_registrar_inscricao(text, text, text, text, text, text, text, text, text, jsonb, text);
drop function if exists public.black_registrar_inscricao(text, text, text, text, text, text, text, text, text, jsonb, text, boolean);
-- Chamada só pela função black-cadastro (service_role), depois de consultar o CNPJ na Receita.
create or replace function public.black_registrar_inscricao(
  p_cnpj text, p_razao text, p_fantasia text, p_cidade text, p_uf text, p_rep_link text,
  p_comprador text, p_email text, p_celular text, p_canais jsonb, p_senha text, p_confiavel boolean default true, p_alertas text[] default '{}')
returns json language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  v_cnpj text := public.black_so_digitos(p_cnpj);
  v_cart public.black_carteira;
  v_cfg public.black_config;
  v_status text; v_origem text; v_id uuid;
  v_alertas text[] := coalesce(p_alertas, '{}');
  v_cel text := public.black_so_digitos(p_celular);
begin
  select * into v_cfg from public.black_config where id = 1;
  if now() > v_cfg.inscricoes_ate then return json_build_object('erro', 'inscricoes_encerradas'); end if;
  if length(v_cnpj) <> 14 then return json_build_object('erro', 'cnpj_invalido'); end if;
  if length(coalesce(p_senha, '')) < 6 then return json_build_object('erro', 'senha_curta'); end if;
  if exists (select 1 from public.black_inscritos where cnpj = v_cnpj) then
    return json_build_object('erro', 'ja_inscrito');
  end if;

  -- sem consulta à Receita (fora do ar), o nome digitado não é confiável: não cruza com a carteira
  if p_confiavel then
    select * into v_cart from public.black_carteira_match(p_razao, p_uf, v_cnpj);
  else
    v_alertas := array_append(v_alertas, 'receita_fora');
  end if;
  if v_cart.id is null then v_alertas := array_append(v_alertas, 'fora_carteira'); end if;
  if exists (select 1 from public.black_inscritos where lower(email) = lower(trim(p_email))) then
    v_alertas := array_append(v_alertas, 'email_repetido');
  end if;
  if length(v_cel) >= 10 and exists (select 1 from public.black_inscritos where public.black_so_digitos(celular) = v_cel) then
    v_alertas := array_append(v_alertas, 'celular_repetido');
  end if;
  if v_cart.id is not null and exists (select 1 from public.black_inscritos where carteira_id = v_cart.id) then
    v_alertas := array_append(v_alertas, 'empresa_ja_inscrita');
  end if;
  -- só o DDD de outro estado é aviso; qualquer outro alerta manda para análise
  v_status := case when exists (select 1 from unnest(v_alertas) a where a <> 'ddd_outra_uf') then 'analise' else 'aprovado' end;
  v_origem := case when v_cart.id is null then 'fora_carteira' else 'carteira' end;

  insert into public.black_inscritos (cnpj, razao_social, fantasia, cidade, uf, carteira_id, representante, rep_link,
                                      comprador, email, celular, canais, status, origem, alertas, aceite_lgpd_em,
                                      decidido_em)
  values (v_cnpj, coalesce(p_razao, ''), coalesce(nullif(p_fantasia, ''), nullif(v_cart.fantasia, ''), ''), coalesce(p_cidade, ''),
          upper(coalesce(p_uf, '')), v_cart.id, coalesce(nullif(v_cart.representante, ''), p_rep_link, ''),
          coalesce(p_rep_link, ''), coalesce(p_comprador, ''), lower(coalesce(p_email, '')), coalesce(p_celular, ''),
          coalesce(p_canais, '{}'), v_status, v_origem, v_alertas, now(),
          case when v_status = 'aprovado' then now() end)
  returning id into v_id;

  insert into public.black_credenciais (inscrito_id, senha_hash) values (v_id, crypt(p_senha, gen_salt('bf')));

  return json_build_object(
    'status', v_status,
    'fantasia', coalesce(nullif(p_fantasia, ''), nullif(v_cart.fantasia, ''), p_razao),
    'representante', coalesce(nullif(v_cart.representante, ''), p_rep_link, ''),
    'canal_link', case when v_status = 'aprovado' then v_cfg.canal_link else '' end,
    'live_data', v_cfg.live_data,
    'live_link', case when v_status = 'aprovado' then v_cfg.live_link else '' end);
end
$fn$;
revoke all on function public.black_registrar_inscricao(text, text, text, text, text, text, text, text, text, jsonb, text, boolean, text[]) from public, anon, authenticated;
grant execute on function public.black_registrar_inscricao(text, text, text, text, text, text, text, text, text, jsonb, text, boolean, text[]) to service_role;

create or replace function public.black_ja_inscrito(p_cnpj text)
returns text language sql stable security definer set search_path = public
as $fn$ select status from public.black_inscritos where cnpj = public.black_so_digitos(p_cnpj); $fn$;
revoke all on function public.black_ja_inscrito(text) from public, anon, authenticated;
grant execute on function public.black_ja_inscrito(text) to service_role;

-- ------------------------------------------------------------------ funções públicas (lojista)
create or replace function public.black_config_publica()
returns json language sql stable security definer set search_path = public
as $fn$
  select json_build_object(
    'inscricoes_ate', inscricoes_ate, 'abre_em', abre_em, 'fecha_em', fecha_em,
    'pedido_minimo', pedido_minimo, 'frete_gratis_sp_rj', frete_gratis_sp_rj, 'live_data', live_data,
    'agora', now(), 'aberto', now() between abre_em and fecha_em, 'encerrado', now() > fecha_em)
  from public.black_config where id = 1;
$fn$;

create or replace function public.black_login(p_cnpj text, p_senha text)
returns json language plpgsql security definer set search_path = public, extensions
as $fn$
declare v_i public.black_inscritos; v_hash text; v_token text;
begin
  select * into v_i from public.black_inscritos where cnpj = public.black_so_digitos(p_cnpj);
  if v_i.id is null then return json_build_object('erro', 'nao_inscrito'); end if;
  select senha_hash into v_hash from public.black_credenciais where inscrito_id = v_i.id;
  if v_hash is null or v_hash <> crypt(coalesce(p_senha, ''), v_hash) then
    insert into public.black_eventos (tipo, inscrito_id) values ('login_falhou', v_i.id);
    return json_build_object('erro', 'senha');
  end if;
  if v_i.status = 'analise' then return json_build_object('erro', 'em_analise'); end if;
  if v_i.status = 'recusado' then return json_build_object('erro', 'recusado'); end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.black_sessoes (token, inscrito_id, expira_em)
  values (v_token, v_i.id, greatest((select fecha_em from public.black_config where id = 1), now()) + interval '7 days');
  insert into public.black_eventos (tipo, inscrito_id) values ('login', v_i.id);
  return json_build_object('token', v_token);
end
$fn$;

create or replace function public.black_sair(p_token text)
returns void language sql security definer set search_path = public
as $fn$ delete from public.black_sessoes where token = p_token; $fn$;

create or replace function public.black_sessao(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  select json_build_object(
    'cnpj', i.cnpj, 'razao_social', i.razao_social, 'fantasia', i.fantasia, 'cidade', i.cidade, 'uf', i.uf,
    'representante', i.representante, 'comprador', i.comprador, 'email', i.email, 'celular', i.celular,
    'canal_link', c.canal_link, 'live_link', c.live_link)
  from public.black_inscritos i, public.black_config c
  where i.id = public.black_inscrito_da_sessao(p_token) and c.id = 1;
$fn$;

create or replace function public.black_catalogo(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  with logado as (select i.uf, true as ok from public.black_inscritos i where i.id = public.black_inscrito_da_sessao(p_token)),
  vendido as (
    select it.codigo, sum(it.caixas) as cx from public.black_pedido_itens it
      join public.black_pedidos pd on pd.id = it.pedido_id and pd.status <> 'cancelado'
     group by it.codigo)
  select coalesce(json_agg(json_build_object(
      'codigo', bp.codigo, 'ordem', bp.ordem, 'nome', coalesce(nullif(p.packaging_name, ''), p.name, bp.codigo),
      'familia', coalesce(nullif(bp.familia, ''), p.line, ''),
      'caixa', coalesce(bp.caixa_qtd, p.carton_quantity, 1),
      -- preço só para quem entrou e só a partir da abertura (não vaza antes da live)
      'preco_peca', case when (select ok from logado) and now() >= (select abre_em from public.black_config where id = 1)
                         then public.black_preco(bp.codigo, (select uf from logado)) end,
      'disponivel', case when bp.estoque_caixas is null then null
                         else greatest(bp.estoque_caixas - coalesce(v.cx, 0), 0) end,
      'imagem', coalesce(p.image_url, ''), 'embalagem', coalesce(p.packaging_image_url, ''))
    order by bp.ordem, bp.codigo), '[]'::json)
  from public.black_produtos bp
  left join public.products p on p.code = bp.codigo
  left join vendido v on v.codigo = bp.codigo
  where bp.ativo;
$fn$;

create or replace function public.black_produto(p_codigo text, p_token text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare v_ins uuid := public.black_inscrito_da_sessao(p_token); v json;
begin
  select json_build_object(
    'codigo', bp.codigo, 'ordem', bp.ordem,
    'nome', coalesce(nullif(p.packaging_name, ''), p.name, bp.codigo),
    'familia', coalesce(nullif(bp.familia, ''), p.line, ''),
    'caixa', coalesce(bp.caixa_qtd, p.carton_quantity, 1),
    'preco_peca', case when v_ins is not null and now() >= (select abre_em from public.black_config where id = 1)
                       then public.black_preco(bp.codigo, (select uf from public.black_inscritos where id = v_ins)) end,
    'disponivel', case when bp.estoque_caixas is null then null else greatest(bp.estoque_caixas - coalesce((
        select sum(it.caixas) from public.black_pedido_itens it
          join public.black_pedidos pd on pd.id = it.pedido_id and pd.status <> 'cancelado'
         where it.codigo = bp.codigo), 0), 0) end,
    'imagem', coalesce(p.image_url, ''), 'embalagem', coalesce(p.packaging_image_url, ''),
    'descricao', coalesce(p.description, ''), 'diferenciais', coalesce(to_json(p.differentials), '[]'::json),
    'tecnico', json_build_object(
      'faixa_etaria', p.age_range, 'ean', p.ean, 'inmetro', p.inmetro_number, 'material', p.material,
      'cor', p.color, 'categoria', p.toy_category, 'conteudo', p.package_contents,
      'mecanismo', p.has_mechanism, 'som', p.has_sound, 'luz', p.has_light, 'pilhas', p.battery_type,
      'produto_mm', json_build_array(p.product_length_mm, p.product_width_mm, p.product_height_mm),
      'produto_kg', p.product_weight_kg,
      'embalagem_mm', json_build_array(p.package_length_mm, p.package_width_mm, p.package_height_mm),
      'embalagem_kg', p.package_weight_kg,
      'caixa_mm', json_build_array(p.carton_length_mm, p.carton_width_mm, p.carton_height_mm),
      'caixa_kg', p.carton_gross_weight_kg, 'caixa_obs', p.carton_note),
    'materiais', coalesce((
      select json_agg(json_build_object('tipo', m.kind, 'nome', m.name, 'link', m.drive_url,
                                        'cache', coalesce(a.cache_path, '')) order by m.kind, m.name)
        from public.content_materials m
        left join public.library_assets a on a.id = m.library_asset_id and a.vitrine
       where m.product_id = p.id and m.status = 'liberado'), '[]'::json))
  into v
  from public.black_produtos bp
  left join public.products p on p.code = bp.codigo
  where bp.codigo = p_codigo and bp.ativo;

  if v is null then return null; end if;
  insert into public.black_eventos (tipo, codigo, inscrito_id) values ('ficha', p_codigo, v_ins);
  return v;
end
$fn$;

create or replace function public.black_pedido_enviar(p_token text, p_itens jsonb, p_obs text, p_comprador text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_ins uuid := public.black_inscrito_da_sessao(p_token);
  v_i public.black_inscritos; v_cfg public.black_config;
  v_ped uuid; v_num text; v_tot numeric := 0; v_cx int := 0; v_pc int := 0; r record;
begin
  if v_ins is null then return json_build_object('erro', 'sessao'); end if;
  select * into v_cfg from public.black_config where id = 1;
  if now() < v_cfg.abre_em then return json_build_object('erro', 'nao_abriu'); end if;
  if now() > v_cfg.fecha_em then return json_build_object('erro', 'encerrado'); end if;
  select * into v_i from public.black_inscritos where id = v_ins;

  drop table if exists _itens;
  create temp table _itens on commit drop as
  select x.codigo, sum(x.caixas)::int as caixas
    from jsonb_to_recordset(coalesce(p_itens, '[]')) as x(codigo text, caixas int)
   where x.caixas > 0
   group by x.codigo;
  if not exists (select 1 from _itens) then return json_build_object('erro', 'vazio'); end if;

  -- trava as linhas dos produtos para o estoque não ser vendido duas vezes ao mesmo tempo
  perform 1 from public.black_produtos where codigo in (select codigo from _itens) for update;

  for r in
    select it.codigo, it.caixas, public.black_preco(it.codigo, v_i.uf) as preco_peca, bp.estoque_caixas, bp.ativo,
           coalesce(bp.caixa_qtd, p.carton_quantity, 1) as pc,
           coalesce(nullif(p.packaging_name, ''), p.name, it.codigo) as nome,
           coalesce((select sum(pi.caixas) from public.black_pedido_itens pi
                       join public.black_pedidos pd on pd.id = pi.pedido_id and pd.status <> 'cancelado'
                      where pi.codigo = it.codigo), 0) as vendidas
      from _itens it
      left join public.black_produtos bp on bp.codigo = it.codigo
      left join public.products p on p.code = it.codigo
  loop
    if r.preco_peca is null or r.ativo is not true then
      return json_build_object('erro', 'produto', 'codigo', r.codigo);
    end if;
    if r.estoque_caixas is not null and r.vendidas + r.caixas > r.estoque_caixas then
      return json_build_object('erro', 'estoque', 'codigo', r.codigo, 'disponivel', greatest(r.estoque_caixas - r.vendidas, 0));
    end if;
    v_tot := v_tot + r.caixas * r.pc * r.preco_peca; v_cx := v_cx + r.caixas; v_pc := v_pc + r.caixas * r.pc;
  end loop;

  if v_tot < v_cfg.pedido_minimo then
    return json_build_object('erro', 'minimo', 'total', v_tot, 'minimo', v_cfg.pedido_minimo);
  end if;

  insert into public.black_pedidos (inscrito_id, cnpj, razao_social, fantasia, cidade, uf, representante, comprador,
                                    email, celular, observacao, caixas, pecas, total, frete)
  values (v_i.id, v_i.cnpj, v_i.razao_social, v_i.fantasia, v_i.cidade, v_i.uf, v_i.representante,
          coalesce(nullif(trim(p_comprador), ''), v_i.comprador), v_i.email, v_i.celular, coalesce(p_obs, ''),
          v_cx, v_pc, v_tot, public.black_frete(v_i.uf, v_i.cidade, v_tot))
  returning id, numero into v_ped, v_num;

  insert into public.black_pedido_itens (pedido_id, codigo, nome, caixas, pecas_caixa, preco_peca, total)
  select v_ped, it.codigo, coalesce(nullif(p.packaging_name, ''), p.name, it.codigo), it.caixas,
         coalesce(bp.caixa_qtd, p.carton_quantity, 1), public.black_preco(it.codigo, v_i.uf),
         it.caixas * coalesce(bp.caixa_qtd, p.carton_quantity, 1) * public.black_preco(it.codigo, v_i.uf)
    from _itens it
    join public.black_produtos bp on bp.codigo = it.codigo
    left join public.products p on p.code = it.codigo;

  return json_build_object('numero', v_num, 'caixas', v_cx, 'pecas', v_pc, 'total', v_tot,
                           'frete', public.black_frete(v_i.uf, v_i.cidade, v_tot), 'representante', v_i.representante);
end
$fn$;

create or replace function public.black_meus_pedidos(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  select coalesce(json_agg(json_build_object(
      'numero', pd.numero, 'criado_em', pd.criado_em, 'caixas', pd.caixas, 'total', pd.total, 'status', pd.status,
      'itens', (select json_agg(json_build_object('codigo', it.codigo, 'nome', it.nome, 'caixas', it.caixas,
                                                  'pecas_caixa', it.pecas_caixa, 'preco_peca', it.preco_peca, 'total', it.total))
                  from public.black_pedido_itens it where it.pedido_id = pd.id))
    order by pd.criado_em desc), '[]'::json)
  from public.black_pedidos pd
  where pd.inscrito_id = public.black_inscrito_da_sessao(p_token);
$fn$;

-- troca de senha: a equipe gera o link no Hub e manda pelo WhatsApp/e-mail; o lojista define a nova
create or replace function public.black_senha_link(p_inscrito uuid)
returns text language plpgsql security definer set search_path = public, extensions
as $fn$
declare v text;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  v := encode(gen_random_bytes(24), 'hex');
  update public.black_credenciais set reset_token = v, reset_ate = now() + interval '3 days' where inscrito_id = p_inscrito;
  if not found then
    insert into public.black_credenciais (inscrito_id, senha_hash, reset_token, reset_ate)
    values (p_inscrito, crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')), v, now() + interval '3 days');
  end if;
  return v;
end
$fn$;
revoke all on function public.black_senha_link(uuid) from public, anon;
grant execute on function public.black_senha_link(uuid) to authenticated;

create or replace function public.black_senha_definir(p_reset text, p_senha text)
returns json language plpgsql security definer set search_path = public, extensions
as $fn$
declare v_id uuid;
begin
  if length(coalesce(p_senha, '')) < 6 then return json_build_object('erro', 'senha_curta'); end if;
  select inscrito_id into v_id from public.black_credenciais
   where reset_token = p_reset and reset_ate > now();
  if v_id is null then return json_build_object('erro', 'link'); end if;
  update public.black_credenciais
     set senha_hash = crypt(p_senha, gen_salt('bf')), reset_token = null, reset_ate = null
   where inscrito_id = v_id;
  delete from public.black_sessoes where inscrito_id = v_id;
  return json_build_object('ok', true, 'cnpj', (select cnpj from public.black_inscritos where id = v_id));
end
$fn$;

-- decisão da equipe sobre um cadastro em análise (ou reabrir um recusado)
create or replace function public.black_decidir(p_inscrito uuid, p_status text, p_motivo text)
returns void language plpgsql security definer set search_path = public
as $fn$
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  if p_status not in ('aprovado', 'analise', 'recusado') then raise exception 'status inválido'; end if;
  update public.black_inscritos
     set status = p_status, motivo = coalesce(p_motivo, ''), decidido_em = now(), decidido_por = auth.uid()
   where id = p_inscrito;
  if p_status <> 'aprovado' then delete from public.black_sessoes where inscrito_id = p_inscrito; end if;
end
$fn$;
revoke all on function public.black_decidir(uuid, text, text) from public, anon;
grant execute on function public.black_decidir(uuid, text, text) to authenticated;

-- importação da carteira (CSV lido no navegador): substitui ou acrescenta, sempre pela equipe
create or replace function public.black_carteira_importar(p_linhas jsonb, p_substituir boolean)
returns json language plpgsql security definer set search_path = public
as $fn$
declare n int;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  if p_substituir then
    update public.black_inscritos set carteira_id = null where carteira_id is not null;
    delete from public.black_carteira;
  end if;
  -- uma linha por (razão social normalizada, UF): o painel às vezes repete o cliente; CNPJ repetido fica só na 1ª
  with x as (
    select trim(j->>'razao_social') as razao_social, nullif(public.black_so_digitos(j->>'cnpj'), '') as cnpj,
           coalesce(j->>'fantasia', '') as fantasia, coalesce(j->>'cidade', '') as cidade,
           upper(trim(coalesce(j->>'uf', ''))) as uf, coalesce(j->>'representante', '') as representante,
           coalesce(j->>'grupo', '') as grupo, coalesce(j->>'situacao', '') as situacao,
           round(nullif(j->>'dias_sem_compra', '')::numeric)::int as dias_sem_compra,
           nullif(j->>'faturamento_12m', '')::numeric as faturamento_12m, ord
      from jsonb_array_elements(p_linhas) with ordinality as e(j, ord)
     where coalesce(trim(j->>'razao_social'), '') <> ''
  ), u as (
    select distinct on (public.black_norm(razao_social), uf) * from x
     order by public.black_norm(razao_social), uf, faturamento_12m desc nulls last, ord
  ), c as (
    select u.*, case when u.cnpj is not null
                      and row_number() over (partition by u.cnpj order by u.ord) = 1
                      and not exists (select 1 from public.black_carteira b
                                       where b.cnpj = u.cnpj and (b.razao_norm, b.uf) <> (public.black_norm(u.razao_social), u.uf))
                     then u.cnpj end as cnpj_ok
      from u
  )
  insert into public.black_carteira (razao_social, cnpj, fantasia, cidade, uf, representante, grupo, situacao,
                                     dias_sem_compra, faturamento_12m)
  select razao_social, cnpj_ok, fantasia, cidade, uf, representante, grupo, situacao, dias_sem_compra, faturamento_12m
    from c
  on conflict (razao_norm, uf) do update
     set cnpj = coalesce(excluded.cnpj, public.black_carteira.cnpj),
         fantasia = case when excluded.fantasia <> '' then excluded.fantasia else public.black_carteira.fantasia end,
         cidade = case when excluded.cidade <> '' then excluded.cidade else public.black_carteira.cidade end,
         representante = excluded.representante, grupo = excluded.grupo, situacao = excluded.situacao,
         dias_sem_compra = excluded.dias_sem_compra, faturamento_12m = excluded.faturamento_12m,
         importado_em = now();
  get diagnostics n = row_count;
  return json_build_object('linhas', n, 'total', (select count(*) from public.black_carteira));
end
$fn$;
revoke all on function public.black_carteira_importar(jsonb, boolean) from public, anon;
grant execute on function public.black_carteira_importar(jsonb, boolean) to authenticated;


-- arquivo do Drive que a ficha pode mostrar sem login: material liberado de um produto ativo da Black
create or replace function public.black_midia_liberada(p_file text)
returns boolean language sql stable security definer set search_path = public
as $fn$
  select length(coalesce(p_file, '')) >= 20 and exists (
    select 1 from public.content_materials m
      join public.products p on p.id = m.product_id
      join public.black_produtos bp on bp.codigo = p.code and bp.ativo
     where m.status = 'liberado' and position(p_file in m.drive_url) > 0);
$fn$;

-- públicas: anon e authenticated
grant execute on function public.black_config_publica() to anon, authenticated;
grant execute on function public.black_login(text, text) to anon, authenticated;
grant execute on function public.black_sair(text) to anon, authenticated;
grant execute on function public.black_sessao(text) to anon, authenticated;
grant execute on function public.black_catalogo(text) to anon, authenticated;
grant execute on function public.black_produto(text, text) to anon, authenticated;
grant execute on function public.black_pedido_enviar(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.black_meus_pedidos(text) to anon, authenticated;
grant execute on function public.black_senha_definir(text, text) to anon, authenticated;
grant execute on function public.black_midia_liberada(text) to anon, authenticated;

commit;
