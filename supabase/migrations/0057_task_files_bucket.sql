-- Cardoso Marketing Hub — anexos de demanda com upload real (imagens para validação)
-- Roda depois de 0001..0056. Retry-safe/idempotente.
--
-- Antes a seção "Arquivos" da demanda só aceitava colar um LINK (Drive, etc.).
-- Agora dá pra SUBIR a imagem/arquivo direto e ele aparece como miniatura para validação,
-- observações e aprovação. Os arquivos vão pro bucket público "task-files" (Supabase Storage)
-- e continuam registrados na tabela project_files (name + url), como os links.

set lock_timeout = '5s';

-- Bucket público pros anexos de demanda
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', true)
on conflict (id) do update set public = true;

-- Leitura pública; escrita/edição/remoção por usuários logados
drop policy if exists "task_files_read" on storage.objects;
create policy "task_files_read" on storage.objects
  for select to public using (bucket_id = 'task-files');

drop policy if exists "task_files_insert" on storage.objects;
create policy "task_files_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'task-files');

drop policy if exists "task_files_update" on storage.objects;
create policy "task_files_update" on storage.objects
  for update to authenticated using (bucket_id = 'task-files');

drop policy if exists "task_files_delete" on storage.objects;
create policy "task_files_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'task-files');
