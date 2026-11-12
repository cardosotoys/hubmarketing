-- Cardoso Black: estrutura final de pedidos.
--   • carrinho no servidor: a caixa colocada no carrinho sai do disponível de todos na hora; ao remover, volta.
--     A reserva vale enquanto o cliente está na página (renovada a cada poucos minutos); carrinho parado há
--     mais de reserva_min minutos devolve o estoque e conta como abandonado no relatório.
--   • Totokinha Clássica (0300 e 0301): juntas, no máximo limite_pct (10%) do valor do pedido.
--   • frete grátis só para a cidade de São Paulo.
--   • relatório de carrinhos (abandonados, em andamento e finalizados) para a equipe.
begin;

alter table public.black_config add column if not exists reserva_min int not null default 30;
alter table public.black_config add column if not exists limite_pct numeric(5, 2) not null default 10;
alter table public.black_config add column if not exists limite_codigos text not null default '300,301';

create table if not exists public.black_carrinhos (
  id uuid primary key default gen_random_uuid(),
  inscrito_id uuid not null references public.black_inscritos (id) on delete cascade,
  status text not null default 'aberto' check (status in ('aberto', 'finalizado')),
  itens jsonb not null default '{}'::jsonb,          -- {codigo: caixas}
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),  -- última mudança de quantidade
  visto_em timestamptz not null default now(),       -- última vez que a página renovou a reserva
  finalizado_em timestamptz,
  pedido_id uuid references public.black_pedidos (id) on delete set null
);
create unique index if not exists black_carrinhos_um_aberto on public.black_carrinhos (inscrito_id) where status = 'aberto';
alter table public.black_carrinhos enable row level security;
drop policy if exists black_carrinhos_staff on public.black_carrinhos;
create policy black_carrinhos_staff on public.black_carrinhos for select to authenticated using (public.black_staff());
revoke all on public.black_carrinhos from anon;

create table if not exists public.black_carrinho_eventos (
  id bigserial primary key,
  carrinho_id uuid not null references public.black_carrinhos (id) on delete cascade,
  codigo text not null, de int not null, para int not null,
  em timestamptz not null default now()
);
create index if not exists black_carrinho_eventos_car on public.black_carrinho_eventos (carrinho_id);
alter table public.black_carrinho_eventos enable row level security;
drop policy if exists black_carrinho_eventos_staff on public.black_carrinho_eventos;
create policy black_carrinho_eventos_staff on public.black_carrinho_eventos for select to authenticated using (public.black_staff());
revoke all on public.black_carrinho_eventos from anon;

-- produto que entra no limite de % do pedido (0300 e 0301)
create or replace function public.black_limitado(p_codigo text)
returns boolean language sql stable security definer set search_path = public
as $fn$
  select ltrim(trim(p_codigo), '0') = any (string_to_array(replace((select limite_codigos from public.black_config where id = 1), ' ', ''), ','));
$fn$;

-- caixas reservadas em carrinhos ativos (sem contar o carrinho de p_ins)
create or replace function public.black_reservado(p_codigo text, p_ins uuid)
returns integer language sql stable security definer set search_path = public
as $fn$
  select coalesce(sum((c.itens ->> p_codigo)::int), 0)::int
    from public.black_carrinhos c
   where c.status = 'aberto' and c.itens ? p_codigo
     and c.visto_em > now() - make_interval(mins => (select reserva_min from public.black_config where id = 1))
     and c.inscrito_id is distinct from p_ins;
$fn$;
revoke all on function public.black_reservado(text, uuid) from public, anon;

-- disponível para este cliente: estoque − vendido − reservado no carrinho dos outros (null = sem limite)
create or replace function public.black_disponivel_para(p_codigo text, p_ins uuid)
returns integer language sql stable security definer set search_path = public
as $fn$
  select case when d is null then null else greatest(0, d - public.black_reservado(p_codigo, p_ins)) end
    from (select public.black_disponivel(p_codigo) as d) x;
$fn$;
revoke all on function public.black_disponivel_para(text, uuid) from public, anon;

-- o carrinho do cliente: recebe {codigo: caixas}, reserva o que tem, devolve o que foi aceito.
-- A página chama a cada mudança e a cada poucos minutos (renova a reserva).
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
  if now() > v_cfg.fecha_em then return json_build_object('erro', 'encerrado'); end if;

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
revoke all on function public.black_carrinho_sincronizar(text, jsonb) from public;
grant execute on function public.black_carrinho_sincronizar(text, jsonb) to anon, authenticated;

-- frete: grátis só para a cidade de São Paulo
create or replace function public.black_frete(p_uf text, p_cidade text, p_total numeric)
returns text language plpgsql stable set search_path = public
as $fn$
begin
  if upper(p_uf) = 'SP' and public.black_norm(p_cidade) = 'SAO PAULO' then
    return 'Frete grátis para a cidade de São Paulo';
  end if;
  return 'Frete por conta da loja';
end
$fn$;

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
      'disponivel', public.black_disponivel_para(bp.codigo, public.black_inscrito_da_sessao(p_token)),
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
    -- depois do fim da live o link fecha; antes da abertura, só a contagem
    if now() > (select fecha_em from public.black_config where id = 1) then
      return json_build_object('encerrado', true, 'fecha_em', (select fecha_em from public.black_config where id = 1));
    end if;
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
    'disponivel', public.black_disponivel_para(bp.codigo, v_ins),
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
  v_ped uuid; v_num text; v_tot numeric := 0; v_ipi numeric := 0; v_cx int := 0; v_pc int := 0; r record; v_disp int; v_lim numeric := 0;
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

-- relatório de carrinhos para a equipe: abandonado (parado há mais de reserva_min), em andamento e finalizado
create or replace function public.black_carrinhos_relatorio()
returns json language sql stable security definer set search_path = public
as $fn$
  select case when not public.black_staff() then '[]'::json else coalesce((
    select json_agg(x order by x.atualizado_em desc) from (
      select c.id, c.criado_em, c.atualizado_em, c.visto_em, c.finalizado_em,
             case when c.status = 'finalizado' then 'finalizado'
                  when c.itens = '{}'::jsonb then 'vazio'
                  when c.visto_em > now() - make_interval(mins => cfg.reserva_min) and now() <= cfg.fecha_em then 'ativo'
                  else 'abandonado' end as situacao,
             i.fantasia, i.razao_social, i.cnpj, i.cidade, i.uf, i.representante, i.comprador, i.celular, i.email,
             pd.numero as pedido,
             (select coalesce(sum(e.value::int), 0) from jsonb_each_text(c.itens) e) as caixas,
             (select coalesce(sum(e.value::int * coalesce(bp.caixa_qtd, p.carton_quantity, 1) * coalesce(public.black_preco(e.key, i.uf), 0)), 0)
                from jsonb_each_text(c.itens) e
                left join public.black_produtos bp on bp.codigo = e.key
                left join public.products p on p.code = e.key) as valor,
             (select coalesce(json_agg(json_build_object('codigo', e.key, 'nome', coalesce(nullif(bp.nome, ''), nullif(p.packaging_name, ''), p.name, e.key), 'caixas', e.value::int) order by bp.ordem), '[]'::json)
                from jsonb_each_text(c.itens) e
                left join public.black_produtos bp on bp.codigo = e.key
                left join public.products p on p.code = e.key) as itens,
             (select count(*) from public.black_carrinho_eventos ev where ev.carrinho_id = c.id) as mudancas,
             (select coalesce(json_agg(json_build_object('codigo', ev.codigo, 'max', ev.mx)), '[]'::json)
                from (select ev.codigo, max(greatest(ev.de, ev.para)) as mx from public.black_carrinho_eventos ev
                       where ev.carrinho_id = c.id group by ev.codigo
                      having max(greatest(ev.de, ev.para)) > coalesce((c.itens ->> ev.codigo)::int, 0)) ev) as retirados
        from public.black_carrinhos c
        join public.black_inscritos i on i.id = c.inscrito_id
        cross join (select reserva_min, fecha_em from public.black_config where id = 1) cfg
        left join public.black_pedidos pd on pd.id = c.pedido_id
       where coalesce(i.origem, '') <> 'previa'
    ) x), '[]'::json) end;
$fn$;
revoke all on function public.black_carrinhos_relatorio() from public, anon;
grant execute on function public.black_carrinhos_relatorio() to authenticated;

create or replace function public.black_config_publica()
returns json language sql stable security definer set search_path = public
as $fn$
  select json_build_object(
    'inscricoes_ate', inscricoes_ate, 'abre_em', abre_em, 'fecha_em', fecha_em,
    'pedido_minimo', pedido_minimo, 'frete_gratis_sp_rj', frete_gratis_sp_rj, 'live_data', live_data, 'ipi_pct', ipi_pct, 'canal_link', canal_link, 'limite_pct', limite_pct, 'limite_codigos', limite_codigos,
    'agora', now(), 'aberto', now() between abre_em and fecha_em, 'encerrado', now() > fecha_em)
  from public.black_config where id = 1;
$fn$;

commit;
