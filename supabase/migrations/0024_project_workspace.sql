-- Cardoso Marketing Hub — workspace de projeto (briefing + financeiro + riscos/decisões)
-- Roda uma vez no SQL Editor, depois de 0001..0023 já terem rodado.
--
-- Projetos ganham a mesma profundidade operacional de Campanhas: briefing completo,
-- verba planejada x executada, riscos e decisões — reaproveitando as tabelas já
-- existentes de Campanhas (campaign_budget_items, campaign_risks, campaign_decisions),
-- que passam a aceitar tanto campaign_id quanto project_id (nunca os dois ao mesmo
-- tempo). Nenhum dado existente de Campanhas é afetado.

alter table public.projects
  add column description text not null default '',
  add column problem text not null default '',
  add column opportunity text not null default '',
  add column target_audience text not null default '',
  add column personas text not null default '',
  add column competitors text not null default '',
  add column message_main text not null default '',
  add column tone_of_voice text not null default '',
  add column promise text not null default '',
  add column value_proposition text not null default '',
  add column differentiators text not null default '',
  add column strategy text not null default '',
  add column restrictions text not null default '',
  add column assumptions text not null default '',
  add column stakeholders text not null default '';

alter table public.campaign_budget_items
  alter column campaign_id drop not null,
  add column project_id uuid references public.projects (id) on delete cascade,
  add constraint campaign_budget_items_owner_check
    check ((campaign_id is not null) <> (project_id is not null));
create index on public.campaign_budget_items (project_id);

alter table public.campaign_risks
  alter column campaign_id drop not null,
  add column project_id uuid references public.projects (id) on delete cascade,
  add constraint campaign_risks_owner_check
    check ((campaign_id is not null) <> (project_id is not null));
create index on public.campaign_risks (project_id);

alter table public.campaign_decisions
  alter column campaign_id drop not null,
  add column project_id uuid references public.projects (id) on delete cascade,
  add constraint campaign_decisions_owner_check
    check ((campaign_id is not null) <> (project_id is not null));
create index on public.campaign_decisions (project_id);
