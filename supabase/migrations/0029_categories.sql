-- Cardoso Marketing Hub — categorias gerenciáveis (Configurações → Categorias)
-- Roda uma vez no SQL Editor, depois de 0001..0028 já terem rodado.
--
-- Antes, "categoria" em Projetos e Campanhas era um campo de texto livre — cada
-- pessoa digitava do seu jeito, gerando duplicatas tipo "Embalagens"/"embalagem".
-- Essa tabela vira a lista gerenciável por trás do seletor em cada tela.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('projeto', 'campanha')),
  label text not null,
  created_at timestamptz not null default now(),
  unique (scope, label)
);
create index on public.categories (scope);

alter table public.categories enable row level security;
create policy "categories_select_authenticated" on public.categories for select to authenticated using (true);
create policy "categories_write_privileged" on public.categories for all to authenticated
  using (public.is_privileged()) with check (public.is_privileged());

-- Semeia com as categorias já em uso hoje nos dados reais, pra ninguém perder o que já digitou.
insert into public.categories (scope, label)
select distinct 'projeto', category from public.projects where category is not null and category <> ''
union
select distinct 'projeto', category from public.project_templates where category is not null and category <> ''
on conflict (scope, label) do nothing;

insert into public.categories (scope, label)
select distinct 'campanha', category from public.campaigns where category is not null and category <> ''
on conflict (scope, label) do nothing;
