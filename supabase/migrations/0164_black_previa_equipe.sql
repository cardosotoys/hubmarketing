-- Cardoso Black: prévia da equipe ("Ver como cliente").
-- Quem opera a Black no Hub entra na página de pedido e na ficha como uma loja de demonstração,
-- vê preços e monta o carrinho mesmo antes da abertura, sem enviar pedido e sem entrar na medição.
-- A loja de demonstração (CNPJ 00000000000000, origem 'previa') fica fora das listas do módulo.
-- Pode rodar de novo sem apagar nada.

alter table public.black_inscritos drop constraint if exists black_inscritos_origem_check;
alter table public.black_inscritos add constraint black_inscritos_origem_check
  check (origem in ('', 'carteira', 'fora_carteira', 'situacao', 'previa'));

create or replace function public.black_eh_previa(p_token text)
returns boolean language sql stable security definer set search_path = public
as $fn$
  select exists (select 1 from public.black_sessoes s join public.black_inscritos i on i.id = s.inscrito_id
                  where s.token = p_token and s.expira_em > now() and i.origem = 'previa');
$fn$;
revoke all on function public.black_eh_previa(text) from public, anon, authenticated;

-- preço aparece a partir da abertura, ou sempre na prévia da equipe
create or replace function public.black_preco_visivel(p_token text)
returns boolean language sql stable security definer set search_path = public
as $fn$
  select now() >= (select abre_em from public.black_config where id = 1) or public.black_eh_previa(p_token);
$fn$;
revoke all on function public.black_preco_visivel(text) from public, anon, authenticated;

-- a equipe pede uma sessão de prévia (vale 12 horas)
create or replace function public.black_previa_entrar()
returns json language plpgsql security definer set search_path = public, extensions
as $fn$
declare v_id uuid; v_token text;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  insert into public.black_inscritos (cnpj, razao_social, fantasia, cidade, uf, representante, comprador, email, celular,
                                      canais, status, origem, alertas, motivo)
  values ('00000000000000', 'LOJA DE DEMONSTRAÇÃO', 'Prévia da equipe', 'São Paulo', 'SP', 'Equipe Cardoso',
          'Equipe Cardoso', 'previa@cardosotoys.com.br', '(11) 00000-0000', '{}', 'aprovado', 'previa', '{}', 'prévia interna')
  on conflict (cnpj) do update set status = 'aprovado', origem = 'previa'
  returning id into v_id;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.black_sessoes (token, inscrito_id, expira_em) values (v_token, v_id, now() + interval '12 hours');
  return json_build_object('token', v_token);
end
$fn$;
revoke all on function public.black_previa_entrar() from public, anon;
grant execute on function public.black_previa_entrar() to authenticated;

-- a sessão informa se é prévia (a página libera a vitrine antes da abertura)
create or replace function public.black_sessao(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  select json_build_object(
    'cnpj', i.cnpj, 'razao_social', i.razao_social, 'fantasia', i.fantasia, 'cidade', i.cidade, 'uf', i.uf,
    'representante', i.representante, 'comprador', i.comprador, 'email', i.email, 'celular', i.celular,
    'canal_link', c.canal_link, 'live_link', c.live_link, 'previa', i.origem = 'previa')
  from public.black_inscritos i, public.black_config c
  where i.id = public.black_inscrito_da_sessao(p_token) and c.id = 1;
$fn$;

create or replace function public.black_catalogo(p_token text)
returns json language sql stable security definer set search_path = public
as $fn$
  with logado as (select i.uf, true as ok from public.black_inscritos i where i.id = public.black_inscrito_da_sessao(p_token))
  select coalesce(json_agg(json_build_object(
      'codigo', bp.codigo, 'ordem', bp.ordem, 'nome', coalesce(nullif(p.packaging_name, ''), p.name, bp.codigo),
      'familia', coalesce(nullif(bp.familia, ''), p.line, ''),
      'caixa', coalesce(bp.caixa_qtd, p.carton_quantity, 1),
      'preco_peca', case when (select ok from logado) and public.black_preco_visivel(p_token)
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
    'preco_peca', case when v_ins is not null and public.black_preco_visivel(p_token)
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

create or replace function public.black_pedido_enviar(p_token text, p_itens jsonb, p_obs text, p_comprador text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare
  v_ins uuid := public.black_inscrito_da_sessao(p_token);
  v_i public.black_inscritos; v_cfg public.black_config;
  v_ped uuid; v_num text; v_tot numeric := 0; v_cx int := 0; v_pc int := 0; r record; v_disp int;
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
