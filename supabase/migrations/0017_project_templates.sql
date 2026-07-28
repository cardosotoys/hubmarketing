-- Cardoso Marketing Hub — modelos de projeto (templates) para agilizar a criação
-- Roda uma vez no SQL Editor, depois de 0001..0016 já terem rodado.

create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default '',
  default_priority text not null default 'medium'
    check (default_priority in ('urgent', 'high', 'medium', 'low')),
  objective text not null default '',
  created_at timestamptz not null default now()
);

create table public.project_template_checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates (id) on delete cascade,
  label text not null,
  position integer not null default 0
);
create index on public.project_template_checklist_items (template_id);

create table public.project_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates (id) on delete cascade,
  title text not null,
  stage text not null default 'recebido'
    check (stage in ('recebido', 'planejamento', 'producao', 'revisao', 'aprovacao', 'finalizado')),
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  position integer not null default 0
);
create index on public.project_template_tasks (template_id);

alter table public.project_templates enable row level security;
alter table public.project_template_checklist_items enable row level security;
alter table public.project_template_tasks enable row level security;

create policy "project_templates_select" on public.project_templates for select to authenticated using (true);
create policy "project_templates_insert" on public.project_templates for insert to authenticated with check (true);
create policy "project_templates_update" on public.project_templates for update to authenticated using (true);
create policy "project_templates_delete" on public.project_templates for delete to authenticated using (public.is_privileged());

create policy "project_template_checklist_items_select" on public.project_template_checklist_items for select to authenticated using (true);
create policy "project_template_checklist_items_insert" on public.project_template_checklist_items for insert to authenticated with check (true);
create policy "project_template_checklist_items_update" on public.project_template_checklist_items for update to authenticated using (true);
create policy "project_template_checklist_items_delete" on public.project_template_checklist_items for delete to authenticated using (public.is_privileged());

create policy "project_template_tasks_select" on public.project_template_tasks for select to authenticated using (true);
create policy "project_template_tasks_insert" on public.project_template_tasks for insert to authenticated with check (true);
create policy "project_template_tasks_update" on public.project_template_tasks for update to authenticated using (true);
create policy "project_template_tasks_delete" on public.project_template_tasks for delete to authenticated using (public.is_privileged());

-- Modelos iniciais, pensados pra acelerar os tipos de projeto mais recorrentes na Cardoso.

insert into public.project_templates (id, name, description, category, default_priority, objective) values
  ('a1000000-0000-4000-8000-000000000001', 'Lançamento de Produto Novo',
   'Coordena todas as etapas de lançamento de um produto novo, da embalagem ao ponto de venda.',
   'Lançamento', 'high',
   'Lançar o produto com embalagem aprovada, catálogo atualizado, conteúdo de mídia pronto e time comercial alinhado.'),
  ('a1000000-0000-4000-8000-000000000002', 'Conferência/Aprovação de Embalagem',
   'Acompanha o desenvolvimento de uma embalagem específica, do layout ao selo INMETRO.',
   'Embalagens', 'medium',
   'Levar uma embalagem do layout inicial até a aprovação final, com o selo INMETRO conferido.'),
  ('a1000000-0000-4000-8000-000000000003', 'Auditoria de Mídias / Correções de Embalagem',
   'Audita embalagens já em produção ou estoque e acompanha as correções necessárias até o fim.',
   'Auditoria', 'medium',
   'Identificar divergências entre a arte aprovada e as embalagens físicas, e acompanhar até a correção.'),
  ('a1000000-0000-4000-8000-000000000004', 'Ação de Trade Marketing / PDV',
   'Planeja e executa uma ação de trade marketing (materiais de PDV, ativação, precificação) com o time comercial.',
   'Trade Marketing', 'medium',
   'Executar uma ação de trade marketing do briefing comercial até a coleta de resultados no ponto de venda.');

insert into public.project_template_checklist_items (template_id, label, position) values
  ('a1000000-0000-4000-8000-000000000001', 'Ficha técnica do produto revisada', 1),
  ('a1000000-0000-4000-8000-000000000001', 'Embalagem aprovada (ver Conferência de Embalagens)', 2),
  ('a1000000-0000-4000-8000-000000000001', 'Fotos still e lifestyle produzidas', 3),
  ('a1000000-0000-4000-8000-000000000001', 'Produto cadastrado no Banco de Produtos', 4),
  ('a1000000-0000-4000-8000-000000000001', 'Vídeo de demonstração gravado', 5),
  ('a1000000-0000-4000-8000-000000000001', 'Materiais de social media aprovados', 6),
  ('a1000000-0000-4000-8000-000000000001', 'Kit de imprensa/influenciadores preparado', 7),
  ('a1000000-0000-4000-8000-000000000001', 'Treinamento do time comercial alinhado', 8),
  ('a1000000-0000-4000-8000-000000000001', 'Data de lançamento confirmada com o comercial', 9),

  ('a1000000-0000-4000-8000-000000000002', 'Layout inicial enviado para revisão', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Correções de arte aplicadas', 2),
  ('a1000000-0000-4000-8000-000000000002', 'Revisão técnica (materiais/medidas) concluída', 3),
  ('a1000000-0000-4000-8000-000000000002', 'Selo INMETRO conferido', 4),
  ('a1000000-0000-4000-8000-000000000002', 'Aprovação final registrada', 5),
  ('a1000000-0000-4000-8000-000000000002', 'Arquivo final salvo na Biblioteca', 6),

  ('a1000000-0000-4000-8000-000000000003', 'Lista de produtos a auditar definida', 1),
  ('a1000000-0000-4000-8000-000000000003', 'Embalagens físicas conferidas contra a arte aprovada', 2),
  ('a1000000-0000-4000-8000-000000000003', 'Itens divergentes registrados na aba Correções', 3),
  ('a1000000-0000-4000-8000-000000000003', 'Responsáveis pela correção notificados', 4),
  ('a1000000-0000-4000-8000-000000000003', 'Reconferência pós-correção realizada', 5),

  ('a1000000-0000-4000-8000-000000000004', 'Objetivo comercial da ação definido', 1),
  ('a1000000-0000-4000-8000-000000000004', 'Materiais de PDV (display, wobbler, cartaz) criados', 2),
  ('a1000000-0000-4000-8000-000000000004', 'Lista de lojas/redes participantes definida', 3),
  ('a1000000-0000-4000-8000-000000000004', 'Materiais enviados para produção gráfica', 4),
  ('a1000000-0000-4000-8000-000000000004', 'Kit de instruções enviado às lojas/representantes', 5),
  ('a1000000-0000-4000-8000-000000000004', 'Resultados da ação coletados', 6);

insert into public.project_template_tasks (template_id, title, stage, priority, position) values
  ('a1000000-0000-4000-8000-000000000001', 'Revisar ficha técnica', 'recebido', 'high', 1),
  ('a1000000-0000-4000-8000-000000000001', 'Acompanhar aprovação da embalagem', 'recebido', 'high', 2),
  ('a1000000-0000-4000-8000-000000000001', 'Produzir fotos still e lifestyle', 'recebido', 'medium', 3),
  ('a1000000-0000-4000-8000-000000000001', 'Cadastrar produto no catálogo', 'recebido', 'medium', 4),
  ('a1000000-0000-4000-8000-000000000001', 'Criar peças de social media', 'recebido', 'medium', 5),
  ('a1000000-0000-4000-8000-000000000001', 'Preparar kit de imprensa/influenciadores', 'recebido', 'low', 6),
  ('a1000000-0000-4000-8000-000000000001', 'Alinhar treinamento com o time comercial', 'recebido', 'medium', 7),

  ('a1000000-0000-4000-8000-000000000002', 'Enviar layout para revisão', 'recebido', 'medium', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Aplicar correções apontadas', 'planejamento', 'medium', 2),
  ('a1000000-0000-4000-8000-000000000002', 'Fazer revisão técnica', 'revisao', 'medium', 3),
  ('a1000000-0000-4000-8000-000000000002', 'Registrar aprovação final', 'aprovacao', 'high', 4),

  ('a1000000-0000-4000-8000-000000000003', 'Levantar lista de produtos a auditar', 'recebido', 'medium', 1),
  ('a1000000-0000-4000-8000-000000000003', 'Conferir embalagens físicas', 'planejamento', 'medium', 2),
  ('a1000000-0000-4000-8000-000000000003', 'Registrar divergências em Correções', 'producao', 'medium', 3),
  ('a1000000-0000-4000-8000-000000000003', 'Reconferir após correção', 'revisao', 'medium', 4),

  ('a1000000-0000-4000-8000-000000000004', 'Definir objetivo comercial da ação', 'recebido', 'medium', 1),
  ('a1000000-0000-4000-8000-000000000004', 'Criar materiais de PDV', 'planejamento', 'medium', 2),
  ('a1000000-0000-4000-8000-000000000004', 'Enviar para produção gráfica', 'producao', 'medium', 3),
  ('a1000000-0000-4000-8000-000000000004', 'Distribuir kit às lojas/representantes', 'revisao', 'medium', 4),
  ('a1000000-0000-4000-8000-000000000004', 'Coletar resultados da ação', 'aprovacao', 'low', 5);
