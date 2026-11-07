-- Cardoso Black: vitrine fechada até a abertura (12/11, 16h).
-- Antes de abre_em, catálogo e ficha não devolvem produto nenhum para o cliente: só a contagem regressiva.
-- A equipe continua vendo tudo: logada no Hub (black_staff) ou na prévia (Ver como cliente).
begin;

create or replace function public.black_vitrine_liberada(p_token text)
returns boolean language sql stable security definer set search_path = public
as $fn$
  select now() >= (select abre_em from public.black_config where id = 1)
      or public.black_staff()
      or public.black_eh_previa(p_token);
$fn$;
revoke all on function public.black_vitrine_liberada(text) from public, anon, authenticated;

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
  where bp.ativo and public.black_vitrine_liberada(p_token);
$fn$;

create or replace function public.black_produto(p_codigo text, p_token text)
returns json language plpgsql security definer set search_path = public
as $fn$
declare v_ins uuid := public.black_inscrito_da_sessao(p_token); v json;
begin
  -- antes da live a vitrine fica fechada: só a contagem regressiva
  if not public.black_vitrine_liberada(p_token) then
    return json_build_object('bloqueado', true, 'abre_em', (select abre_em from public.black_config where id = 1));
  end if;
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

commit;
