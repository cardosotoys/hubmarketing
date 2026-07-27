-- Cardoso Marketing Hub — departamentos (visibilidade de módulo por função)
-- Roda uma vez no SQL Editor, depois de 0001..0010 já terem rodado.
--
-- Adiciona uma segunda dimensão de acesso, além do papel de privilégio
-- (diretoria/equipe/administrador) que já existe: o "departamento" decide
-- quais módulos aparecem pra cada pessoa (o app lê essa coluna e ajusta o
-- menu), sem mexer em nada do sistema de privilégio já existente.

alter table public.profiles
  add column department text not null default 'growth'
    check (department in ('diretoria', 'growth', 'coordenacao', 'design', 'assistente'));

-- Helper de permissão (mesmo padrão do is_privileged(), evita recursão de RLS)
create function public.is_assistente()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and department = 'assistente'
  );
$$;

-- Produtos e Biblioteca ficam só-leitura para o departamento "assistente"
-- (o resto do time continua podendo criar/editar normalmente).
drop policy "products_write_authenticated" on public.products;
create policy "products_insert_not_assistente" on public.products
  for insert to authenticated with check (not public.is_assistente());
drop policy "products_update_authenticated" on public.products;
create policy "products_update_not_assistente" on public.products
  for update to authenticated using (not public.is_assistente());

drop policy "library_folders_insert_authenticated" on public.library_folders;
create policy "library_folders_insert_not_assistente" on public.library_folders
  for insert to authenticated with check (not public.is_assistente());
drop policy "library_folders_update_authenticated" on public.library_folders;
create policy "library_folders_update_not_assistente" on public.library_folders
  for update to authenticated using (not public.is_assistente());
drop policy "library_folders_delete_authenticated" on public.library_folders;
create policy "library_folders_delete_not_assistente" on public.library_folders
  for delete to authenticated using (not public.is_assistente());

drop policy "library_links_insert_authenticated" on public.library_links;
create policy "library_links_insert_not_assistente" on public.library_links
  for insert to authenticated with check (not public.is_assistente());
drop policy "library_links_delete_authenticated" on public.library_links;
create policy "library_links_delete_not_assistente" on public.library_links
  for delete to authenticated using (not public.is_assistente());
