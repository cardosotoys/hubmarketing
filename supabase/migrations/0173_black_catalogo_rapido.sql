-- Cardoso Black: catálogo mais rápido para a hora da live (100+ clientes ao mesmo tempo).
-- A versão anterior chamava várias funções por produto (sessão, prévia, estoque, reservas): ~0,7 s por chamada.
-- Esta calcula tudo de uma vez (vendas, estoque do Guarani e reservas agrupados), com o mesmo resultado.
begin;

create index if not exists black_pedido_itens_codigo on public.black_pedido_itens (codigo);
create index if not exists black_carrinhos_abertos on public.black_carrinhos (visto_em) where status = 'aberto';

create or replace function public.black_catalogo(p_token text)
returns json language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_ins uuid; v_uf text; v_ver boolean; v_min int;
begin
  if not public.black_vitrine_liberada(p_token) then return '[]'::json; end if;
  v_ins := public.black_inscrito_da_sessao(p_token);
  select uf into v_uf from public.black_inscritos where id = v_ins;
  v_ver := v_ins is not null and public.black_preco_visivel(p_token);
  select reserva_min into v_min from public.black_config where id = 1;

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
        'preco_peca', case when v_ver then coalesce(b.preco_peca, public.black_preco(b.codigo, v_uf)) end,
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
