-- Cardoso Black: preços líquidos (TAB 225 LIVE BLACK) + IPI de 6,5% somado só no fechamento, sobre o pedido inteiro.
-- black_pedidos.total continua sendo o valor dos produtos (base do mínimo de R$ 2.500 e do frete grátis);
-- ipi e total_com_ipi guardam o imposto e o valor final do pedido.
-- black_produtos.preco_tabela: preço da tabela atual, para mostrar “de/por” e o % de desconto.
-- black_produtos.nome: nome de vitrine da Black (da TAB); quando vazio, usa o nome do cadastro do produto.
begin;

alter table public.black_config add column if not exists ipi_pct numeric(5, 2) not null default 6.5
  check (ipi_pct >= 0 and ipi_pct < 100);
alter table public.black_pedidos add column if not exists ipi numeric(14, 2) not null default 0;
alter table public.black_pedidos add column if not exists total_com_ipi numeric(14, 2) generated always as (total + ipi) stored;

create or replace function public.black_config_publica()
returns json language sql stable security definer set search_path = public
as $fn$
  select json_build_object(
    'inscricoes_ate', inscricoes_ate, 'abre_em', abre_em, 'fecha_em', fecha_em,
    'pedido_minimo', pedido_minimo, 'frete_gratis_sp_rj', frete_gratis_sp_rj, 'live_data', live_data, 'ipi_pct', ipi_pct,
    'agora', now(), 'aberto', now() between abre_em and fecha_em, 'encerrado', now() > fecha_em)
  from public.black_config where id = 1;
$fn$;

create or replace function public.black_pedido_enviar(p_token text, p_itens jsonb, p_obs text, p_comprador text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_ins uuid := public.black_inscrito_da_sessao(p_token);
  v_i public.black_inscritos; v_cfg public.black_config;
  v_ped uuid; v_num text; v_tot numeric := 0; v_ipi numeric := 0; v_cx int := 0; v_pc int := 0; r record; v_disp int;
begin
  if v_ins is null then return json_build_object('erro', 'sessao'); end if;
  if public.black_eh_previa(p_token) then return json_build_object('erro', 'previa'); end if;
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

  -- preços da Black são líquidos; o IPI entra uma vez, sobre o pedido inteiro
  v_ipi := round(v_tot * coalesce(v_cfg.ipi_pct, 0) / 100, 2);

  insert into public.black_pedidos (inscrito_id, cnpj, razao_social, fantasia, cidade, uf, representante, comprador,
                                    email, celular, observacao, caixas, pecas, total, frete, ipi)
  values (v_i.id, v_i.cnpj, v_i.razao_social, v_i.fantasia, v_i.cidade, v_i.uf, v_i.representante,
          coalesce(nullif(trim(p_comprador), ''), v_i.comprador), v_i.email, v_i.celular, coalesce(p_obs, ''),
          v_cx, v_pc, v_tot, public.black_frete(v_i.uf, v_i.cidade, v_tot), v_ipi)
  returning id, numero into v_ped, v_num;

  insert into public.black_pedido_itens (pedido_id, codigo, nome, caixas, pecas_caixa, preco_peca, total)
  select v_ped, it.codigo, coalesce(nullif(p.packaging_name, ''), p.name, it.codigo), it.caixas,
         coalesce(bp.caixa_qtd, p.carton_quantity, 1), public.black_preco(it.codigo, v_i.uf),
         it.caixas * coalesce(bp.caixa_qtd, p.carton_quantity, 1) * public.black_preco(it.codigo, v_i.uf)
    from _itens it
    join public.black_produtos bp on bp.codigo = it.codigo
    left join public.products p on p.code = it.codigo;

  return json_build_object('numero', v_num, 'caixas', v_cx, 'pecas', v_pc, 'total', v_tot, 'ipi', v_ipi, 'total_com_ipi', v_tot + v_ipi,
                           'frete', public.black_frete(v_i.uf, v_i.cidade, v_tot), 'representante', v_i.representante);
end
$fn$;

create or replace function public.black_meus_pedidos(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  select coalesce(json_agg(json_build_object(
      'numero', pd.numero, 'criado_em', pd.criado_em, 'caixas', pd.caixas, 'total', pd.total,
      'ipi', pd.ipi, 'total_com_ipi', pd.total_com_ipi, 'status', pd.status,
      'itens', (select json_agg(json_build_object('codigo', it.codigo, 'nome', it.nome, 'caixas', it.caixas,
                                                  'pecas_caixa', it.pecas_caixa, 'preco_peca', it.preco_peca, 'total', it.total))
                  from public.black_pedido_itens it where it.pedido_id = pd.id))
    order by pd.criado_em desc), '[]'::json)
  from public.black_pedidos pd
  where pd.inscrito_id = public.black_inscrito_da_sessao(p_token);
$fn$;

alter table public.black_produtos add column if not exists nome text not null default '';
-- preço por peça na tabela atual (o “de” do “de/por”); só aparece junto com o preço da Black
alter table public.black_produtos add column if not exists preco_tabela numeric(12, 2) check (preco_tabela is null or preco_tabela > 0);

create or replace function public.black_catalogo(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  with logado as (select i.uf, true as ok from public.black_inscritos i where i.id = public.black_inscrito_da_sessao(p_token))
  select coalesce(json_agg(json_build_object(
      'codigo', bp.codigo, 'ordem', bp.ordem, 'nome', coalesce(nullif(bp.nome, ''), nullif(p.packaging_name, ''), p.name, bp.codigo),
      'familia', coalesce(nullif(bp.familia, ''), p.line, ''),
      'caixa', coalesce(bp.caixa_qtd, p.carton_quantity, 1),
      'preco_peca', case when (select ok from logado) and public.black_preco_visivel(p_token)
                         then public.black_preco(bp.codigo, (select uf from logado)) end,
      'preco_tabela', case when (select ok from logado) and public.black_preco_visivel(p_token) then bp.preco_tabela end,
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
    'nome', coalesce(nullif(bp.nome, ''), nullif(p.packaging_name, ''), p.name, bp.codigo),
    'familia', coalesce(nullif(bp.familia, ''), p.line, ''),
    'caixa', coalesce(bp.caixa_qtd, p.carton_quantity, 1),
    'preco_peca', case when v_ins is not null and public.black_preco_visivel(p_token)
                       then public.black_preco(bp.codigo, (select uf from public.black_inscritos where id = v_ins)) end,
    'preco_tabela', case when v_ins is not null and public.black_preco_visivel(p_token) then bp.preco_tabela end,
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
      select json_agg(json_build_object('tipo', m.kind, 'nome', m.name, 'link', m.drive_url, 'cache', '')
                      order by m.kind, m.name)
        from public.content_materials m
       where m.product_id = p.id and m.status = 'liberado'), '[]'::json))
  into v
  from public.black_produtos bp
  left join public.products p on p.code = bp.codigo
  where bp.codigo = p_codigo and bp.ativo;

  if v is null then return null; end if;
  if not public.black_eh_previa(p_token) then
    insert into public.black_eventos (tipo, codigo, inscrito_id) values ('ficha', p_codigo, v_ins);
  end if;
  return v;
end
$fn$;

-- live e abertura dos pedidos às 14h de 12/11 (antes 15h)
update public.black_config
   set abre_em = '2026-11-12 14:00:00-03', live_data = 'Quinta-feira, 12/11 · 14h', atualizado_em = now()
 where id = 1;

commit;
