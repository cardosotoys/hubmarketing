-- Cardoso Marketing Hub — demandas avulsas + rastreio de atraso
-- Roda uma vez no SQL Editor, depois de 0001..0011 já terem rodado.
--
-- Duas coisas: (1) uma demanda deixa de exigir projeto — pode ser algo pontual,
-- sem vínculo; (2) toda demanda ganha início/prazo, e quando passa do prazo sem
-- ser concluída, o responsável precisa registrar o motivo do atraso — isso é o
-- que alimenta "por que o projeto não avançou e quem foi o responsável" tanto
-- pra Diretoria quanto pra quem mais estiver envolvido.

alter table public.tasks alter column project_id drop not null;
alter table public.tasks add column start_date date;
alter table public.tasks add column due_date date;
alter table public.tasks add column delay_reason text not null default '';
create index on public.tasks (due_date);

-- Histórico ganha granularidade por demanda também (mesmo padrão já usado
-- para campaign_task_id em activity_log).
alter table public.activity_log add column task_id uuid references public.tasks (id) on delete set null;
create index on public.activity_log (task_id);
