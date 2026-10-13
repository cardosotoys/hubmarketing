-- Cardoso Marketing Hub — Centro de Operações de Conteúdo, Fase 3: banco de materiais + área comercial.
--
-- content_materials   → tudo o que é produzido para o cliente fora das redes: fotos, vídeos, kits de
--                       campanha e documentos, por produto, com o link do Drive. Uma liberação só.
-- commercial_banners  → os banners da área comercial. Reservar um banner já cria a demanda de arte
--                       nas Demandas, com entrega 10 dias antes de ele entrar no ar.
--
-- Quem libera (material ou banner) é o aprovador do Social (social_plan_settings.approver_id) ou a
-- diretoria. A trava fica no banco, num trigger.
-- As demandas avulsas só são visíveis para o responsável (RLS de tasks, 0048); por isso o quadro lê a
-- etapa de cada demanda por uma função security definer, que devolve só etapa, responsável e prazo.
--
-- Roda depois de 0110. Idempotente.

set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Banco de materiais
-- ---------------------------------------------------------------------------
create table if not exists public.content_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  subject text not null default '',      -- quando não é de um produto: "Kit de Natal", "Catálogo 2026"…
  brand text not null default 'Cardoso',
  kind text not null check (kind in ('foto', 'video', 'kit', 'documento')),
  name text not null,
  drive_url text not null default '',
  status text not null default 'pedido' check (status in ('pedido', 'producao', 'aguardando', 'liberado')),
  task_id uuid references public.tasks (id) on delete set null,
  notes text not null default '',
  announced boolean not null default false,   -- já virou aviso no WhatsApp
  released_by uuid references public.profiles (id),
  released_at timestamptz,
  library_asset_id uuid references public.library_assets (id) on delete set null, -- quando o robô do Drive existir
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_materials_product_idx on public.content_materials (product_id);
create index if not exists content_materials_status_idx on public.content_materials (status);

alter table public.content_materials enable row level security;
drop policy if exists "cm_select" on public.content_materials;
create policy "cm_select" on public.content_materials for select to authenticated using (true);
drop policy if exists "cm_insert" on public.content_materials;
create policy "cm_insert" on public.content_materials for insert to authenticated with check (true);
drop policy if exists "cm_update" on public.content_materials;
create policy "cm_update" on public.content_materials for update to authenticated using (true) with check (true);
drop policy if exists "cm_delete" on public.content_materials;
create policy "cm_delete" on public.content_materials for delete to authenticated
  using (public.is_privileged() or created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 2) Banners da área comercial
-- ---------------------------------------------------------------------------
create table if not exists public.commercial_banners (
  id uuid primary key default gen_random_uuid(),
  seal text not null default 'CAMPANHA' check (seal in ('CAMPANHA', 'LANÇAMENTO', 'AVISO COMERCIAL', 'CLUBE CARDOSO')),
  title text not null,
  subtitle text not null default '',
  cta text not null default '',
  cta_link text not null default '',
  starts_on date not null,
  ends_on date not null,
  marco text not null default '',
  art_url text not null default '',       -- arte final no Drive
  task_id uuid references public.tasks (id) on delete set null,
  owner_id uuid references public.profiles (id),
  released boolean not null default false,
  released_by uuid references public.profiles (id),
  released_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_banners_periodo check (ends_on >= starts_on)
);
create index if not exists commercial_banners_period_idx on public.commercial_banners (starts_on, ends_on);

alter table public.commercial_banners enable row level security;
drop policy if exists "cb_select" on public.commercial_banners;
create policy "cb_select" on public.commercial_banners for select to authenticated using (true);
drop policy if exists "cb_insert" on public.commercial_banners;
create policy "cb_insert" on public.commercial_banners for insert to authenticated with check (true);
drop policy if exists "cb_update" on public.commercial_banners;
create policy "cb_update" on public.commercial_banners for update to authenticated using (true) with check (true);
drop policy if exists "cb_delete" on public.commercial_banners;
create policy "cb_delete" on public.commercial_banners for delete to authenticated
  using (public.is_privileged() or created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) Liberação: só o aprovador ou a diretoria; editar o arquivo depois tira a liberação
-- ---------------------------------------------------------------------------
create or replace function public.can_release_content()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_privileged()
      or exists (select 1 from public.social_plan_settings s where s.id = 1 and s.approver_id = auth.uid())
$$;

create or replace function public.content_release_rules()
returns trigger language plpgsql set search_path = public as $$
declare was boolean; now_on boolean;
begin
  new.updated_at := now();
  if tg_table_name = 'content_materials' then
    was := tg_op = 'UPDATE' and old.status = 'liberado';
    now_on := new.status = 'liberado';
    -- arquivo trocado depois de liberado volta para a liberação
    if was and now_on and new.drive_url is distinct from old.drive_url then
      new.status := 'aguardando'; new.released_by := null; new.released_at := null; now_on := false;
    end if;
    if now_on and not coalesce(was, false) then
      if not public.can_release_content() then raise exception 'Só o aprovador ou a diretoria liberam material para o cliente.'; end if;
      if coalesce(new.drive_url, '') = '' then raise exception 'Material sem link do Drive não pode ser liberado.'; end if;
      new.released_by := auth.uid(); new.released_at := now();
    end if;
    if not now_on then new.released_by := null; new.released_at := null; end if;
  else
    was := tg_op = 'UPDATE' and old.released;
    now_on := new.released;
    if was and now_on and new.art_url is distinct from old.art_url then
      new.released := false; now_on := false;
    end if;
    if now_on and not coalesce(was, false) then
      if not public.can_release_content() then raise exception 'Só o aprovador ou a diretoria liberam banner.'; end if;
      if coalesce(new.art_url, '') = '' then raise exception 'Banner sem a arte final no Drive não pode ser liberado.'; end if;
      new.released_by := auth.uid(); new.released_at := now();
    end if;
    if not now_on then new.released_by := null; new.released_at := null; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cm_release on public.content_materials;
create trigger trg_cm_release before insert or update on public.content_materials
  for each row execute function public.content_release_rules();
drop trigger if exists trg_cb_release on public.commercial_banners;
create trigger trg_cb_release before insert or update on public.commercial_banners
  for each row execute function public.content_release_rules();

-- ---------------------------------------------------------------------------
-- 4) Demanda vinculada: cria a demanda avulsa na primeira etapa global
-- ---------------------------------------------------------------------------
create or replace function public.content_create_task(p_title text, p_assignee uuid, p_due date, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; tid uuid;
begin
  if auth.uid() is null then raise exception 'Entre no Hub para criar a demanda.'; end if;
  select id into sid from public.stages
   where project_id is null and packaging_track is null order by position limit 1;
  if sid is null then raise exception 'As etapas das demandas avulsas não estão configuradas.'; end if;
  insert into public.tasks (title, project_id, priority, assignee_id, due_date, stage_id, notes, updated_by)
  values (p_title, null, 'medium', p_assignee, p_due, sid, coalesce(p_notes, ''), auth.uid())
  returning id into tid;
  return tid;
end;
$$;

-- Reservar banner: demanda + banner na mesma transação. Entrada no ar com pelo menos 10 dias.
create or replace function public.reserve_commercial_banner(
  p_seal text, p_title text, p_subtitle text, p_cta text, p_cta_link text,
  p_starts date, p_ends date, p_marco text, p_owner uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid; bid uuid; due date;
begin
  if p_starts < current_date + 10 then
    raise exception 'O banner precisa entrar no ar a pelo menos 10 dias de hoje, para caber as aprovações.';
  end if;
  if p_ends < p_starts then raise exception 'A saída do ar não pode ser antes da entrada.'; end if;
  due := p_starts - 10;
  tid := public.content_create_task(
    'Arte do banner da área comercial: ' || p_title, p_owner, due,
    format(E'Banner da área comercial (%s).\nNo ar de %s a %s.\nTítulo: %s\nSubtítulo: %s\nBotão: %s%s\nEntrega da arte até %s, para caber as aprovações.',
      p_seal, to_char(p_starts, 'DD/MM/YYYY'), to_char(p_ends, 'DD/MM/YYYY'), p_title, coalesce(p_subtitle, ''), coalesce(p_cta, ''),
      case when coalesce(p_marco, '') <> '' then E'\nMarco: ' || p_marco else '' end, to_char(due, 'DD/MM/YYYY')));
  insert into public.commercial_banners (seal, title, subtitle, cta, cta_link, starts_on, ends_on, marco, task_id, owner_id)
  values (p_seal, p_title, coalesce(p_subtitle, ''), coalesce(p_cta, ''), coalesce(p_cta_link, ''), p_starts, p_ends, coalesce(p_marco, ''), tid, p_owner)
  returning id into bid;
  return bid;
end;
$$;

-- Etapa das demandas ligadas a material/banner, sem abrir a demanda inteira
create or replace function public.content_task_board()
returns table (task_id uuid, stage_name text, stage_position int, is_final boolean, assignee_id uuid, assignee_name text, due_date date)
language sql stable security definer set search_path = public as $$
  select t.id, s.name, s.position, coalesce(s.is_final, false), t.assignee_id, p.name, t.due_date
    from public.tasks t
    left join public.stages s on s.id = t.stage_id
    left join public.profiles p on p.id = t.assignee_id
   where auth.uid() is not null
     and (t.id in (select task_id from public.commercial_banners where task_id is not null)
       or t.id in (select task_id from public.content_materials where task_id is not null))
$$;

revoke all on function public.content_create_task(text, uuid, date, text) from public, anon;
grant execute on function public.content_create_task(text, uuid, date, text) to authenticated;
revoke all on function public.reserve_commercial_banner(text, text, text, text, text, date, date, text, uuid) from public, anon;
grant execute on function public.reserve_commercial_banner(text, text, text, text, text, date, date, text, uuid) to authenticated;
revoke all on function public.content_task_board() from public, anon;
grant execute on function public.content_task_board() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_materials') then
    alter publication supabase_realtime add table public.content_materials;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'commercial_banners') then
    alter publication supabase_realtime add table public.commercial_banners;
  end if;
end $$;
