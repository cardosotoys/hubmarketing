-- Cardoso Marketing Hub — Trade Campo: a líder cadastra lojas e atribui o promotor
-- pelo próprio link (sem entrar no hub). Grava por RPC security-definer (token validado).
-- Roda depois de 0082. Idempotente.

set lock_timeout = '5s';

-- Cadastra/edita uma loja e atribui o responsável. Cria a rede pelo nome se não existir.
create or replace function public.tm_field_store_upsert(
  p_token text, p_store_id uuid, p_name text, p_network text,
  p_city text, p_region text, p_address text, p_promoter uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare tk public.tm_field_tokens; nid uuid; sid uuid;
begin
  select * into tk from public.tm_field_tokens where token = p_token and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('ok', false, 'error', 'nome'); end if;

  -- resolve a rede pelo nome (find-or-create)
  if coalesce(trim(p_network), '') <> '' then
    select id into nid from public.tm_networks where lower(name) = lower(trim(p_network));
    if nid is null then
      insert into public.tm_networks (name) values (trim(p_network)) returning id into nid;
    end if;
  end if;

  if p_store_id is null then
    insert into public.tm_stores (name, network_id, city, region, address, default_promoter_id, status)
    values (trim(p_name), nid, nullif(trim(coalesce(p_city, '')), ''), nullif(trim(coalesce(p_region, '')), ''),
            nullif(trim(coalesce(p_address, '')), ''), p_promoter, 'ativa')
    returning id into sid;
  else
    update public.tm_stores set
      name = trim(p_name),
      network_id = coalesce(nid, network_id),
      city = nullif(trim(coalesce(p_city, '')), ''),
      region = nullif(trim(coalesce(p_region, '')), ''),
      address = nullif(trim(coalesce(p_address, '')), ''),
      default_promoter_id = p_promoter
    where id = p_store_id
    returning id into sid;
  end if;

  return jsonb_build_object('ok', true, 'id', sid);
end;
$$;

grant execute on function public.tm_field_store_upsert(text, uuid, text, text, text, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contexto: acrescenta a lista de redes (p/ o formulário de cadastro escolher/criar)
-- ---------------------------------------------------------------------------
create or replace function public.tm_field_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare tk public.tm_field_tokens; ws date;
begin
  select * into tk from public.tm_field_tokens where token = p_token and active;
  if not found then return jsonb_build_object('ok', false); end if;
  ws := current_date - ((extract(isodow from current_date)::int) - 1);
  return jsonb_build_object(
    'ok', true,
    'kind', tk.kind,
    'promoter_id', tk.promoter_id,
    'label', tk.label,
    'week_start', ws,
    'today', current_date,
    'today_weekday', extract(isodow from current_date)::int,
    'promoters', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]')
                  from public.tm_promoters where status = 'ativo' and (tk.kind = 'lider' or id = tk.promoter_id)),
    'networks', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]')
                 from public.tm_networks),
    'stores', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', s.id, 'name', s.name, 'network', n.name, 'network_id', s.network_id,
                 'city', s.city, 'region', s.region, 'address', s.address,
                 'default_promoter_id', s.default_promoter_id) order by s.name), '[]')
               from public.tm_stores s left join public.tm_networks n on n.id = s.network_id
               where s.status = 'ativa'),
    'plan', (select coalesce(jsonb_agg(jsonb_build_object('promoter_id', promoter_id, 'weekday', weekday, 'store_id', store_id)), '[]')
             from public.tm_field_plan where week_start = ws and (tk.kind = 'lider' or promoter_id = tk.promoter_id)),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object(
                  'promoter_id', promoter_id, 'report_date', report_date, 'store_id', store_id,
                  'status', status, 'reason', reason, 'note', note)), '[]')
                from public.tm_field_report where report_date >= ws - 7 and (tk.kind = 'lider' or promoter_id = tk.promoter_id))
  );
end;
$$;
