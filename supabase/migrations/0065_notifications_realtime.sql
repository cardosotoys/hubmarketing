-- Cardoso Marketing Hub — habilitar realtime da tabela notifications
-- Roda depois de 0001..0064. Retry-safe/idempotente.
--
-- A tabela notifications (criada na 0053) nunca foi adicionada à publicação supabase_realtime, então
-- as assinaturas postgres_changes do sininho/página não recebiam eventos — as notificações só
-- apareciam/atualizavam após F5. Isto liga o tempo real (nova menção, leitura, exclusão) na hora.

set lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
