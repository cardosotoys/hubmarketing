-- Cardoso Marketing Hub — estoque do Guarani em tempo real para a Cardoso Black
--
-- Durante a Black os outros pedidos da Cardoso continuam saindo do mesmo estoque. Então o disponível
-- de cada produto na Black passa a ser o MENOR entre:
--   a) o saldo do Guarani (em caixas)  −  os pedidos da Black que ainda não estão no Guarani
--   b) a cota da Black (black_produtos.estoque_caixas)  −  tudo o que a Black já vendeu   (opcional)
-- Vazio nos dois = sem limite.
--
-- "Ainda não está no Guarani" = pedido da Black com status Recebido, ou Confirmado depois da última
-- leitura do estoque. Regra de operação: confirmar no Hub quando o pedido for lançado no Guarani.
--
-- O saldo chega por:
--   • Hub → Cardoso Black → Produtos → "Atualizar estoque do Guarani" (CSV exportado do Guarani), ou
--   • função black-estoque (POST com chave), para a integração automática com o Guarani.
-- Pode rodar de novo sem apagar nada.

create table if not exists public.estoque_guarani (
  codigo text primary key,
  codigo_norm text generated always as (ltrim(trim(codigo), '0')) stored,
  pecas numeric(14, 2) not null,
  atualizado_em timestamptz not null default now(),
  origem text not null default ''
);
create index if not exists estoque_guarani_norm on public.estoque_guarani (codigo_norm);
comment on table public.estoque_guarani is
  'Saldo de estoque por código vindo do Guarani (em peças). Atualizado por CSV no módulo Cardoso Black ou pela função black-estoque.';

alter table public.estoque_guarani enable row level security;
drop policy if exists estoque_guarani_staff on public.estoque_guarani;
create policy estoque_guarani_staff on public.estoque_guarani for select to authenticated using (public.black_staff());
revoke all on public.estoque_guarani from anon;

-- disponível de um produto na Black, em caixas (null = sem limite)
create or replace function public.black_disponivel(p_codigo text)
returns integer language sql stable security definer set search_path = public
as $fn$
  with b as (
    select bp.codigo, bp.estoque_caixas, greatest(coalesce(bp.caixa_qtd, p.carton_quantity, 1), 1) as caixa
      from public.black_produtos bp left join public.products p on p.code = bp.codigo
     where bp.codigo = p_codigo),
  g as (
    select e.pecas, e.atualizado_em from public.estoque_guarani e, b
     where e.codigo_norm = ltrim(trim(b.codigo), '0')
     order by e.atualizado_em desc limit 1),
  vend as (
    select coalesce(sum(it.caixas) filter (where pd.status <> 'cancelado'), 0) as todas,
           coalesce(sum(it.caixas) filter (where pd.status = 'recebido'
                    or (pd.status = 'confirmado' and pd.atualizado_em > (select atualizado_em from g))), 0) as fora_guarani
      from public.black_pedido_itens it join public.black_pedidos pd on pd.id = it.pedido_id
     where it.codigo = p_codigo)
  select case
           when (select estoque_caixas from b) is null and not exists (select 1 from g) then null
           else greatest(0, least(
             case when exists (select 1 from g)
                  then floor((select pecas from g) / (select caixa from b))::int - (select fora_guarani from vend) end,
             case when (select estoque_caixas from b) is not null
                  then (select estoque_caixas from b) - (select todas from vend) end))
         end;
$fn$;
revoke all on function public.black_disponivel(text) from public, anon;

-- recebe o saldo do Guarani: [{codigo, pecas}] — pela equipe (CSV no Hub) ou pela função black-estoque
create or replace function public.estoque_guarani_atualizar(p_linhas jsonb, p_origem text default 'csv')
returns json language plpgsql security definer set search_path = public
as $fn$
declare n int;
begin
  -- equipe pelo Hub, ou a função black-estoque (chave de serviço)
  if not (public.black_staff()
          or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                      (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role'), '') = 'service_role')
  then raise exception 'sem permissão'; end if;
  insert into public.estoque_guarani (codigo, pecas, atualizado_em, origem)
  select distinct on (trim(j->>'codigo')) trim(j->>'codigo'),
         greatest(coalesce(nullif(case when j->>'pecas' like '%,%' then replace(replace(j->>'pecas', '.', ''), ',', '.')
                                        else j->>'pecas' end, '')::numeric, 0), 0), now(), coalesce(p_origem, '')
    from jsonb_array_elements(coalesce(p_linhas, '[]')) as j
   where coalesce(trim(j->>'codigo'), '') <> ''
  on conflict (codigo) do update set pecas = excluded.pecas, atualizado_em = excluded.atualizado_em, origem = excluded.origem;
  get diagnostics n = row_count;
  return json_build_object('linhas', n, 'em', now());
end
$fn$;
revoke all on function public.estoque_guarani_atualizar(jsonb, text) from public, anon;
grant execute on function public.estoque_guarani_atualizar(jsonb, text) to authenticated, service_role;

-- visão da equipe: saldo do Guarani e disponível na Black, por produto
create or replace function public.black_disponibilidade()
returns json language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  return (select coalesce(json_agg(json_build_object(
      'codigo', bp.codigo,
      'guarani_pecas', g.pecas, 'guarani_em', g.atualizado_em,
      'disponivel', public.black_disponivel(bp.codigo))), '[]'::json)
    from public.black_produtos bp
    left join lateral (select e.pecas, e.atualizado_em from public.estoque_guarani e
                        where e.codigo_norm = ltrim(trim(bp.codigo), '0') order by e.atualizado_em desc limit 1) g on true);
end
$fn$;
revoke all on function public.black_disponibilidade() from public, anon;
grant execute on function public.black_disponibilidade() to authenticated;

-- catálogo, ficha e pedido passam a usar o disponível único
create or replace function public.black_catalogo(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  with logado as (select i.uf, true as ok from public.black_inscritos i where i.id = public.black_inscrito_da_sessao(p_token))
  select coalesce(json_agg(json_build_object(
      'codigo', bp.codigo, 'ordem', bp.ordem, 'nome', coalesce(nullif(p.packaging_name, ''), p.name, bp.codigo),
      'familia', coalesce(nullif(bp.familia, ''), p.line, ''),
      'caixa', coalesce(bp.caixa_qtd, p.carton_quantity, 1),
      'preco_peca', case when (select ok from logado) and now() >= (select abre_em from public.black_config where id = 1)
                         then public.black_preco(bp.codigo, (select uf from logado)) end,
      'disponivel', public.black_disponivel(bp.codigo),
      'imagem', coalesce(p.image_url, ''), 'embalagem', coalesce(p.packaging_image_url, ''))
    order by bp.ordem, bp.codigo), '[]'::json)
  from public.black_produtos bp
  left join public.products p on p.code = bp.codigo
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
    'disponivel', public.black_disponivel(bp.codigo),
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
  v_ped uuid; v_num text; v_tot numeric := 0; v_cx int := 0; v_pc int := 0; r record; v_disp int;
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
  perform 1 from public.black_produtos where codigo in (select codigo from _itens) order by codigo for update;

  for r in
    select it.codigo, it.caixas, public.black_preco(it.codigo, v_i.uf) as preco_peca, bp.ativo,
           coalesce(bp.caixa_qtd, p.carton_quantity, 1) as pc
      from _itens it
      left join public.black_produtos bp on bp.codigo = it.codigo
      left join public.products p on p.code = it.codigo
  loop
    if r.preco_peca is null or r.ativo is not true then
      return json_build_object('erro', 'produto', 'codigo', r.codigo);
    end if;
    v_disp := public.black_disponivel(r.codigo);
    if v_disp is not null and r.caixas > v_disp then
      return json_build_object('erro', 'estoque', 'codigo', r.codigo, 'disponivel', v_disp);
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
