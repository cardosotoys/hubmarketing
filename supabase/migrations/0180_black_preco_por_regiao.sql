-- Cardoso Black: preço por região (Black Varejo, 24/11).
-- O preço fixo da Black (black_produtos.preco_peca) é o de São Paulo. Para as outras UFs aplica o desconto
-- da região, produto a produto, arredondado ao centavo: Sul, RJ e MG −6%; Norte, Nordeste, Centro-Oeste e ES −9%.
-- A UF é a do cadastro do cliente (black_inscritos.uf). Vale para a vitrine, a ficha, o carrinho e o pedido,
-- porque todos usam black_preco(). Os percentuais ficam em black_config.desconto_regiao (UF → %).
begin;

alter table public.black_config add column if not exists desconto_regiao jsonb not null default '{}'::jsonb;

update public.black_config set desconto_regiao = jsonb_build_object(
  'PR', 6, 'SC', 6, 'RS', 6, 'RJ', 6, 'MG', 6,
  'AC', 9, 'AP', 9, 'AM', 9, 'PA', 9, 'RO', 9, 'RR', 9, 'TO', 9,
  'AL', 9, 'BA', 9, 'CE', 9, 'MA', 9, 'PB', 9, 'PE', 9, 'PI', 9, 'RN', 9, 'SE', 9,
  'ES', 9,
  'GO', 9, 'MT', 9, 'MS', 9, 'DF', 9)
where id = 1;

-- % de desconto da região de uma UF (0 = preço de SP)
create or replace function public.black_desconto_regiao(p_uf text)
returns numeric language sql stable security definer set search_path = public
as $fn$
  select coalesce((select nullif(c.desconto_regiao ->> upper(trim(coalesce(p_uf, ''))), '')::numeric
                     from public.black_config c where c.id = 1), 0);
$fn$;
revoke all on function public.black_desconto_regiao(text) from public, anon;
grant execute on function public.black_desconto_regiao(text) to authenticated;

-- preço Black de um produto para uma UF: fixo com o desconto da região, ou Tabela de Preços da região - desconto
create or replace function public.black_preco(p_codigo text, p_uf text)
returns numeric language sql stable security definer set search_path = public
as $fn$
  select case
    when bp.preco_peca is not null then round(bp.preco_peca * (1 - public.black_desconto_regiao(p_uf) / 100), 2)
    else round((select i.preco from public.price_table_items i
                 join public.price_tables t on t.id = i.price_table_id
                where i.codigo = bp.codigo and t.vigente_ate is null and upper(p_uf) = any (t.ufs)
                order by (t.simples is null) desc, t.nome
                limit 1)
               * (1 - coalesce(bp.desconto_pct, (select desconto_pct from public.black_config where id = 1), 0) / 100), 2)
  end
  from public.black_produtos bp where bp.codigo = p_codigo;
$fn$;
revoke all on function public.black_preco(text, text) from public, anon;
grant execute on function public.black_preco(text, text) to authenticated;

-- vitrine: mesmo cálculo, com o desconto da região do cliente
create or replace function public.black_catalogo(p_token text)
returns json language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_ins uuid; v_uf text; v_ver boolean; v_min int; v_reg numeric;
begin
  if not public.black_vitrine_liberada(p_token) then return '[]'::json; end if;
  v_ins := public.black_inscrito_da_sessao(p_token);
  select uf into v_uf from public.black_inscritos where id = v_ins;
  v_ver := v_ins is not null and public.black_preco_visivel(p_token);
  select reserva_min into v_min from public.black_config where id = 1;
  v_reg := public.black_desconto_regiao(v_uf);

  return (
    with b as (
      select bp.codigo, bp.ordem, bp.nome, bp.familia, bp.preco_peca, bp.preco_tabela, bp.estoque_caixas, bp.caixa_qtd,
             p.name, p.packaging_name, p.line, p.carton_quantity, p.image_url, p.packaging_image_url,
             greatest(coalesce(bp.caixa_qtd, p.carton_quantity, 1), 1) as cx
        from public.black_produtos bp
        left join public.products p on p.code = bp.codigo
       where bp.ativo),
    g as (
      select distinct on (e.codigo_norm) e.codigo_norm, e.pecas, e.atualizado_em
        from public.estoque_guarani e
       where e.codigo_norm in (select ltrim(trim(codigo), '0') from b)
       order by e.codigo_norm, e.atualizado_em desc),
    vend as (
      select it.codigo,
             coalesce(sum(it.caixas) filter (where pd.status <> 'cancelado'), 0) as todas,
             coalesce(sum(it.caixas) filter (where pd.status = 'recebido'
                      or (pd.status = 'confirmado' and pd.atualizado_em > g.atualizado_em)), 0) as fora
        from public.black_pedido_itens it
        join public.black_pedidos pd on pd.id = it.pedido_id
        left join g on g.codigo_norm = ltrim(trim(it.codigo), '0')
       group by it.codigo),
    res as (
      select e.key as codigo, sum(e.value::int) as cx
        from public.black_carrinhos c, jsonb_each_text(c.itens) e
       where c.status = 'aberto' and c.visto_em > now() - make_interval(mins => v_min)
         and c.inscrito_id is distinct from v_ins
       group by e.key)
    select coalesce(json_agg(json_build_object(
        'codigo', b.codigo, 'ordem', b.ordem, 'nome', coalesce(nullif(b.nome, ''), nullif(b.packaging_name, ''), b.name, b.codigo),
        'familia', coalesce(nullif(b.familia, ''), b.line, ''),
        'caixa', coalesce(b.caixa_qtd, b.carton_quantity, 1),
        'preco_peca', case when v_ver then case when b.preco_peca is not null then round(b.preco_peca * (1 - v_reg / 100), 2)
                                               else public.black_preco(b.codigo, v_uf) end end,
        'preco_tabela', case when v_ver then b.preco_tabela end,
        'disponivel', case
           when b.estoque_caixas is null and g.pecas is null then null
           else greatest(0, least(
                  case when g.pecas is not null then floor(g.pecas / b.cx)::int - coalesce(v.fora, 0) end,
                  case when b.estoque_caixas is not null then b.estoque_caixas - coalesce(v.todas, 0) end)
                - coalesce(r.cx, 0)) end,
        'imagem', coalesce(b.image_url, ''), 'embalagem', coalesce(b.packaging_image_url, ''))
      order by b.ordem, b.codigo), '[]'::json)
      from b
      left join g on g.codigo_norm = ltrim(trim(b.codigo), '0')
      left join vend v on v.codigo = b.codigo
      left join res r on r.codigo = b.codigo
  );
end
$fn$;
grant execute on function public.black_catalogo(text) to anon, authenticated;

commit;
