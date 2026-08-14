-- Cardoso Marketing Hub — Social: novo módulo "Planejamento de mídias digitais".
-- Espelha o documento vivo (HTML) de 8 meses de conteúdo por marca, com aprovação/ajuste,
-- comentários em thread com menção, notificação que abre direto no item e edição de cada peça.
-- Roda depois de 0001..0075. Idempotente / retry-safe.
--
-- Modelo novo, independente do social_content antigo (que ficou parado). O front usa este.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Itens do plano (as 614 publicações). Campos espelham o modelo do HTML:
--    b/r/t/o/m/d/w/c/f/pr/p/k/s/ob/ct/md → brand/network/piece_type/origin/…
-- ---------------------------------------------------------------------------
create table if not exists public.social_plan_items (
  id uuid primary key default gen_random_uuid(),
  ext_id text unique,                               -- id original do documento (idempotência do seed)
  pub_date date not null,                           -- d
  weekday text not null default '',                 -- w  (Segunda…)
  month_label text not null default '',             -- m  (Ago/26)
  week_theme text not null default '',              -- s  (Semana 1 · Play & Imagine)
  brand text not null,                              -- b  (Playmi / Tópi / Cardoso)
  network text not null default '',                 -- r  (Instagram / Facebook / …)
  channel text not null default '',                 -- c  (Instagram · Reels)
  piece_type text not null default '',              -- t  (Reels / Feed / Stories / LinkedIn / Pin)
  format text not null default '',                  -- f  (Carrossel / Reels · Short / …)
  origin text not null default 'Original',          -- o  (Original / Apoio / Reaproveitamento)
  pauta text not null default '',                   -- p  (título/headline)
  product text not null default '',                 -- pr (produto)
  sku text not null default '',                     -- k
  objective text not null default '',               -- ob
  cta text not null default '',                     -- ct
  media_use text not null default '',               -- md
  product_id uuid references public.products (id),  -- vínculo opcional com o catálogo (SKU real)
  -- estado de aprovação (por item)
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'ajuste')),
  status_by uuid references public.profiles (id),
  status_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
create index if not exists social_plan_items_date_idx on public.social_plan_items (pub_date);
create index if not exists social_plan_items_brand_idx on public.social_plan_items (brand);
create index if not exists social_plan_items_status_idx on public.social_plan_items (status);

alter table public.social_plan_items enable row level security;
-- Ferramenta interna colaborativa: todo mundo autenticado lê e edita (como as Demandas).
drop policy if exists "spi_select" on public.social_plan_items;
create policy "spi_select" on public.social_plan_items for select to authenticated using (true);
drop policy if exists "spi_insert" on public.social_plan_items;
create policy "spi_insert" on public.social_plan_items for insert to authenticated with check (true);
drop policy if exists "spi_update" on public.social_plan_items;
create policy "spi_update" on public.social_plan_items for update to authenticated using (true) with check (true);
drop policy if exists "spi_delete" on public.social_plan_items;
create policy "spi_delete" on public.social_plan_items for delete to authenticated using (public.is_privileged());

-- ---------------------------------------------------------------------------
-- 2) Comentários em thread (com menção). kind: comment | approve | adjust
-- ---------------------------------------------------------------------------
create table if not exists public.social_plan_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.social_plan_items (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null default '',
  kind text not null default 'comment' check (kind in ('comment', 'approve', 'adjust')),
  mentioned_ids uuid[] not null default '{}',
  parent_id uuid references public.social_plan_comments (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists social_plan_comments_item_idx on public.social_plan_comments (item_id, created_at);

alter table public.social_plan_comments enable row level security;
drop policy if exists "spc_select" on public.social_plan_comments;
create policy "spc_select" on public.social_plan_comments for select to authenticated using (true);
drop policy if exists "spc_insert" on public.social_plan_comments;
create policy "spc_insert" on public.social_plan_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "spc_update_own" on public.social_plan_comments;
create policy "spc_update_own" on public.social_plan_comments for update to authenticated using (author_id = auth.uid());
drop policy if exists "spc_delete_own" on public.social_plan_comments;
create policy "spc_delete_own" on public.social_plan_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_privileged());

-- ---------------------------------------------------------------------------
-- 3) Prazos comerciais (a aba "Prazos comerciais" do documento)
-- ---------------------------------------------------------------------------
create table if not exists public.social_plan_deadlines (
  id uuid primary key default gen_random_uuid(),
  ext_key text unique,               -- chave idempotente do seed
  marco text not null,               -- Galinha Pintadinha O Filme
  dm text not null default '',       -- D-35
  limite date,                       -- data limite
  acao text not null default '',     -- ação
  resp text not null default '',     -- responsável
  ord int not null default 0
);
alter table public.social_plan_deadlines enable row level security;
drop policy if exists "spd_select" on public.social_plan_deadlines;
create policy "spd_select" on public.social_plan_deadlines for select to authenticated using (true);
drop policy if exists "spd_write" on public.social_plan_deadlines;
create policy "spd_write" on public.social_plan_deadlines for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

-- ---------------------------------------------------------------------------
-- 4) Notificações: coluna genérica de link (deep-link p/ qualquer módulo).
--    O sininho passa a preferir n.link quando existir.
-- ---------------------------------------------------------------------------
alter table public.notifications add column if not exists link text;

-- ---------------------------------------------------------------------------
-- 5) Trigger: menção em comentário do plano → notificação que abre no item.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_social_plan_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  ititle text;
  ntype text;
begin
  select coalesce(nullif(pauta, ''), product, 'uma peça') into ititle
    from public.social_plan_items where id = new.item_id;
  ntype := case when new.kind = 'adjust' then 'approval'
                when new.parent_id is not null then 'reply'
                else 'mention' end;
  foreach uid in array coalesce(new.mentioned_ids, '{}'::uuid[])
  loop
    if uid is not null and uid <> new.author_id then
      insert into public.notifications (user_id, actor_id, type, title, body, link)
      values (uid, new.author_id, ntype, coalesce(ititle, 'uma peça'), new.body,
              '/redes-sociais?item=' || new.item_id::text);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_social_plan_comment on public.social_plan_comments;
create trigger trg_notify_social_plan_comment
  after insert on public.social_plan_comments
  for each row execute function public.notify_on_social_plan_comment();

-- ---------------------------------------------------------------------------
-- 6) updated_at automático nos itens
-- ---------------------------------------------------------------------------
create or replace function public.touch_social_plan_item()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_touch_social_plan_item on public.social_plan_items;
create trigger trg_touch_social_plan_item
  before update on public.social_plan_items
  for each row execute function public.touch_social_plan_item();

-- ---------------------------------------------------------------------------
-- 7) Realtime: item, comentário e prazo aparecem sozinhos (sem F5)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'social_plan_items') then
    alter publication supabase_realtime add table public.social_plan_items;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'social_plan_comments') then
    alter publication supabase_realtime add table public.social_plan_comments;
  end if;
end $$;
