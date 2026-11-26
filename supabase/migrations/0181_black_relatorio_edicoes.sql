-- Cardoso Black: relatório de carrinhos de uma edição arquivada (black_arq_*), para ver a 1ª edição no Hub.
-- Só leitura e só para a equipe da Black. Não mexe em nenhuma tabela nem na edição em andamento.
-- Mesmo formato de black_carrinhos_relatorio(): a aba Carrinhos e o Relatório da diretoria usam os dois.
-- Edição encerrada não tem carrinho "em andamento": o que não virou pedido aparece como abandonado.
-- Valor do carrinho: preço da peça na lista da edição; sem ele, o preço médio pago nos pedidos da edição.

create or replace function public.black_carrinhos_relatorio_arq(p_edicao text)
returns json language sql stable security definer set search_path = public
as $fn$
  select case when not public.black_staff() then '[]'::json else coalesce((
    select json_agg(x order by x.atualizado_em desc) from (
      select c.id, c.criado_em, c.atualizado_em, c.visto_em, c.finalizado_em,
             case when c.status = 'finalizado' then 'finalizado'
                  when c.itens = '{}'::jsonb then 'vazio'
                  else 'abandonado' end as situacao,
             i.fantasia, i.razao_social, i.cnpj, i.cidade, i.uf, i.representante, i.comprador, i.celular, i.email,
             pd.numero as pedido,
             (select coalesce(sum(e.value::int), 0) from jsonb_each_text(c.itens) e) as caixas,
             (select coalesce(sum(e.value::int * coalesce(bp.caixa_qtd, p.carton_quantity, 1)
                       * coalesce(bp.preco_peca, (select avg(pi.preco_peca) from public.black_arq_pedido_itens pi
                                                   where pi.edicao = p_edicao and pi.codigo = e.key), 0)), 0)
                from jsonb_each_text(c.itens) e
                left join public.black_arq_produtos bp on bp.edicao = p_edicao and bp.codigo = e.key
                left join public.products p on p.code = e.key) as valor,
             (select coalesce(json_agg(json_build_object('codigo', e.key, 'nome', coalesce(nullif(bp.nome, ''), nullif(p.packaging_name, ''), p.name, e.key), 'caixas', e.value::int) order by bp.ordem), '[]'::json)
                from jsonb_each_text(c.itens) e
                left join public.black_arq_produtos bp on bp.edicao = p_edicao and bp.codigo = e.key
                left join public.products p on p.code = e.key) as itens,
             (select count(*) from public.black_arq_carrinho_eventos ev where ev.edicao = p_edicao and ev.carrinho_id = c.id) as mudancas,
             (select coalesce(json_agg(json_build_object('codigo', ev.codigo, 'max', ev.mx)), '[]'::json)
                from (select ev.codigo, max(greatest(ev.de, ev.para)) as mx from public.black_arq_carrinho_eventos ev
                       where ev.edicao = p_edicao and ev.carrinho_id = c.id group by ev.codigo
                      having max(greatest(ev.de, ev.para)) > coalesce((c.itens ->> ev.codigo)::int, 0)) ev) as retirados
        from public.black_arq_carrinhos c
        join public.black_arq_inscritos i on i.edicao = p_edicao and i.id = c.inscrito_id
        left join public.black_arq_pedidos pd on pd.edicao = p_edicao and pd.id = c.pedido_id
       where c.edicao = p_edicao and coalesce(i.origem, '') <> 'previa'
    ) x), '[]'::json) end;
$fn$;
revoke all on function public.black_carrinhos_relatorio_arq(text) from public, anon;
grant execute on function public.black_carrinhos_relatorio_arq(text) to authenticated;
