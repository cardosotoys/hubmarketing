-- Cardoso Marketing Hub — eventos avulsos de calendário
-- Roda uma vez no SQL Editor, depois de 0001..0007 já terem rodado.
-- Cobre qualquer compromisso que não esteja atrelado a projeto, campanha ou post
-- (ex.: uma entrega pessoal, uma reunião, um lembrete qualquer).

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  brand_id uuid references public.brands (id),
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.calendar_events (date);

alter table public.calendar_events enable row level security;
create policy "calendar_events_select_authenticated" on public.calendar_events
  for select to authenticated using (true);
create policy "calendar_events_insert_own" on public.calendar_events
  for insert to authenticated with check (auth.uid() = created_by);
create policy "calendar_events_delete_own_or_privileged" on public.calendar_events
  for delete to authenticated using (auth.uid() = created_by or public.is_privileged());
