-- Cardoso Marketing Hub — Brand Center: upload real de assets do licenciado + infos de acesso ao guia
-- Roda depois de 0001..0059. Retry-safe/idempotente.
--
-- Agora cada asset (logotipos, paleta, tipografia, ícones, pattern) aceita UPLOAD de arquivo
-- (bucket brand-assets), não só um link. E o guia real fica com o site + as instruções de acesso.

set lock_timeout = '5s';

-- Instruções de acesso ao guia real (site + como acessar: login/observações)
alter table public.brand_licensees add column if not exists access_info text not null default '';

-- Arquivos enviados por categoria de asset
create table if not exists public.brand_licensee_files (
  id uuid primary key default gen_random_uuid(),
  licensee_id uuid not null references public.brand_licensees (id) on delete cascade,
  category text not null check (category in ('logos', 'colors', 'typography', 'icons', 'pattern')),
  name text not null,
  url text not null,
  path text not null default '', -- caminho no storage (para remoção)
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists brand_licensee_files_licensee_idx on public.brand_licensee_files (licensee_id, category);

alter table public.brand_licensee_files enable row level security;
drop policy if exists "brand_files_select" on public.brand_licensee_files;
create policy "brand_files_select" on public.brand_licensee_files for select to authenticated using (true);
drop policy if exists "brand_files_insert" on public.brand_licensee_files;
create policy "brand_files_insert" on public.brand_licensee_files for insert to authenticated with check (true);
drop policy if exists "brand_files_delete" on public.brand_licensee_files;
create policy "brand_files_delete" on public.brand_licensee_files for delete to authenticated using (true);

-- Bucket público dos assets de marca
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "brand_assets_read" on storage.objects;
create policy "brand_assets_read" on storage.objects
  for select to public using (bucket_id = 'brand-assets');
drop policy if exists "brand_assets_insert" on storage.objects;
create policy "brand_assets_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'brand-assets');
drop policy if exists "brand_assets_update" on storage.objects;
create policy "brand_assets_update" on storage.objects
  for update to authenticated using (bucket_id = 'brand-assets');
drop policy if exists "brand_assets_delete" on storage.objects;
create policy "brand_assets_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'brand-assets');
