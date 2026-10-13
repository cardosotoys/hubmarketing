-- Cardoso Marketing Hub — miniaturas das fotos (corta o Cached Egress do Storage).
--
-- Por que: a lista de Produtos mostrava a foto original (~1 MB) num quadrinho de 26 px, e as
-- 315 de uma vez. Isso estourou o Cached Egress do plano free (11 GB de 5 GB no ciclo).
-- A miniatura (até 640 px, WebP) é gerada uma vez no navegador e guardada no próprio bucket
-- product-images, em thumbs/. A foto original não muda e continua disponível para download.
--
-- A chave é o ENDEREÇO da foto original: se a foto for trocada, o endereço muda e a miniatura
-- antiga simplesmente deixa de ser usada. Fica fora da tabela products de propósito: as travas
-- da 0099 recusariam a gravação nos produtos que ainda violam alguma regra.
--
-- Roda depois de 0001..0108. Idempotente.

set lock_timeout = '5s';

create table if not exists public.media_thumbs (
  source_url text primary key,
  thumb_url text not null,
  width int,
  bytes int,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.media_thumbs enable row level security;
drop policy if exists "mth_select" on public.media_thumbs;
create policy "mth_select" on public.media_thumbs for select to authenticated using (true);
drop policy if exists "mth_insert" on public.media_thumbs;
create policy "mth_insert" on public.media_thumbs for insert to authenticated with check (true);
drop policy if exists "mth_update" on public.media_thumbs;
create policy "mth_update" on public.media_thumbs for update to authenticated using (true) with check (true);
drop policy if exists "mth_delete" on public.media_thumbs;
create policy "mth_delete" on public.media_thumbs for delete to authenticated using (public.is_privileged());

-- Conferência depois de gerar no Hub:
--   select count(*) as miniaturas, pg_size_pretty(sum(bytes)::bigint) as tamanho from media_thumbs;
