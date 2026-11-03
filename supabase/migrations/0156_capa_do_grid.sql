-- CAPA DA PEÇA NO GRID DO PERFIL (03/11/2026)
-- Como o "Editar capa" do Instagram: o Reels (ou o post) ganha uma capa escolhida, que é o que aparece no grid,
-- no calendário e no mural do Hub. Pode ser um quadro do vídeo (imagem pequena no Storage, pasta capas/ do bucket
-- product-images) ou uma imagem do Drive (fica o link). Sem capa, vale a primeira lâmina/o criativo, como antes.
-- Idempotente.

set lock_timeout = '5s';

alter table public.social_plan_items
  add column if not exists cover_url text;

comment on column public.social_plan_items.cover_url is
  'Capa no grid do perfil: quadro do vídeo (Storage) ou imagem do Drive. Vale para os destinos que seguem a matriz.';

notify pgrst, 'reload schema';

-- CONFERÊNCIA — a coluna existe (deve vir 1)
select count(*) as coluna_capa
  from information_schema.columns
 where table_schema = 'public' and table_name = 'social_plan_items' and column_name = 'cover_url';
