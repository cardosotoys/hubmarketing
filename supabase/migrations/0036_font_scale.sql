-- Cardoso Marketing Hub — preferência de tamanho de fonte por usuário
-- Roda uma vez no SQL Editor, depois de 0001..0035 já terem rodado.

alter table public.profiles
  add column font_scale text not null default 'md' check (font_scale in ('sm', 'md', 'lg', 'xl'));
