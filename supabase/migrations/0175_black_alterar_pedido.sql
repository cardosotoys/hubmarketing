-- Cardoso Black: o cliente altera o próprio pedido até o fechamento.
-- O pedido mantém o número e ganha uma nova versão; o Hub mostra o que mudou (entrou, saiu, mudou a quantidade).
-- Mesmas regras do envio: mínimo, limite 0300/0301 e estoque (o que já estava no pedido conta como dele).
-- Pode rodar de novo sem apagar nada.

alter table public.black_pedidos add column if not exists versao int not null default 1;
alter table public.black_pedidos add column if not exists alterado_em timestamptz;
alter table public.black_pedidos add column if not exists alteracoes jsonb;            -- o que mudou na última alteração
alter table public.black_pedidos add column if not exists historico jsonb not null default '[]'::jsonb; -- versões anteriores

create or replace function public.black_pedido_alterar(p_token text, p_numero text, p_itens jsonb)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_ins uuid := public.black_inscrito_da_sessao(p_token);
  v_i public.black_inscritos; v_cfg public.black_config; v_p public.black_pedidos;
  v_tot numeric := 0; v_ipi numeric := 0; v_cx int := 0; v_pc int := 0; r record; v_disp int; v_lim numeric := 0;
  v_dif jsonb; v_antes jsonb;
begin
  if v_ins is null then return json_build_object('erro', 'sessao'); end if;
  if public.black_eh_previa(p_token) then return json_build_object('erro', 'previa'); end if;
  select * into v_cfg from public.black_config where id = 1;
  if now() > v_cfg.fecha_em then return json_build_object('erro', 'encerrado'); end if;
  select * into v_i from public.black_inscritos where id = v_ins;
  select * into v_p from public.black_pedidos where numero = p_numero and inscrito_id = v_ins for update;
  if v_p.id is null then return json_build_object('erro', 'pedido'); end if;
  if v_p.status = 'cancelado' then return json_build_object('erro', 'cancelado'); end if;

  drop table if exists _novos;
  create temp table _novos on commit drop as
  select x.codigo, sum(x.caixas)::int as caixas
    from jsonb_to_recordset(coalesce(p_itens, '[]')) as x(codigo text, caixas int)
   where x.caixas > 0
   group by x.codigo;
  if not exists (select 1 from _novos) then return json_build_object('erro', 'vazio'); end if;

  perform 1 from public.black_produtos where codigo in (select codigo from _novos) order by codigo for update;

  for r in
    select it.codigo, it.caixas, public.black_preco(it.codigo, v_i.uf) as preco_peca, bp.ativo,
           coalesce(bp.caixa_qtd, p.carton_quantity, 1) as pc,
           coalesce((select sum(o.caixas) from public.black_pedido_itens o where o.pedido_id = v_p.id and o.codigo = it.codigo), 0)::int as ja
      from _novos it
      left join public.black_produtos bp on bp.codigo = it.codigo
      left join public.products p on p.code = it.codigo
  loop
    if r.preco_peca is null or (r.ativo is not true and r.caixas > r.ja) then
      return json_build_object('erro', 'produto', 'codigo', r.codigo);
    end if;
    -- só o que passa do que já estava no pedido precisa de estoque livre
    if r.caixas > r.ja then
      v_disp := public.black_disponivel_para(r.codigo, v_ins);
      if v_disp is not null and r.caixas - r.ja > v_disp then
        return json_build_object('erro', 'estoque', 'codigo', r.codigo, 'disponivel', v_disp + r.ja);
      end if;
    end if;
    v_tot := v_tot + r.caixas * r.pc * r.preco_peca; v_cx := v_cx + r.caixas; v_pc := v_pc + r.caixas * r.pc;
  end loop;

  if v_tot < v_cfg.pedido_minimo then
    return json_build_object('erro', 'minimo', 'total', v_tot, 'minimo', v_cfg.pedido_minimo);
  end if;
  select coalesce(sum(it.caixas * coalesce(bp.caixa_qtd, p.carton_quantity, 1) * public.black_preco(it.codigo, v_i.uf)), 0)
    into v_lim
    from _novos it join public.black_produtos bp on bp.codigo = it.codigo left join public.products p on p.code = it.codigo
   where public.black_limitado(it.codigo);
  if v_lim > v_tot * coalesce(v_cfg.limite_pct, 10) / 100 then
    return json_build_object('erro', 'limite', 'valor', v_lim, 'maximo', round(v_tot * coalesce(v_cfg.limite_pct, 10) / 100, 2));
  end if;
  v_ipi := round(v_tot * coalesce(v_cfg.ipi_pct, 0) / 100, 2);

  -- o que mudou: entrou, saiu ou mudou a quantidade
  select coalesce(jsonb_agg(jsonb_build_object('codigo', d.codigo, 'nome', d.nome, 'de', d.de, 'para', d.para) order by d.codigo), '[]'::jsonb)
    into v_dif
    from (
      select coalesce(n.codigo, o.codigo) as codigo,
             coalesce(o.nome, (select coalesce(nullif(p.packaging_name, ''), p.name) from public.products p where p.code = n.codigo), n.codigo) as nome,
             coalesce(o.caixas, 0) as de, coalesce(n.caixas, 0) as para
        from _novos n
        full join (select codigo, max(nome) as nome, sum(caixas)::int as caixas from public.black_pedido_itens where pedido_id = v_p.id group by codigo) o
          on o.codigo = n.codigo
    ) d where d.de <> d.para;
  if jsonb_array_length(v_dif) = 0 then return json_build_object('erro', 'igual'); end if;

  select jsonb_build_object('versao', v_p.versao, 'em', coalesce(v_p.alterado_em, v_p.criado_em), 'caixas', v_p.caixas, 'total', v_p.total,
           'itens', coalesce((select jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'caixas', caixas, 'pecas_caixa', pecas_caixa,
                                                                  'preco_peca', preco_peca, 'total', total)) from public.black_pedido_itens where pedido_id = v_p.id), '[]'::jsonb))
    into v_antes;

  delete from public.black_pedido_itens where pedido_id = v_p.id;
  insert into public.black_pedido_itens (pedido_id, codigo, nome, caixas, pecas_caixa, preco_peca, total)
  select v_p.id, it.codigo, coalesce(nullif(p.packaging_name, ''), p.name, it.codigo), it.caixas,
         coalesce(bp.caixa_qtd, p.carton_quantity, 1), public.black_preco(it.codigo, v_i.uf),
         it.caixas * coalesce(bp.caixa_qtd, p.carton_quantity, 1) * public.black_preco(it.codigo, v_i.uf)
    from _novos it
    join public.black_produtos bp on bp.codigo = it.codigo
    left join public.products p on p.code = it.codigo;

  -- volta para "a confirmar": o representante precisa ver a versão nova
  update public.black_pedidos
     set caixas = v_cx, pecas = v_pc, total = v_tot, ipi = v_ipi, frete = public.black_frete(v_i.uf, v_i.cidade, v_tot),
         versao = versao + 1, alterado_em = now(), alteracoes = v_dif, historico = historico || jsonb_build_array(v_antes),
         status = 'recebido', atualizado_em = now()
   where id = v_p.id;

  -- o carrinho que sobrou aberto não reserva mais nada
  update public.black_carrinhos set itens = '{}'::jsonb, atualizado_em = now() where inscrito_id = v_ins and status = 'aberto';

  return json_build_object('numero', v_p.numero, 'versao', v_p.versao + 1, 'caixas', v_cx, 'total', v_tot, 'ipi', v_ipi,
                           'total_com_ipi', v_tot + v_ipi, 'alteracoes', v_dif);
end
$fn$;
revoke all on function public.black_pedido_alterar(text, text, jsonb) from public;
grant execute on function public.black_pedido_alterar(text, text, jsonb) to anon, authenticated;

create or replace function public.black_meus_pedidos(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  select coalesce(json_agg(json_build_object(
      'numero', pd.numero, 'criado_em', pd.criado_em, 'caixas', pd.caixas, 'total', pd.total,
      'ipi', pd.ipi, 'total_com_ipi', pd.total_com_ipi, 'status', pd.status, 'versao', pd.versao, 'alterado_em', pd.alterado_em,
      'itens', (select json_agg(json_build_object('codigo', it.codigo, 'nome', it.nome, 'caixas', it.caixas,
                                                  'pecas_caixa', it.pecas_caixa, 'preco_peca', it.preco_peca, 'total', it.total))
                  from public.black_pedido_itens it where it.pedido_id = pd.id))
    order by pd.criado_em desc), '[]'::json)
  from public.black_pedidos pd
  where pd.inscrito_id = public.black_inscrito_da_sessao(p_token);
$fn$;
grant execute on function public.black_meus_pedidos(text) to anon, authenticated;
