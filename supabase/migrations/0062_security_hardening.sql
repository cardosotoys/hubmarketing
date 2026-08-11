-- Cardoso Marketing Hub — blindagem de segurança (RLS de escrita + storage por dono)
-- Roda depois de 0001..0061. Retry-safe/idempotente. Não depende de mudança de código.
--
-- Fecha "broken access control": escrita que antes só era barrada no front passa a ser barrada no
-- banco. Não altera leitura (nenhum dado deixa de aparecer para quem já via).

set lock_timeout = '5s';

-- ============================================================================
-- 1) products: refletir a permissão de edição no RLS (antes era using(true))
--    Pode editar: privilegiado, ou quem não é 'assistente', ou assistente liberado (can_edit_products)
-- ============================================================================
create or replace function public.can_edit_products()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role in ('diretoria', 'administrador') or p.department <> 'assistente' or p.can_edit_products)
  );
$$;

drop policy if exists "products_write_authenticated" on public.products;
drop policy if exists "products_update_authenticated" on public.products;
drop policy if exists "products_insert_not_assistente" on public.products;
drop policy if exists "products_update_not_assistente" on public.products;
drop policy if exists "products_insert_can_edit" on public.products;
drop policy if exists "products_update_can_edit" on public.products;
create policy "products_insert_can_edit" on public.products
  for insert to authenticated with check (public.can_edit_products());
create policy "products_update_can_edit" on public.products
  for update to authenticated using (public.can_edit_products()) with check (public.can_edit_products());

-- ============================================================================
-- 2) mpm_settings: só Diretoria/Admin altera (webhook/whatsapp/email dos alertas)
-- ============================================================================
drop policy if exists "mpm_settings_update" on public.mpm_settings;
create policy "mpm_settings_update" on public.mpm_settings
  for update to authenticated using (public.is_privileged()) with check (public.is_privileged());

-- ============================================================================
-- 3) notifications: INSERT não pode forjar remetente. O trigger de menção é
--    security definer (ignora RLS), então o fluxo legítimo continua funcionando.
-- ============================================================================
drop policy if exists "notif_insert" on public.notifications;
create policy "notif_insert" on public.notifications
  for insert to authenticated with check (actor_id = auth.uid());

-- ============================================================================
-- 4) profiles: impedir o próprio usuário de mudar seu department/can_edit_products/disabled
--    (anti-escalonamento — antes só role e módulos eram protegidos)
-- ============================================================================
create or replace function public.prevent_privilege_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_privileged()
     and (new.department is distinct from old.department
          or new.can_edit_products is distinct from old.can_edit_products
          or new.disabled is distinct from old.disabled) then
    raise exception 'Apenas Diretoria/Administrador podem alterar departamento/permissões/status de um usuário.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.prevent_privilege_self_change();

-- ============================================================================
-- 5) storage.objects: só o DONO do arquivo (ou privilegiado) sobrescreve/apaga.
--    Antes qualquer autenticado apagava/trocava arquivo de qualquer um.
--    (avatars já era escopado por pasta; mantido.) Upload/insert segue liberado.
-- ============================================================================
-- task-files
drop policy if exists "task_files_update" on storage.objects;
create policy "task_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'task-files' and (owner = auth.uid() or public.is_privileged()));
drop policy if exists "task_files_delete" on storage.objects;
create policy "task_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and (owner = auth.uid() or public.is_privileged()));

-- brand-assets
drop policy if exists "brand_assets_update" on storage.objects;
create policy "brand_assets_update" on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and (owner = auth.uid() or public.is_privileged()));
drop policy if exists "brand_assets_delete" on storage.objects;
create policy "brand_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and (owner = auth.uid() or public.is_privileged()));

-- product-images
drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (owner = auth.uid() or public.is_privileged()));
drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (owner = auth.uid() or public.is_privileged()));

-- social-media (só delete existia)
drop policy if exists "social_media_authenticated_delete" on storage.objects;
create policy "social_media_authenticated_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'social-media' and (owner = auth.uid() or public.is_privileged()));

-- campaign-creatives (só delete existia)
drop policy if exists "campaign_creatives_authenticated_delete" on storage.objects;
create policy "campaign_creatives_authenticated_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-creatives' and (owner = auth.uid() or public.is_privileged()));
