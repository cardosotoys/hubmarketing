-- Cardoso Black: cópia pública das fotos e vídeos liberados da ficha, para abrir rápido (CDN do Supabase).
-- A função black-midia grava aqui (o/ original, i/ imagem 1600 px, t/ miniatura 400 px + id do Drive).
-- Só entra arquivo que black_midia_liberada aprova: material liberado de produto ativo da Black.
insert into storage.buckets (id, name, public, file_size_limit)
values ('black-midia', 'black-midia', true, null)
on conflict (id) do update set public = true;
