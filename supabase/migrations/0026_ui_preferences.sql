-- Cardoso Marketing Hub — preferência de tema por usuário
-- Roda uma vez no SQL Editor, depois de 0001..0025 já terem rodado.

alter table public.profiles
  add column theme text not null default 'dark' check (theme in ('dark', 'light'));
