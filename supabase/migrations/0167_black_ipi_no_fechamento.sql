-- Cardoso Black: preços líquidos (TAB 225 LIVE BLACK) + IPI de 6,5% somado só no fechamento, sobre o pedido inteiro.
-- black_pedidos.total continua sendo o valor dos produtos (base do mínimo de R$ 2.500 e do frete grátis);
-- ipi e total_com_ipi guardam o imposto e o valor final do pedido.
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

commit;
