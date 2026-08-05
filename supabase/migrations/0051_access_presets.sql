-- Cardoso Marketing Hub — Presets de acesso (perfis de módulos por cargo/setor)
-- Roda depois de 0001..0050. Retry-safe/idempotente.
--
-- Escala a liberação de módulos: em vez de ligar/desligar módulo por módulo em cada pessoa,
-- cria-se um preset (ex.: "Comercial - Equipe") com o conjunto de módulos, e aplica-se numa
-- pessoa de uma vez. Aplicar grava em profiles.extra_modules / hidden_modules.

set lock_timeout = '5s';

create table if not exists public.access_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  modules text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.access_presets enable row level security;

drop policy if exists "ap_select" on public.access_presets;
create policy "ap_select" on public.access_presets for select to authenticated using (true);
drop policy if exists "ap_insert" on public.access_presets;
create policy "ap_insert" on public.access_presets for insert to authenticated with check (public.is_privileged());
drop policy if exists "ap_update" on public.access_presets;
create policy "ap_update" on public.access_presets for update to authenticated using (public.is_privileged());
drop policy if exists "ap_delete" on public.access_presets;
create policy "ap_delete" on public.access_presets for delete to authenticated using (public.is_privileged());
