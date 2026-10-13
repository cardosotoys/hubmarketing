-- Cardoso Marketing Hub — Centro de Operações de Conteúdo, Fase 1: assunto + destinos.
--
-- Um ASSUNTO (social_topics) é a ideia: pauta, marca, produto, frente, objetivo, estratégia.
-- Cada DESTINO continua sendo uma linha de social_plan_items (assim comentários, aprovações e
-- notificações existentes seguem valendo), agora ligada ao assunto, a um canal cadastrado e com
-- horário, legenda, criativo (link do Drive) e o vínculo com a matriz:
--   matriz      → a peça principal do assunto
--   reaproveita → mesma legenda e criativo da matriz, em outro canal/dia
--   adapta      → legenda própria (e criativo próprio, se creative_changed)
-- O Facebook deixa de ser linha separada: vira mirror_facebook na peça do Instagram.
--
-- Roda depois de 0001..0107. Idempotente / retry-safe. Não apaga nada: as linhas de Facebook
-- espelho ficam archived = true com merged_into apontando para a peça do Instagram.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Canais cadastráveis
-- ---------------------------------------------------------------------------
create table if not exists public.social_channels (
  id text primary key,
  account text not null check (account in ('Cardoso', 'Playmi', 'Tópi')),
  name text not null,
  network text not null,                 -- rótulo legado usado pelos filtros (Instagram, WhatsApp…)
  caption_limit int,                     -- null = sem contador
  formats text[] not null default '{}',  -- formatos escolhíveis (Instagram: Feed/Reels/Stories)
  mirror text,                           -- rede espelho (Instagram → Facebook)
  future boolean not null default false, -- canal que ainda não existe: guarda as peças
  active boolean not null default true,
  ord int not null default 0
);

insert into public.social_channels (id, account, name, network, caption_limit, formats, mirror, future, ord) values
  ('cd-li',    'Cardoso', 'LinkedIn',                          'LinkedIn',           3000, '{}',                    null,       false, 10),
  ('cd-ig',    'Cardoso', 'Instagram',                         'Instagram',          2200, '{Feed,Reels,Stories}',  'Facebook', false, 20),
  ('cd-fb',    'Cardoso', 'Facebook · post nativo',            'Facebook',           null, '{}',                    null,       false, 25),
  ('cd-yt-pl', 'Cardoso', 'YouTube · playlist Playmi',         'YouTube Shorts',     5000, '{Shorts,Vídeo}',        null,       false, 30),
  ('cd-yt-tp', 'Cardoso', 'YouTube · playlist Tópi',           'YouTube Shorts',     5000, '{Shorts,Vídeo}',        null,       false, 31),
  ('cd-pin',   'Cardoso', 'Pinterest',                         'Pinterest',          500,  '{}',                    null,       false, 40),
  ('cd-gmn',   'Cardoso', 'Google Meu Negócio',                'Google Meu Negócio', 1500, '{}',                    null,       false, 50),
  ('wa-st',    'Cardoso', 'WhatsApp · Status',                 'WhatsApp',           null, '{}',                    null,       false, 60),
  ('wa-rep',   'Cardoso', 'WhatsApp · Canal Representantes',   'WhatsApp',           null, '{}',                    null,       false, 61),
  ('wa-s',     'Cardoso', 'WhatsApp · Clientes Sul',           'WhatsApp',           null, '{}',                    null,       false, 62),
  ('wa-se',    'Cardoso', 'WhatsApp · Clientes Sudeste',       'WhatsApp',           null, '{}',                    null,       false, 63),
  ('wa-nne',   'Cardoso', 'WhatsApp · Clientes Norte/Nordeste','WhatsApp',           null, '{}',                    null,       false, 64),
  ('wa-co',    'Cardoso', 'WhatsApp · Clientes Centro-Oeste',  'WhatsApp',           null, '{}',                    null,       false, 65),
  ('pl-ig',    'Playmi',  'Instagram',                         'Instagram',          2200, '{Feed,Reels,Stories}',  'Facebook', false, 70),
  ('pl-fb',    'Playmi',  'Facebook · post nativo',            'Facebook',           null, '{}',                    null,       false, 75),
  ('pl-tt',    'Playmi',  'TikTok',                            'TikTok',             2200, '{}',                    null,       true,  80),
  ('tp-ig',    'Tópi',    'Instagram',                         'Instagram',          2200, '{Feed,Reels,Stories}',  'Facebook', false, 90),
  ('tp-fb',    'Tópi',    'Facebook · post nativo',            'Facebook',           null, '{}',                    null,       false, 95),
  ('tp-tt',    'Tópi',    'TikTok',                            'TikTok',             2200, '{}',                    null,       false, 100)
on conflict (id) do nothing;

alter table public.social_channels enable row level security;
drop policy if exists "sch_select" on public.social_channels;
create policy "sch_select" on public.social_channels for select to authenticated using (true);
drop policy if exists "sch_write" on public.social_channels;
create policy "sch_write" on public.social_channels for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

-- ---------------------------------------------------------------------------
-- 2) Assuntos
-- ---------------------------------------------------------------------------
create table if not exists public.social_topics (
  id uuid primary key default gen_random_uuid(),
  ext_key text unique,                               -- 'item:<id>' quando nasceu do plano antigo
  title text not null default '',
  brand text not null,
  product text not null default '',
  sku text not null default '',
  product_id uuid references public.products (id),
  front text not null default '',                    -- frente / tema da semana
  objective text not null default '',
  strategy text not null default '',                 -- por que esta peça existe agora
  cta text not null default '',
  media_use text not null default '',
  licensed boolean not null default false,
  licensor_ok boolean not null default false,
  licensor_proof text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
create index if not exists social_topics_brand_idx on public.social_topics (brand);

alter table public.social_topics enable row level security;
drop policy if exists "stp_select" on public.social_topics;
create policy "stp_select" on public.social_topics for select to authenticated using (true);
drop policy if exists "stp_insert" on public.social_topics;
create policy "stp_insert" on public.social_topics for insert to authenticated with check (true);
drop policy if exists "stp_update" on public.social_topics;
create policy "stp_update" on public.social_topics for update to authenticated using (true) with check (true);
drop policy if exists "stp_delete" on public.social_topics;
create policy "stp_delete" on public.social_topics for delete to authenticated using (public.is_privileged());

create or replace function public.touch_social_topic()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_touch_social_topic on public.social_topics;
create trigger trg_touch_social_topic
  before update on public.social_topics
  for each row execute function public.touch_social_topic();

-- ---------------------------------------------------------------------------
-- 3) Destinos: colunas novas nas peças
-- ---------------------------------------------------------------------------
alter table public.social_plan_items add column if not exists topic_id uuid references public.social_topics (id) on delete cascade;
alter table public.social_plan_items add column if not exists channel_id text references public.social_channels (id);
alter table public.social_plan_items add column if not exists link_kind text not null default 'matriz';
alter table public.social_plan_items add column if not exists pub_time time;
alter table public.social_plan_items add column if not exists caption text;
alter table public.social_plan_items add column if not exists creative_url text;
alter table public.social_plan_items add column if not exists creative_changed boolean not null default false;
alter table public.social_plan_items add column if not exists mirror_facebook boolean not null default false;
alter table public.social_plan_items add column if not exists archived boolean not null default false;
alter table public.social_plan_items add column if not exists merged_into uuid references public.social_plan_items (id) on delete set null;

alter table public.social_plan_items drop constraint if exists social_plan_items_link_kind_check;
alter table public.social_plan_items add constraint social_plan_items_link_kind_check
  check (link_kind in ('matriz', 'reaproveita', 'adapta'));

create index if not exists social_plan_items_topic_idx on public.social_plan_items (topic_id);
create index if not exists social_plan_items_archived_idx on public.social_plan_items (archived);

-- ---------------------------------------------------------------------------
-- 4) Backfill: canal de cada peça
-- ---------------------------------------------------------------------------
update public.social_plan_items set channel_id = case
    when network = 'Instagram' then case brand when 'Playmi' then 'pl-ig' when 'Tópi' then 'tp-ig' else 'cd-ig' end
    when network = 'Facebook'  then case brand when 'Playmi' then 'pl-fb' when 'Tópi' then 'tp-fb' else 'cd-fb' end
    when network = 'LinkedIn'  then 'cd-li'
    when network = 'TikTok'    then case brand when 'Playmi' then 'pl-tt' when 'Tópi' then 'tp-tt' end
    when network = 'YouTube Shorts' then case brand when 'Tópi' then 'cd-yt-tp' else 'cd-yt-pl' end
    when network = 'Pinterest' then 'cd-pin'
  end
where channel_id is null;

-- ---------------------------------------------------------------------------
-- 5) Backfill: Facebook espelho → mirror_facebook na peça do Instagram
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select distinct on (f.id) f.id as fb_id, f.status as fb_status, f.status_by, f.status_at, i.id as ig_id
      from public.social_plan_items f
      join public.social_plan_items i
        on i.network = 'Instagram' and i.brand = f.brand and i.pauta = f.pauta and i.product = f.product
       and i.pub_date = f.pub_date and i.piece_type = f.piece_type and not i.archived
     where f.network = 'Facebook' and not f.archived and f.topic_id is null
     order by f.id, i.created_at
  loop
    update public.social_plan_comments set item_id = r.ig_id where item_id = r.fb_id;
    update public.social_plan_items set mirror_facebook = true where id = r.ig_id;
    -- se só o Facebook tinha decisão, ela passa para a peça que fica
    update public.social_plan_items set status = r.fb_status, status_by = r.status_by, status_at = r.status_at
     where id = r.ig_id and status = 'pendente' and r.fb_status <> 'pendente';
    update public.social_plan_items set archived = true, merged_into = r.ig_id, channel_id = null where id = r.fb_id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Backfill: assuntos
--    a) peças originais e de apoio: um assunto por (marca, pauta, produto, data)
--    b) reaproveitamentos: entram no assunto da peça-mãe (parent_item_id) ou no assunto da
--       mesma pauta até 21 dias de distância; sem par, viram assunto próprio
-- ---------------------------------------------------------------------------
do $$
declare g record; r record; tid uuid; mid uuid;
begin
  for g in
    select brand, pauta, product, pub_date,
           array_agg(id order by (network = 'Instagram') desc, created_at) as ids
      from public.social_plan_items
     where not archived and topic_id is null and origin <> 'Reaproveitamento'
     group by brand, pauta, product, pub_date
  loop
    mid := g.ids[1];
    insert into public.social_topics (ext_key, title, brand, product, sku, product_id, front, objective, cta, media_use)
    select 'item:' || id, pauta, brand, product, sku, product_id, week_theme, objective, cta, media_use
      from public.social_plan_items where id = mid
    on conflict (ext_key) do update set ext_key = excluded.ext_key
    returning id into tid;
    update public.social_plan_items
       set topic_id = tid, link_kind = case when id = mid then 'matriz' else 'reaproveita' end
     where id = any (g.ids);
  end loop;

  for r in
    select i.* from public.social_plan_items i
      left join public.social_channels c on c.id = i.channel_id
     where not i.archived and i.topic_id is null
     order by coalesce(c.future, false), i.pub_date, i.created_at
  loop
    tid := null;
    if r.parent_item_id is not null then
      select topic_id into tid from public.social_plan_items where id = r.parent_item_id;
    end if;
    if tid is null then
      select m.topic_id into tid
        from public.social_plan_items m
       where m.topic_id is not null and m.link_kind = 'matriz' and not m.archived
         and m.brand = r.brand and m.pauta = r.pauta and m.product = r.product
         and abs(r.pub_date - m.pub_date) <= 21
       order by abs(r.pub_date - m.pub_date)
       limit 1;
    end if;
    if tid is not null then
      update public.social_plan_items set topic_id = tid, link_kind = 'reaproveita' where id = r.id;
    else
      insert into public.social_topics (ext_key, title, brand, product, sku, product_id, front, objective, cta, media_use)
      values ('item:' || r.id, r.pauta, r.brand, r.product, r.sku, r.product_id, r.week_theme, r.objective, r.cta, r.media_use)
      on conflict (ext_key) do update set ext_key = excluded.ext_key
      returning id into tid;
      update public.social_plan_items set topic_id = tid, link_kind = 'matriz' where id = r.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Realtime: assunto editado aparece sozinho
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'social_topics') then
    alter publication supabase_realtime add table public.social_topics;
  end if;
end $$;

-- Conferência (deve dar 0 nas duas primeiras linhas):
--   select count(*) from social_plan_items where not archived and topic_id is null;
--   select count(*) from social_topics t where not exists (select 1 from social_plan_items i where i.topic_id = t.id and i.link_kind = 'matriz');
--   select count(*) as assuntos from social_topics;
