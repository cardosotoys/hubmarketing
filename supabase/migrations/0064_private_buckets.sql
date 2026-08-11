-- Cardoso Marketing Hub — fechar o vazamento: buckets sensíveis privados + leitura só autenticada
-- Roda depois de 0001..0063. RODE POR ÚLTIMO, só depois que o deploy do código com URLs assinadas
-- estiver no ar e você confirmar que os arquivos ainda aparecem no Brand Center e nas demandas.
--
-- Depois disto: o endpoint /object/public/ para de servir esses buckets (anônimo não baixa mais),
-- a listagem exige login, e o app acessa via URLs assinadas temporárias (createSignedUrl).

set lock_timeout = '5s';

-- 1) tornar privados os buckets com conteúdo sensível
update storage.buckets set public = false where id in ('task-files', 'brand-assets');

-- 2) leitura (necessária para gerar URL assinada) só para usuários autenticados — bloqueia
--    enumeração/assinatura por anônimo (antes era `to public`)
drop policy if exists "task_files_read" on storage.objects;
create policy "task_files_read" on storage.objects
  for select to authenticated using (bucket_id = 'task-files');

drop policy if exists "brand_assets_read" on storage.objects;
create policy "brand_assets_read" on storage.objects
  for select to authenticated using (bucket_id = 'brand-assets');
