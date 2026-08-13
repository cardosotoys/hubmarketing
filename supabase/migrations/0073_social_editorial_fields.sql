-- 0073: campos editoriais ricos no social_content
set lock_timeout='5s';
alter table public.social_content add column if not exists tipo text not null default '';
alter table public.social_content add column if not exists pilar text not null default '';
alter table public.social_content add column if not exists campaign text not null default '';
alter table public.social_content add column if not exists block text not null default '';
alter table public.social_content add column if not exists product text not null default '';
alter table public.social_content add column if not exists objective text not null default '';
alter table public.social_content add column if not exists cta text not null default '';
alter table public.social_content add column if not exists media_use text not null default '';
alter table public.social_content add column if not exists line_axis text not null default '';