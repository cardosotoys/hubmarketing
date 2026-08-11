-- Cardoso Marketing Hub — proteger as instruções de acesso do guia (credenciais) em tabela restrita
-- Roda depois de 0001..0062. RODE DEPOIS que o deploy do código novo do Brand Center subir
-- (o app novo lê/grava em brand_licensee_access e não usa mais brand_licensees.access_info).
--
-- Motivo: RLS não esconde COLUNA — só linha. Como access_info guardava login/observações de acesso
-- aos portais dos licenciadores, ficava legível por qualquer autenticado. Movendo para uma tabela
-- própria com RLS restrito a is_privileged(), só Diretoria/Admin lê e edita.

set lock_timeout = '5s';

create table if not exists public.brand_licensee_access (
  licensee_id uuid primary key references public.brand_licensees (id) on delete cascade,
  access_info text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.brand_licensee_access enable row level security;
drop policy if exists "bla_select" on public.brand_licensee_access;
create policy "bla_select" on public.brand_licensee_access for select to authenticated using (public.is_privileged());
drop policy if exists "bla_insert" on public.brand_licensee_access;
create policy "bla_insert" on public.brand_licensee_access for insert to authenticated with check (public.is_privileged());
drop policy if exists "bla_update" on public.brand_licensee_access;
create policy "bla_update" on public.brand_licensee_access for update to authenticated using (public.is_privileged()) with check (public.is_privileged());
drop policy if exists "bla_delete" on public.brand_licensee_access;
create policy "bla_delete" on public.brand_licensee_access for delete to authenticated using (public.is_privileged());

-- migra o que já existe
insert into public.brand_licensee_access (licensee_id, access_info)
select id, access_info from public.brand_licensees where coalesce(access_info, '') <> ''
on conflict (licensee_id) do nothing;

-- remove a coluna aberta (o app novo não usa mais)
alter table public.brand_licensees drop column if exists access_info;
