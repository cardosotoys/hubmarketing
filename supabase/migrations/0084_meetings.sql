-- Cardoso Marketing Hub — módulo Reuniões (foco em licenciamento).
-- Registra todas as reuniões: agência, marca, data, participantes, assuntos + itens
-- (demandas com responsável/prazo e pontos que precisam de avaliação/decisão).
-- Roda depois de 0001..0083. Idempotente.

set lock_timeout = '5s';

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'licenciamento' check (type in ('licenciamento', 'geral')),
  title text not null default '',
  agency text not null default '',        -- agência (licenciamento)
  brand text not null default '',         -- marca / propriedade licenciada
  meeting_date date,
  participants text not null default '',  -- participantes (livre)
  topics text not null default '',        -- principais assuntos
  notes text not null default '',         -- resumo / observações
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
create index if not exists meetings_date_idx on public.meetings (meeting_date desc);
create index if not exists meetings_type_idx on public.meetings (type);

-- itens da reunião: demanda (responsável/prazo) ou decisão (ponto que precisa de avaliação)
create table if not exists public.meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  kind text not null default 'demanda' check (kind in ('demanda', 'decisao')),
  description text not null default '',
  owner text not null default '',                 -- responsável (livre; pode ser externo)
  owner_id uuid references public.profiles (id),   -- opcional: vínculo com usuário do hub
  due_date date,                                   -- prazo
  status text not null default 'aberto' check (status in ('aberto', 'concluido')),
  decision text not null default '',               -- decisão registrada (quando kind='decisao')
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  position int not null default 0
);
create index if not exists meeting_items_meeting_idx on public.meeting_items (meeting_id, position);
create index if not exists meeting_items_open_idx on public.meeting_items (kind, status);

alter table public.meetings enable row level security;
alter table public.meeting_items enable row level security;

-- ferramenta interna colaborativa: autenticado lê e escreve; excluir reunião só privilegiado
drop policy if exists "meetings_select" on public.meetings;
create policy "meetings_select" on public.meetings for select to authenticated using (true);
drop policy if exists "meetings_insert" on public.meetings;
create policy "meetings_insert" on public.meetings for insert to authenticated with check (true);
drop policy if exists "meetings_update" on public.meetings;
create policy "meetings_update" on public.meetings for update to authenticated using (true) with check (true);
drop policy if exists "meetings_delete" on public.meetings;
create policy "meetings_delete" on public.meetings for delete to authenticated using (public.is_privileged());

drop policy if exists "mitems_select" on public.meeting_items;
create policy "mitems_select" on public.meeting_items for select to authenticated using (true);
drop policy if exists "mitems_all" on public.meeting_items;
create policy "mitems_all" on public.meeting_items for all to authenticated using (true) with check (true);

-- updated_at automático
create or replace function public.touch_meeting()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_touch_meeting on public.meetings;
create trigger trg_touch_meeting before update on public.meetings
  for each row execute function public.touch_meeting();

-- realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetings') then
    alter publication supabase_realtime add table public.meetings;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_items') then
    alter publication supabase_realtime add table public.meeting_items;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Visibilidade restrita: o módulo é "grantOnly" no front — só quem tiver 'reunioes'
-- em extra_modules vê/acessa. Libera pras 3 pessoas (Aldair, Stefany, Fabiana).
-- Ajuste os nomes se necessário. Idempotente (dedup).
-- ---------------------------------------------------------------------------
update public.profiles
set extra_modules = (select array(select distinct e from unnest(coalesce(extra_modules, '{}') || array['reunioes']) e))
where name ilike '%aldair%' or name ilike '%stefany%' or name ilike '%fabiana%';
