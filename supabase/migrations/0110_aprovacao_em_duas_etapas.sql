-- Cardoso Marketing Hub — Centro de Operações de Conteúdo, Fase 2: aprovação em duas etapas.
--
--   Etapa 1 · pauta e legenda  → coluna status (a que já existia: aprovada/ajuste/pendente)
--   Etapa 2 · criativo final   → coluna nova creative_status
--
-- Quem herda o quê (regra do assunto, garantida aqui no banco):
--   reaproveita → segue as duas etapas da matriz (não volta para a fila)
--   adapta      → etapa 1 própria; etapa 2 própria só se creative_changed, senão segue a matriz
-- Peça editada depois de decidida volta para pendente: legenda mudou → etapa 1; criativo mudou → etapa 2.
-- Agendar/publicar fica em stage ('agendado'/'publicado') com quem e quando.
--
-- Roda depois de 0108. Idempotente.

set lock_timeout = '5s';

alter table public.social_plan_items add column if not exists creative_status text not null default 'pendente';
alter table public.social_plan_items add column if not exists creative_by uuid references public.profiles (id);
alter table public.social_plan_items add column if not exists creative_at timestamptz;
alter table public.social_plan_items add column if not exists stage_by uuid references public.profiles (id);
alter table public.social_plan_items add column if not exists stage_at timestamptz;

alter table public.social_plan_items drop constraint if exists social_plan_items_creative_status_check;
alter table public.social_plan_items add constraint social_plan_items_creative_status_check
  check (creative_status in ('pendente', 'aprovada', 'ajuste'));

-- ---------------------------------------------------------------------------
-- 1) Antes de gravar: herança da matriz + volta para pendente quando o conteúdo muda
-- ---------------------------------------------------------------------------
create or replace function public.social_gate_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare m record;
begin
  -- conteúdo mudou depois de decidido → precisa de nova aprovação
  if tg_op = 'UPDATE' then
    if new.link_kind <> 'reaproveita' and new.caption is distinct from old.caption and new.status <> 'pendente'
       and old.status = new.status then
      new.status := 'pendente'; new.status_by := null; new.status_at := now();
    end if;
    if (new.link_kind = 'matriz' or (new.link_kind = 'adapta' and new.creative_changed))
       and new.creative_url is distinct from old.creative_url and new.creative_status <> 'pendente'
       and old.creative_status = new.creative_status then
      new.creative_status := 'pendente'; new.creative_by := null; new.creative_at := now();
    end if;
  end if;

  -- herança
  if new.link_kind <> 'matriz' and new.topic_id is not null then
    select status, status_by, status_at, creative_status, creative_by, creative_at into m
      from public.social_plan_items
     where topic_id = new.topic_id and link_kind = 'matriz' and id <> new.id and not archived
     limit 1;
    if found then
      if new.link_kind = 'reaproveita' then
        new.status := m.status; new.status_by := m.status_by; new.status_at := m.status_at;
      end if;
      if new.link_kind = 'reaproveita' or not new.creative_changed then
        new.creative_status := m.creative_status; new.creative_by := m.creative_by; new.creative_at := m.creative_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_social_gate_rules on public.social_plan_items;
create trigger trg_social_gate_rules
  before insert or update on public.social_plan_items
  for each row execute function public.social_gate_rules();

-- ---------------------------------------------------------------------------
-- 2) Depois de gravar a matriz: repassa as decisões para quem herda
-- ---------------------------------------------------------------------------
create or replace function public.social_gate_propagate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.link_kind = 'matriz' and new.topic_id is not null
     and (tg_op = 'INSERT'
          or new.status is distinct from old.status
          or new.creative_status is distinct from old.creative_status) then
    -- o "update" vazio dispara o trigger de herança de cada irmã, que copia da matriz
    update public.social_plan_items
       set updated_at = updated_at
     where topic_id = new.topic_id and id <> new.id and not archived
       and (link_kind = 'reaproveita' or (link_kind = 'adapta' and not creative_changed));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_social_gate_propagate on public.social_plan_items;
create trigger trg_social_gate_propagate
  after insert or update on public.social_plan_items
  for each row execute function public.social_gate_propagate();

-- ---------------------------------------------------------------------------
-- 3) Backfill
--    a) a aprovação antiga foi dada na pauta, peça por peça. Se um reaproveitamento já estava
--       aprovado e a matriz não, a pauta do assunto foi aprovada: a matriz assume (desde que
--       nenhum destino do assunto esteja com ajuste).
--    b) depois, cada destino que herda é recalculado a partir da matriz.
-- ---------------------------------------------------------------------------
update public.social_plan_items m
   set status = 'aprovada',
       status_by = (select s.status_by from public.social_plan_items s
                     where s.topic_id = m.topic_id and s.link_kind = 'reaproveita' and s.status = 'aprovada' limit 1),
       status_at = now()
 where m.link_kind = 'matriz' and m.status = 'pendente' and not m.archived
   and exists (select 1 from public.social_plan_items s
                where s.topic_id = m.topic_id and s.link_kind = 'reaproveita' and s.status = 'aprovada' and not s.archived)
   and not exists (select 1 from public.social_plan_items s
                    where s.topic_id = m.topic_id and s.status = 'ajuste' and not s.archived);

update public.social_plan_items set updated_at = updated_at
 where link_kind <> 'matriz' and not archived and topic_id is not null;

-- Conferência (deve dar 0): destino que reaproveita com etapa diferente da matriz
--   select count(*) from social_plan_items r join social_plan_items m
--     on m.topic_id = r.topic_id and m.link_kind = 'matriz'
--    where r.link_kind = 'reaproveita' and not r.archived
--      and (r.status <> m.status or r.creative_status <> m.creative_status);
