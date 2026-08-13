-- Cardoso Marketing Hub — Trade Marketing: planejamento (roteiro fixo + agenda)
-- Roda depois de 0001..0068. Retry-safe/idempotente.
--
-- tm_routes  = roteiro fixo (loja -> promotor responsável, dia da semana, cadência em semanas)
-- tm_agenda  = visitas planejadas concretas (uma data). source='fixo' (do roteiro), 'expedicao'
--              (futuro: produto chegou na loja) ou 'manual'. É onde a expedição vai injetar visitas.

set lock_timeout = '5s';

create table if not exists public.tm_routes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.tm_stores (id) on delete cascade,
  promoter_id uuid references public.tm_promoters (id),
  weekday smallint,                 -- 0=segunda .. 5=sábado
  cadence_weeks smallint not null default 1,  -- 1=semanal, 2=quinzenal, 4=mensal
  active boolean not null default true,
  source text not null default 'auto',        -- 'auto' | 'manual'
  created_at timestamptz not null default now(),
  unique (store_id)
);

create table if not exists public.tm_agenda (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.tm_stores (id) on delete cascade,
  promoter_id uuid references public.tm_promoters (id),
  planned_date date not null,
  source text not null default 'fixo',         -- 'fixo' | 'expedicao' | 'manual'
  status text not null default 'planejada',    -- 'planejada' | 'realizada' | 'cancelada'
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists tm_agenda_date_idx on public.tm_agenda (planned_date);
create index if not exists tm_agenda_promoter_idx on public.tm_agenda (promoter_id, planned_date);
create unique index if not exists tm_agenda_dedup_idx on public.tm_agenda (store_id, planned_date);

do $$
declare t text;
begin
  foreach t in array array['tm_routes','tm_agenda']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.is_privileged()) with check (public.is_privileged());', t, t);
  end loop;
end $$;
