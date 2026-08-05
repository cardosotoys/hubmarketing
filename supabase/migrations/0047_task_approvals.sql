-- Cardoso Marketing Hub — aprovação com múltiplos decisores por demanda
-- Roda depois de 0001..0046. Retry-safe/idempotente.
--
-- Antes a demanda tinha 1 aprovador (tasks.approval_requested_to). Agora pode ter vários:
-- cada aprovador tem sua própria decisão, e a demanda só "segue o fluxo" quando TODOS aprovam.
-- tasks.approval_state segue como agregado (none/aguardando/aprovado/correcao) para o badge/kanban.

set lock_timeout = '5s';

create table if not exists public.task_approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  approver_id uuid not null references public.profiles (id),
  decision text not null default 'pendente' check (decision in ('pendente', 'aprovado', 'correcao')),
  note text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, approver_id)
);
create index if not exists task_approvals_task_id_idx on public.task_approvals (task_id);

alter table public.task_approvals enable row level security;
drop policy if exists "ta_select" on public.task_approvals;
create policy "ta_select" on public.task_approvals for select to authenticated using (true);
drop policy if exists "ta_insert" on public.task_approvals;
create policy "ta_insert" on public.task_approvals for insert to authenticated with check (true);
drop policy if exists "ta_update" on public.task_approvals;
create policy "ta_update" on public.task_approvals for update to authenticated using (true);
drop policy if exists "ta_delete" on public.task_approvals;
create policy "ta_delete" on public.task_approvals for delete to authenticated using (true);
