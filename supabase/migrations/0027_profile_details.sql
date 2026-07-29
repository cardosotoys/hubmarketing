-- Cardoso Marketing Hub — Perfil mais completo (foto real, telefone, bio)
-- Roda uma vez no SQL Editor, depois de 0001..0026 já terem rodado.

alter table public.profiles
  add column avatar_url text not null default '',
  add column phone text not null default '',
  add column bio text not null default '';

-- Storage: bucket público pra leitura (mostra a foto sem precisar de link assinado),
-- upload/troca/remoção restritos à própria pasta de cada pessoa (avatars/<user_id>/arquivo).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_own_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
