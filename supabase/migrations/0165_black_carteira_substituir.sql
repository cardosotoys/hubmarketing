-- Substituir carteira: o Supabase bloqueia DELETE sem WHERE (pg_safeupdate)
create or replace function public.black_carteira_importar(p_linhas jsonb, p_substituir boolean)
returns json language plpgsql security definer set search_path = public
as $fn$
declare n int;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  if p_substituir then
    update public.black_inscritos set carteira_id = null where carteira_id is not null;
    delete from public.black_carteira where true;
  end if;
  -- uma linha por (razão social normalizada, UF): o painel às vezes repete o cliente; CNPJ repetido fica só na 1ª
  with x as (
    select trim(j->>'razao_social') as razao_social, nullif(public.black_so_digitos(j->>'cnpj'), '') as cnpj,
           coalesce(j->>'fantasia', '') as fantasia, coalesce(j->>'cidade', '') as cidade,
           upper(trim(coalesce(j->>'uf', ''))) as uf, coalesce(j->>'representante', '') as representante,
           coalesce(j->>'grupo', '') as grupo, coalesce(j->>'situacao', '') as situacao,
           round(nullif(j->>'dias_sem_compra', '')::numeric)::int as dias_sem_compra,
           nullif(j->>'faturamento_12m', '')::numeric as faturamento_12m, ord
      from jsonb_array_elements(p_linhas) with ordinality as e(j, ord)
     where coalesce(trim(j->>'razao_social'), '') <> ''
  ), u as (
    select distinct on (public.black_norm(razao_social), uf) * from x
     order by public.black_norm(razao_social), uf, faturamento_12m desc nulls last, ord
  ), c as (
    select u.*, case when u.cnpj is not null
                      and row_number() over (partition by u.cnpj order by u.ord) = 1
                      and not exists (select 1 from public.black_carteira b
                                       where b.cnpj = u.cnpj and (b.razao_norm, b.uf) <> (public.black_norm(u.razao_social), u.uf))
                     then u.cnpj end as cnpj_ok
      from u
  )
  insert into public.black_carteira (razao_social, cnpj, fantasia, cidade, uf, representante, grupo, situacao,
                                     dias_sem_compra, faturamento_12m)
  select razao_social, cnpj_ok, fantasia, cidade, uf, representante, grupo, situacao, dias_sem_compra, faturamento_12m
    from c
  on conflict (razao_norm, uf) do update
     set cnpj = coalesce(excluded.cnpj, public.black_carteira.cnpj),
         fantasia = case when excluded.fantasia <> '' then excluded.fantasia else public.black_carteira.fantasia end,
         cidade = case when excluded.cidade <> '' then excluded.cidade else public.black_carteira.cidade end,
         representante = excluded.representante, grupo = excluded.grupo, situacao = excluded.situacao,
         dias_sem_compra = excluded.dias_sem_compra, faturamento_12m = excluded.faturamento_12m,
         importado_em = now();
  get diagnostics n = row_count;
  return json_build_object('linhas', n, 'total', (select count(*) from public.black_carteira));
end
$fn$;
revoke all on function public.black_carteira_importar(jsonb, boolean) from public, anon;
grant execute on function public.black_carteira_importar(jsonb, boolean) to authenticated;
