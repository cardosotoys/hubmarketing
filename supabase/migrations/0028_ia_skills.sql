-- Cardoso Marketing Hub — biblioteca de Skills no módulo IA
-- Roda uma vez no SQL Editor, depois de 0001..0027 já terem rodado.

create table public.ia_skills (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id),
  category text not null default '',
  name text not null,
  description text not null default '',
  body text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ia_skills (brand_id);
create index on public.ia_skills (category);

alter table public.ia_skills enable row level security;
create policy "ia_skills_select_authenticated" on public.ia_skills for select to authenticated using (true);
create policy "ia_skills_insert_authenticated" on public.ia_skills for insert to authenticated with check (true);
create policy "ia_skills_update_authenticated" on public.ia_skills for update to authenticated using (true);
create policy "ia_skills_delete_privileged" on public.ia_skills for delete to authenticated using (public.is_privileged());
