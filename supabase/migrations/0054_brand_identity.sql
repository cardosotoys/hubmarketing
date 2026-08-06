-- Cardoso Marketing Hub — módulo Marcas: acompanhamento da identidade visual por marca
-- Roda depois de 0001..0053. Retry-safe/idempotente.
--
-- O template das seções/tópicos vive em código (src/lib/brandIdentity.ts). Aqui guardamos só o
-- STATUS + observação de cada tópico por marca (esparso — só o que foi tocado). Chave estável:
-- (brand_id, section_key, topic).

set lock_timeout = '5s';

create table if not exists public.brand_identity_status (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  section_key text not null,
  topic text not null,
  status text not null default 'pendente' check (status in ('pendente', 'producao', 'entregue', 'aprovado', 'na')),
  note text not null default '',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (brand_id, section_key, topic)
);
create index if not exists brand_identity_status_brand_idx on public.brand_identity_status (brand_id);

alter table public.brand_identity_status enable row level security;
drop policy if exists "bis_select" on public.brand_identity_status;
create policy "bis_select" on public.brand_identity_status for select to authenticated using (true);
drop policy if exists "bis_insert" on public.brand_identity_status;
create policy "bis_insert" on public.brand_identity_status for insert to authenticated with check (true);
drop policy if exists "bis_update" on public.brand_identity_status;
create policy "bis_update" on public.brand_identity_status for update to authenticated using (true);
drop policy if exists "bis_delete" on public.brand_identity_status;
create policy "bis_delete" on public.brand_identity_status for delete to authenticated using (public.is_privileged());
