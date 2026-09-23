-- Cardoso Marketing Hub — Biblioteca: o esqueleto do espelho do Google Drive
-- Roda depois de 0001..0097. Idempotente, retry-safe e INERTE: nada muda de
-- comportamento hoje. Cria as tabelas que o robô vai preencher e a regra de
-- cargo desligada (toda pasta nasce visível pra todo mundo logado, como hoje).
--
-- As decisões que este SQL materializa:
--
--   1) NADA guarda URL. Tudo guarda id de ativo (library_assets.id). O endereço
--      do Drive é DERIVADO do drive_file_id na hora de mostrar:
--        uso interno  -> https://drive.google.com/file/d/<id>/view   (link direto)
--        vídeo        -> https://drive.google.com/file/d/<id>/preview (player do
--                        Drive, embutido na vitrine — o arquivo nunca desce)
--      Por isso não existe coluna "url" em lugar nenhum daqui.
--
--   2) Acesso em duas camadas:
--        fora  -> o robô só enxerga o que for compartilhado com a conta de
--                 serviço no Google. O que não for compartilhado não existe
--                 pro Hub; quem manda nisso é o Google, não este banco.
--        dentro-> library_folders.visible_to lista os departamentos que podem
--                 ver a pasta. Vazio = todo mundo logado. A regra desce pra
--                 subárvore inteira (effective_visible_to, mantido por gatilho),
--                 e a pasta mais próxima com regra própria ganha.
--
--   3) O Hub só guarda cópia de UMA coisa: a foto que o cliente vê. O lojista
--      abre a vitrine por token, sem login e sem conta Google — não tem como
--      ele buscar no Drive. Então imagem marcada como vitrine ganha uma cópia
--      pequena no bucket library-cache. Todo o resto é link direto, e o
--      library-cache é blindado: só entra imagem com vitrine = true, e só
--      diretoria/administrador consegue marcar vitrine (via RPC abaixo).

set lock_timeout = '5s';

begin;

-- ---------------------------------------------------------------- 1) pastas
-- A árvore de 92 pastas feita à mão continua de pé. Ela só ganha o vínculo com
-- a pasta real do Drive e a regra de cargo.

alter table public.library_folders
  add column if not exists drive_folder_id text,
  add column if not exists origin text not null default 'hub',
  add column if not exists visible_to text[] not null default '{}',
  add column if not exists effective_visible_to text[] not null default '{}',
  add column if not exists missing_in_drive_since timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'library_folders_origin_check') then
    alter table public.library_folders
      add constraint library_folders_origin_check check (origin in ('hub', 'drive'));
  end if;
end
$$;

comment on column public.library_folders.drive_folder_id is
  'Id da pasta no Google Drive. Nulo = pasta que existe só no Hub, ainda não conciliada.';
comment on column public.library_folders.origin is
  'hub = nasceu aqui (as 92 à mão); drive = o robô trouxe.';
comment on column public.library_folders.visible_to is
  'Departamentos que podem ver esta pasta. Vazio = todo mundo logado. Desce pra subárvore.';
comment on column public.library_folders.effective_visible_to is
  'Não edite: o gatilho calcula a partir do visible_to do ancestral mais próximo.';
comment on column public.library_folders.missing_in_drive_since is
  'Quando o robô deixou de achar a pasta no Drive. Nada é apagado — fica marcado.';

create unique index if not exists library_folders_drive_folder_id_key
  on public.library_folders (drive_folder_id) where drive_folder_id is not null;

-- Recalcula a herança de visibilidade da árvore inteira (92 linhas: é barato).
create or replace function public.library_recompute_visibility()
returns void
language sql
security definer
set search_path = public
as $$
  with recursive tree as (
    select id, visible_to as eff
      from public.library_folders
     where parent_id is null
    union all
    select f.id,
           case when coalesce(array_length(f.visible_to, 1), 0) > 0 then f.visible_to else t.eff end
      from public.library_folders f
      join tree t on f.parent_id = t.id
  )
  update public.library_folders f
     set effective_visible_to = t.eff
    from tree t
   where f.id = t.id
     and f.effective_visible_to is distinct from t.eff;
$$;

create or replace function public.library_folders_visibility_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- O próprio recálculo dispara este gatilho de novo (profundidade 2) — para aqui.
  if pg_trigger_depth() <= 1 then
    perform public.library_recompute_visibility();
  end if;
  return null;
end;
$$;

drop trigger if exists library_folders_visibility_sync on public.library_folders;
create trigger library_folders_visibility_sync
  after insert or update or delete on public.library_folders
  for each statement execute function public.library_folders_visibility_sync();

select public.library_recompute_visibility();

-- ---------------------------------------------------------------- 2) ativos
create table if not exists public.library_assets (
  id uuid primary key default gen_random_uuid(),
  drive text not null check (drive in ('cardoso', 'playmi', 'topi')),
  drive_file_id text not null,
  folder_id uuid references public.library_folders (id) on delete set null,
  drive_parent_id text not null default '',
  name text not null,
  mime_type text not null default '',
  kind text not null default 'outro'
    check (kind in ('imagem', 'video', 'pdf', 'vetor', 'documento', 'planilha', 'apresentacao', 'outro')),
  size_bytes bigint not null default 0,
  checksum text not null default '',
  drive_modified_at timestamptz,
  trashed boolean not null default false,
  -- o único caso de cópia: imagem que o cliente vê na vitrine
  vitrine boolean not null default false,
  cache_path text not null default '',
  cache_bytes integer not null default 0,
  cache_checksum text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  missing_since timestamptz,
  -- blindagem: nenhum arquivo ganha cópia sem ser imagem de vitrine
  constraint library_assets_cache_so_vitrine
    check (cache_path = '' or (vitrine and kind = 'imagem'))
);

comment on table public.library_assets is
  'Um registro por arquivo do Drive que o Hub conhece. É o id daqui que o resto do sistema guarda — nunca a URL.';
comment on column public.library_assets.checksum is
  'md5Checksum do Drive. Mudou = o arquivo mudou e a cópia de vitrine precisa ser refeita.';
comment on column public.library_assets.vitrine is
  'true = esta imagem aparece pro lojista. Só quem tem privilégio marca, pela RPC library_marcar_vitrine.';
comment on column public.library_assets.missing_since is
  'O robô parou de ver o arquivo. Fica marcado, não some — quem apaga é gente, no Drive.';

create unique index if not exists library_assets_drive_file_id_key
  on public.library_assets (drive_file_id);
create index if not exists library_assets_folder_idx on public.library_assets (folder_id);
create index if not exists library_assets_drive_idx on public.library_assets (drive, trashed);
create index if not exists library_assets_vitrine_idx on public.library_assets (vitrine) where vitrine;

-- ------------------------------------------------- 3) o robô: raízes e estado
create table if not exists public.library_drive_roots (
  drive text primary key check (drive in ('cardoso', 'playmi', 'topi')),
  root_folder_id text not null default '',
  shared_drive_id text not null default '',
  page_token text not null default '',
  enabled boolean not null default false,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text not null default ''
);

comment on table public.library_drive_roots is
  'Uma linha por Drive. root_folder_id = a pasta compartilhada com a conta de serviço; page_token = o cursor do changes.list (leitura incremental, não varre o Drive inteiro).';

insert into public.library_drive_roots (drive)
values ('cardoso'), ('playmi'), ('topi')
on conflict (drive) do nothing;

create table if not exists public.library_sync_settings (
  id integer primary key default 1 check (id = 1),
  interval_minutes integer not null default 30,
  cache_max_px integer not null default 1200,
  cache_quality integer not null default 78,
  paused boolean not null default false
);

comment on table public.library_sync_settings is
  'Mesmo truque do mpm-sync: o cron bate de hora em hora e a função decide se já é hora de rodar, olhando aqui. Assim o ritmo se ajusta pelo Hub, sem reagendar cron.';

insert into public.library_sync_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.library_sync_runs (
  id uuid primary key default gen_random_uuid(),
  drive text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'rodando' check (status in ('rodando', 'ok', 'erro')),
  folders_new integer not null default 0,
  assets_new integer not null default 0,
  assets_updated integer not null default 0,
  assets_gone integer not null default 0,
  cache_written integer not null default 0,
  error text not null default ''
);
create index if not exists library_sync_runs_recentes on public.library_sync_runs (started_at desc);

-- -------------------------------------------- 4) produto aponta pro ativo
-- Aditivo. image_url e packaging_image_url continuam mandando enquanto o
-- espelho não estiver povoado; quem troca a ordem é a Fase 4.
alter table public.products
  add column if not exists image_asset_id uuid references public.library_assets (id) on delete set null,
  add column if not exists packaging_image_asset_id uuid references public.library_assets (id) on delete set null;

comment on column public.products.image_asset_id is
  'Foto do produto como ativo do Drive. Quando preenchida, é ela que manda — image_url vira legado.';

-- ------------------------------------------------------------- 5) permissão
create or replace function public.library_pode_ver(eff text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_length(eff, 1), 0) = 0
      or public.is_privileged()
      or exists (
           select 1 from public.profiles p
            where p.id = auth.uid() and p.department = any(eff)
         );
$$;

create or replace function public.library_pode_ver_pasta(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when fid is null then public.is_privileged()
    else public.library_pode_ver((select effective_visible_to from public.library_folders where id = fid))
  end;
$$;

-- A leitura das pastas passa a respeitar o cargo. Como toda pasta nasce com
-- visible_to vazio, hoje isso devolve exatamente o que devolvia antes.
drop policy if exists "library_folders_select_authenticated" on public.library_folders;
create policy "library_folders_select_por_cargo" on public.library_folders
  for select to authenticated using (public.library_pode_ver(effective_visible_to));

alter table public.library_assets enable row level security;

drop policy if exists "library_assets_select_por_cargo" on public.library_assets;
create policy "library_assets_select_por_cargo" on public.library_assets
  for select to authenticated using (public.library_pode_ver_pasta(folder_id));

-- Ninguém escreve ativo à mão: quem escreve é o robô (service_role, que passa
-- por cima de RLS). A única mexida humana é marcar vitrine, pela RPC abaixo.

create or replace function public.library_marcar_vitrine(asset_id uuid, ligado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if not public.is_privileged() then
    raise exception 'Só diretoria ou administrador marca imagem de vitrine.';
  end if;

  select kind into k from public.library_assets where id = asset_id;
  if k is null then
    raise exception 'Ativo não encontrado.';
  end if;
  if ligado and k <> 'imagem' then
    raise exception 'Só imagem vai pra vitrine. Vídeo toca pelo player do Drive, e o resto é link direto.';
  end if;

  update public.library_assets
     set vitrine = ligado,
         -- desmarcou: a cópia some na próxima passada do robô
         cache_checksum = case when ligado then cache_checksum else '' end
   where id = asset_id;
end;
$$;

revoke all on function public.library_marcar_vitrine(uuid, boolean) from public;
grant execute on function public.library_marcar_vitrine(uuid, boolean) to authenticated;

-- Painel do robô: o time lê o estado e o histórico; só privilegiado ajusta.
alter table public.library_drive_roots enable row level security;
drop policy if exists "library_roots_select" on public.library_drive_roots;
create policy "library_roots_select" on public.library_drive_roots
  for select to authenticated using (true);
drop policy if exists "library_roots_update" on public.library_drive_roots;
create policy "library_roots_update" on public.library_drive_roots
  for update to authenticated using (public.is_privileged());

alter table public.library_sync_settings enable row level security;
drop policy if exists "library_sync_settings_select" on public.library_sync_settings;
create policy "library_sync_settings_select" on public.library_sync_settings
  for select to authenticated using (true);
drop policy if exists "library_sync_settings_update" on public.library_sync_settings;
create policy "library_sync_settings_update" on public.library_sync_settings
  for update to authenticated using (public.is_privileged());

alter table public.library_sync_runs enable row level security;
drop policy if exists "library_sync_runs_select" on public.library_sync_runs;
create policy "library_sync_runs_select" on public.library_sync_runs
  for select to authenticated using (true);

-- ------------------------------------------------------------ 6) o cache
-- Bucket de leitura pública DE PROPÓSITO: a vitrine do lojista abre por token,
-- sem login (rota /vitrine/:token, fora das rotas autenticadas do CRM), então
-- não existe sessão pra assinar URL. É a mesma exposição que product-images já
-- tem hoje — a diferença é que agora só entra aqui imagem marcada como vitrine
-- (garantido pela constraint library_assets_cache_so_vitrine e pela RPC), e
-- quem escreve é só o robô. Nada sensível do Drive ganha cópia: uso interno é
-- link direto, e aí quem decide quem vê é o Google.
insert into storage.buckets (id, name, public, file_size_limit)
values ('library-cache', 'library-cache', true, 5242880)
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists "library_cache_read" on storage.objects;
create policy "library_cache_read" on storage.objects
  for select to public using (bucket_id = 'library-cache');
-- Sem policy de insert/update/delete: só o service_role (o robô) escreve.

-- ---------------------------------------------------------- 7) o que sai
comment on table public.library_links is
  'DEPRECADA pelo espelho do Drive: guarda URL colada à mão, e a regra agora é guardar id de ativo (library_assets). Está vazia. Sai na Fase 2, quando a tela da Biblioteca passar a listar ativos.';

commit;
