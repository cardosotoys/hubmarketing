-- Cardoso Black: depois do fechamento, só a equipe libera pedido.
-- O link "Fazer pedido por este cliente" (Inscritos) passa a valer também depois de fecha_em, por 3 horas.
-- O cliente continua vendo a Black encerrada e não consegue enviar nada: só a sessão aberta pela equipe passa.
-- Pode rodar de novo sem apagar nada.

alter table public.black_sessoes add column if not exists liberada_ate timestamptz;

create or replace function public.black_sessao_liberada(p_token text)
returns boolean language sql stable security definer set search_path = public
as $fn$
  select exists (select 1 from public.black_sessoes s where s.token = p_token and s.liberada_ate > now() and s.expira_em > now());
$fn$;
revoke all on function public.black_sessao_liberada(text) from public, anon, authenticated;

create or replace function public.black_entrar_como(p_inscrito uuid)
returns json language plpgsql security definer set search_path = public, extensions
as $fn$
declare v_token text;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  if not exists (select 1 from public.black_inscritos where id = p_inscrito and status = 'aprovado' and origem <> 'previa') then
    return json_build_object('erro', 'O cadastro precisa estar aprovado.');
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.black_sessoes (token, inscrito_id, expira_em, liberada_ate) values (v_token, p_inscrito, now() + interval '3 hours', now() + interval '3 hours');
  return json_build_object('token', v_token);
end
$fn$;
revoke all on function public.black_entrar_como(uuid) from public, anon;
grant execute on function public.black_entrar_como(uuid) to authenticated;

create or replace function public.black_vitrine_liberada(p_token text)
returns boolean language sql stable security definer set search_path = public
as $fn$
  select exists (select 1 from public.black_config c where c.id = 1 and now() >= c.abre_em and now() <= c.fecha_em)
      or public.black_staff()
      or public.black_eh_previa(p_token)
      or public.black_sessao_liberada(p_token);
$fn$;
revoke all on function public.black_vitrine_liberada(text) from public, anon, authenticated;

create or replace function public.black_pedido_enviar(p_token text, p_itens jsonb, p_obs text, p_comprador text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_ins uuid := public.black_inscrito_da_sessao(p_token);
  v_i public.black_inscritos; v_cfg public.black_config;
  v_ped uuid; v_num text; v_tot numeric := 0; v_ipi numeric := 0; v_cx int := 0; v_pc int := 0; r record; v_disp int; v_lim numeric := 0;
begin
  if v_ins is null then return json_build_object('erro', 'sessao'); end if;
  if public.black_eh_previa(p_token) then return json_build_object('erro', 'previa'); end if;
  select * into v_cfg from public.black_config where id = 1;
  if now() < v_cfg.abre_em then return json_build_object('erro', 'nao_abriu'); end if;
  if now() > v_cfg.fecha_em and not public.black_sessao_liberada(p_token) then return json_build_object('erro', 'encerrado'); end if;
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
    v_disp := public.black_disponivel_para(r.codigo, v_ins);
    if v_disp is not null and r.caixas > v_disp then
      return json_build_object('erro', 'estoque', 'codigo', r.codigo, 'disponivel', v_disp);
    end if;
    v_tot := v_tot + r.caixas * r.pc * r.preco_peca; v_cx := v_cx + r.caixas; v_pc := v_pc + r.caixas * r.pc;
  end loop;

  if v_tot < v_cfg.pedido_minimo then
    return json_build_object('erro', 'minimo', 'total', v_tot, 'minimo', v_cfg.pedido_minimo);
  end if;

  -- Totokinha Clássica (0300 e 0301): juntas, no máximo 10% do valor do pedido
  select coalesce(sum(it.caixas * coalesce(bp.caixa_qtd, p.carton_quantity, 1) * public.black_preco(it.codigo, v_i.uf)), 0)
    into v_lim
    from _itens it
    join public.black_produtos bp on bp.codigo = it.codigo
    left join public.products p on p.code = it.codigo
   where public.black_limitado(it.codigo);
  if v_lim > v_tot * coalesce(v_cfg.limite_pct, 10) / 100 then
    return json_build_object('erro', 'limite', 'valor', v_lim, 'maximo', round(v_tot * coalesce(v_cfg.limite_pct, 10) / 100, 2));
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

  -- o carrinho vira "finalizado" e libera a reserva (o estoque agora sai pelo pedido)
  update public.black_carrinhos
     set status = 'finalizado', finalizado_em = now(), pedido_id = v_ped, atualizado_em = now(),
         itens = coalesce((select jsonb_object_agg(codigo, caixas) from _itens), '{}'::jsonb)
   where inscrito_id = v_ins and status = 'aberto';
  if not found then
    insert into public.black_carrinhos (inscrito_id, status, itens, finalizado_em, pedido_id)
    values (v_ins, 'finalizado', coalesce((select jsonb_object_agg(codigo, caixas) from _itens), '{}'::jsonb), now(), v_ped);
  end if;

  return json_build_object('numero', v_num, 'caixas', v_cx, 'pecas', v_pc, 'total', v_tot, 'ipi', v_ipi, 'total_com_ipi', v_tot + v_ipi,
                           'frete', public.black_frete(v_i.uf, v_i.cidade, v_tot), 'representante', v_i.representante);
end
$fn$;

create or replace function public.black_carrinho_sincronizar(p_token text, p_itens jsonb)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_ins uuid := public.black_inscrito_da_sessao(p_token);
  v_cfg public.black_config; v_car public.black_carrinhos;
  v_novo jsonb := '{}'::jsonb; v_aj jsonb := '[]'::jsonb; r record; v_q int; v_d int; v_ant int;
begin
  if v_ins is null then return json_build_object('erro', 'sessao'); end if;
  if public.black_eh_previa(p_token) then return json_build_object('itens', coalesce(p_itens, '{}'::jsonb), 'ajustes', '[]'::json, 'previa', true); end if;
  select * into v_cfg from public.black_config where id = 1;
  if now() < v_cfg.abre_em then return json_build_object('erro', 'nao_abriu'); end if;
  if now() > v_cfg.fecha_em and not public.black_sessao_liberada(p_token) then return json_build_object('erro', 'encerrado'); end if;

  select * into v_car from public.black_carrinhos where inscrito_id = v_ins and status = 'aberto' for update;
  if not found then
    insert into public.black_carrinhos (inscrito_id) values (v_ins) returning * into v_car;
  end if;

  -- trava os produtos envolvidos (o que entra e o que sai), em ordem, para dois clientes não pegarem a mesma caixa
  perform 1 from public.black_produtos
   where codigo in (select jsonb_object_keys(coalesce(p_itens, '{}'::jsonb)) union select jsonb_object_keys(v_car.itens))
   order by codigo for update;

  for r in
    select k.codigo, greatest(0, coalesce((p_itens ->> k.codigo)::int, 0)) as pedido
      from (select jsonb_object_keys(coalesce(p_itens, '{}'::jsonb)) as codigo) k
      join public.black_produtos bp on bp.codigo = k.codigo and bp.ativo
  loop
    continue when r.pedido = 0;
    v_d := public.black_disponivel_para(r.codigo, v_ins);
    v_q := case when v_d is null then r.pedido else least(r.pedido, v_d) end;
    if v_q < r.pedido then
      v_aj := v_aj || jsonb_build_object('codigo', r.codigo, 'pedido', r.pedido, 'aceito', v_q);
    end if;
    if v_q > 0 then v_novo := v_novo || jsonb_build_object(r.codigo, v_q); end if;
  end loop;

  -- histórico de cada mudança (para o relatório)
  insert into public.black_carrinho_eventos (carrinho_id, codigo, de, para)
  select v_car.id, k, coalesce((v_car.itens ->> k)::int, 0), coalesce((v_novo ->> k)::int, 0)
    from (select jsonb_object_keys(v_car.itens) as k union select jsonb_object_keys(v_novo)) x
   where coalesce((v_car.itens ->> k)::int, 0) <> coalesce((v_novo ->> k)::int, 0);

  update public.black_carrinhos
     set itens = v_novo, visto_em = now(),
         atualizado_em = case when itens is distinct from v_novo then now() else atualizado_em end
   where id = v_car.id;

  return json_build_object('itens', v_novo, 'ajustes', v_aj);
end
$fn$;

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
  if now() > v_cfg.fecha_em and not public.black_sessao_liberada(p_token) then return json_build_object('erro', 'encerrado'); end if;
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
