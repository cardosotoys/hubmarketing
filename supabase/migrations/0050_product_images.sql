-- Cardoso Marketing Hub — Produtos: imagem do produto + imagem da embalagem (upload real)
-- Roda depois de 0001..0049. Retry-safe/idempotente.
--
-- Antes o produto tinha só image_url (um link colado). Agora dá pra SUBIR 2 imagens:
--   image_url            -> imagem do PRODUTO
--   packaging_image_url  -> imagem da EMBALAGEM
-- Os arquivos vão pro bucket público "product-images" (Supabase Storage).

set lock_timeout = '5s';

alter table public.products add column if not exists packaging_image_url text not null default '';

-- Bucket público pras imagens de produto
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Leitura pública; escrita/edição/remoção por usuários logados
drop policy if exists "product_images_read" on storage.objects;
create policy "product_images_read" on storage.objects
  for select to public using (bucket_id = 'product-images');

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');
