-- Cardoso Marketing Hub — Centro de Operações de Conteúdo, Fase 5: estratégia e cronograma.
--
-- Os marcos comerciais (social_plan_deadlines, a aba "Prazos comerciais") ganham andamento:
-- pendente → andamento → feito, com quem marcou e quando. O andamento das frentes não precisa de
-- tabela: sai das próprias peças (etapas e agendamento).
-- Quem marca o andamento: o aprovador do Social ou a diretoria (a diretoria segue podendo editar tudo).
--
-- Roda depois de 0112. Idempotente.

set lock_timeout = '5s';

alter table public.social_plan_deadlines add column if not exists status text not null default 'pendente';
alter table public.social_plan_deadlines add column if not exists status_by uuid references public.profiles (id);
alter table public.social_plan_deadlines add column if not exists status_at timestamptz;
alter table public.social_plan_deadlines add column if not exists note text not null default '';

alter table public.social_plan_deadlines drop constraint if exists social_plan_deadlines_status_check;
alter table public.social_plan_deadlines add constraint social_plan_deadlines_status_check
  check (status in ('pendente', 'andamento', 'feito'));

drop policy if exists "spd_status" on public.social_plan_deadlines;
create policy "spd_status" on public.social_plan_deadlines for update to authenticated
  using (public.can_release_content()) with check (public.can_release_content());

-- Conferência:
--   select status, count(*) from social_plan_deadlines group by 1;
