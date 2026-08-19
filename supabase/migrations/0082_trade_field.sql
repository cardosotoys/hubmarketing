-- Cardoso Marketing Hub — Trade "Campo": preenchimento externo (sem login no hub).
-- A líder (Neylik) e cada promotor recebem um LINK com token. Abrem no celular, planejam a
-- semana e dão o report diário (foi / não foi + motivo). Grava por FUNÇÕES security-definer
-- (o token é validado no banco); nenhuma tabela fica exposta ao anônimo. Roda depois de 0067..0081.
-- Idempotente.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Tokens de acesso ao campo (link mágico)
-- ---------------------------------------------------------------------------
create table if not exists public.tm_field_tokens (
  token text primary key,
  kind text not null check (kind in ('lider', 'promotor')),
  promoter_id uuid references public.tm_promoters (id) on delete cascade,
  label text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.tm_field_tokens enable row level security;
drop policy if exists "tft_priv" on public.tm_field_tokens;
create policy "tft_priv" on public.tm_field_tokens for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

-- ---------------------------------------------------------------------------
-- Plano da semana (loja por promotor/dia) — separado do tm_agenda p/ não mexer nos números atuais
-- ---------------------------------------------------------------------------
create table if not exists public.tm_field_plan (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.tm_promoters (id) on delete cascade,
  week_start date not null,          -- segunda-feira da semana
  weekday int not null,              -- isodow 1..6 (Seg..Sáb)
  store_id uuid not null references public.tm_stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (promoter_id, week_start, weekday, store_id)
);
create index if not exists tm_field_plan_week_idx on public.tm_field_plan (week_start, promoter_id);
alter table public.tm_field_plan enable row level security;
drop policy if exists "tfp_select" on public.tm_field_plan;
create policy "tfp_select" on public.tm_field_plan for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Report diário (por loja: foi / não foi + motivo)
-- ---------------------------------------------------------------------------
create table if not exists public.tm_field_report (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.tm_promoters (id) on delete cascade,
  report_date date not null,
  store_id uuid not null references public.tm_stores (id) on delete cascade,
  status text not null check (status in ('foi', 'nao_foi')),
  reason text not null default '',
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (promoter_id, report_date, store_id)
);
create index if not exists tm_field_report_date_idx on public.tm_field_report (report_date, promoter_id);
alter table public.tm_field_report enable row level security;
drop policy if exists "tfr_select" on public.tm_field_report;
create policy "tfr_select" on public.tm_field_report for select to authenticated using (true);

-- ===========================================================================
-- Funções security-definer: validam o token e gravam. Chamáveis pelo anônimo.
-- ===========================================================================

-- contexto (promotores, lojas, plano da semana, reports recentes)
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
    'stores', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', s.id, 'name', s.name, 'network', n.name, 'city', s.city, 'region', s.region,
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

-- grava o plano de um dia (substitui as lojas daquele promotor/dia/semana)
create or replace function public.tm_field_plan_set(p_token text, p_promoter uuid, p_week_start date, p_weekday int, p_store_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare tk public.tm_field_tokens; pid uuid; sid uuid;
begin
  select * into tk from public.tm_field_tokens where token = p_token and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  pid := case when tk.kind = 'promotor' then tk.promoter_id else p_promoter end;
  if pid is null then return jsonb_build_object('ok', false, 'error', 'promoter'); end if;
  delete from public.tm_field_plan where promoter_id = pid and week_start = p_week_start and weekday = p_weekday;
  foreach sid in array coalesce(p_store_ids, '{}'::uuid[]) loop
    insert into public.tm_field_plan (promoter_id, week_start, weekday, store_id)
    values (pid, p_week_start, p_weekday, sid) on conflict do nothing;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

-- grava/atualiza o report de uma loja no dia
create or replace function public.tm_field_report_set(p_token text, p_promoter uuid, p_date date, p_store uuid, p_status text, p_reason text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare tk public.tm_field_tokens; pid uuid;
begin
  select * into tk from public.tm_field_tokens where token = p_token and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  if p_status not in ('foi', 'nao_foi') then return jsonb_build_object('ok', false, 'error', 'status'); end if;
  pid := case when tk.kind = 'promotor' then tk.promoter_id else p_promoter end;
  if pid is null then return jsonb_build_object('ok', false, 'error', 'promoter'); end if;
  insert into public.tm_field_report (promoter_id, report_date, store_id, status, reason, note, updated_at)
  values (pid, p_date, p_store, p_status, coalesce(p_reason, ''), coalesce(p_note, ''), now())
  on conflict (promoter_id, report_date, store_id)
  do update set status = excluded.status, reason = excluded.reason, note = excluded.note, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- remove um report (caso marque errado)
create or replace function public.tm_field_report_clear(p_token text, p_promoter uuid, p_date date, p_store uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare tk public.tm_field_tokens; pid uuid;
begin
  select * into tk from public.tm_field_tokens where token = p_token and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  pid := case when tk.kind = 'promotor' then tk.promoter_id else p_promoter end;
  delete from public.tm_field_report where promoter_id = pid and report_date = p_date and store_id = p_store;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.tm_field_context(text) to anon, authenticated;
grant execute on function public.tm_field_plan_set(text, uuid, date, int, uuid[]) to anon, authenticated;
grant execute on function public.tm_field_report_set(text, uuid, date, uuid, text, text, text) to anon, authenticated;
grant execute on function public.tm_field_report_clear(text, uuid, date, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gera os links: 1 para a líder (Neylik) + 1 por promotor ativo. Idempotente.
-- ---------------------------------------------------------------------------
insert into public.tm_field_tokens (token, kind, promoter_id, label)
select gen_random_uuid()::text, 'lider', null, 'Neylik (líder)'
where not exists (select 1 from public.tm_field_tokens where kind = 'lider');

insert into public.tm_field_tokens (token, kind, promoter_id, label)
select gen_random_uuid()::text, 'promotor', p.id, p.name
from public.tm_promoters p
where p.status = 'ativo' and not exists (select 1 from public.tm_field_tokens t where t.promoter_id = p.id);
