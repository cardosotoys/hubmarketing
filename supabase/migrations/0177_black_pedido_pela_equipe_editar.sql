-- Cardoso Black: a equipe edita o pedido do cliente pelo Hub.
--   black_pedido_admin_itens  muda quantidades, inclui e tira produtos (vale depois do fechamento também).
--   black_pedido_admin_dados  corrige os dados do cliente no pedido e, se pedido, também no cadastro.
-- Mínimo, limite 0300/0301 e estoque são conferidos; se algo não bate, a função devolve o aviso
-- e a equipe pode confirmar "salvar mesmo assim" (p_forcar = true).
-- Itens que já estavam no pedido mantêm o preço do pedido; produto novo entra com o preço Black atual.
-- Toda edição fica registrada em black_pedidos.edicoes (quem, quando, o quê). Pode rodar de novo.

alter table public.black_pedidos add column if not exists edicoes jsonb not null default '[]'::jsonb;

create or replace function public.black_pedido_admin_itens(p_pedido uuid, p_itens jsonb, p_forcar boolean default false, p_motivo text default '')
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_cfg public.black_config; v_p public.black_pedidos;
  v_tot numeric := 0; v_ipi numeric := 0; v_cx int := 0; v_pc int := 0; r record; v_disp int; v_lim numeric := 0;
  v_dif jsonb; v_antes jsonb; v_avisos jsonb := '[]'::jsonb; v_quem text;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  select * into v_cfg from public.black_config where id = 1;
  select * into v_p from public.black_pedidos where id = p_pedido for update;
  if v_p.id is null then return json_build_object('erro', 'pedido'); end if;

  drop table if exists _novos;
  create temp table _novos on commit drop as
  select x.codigo, sum(x.caixas)::int as caixas
    from jsonb_to_recordset(coalesce(p_itens, '[]')) as x(codigo text, caixas int)
   where x.caixas > 0
   group by x.codigo;
  if not exists (select 1 from _novos) then return json_build_object('erro', 'vazio'); end if;

  perform 1 from public.black_produtos where codigo in (select codigo from _novos) order by codigo for update;

  drop table if exists _calc;
  create temp table _calc on commit drop as
  select it.codigo, it.caixas,
         coalesce(o.preco_peca, public.black_preco(it.codigo, v_p.uf)) as preco_peca,
         coalesce(o.pecas_caixa, bp.caixa_qtd, p.carton_quantity, 1) as pc,
         coalesce(o.nome, nullif(p.packaging_name, ''), p.name, it.codigo) as nome,
         coalesce(o.caixas, 0)::int as ja, bp.ativo
    from _novos it
    left join (select codigo, max(nome) as nome, max(preco_peca) as preco_peca, max(pecas_caixa) as pecas_caixa, sum(caixas)::int as caixas
                 from public.black_pedido_itens where pedido_id = v_p.id group by codigo) o on o.codigo = it.codigo
    left join public.black_produtos bp on bp.codigo = it.codigo
    left join public.products p on p.code = it.codigo;

  for r in select * from _calc loop
    if r.preco_peca is null then return json_build_object('erro', 'produto', 'codigo', r.codigo); end if;
    if r.ativo is not true and r.caixas > r.ja then
      v_avisos := v_avisos || jsonb_build_object('tipo', 'inativo', 'codigo', r.codigo);
    end if;
    -- só o que passa do que já estava no pedido precisa de estoque livre
    if r.caixas > r.ja then
      v_disp := public.black_disponivel_para(r.codigo, v_p.inscrito_id);
      if v_disp is not null and r.caixas - r.ja > v_disp then
        v_avisos := v_avisos || jsonb_build_object('tipo', 'estoque', 'codigo', r.codigo, 'disponivel', v_disp + r.ja);
      end if;
    end if;
    v_tot := v_tot + r.caixas * r.pc * r.preco_peca; v_cx := v_cx + r.caixas; v_pc := v_pc + r.caixas * r.pc;
  end loop;

  if v_tot < v_cfg.pedido_minimo then
    v_avisos := v_avisos || jsonb_build_object('tipo', 'minimo', 'total', v_tot, 'minimo', v_cfg.pedido_minimo);
  end if;
  select coalesce(sum(c.caixas * c.pc * c.preco_peca), 0) into v_lim from _calc c where public.black_limitado(c.codigo);
  if v_lim > v_tot * coalesce(v_cfg.limite_pct, 10) / 100 then
    v_avisos := v_avisos || jsonb_build_object('tipo', 'limite', 'valor', v_lim, 'maximo', round(v_tot * coalesce(v_cfg.limite_pct, 10) / 100, 2));
  end if;
  if jsonb_array_length(v_avisos) > 0 and not coalesce(p_forcar, false) then
    return json_build_object('erro', 'avisos', 'avisos', v_avisos, 'total', v_tot);
  end if;
  v_ipi := round(v_tot * coalesce(v_cfg.ipi_pct, 0) / 100, 2);

  select coalesce(jsonb_agg(jsonb_build_object('codigo', d.codigo, 'nome', d.nome, 'de', d.de, 'para', d.para) order by d.codigo), '[]'::jsonb)
    into v_dif
    from (
      select coalesce(n.codigo, o.codigo) as codigo, coalesce(o.nome, n.nome) as nome, coalesce(o.caixas, 0) as de, coalesce(n.caixas, 0) as para
        from _calc n
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
  select v_p.id, c.codigo, c.nome, c.caixas, c.pc, c.preco_peca, c.caixas * c.pc * c.preco_peca from _calc c;

  select coalesce(nullif(pr.name, ''), 'equipe') into v_quem from public.profiles pr where pr.id = auth.uid();

  update public.black_pedidos
     set caixas = v_cx, pecas = v_pc, total = v_tot, ipi = v_ipi, frete = public.black_frete(uf, cidade, v_tot),
         versao = versao + 1, alterado_em = now(), alteracoes = v_dif, historico = historico || jsonb_build_array(v_antes),
         edicoes = edicoes || jsonb_build_array(jsonb_build_object('tipo', 'itens', 'em', now(), 'por', coalesce(v_quem, 'equipe'),
                     'versao', versao + 1, 'mudou', v_dif, 'avisos', v_avisos, 'motivo', coalesce(p_motivo, ''))),
         atualizado_em = now(), atualizado_por = auth.uid()
   where id = v_p.id;

  return json_build_object('numero', v_p.numero, 'versao', v_p.versao + 1, 'caixas', v_cx, 'total', v_tot, 'ipi', v_ipi, 'alteracoes', v_dif);
end
$fn$;
revoke all on function public.black_pedido_admin_itens(uuid, jsonb, boolean, text) from public, anon;
grant execute on function public.black_pedido_admin_itens(uuid, jsonb, boolean, text) to authenticated;

create or replace function public.black_pedido_admin_dados(p_pedido uuid, p_dados jsonb, p_cadastro boolean default false)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_p public.black_pedidos; v_n public.black_pedidos; v_mud jsonb := '[]'::jsonb; k text; v_quem text;
  campos text[] := array['razao_social', 'fantasia', 'cnpj', 'cidade', 'uf', 'representante', 'comprador', 'email', 'celular', 'observacao'];
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  select * into v_p from public.black_pedidos where id = p_pedido for update;
  if v_p.id is null then return json_build_object('erro', 'pedido'); end if;

  update public.black_pedidos set
    razao_social  = coalesce(trim(p_dados->>'razao_social'), razao_social),
    fantasia      = coalesce(trim(p_dados->>'fantasia'), fantasia),
    cnpj          = coalesce(nullif(regexp_replace(p_dados->>'cnpj', '\D', '', 'g'), ''), cnpj),
    cidade        = coalesce(trim(p_dados->>'cidade'), cidade),
    uf            = coalesce(upper(trim(p_dados->>'uf')), uf),
    representante = coalesce(trim(p_dados->>'representante'), representante),
    comprador     = coalesce(trim(p_dados->>'comprador'), comprador),
    email         = coalesce(lower(trim(p_dados->>'email')), email),
    celular       = coalesce(trim(p_dados->>'celular'), celular),
    observacao    = coalesce(p_dados->>'observacao', observacao)
  where id = v_p.id returning * into v_n;

  foreach k in array campos loop
    if (to_jsonb(v_p)->>k) is distinct from (to_jsonb(v_n)->>k) then
      v_mud := v_mud || jsonb_build_object('campo', k, 'de', to_jsonb(v_p)->>k, 'para', to_jsonb(v_n)->>k);
    end if;
  end loop;
  if jsonb_array_length(v_mud) = 0 then return json_build_object('erro', 'igual'); end if;

  select coalesce(nullif(pr.name, ''), 'equipe') into v_quem from public.profiles pr where pr.id = auth.uid();
  update public.black_pedidos
     set frete = public.black_frete(uf, cidade, total),
         edicoes = edicoes || jsonb_build_array(jsonb_build_object('tipo', 'dados', 'em', now(), 'por', coalesce(v_quem, 'equipe'),
                     'mudou', v_mud, 'cadastro', coalesce(p_cadastro, false))),
         atualizado_em = now(), atualizado_por = auth.uid()
   where id = v_p.id;

  -- o cadastro do cliente (black_inscritos) acompanha, se a equipe pediu
  if coalesce(p_cadastro, false) and v_p.inscrito_id is not null then
    if v_n.cnpj <> v_p.cnpj and exists (select 1 from public.black_inscritos where cnpj = v_n.cnpj and id <> v_p.inscrito_id) then
      raise exception 'Já existe outro cliente inscrito com o CNPJ %', v_n.cnpj;
    end if;
    update public.black_inscritos set
      razao_social = v_n.razao_social, fantasia = v_n.fantasia, cnpj = v_n.cnpj, cidade = v_n.cidade, uf = v_n.uf,
      representante = v_n.representante, comprador = v_n.comprador, email = v_n.email, celular = v_n.celular
    where id = v_p.inscrito_id;
  end if;

  return json_build_object('numero', v_p.numero, 'mudou', v_mud);
end
$fn$;
revoke all on function public.black_pedido_admin_dados(uuid, jsonb, boolean) from public, anon;
grant execute on function public.black_pedido_admin_dados(uuid, jsonb, boolean) to authenticated;
