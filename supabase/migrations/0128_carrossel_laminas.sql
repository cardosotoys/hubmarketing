-- Carrossel: um link do Drive por lâmina, para a prévia passar de lâmina como no Instagram.
-- creative_url continua sendo a capa (lâmina 1). Trocar qualquer lâmina pede nova aprovação do criativo.

alter table public.social_plan_items add column if not exists creative_slides text[] not null default '{}';

create or replace function public.social_slides_gate()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.link_kind = 'matriz' or (new.link_kind = 'adapta' and new.creative_changed))
     and new.creative_slides is distinct from old.creative_slides
     and new.creative_status <> 'pendente' and old.creative_status = new.creative_status then
    new.creative_status := 'pendente'; new.creative_by := null; new.creative_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_social_slides_gate on public.social_plan_items;
create trigger trg_social_slides_gate before update on public.social_plan_items
  for each row execute function public.social_slides_gate();

notify pgrst, 'reload schema';

-- CONFERÊNCIA — deve mostrar 1
select count(*) as coluna_criada from information_schema.columns
 where table_schema = 'public' and table_name = 'social_plan_items' and column_name = 'creative_slides';
