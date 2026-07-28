# Cardoso Marketing Hub

Hub de trabalho do time de marketing da Cardoso: projetos, demandas (kanban), checklist, comentários,
arquivos (links do Drive), relatório diário e histórico de atividade — tudo com login real e dados
persistidos no Supabase.

Este README cobre o setup do zero: criar o backend no Supabase, rodar localmente e publicar no Vercel.

## Status do projeto

- **Fase 1 (implementada)**: Dashboard, Projetos, Detalhe do Projeto (Resumo, Checklist, Comentários,
  Demandas com kanban arrastável e edição/exclusão de demandas, Correções — quando o projeto tem itens de
  auditoria, Arquivos, Histórico), Demandas global, Relatório Diário, Auditoria, Perfil, Configurações →
  Usuários, **Produtos** (catálogo real do PDF 2026, com criar/editar/excluir), **Redes Sociais** (upload de
  peça + aprovação/solicitação de alteração pela Diretoria, com edição/reenvio, arquivo real no Supabase
  Storage) e **Biblioteca** (árvore de pastas dos 3 Drives — Cardoso/Playmi/Tópi — real e editável: criar,
  renomear, excluir pastas e anexar links do Drive). Tudo com autenticação real e persistência no Supabase.
- **Fase 2, parte concluída**: **Calendário** (real, puxa datas de projetos, campanhas e posts de redes sociais
  automaticamente, **e também aceita eventos avulsos** — qualquer compromisso sem vínculo com projeto/campanha/
  post, tipo uma entrega pessoal ou um lembrete, criado pelo botão "+ Novo evento") e **Relatórios** (painel
  completo: projetos, demandas por estágio, auditoria de mídias, redes sociais, relatório diário e verba —
  seção financeira restrita à Diretoria).
- **Campanhas — Campaign Workspace (núcleo operacional)**: cada campanha agora é um workspace completo, com
  sub-menu próprio: **Resumo** (dashboard executivo com progresso, financeiro, demandas, produtos, linha do
  tempo e atividade recente), **Planejamento** (briefing completo — contexto, público, mensagem, estratégia —
  produtos vinculados do catálogo real, checklist de kickoff e documentos/links), **Objetivos** (estratégicos/
  táticos/operacionais com meta, peso e progresso), **Produtos** (vincular produtos reais do Banco de Produtos
  sem duplicar dado), **KPIs** (metas customizáveis com histórico e mini-gráfico), **Cronograma** (Gantt
  arrastável com dependências entre demandas), **Demandas** (kanban/lista estilo ticket enterprise, com RACI,
  checklist, comentários e dependências por tarefa), **Financeiro** (verba planejada/executada), **Aprovações**
  (fila de demandas aguardando aprovação, restrita ao aprovador designado ou Diretoria/Administrador),
  **Riscos** (registro com mapa de calor probabilidade × impacto), **Decisões** (decision log) e **Histórico**.
  **Roadmap** (visão das 5 fases da campanha com objetivos/riscos/marcos em aberto), **Criativos** (peças com
  versão e aprovação, upload real no Storage), **Conteúdos** (posts/vídeos/stories/reels/shorts/banners/
  catálogos planejados), **Calendário Editorial** (calendário mensal desses conteúdos), **Social Media**
  (vincula posts reais de Redes Sociais a esta campanha, sem duplicar dado), **Influenciadores**, **Trade
  Marketing**, **Marketplace** e **CRM** (registros manuais — sem integração de API de terceiros, como
  combinado) e **Mídia Paga** (investimento por canal, que agora alimenta de verdade o card de Performance do
  Resumo com CTR/ROAS reais). **Configurações** permite trocar responsável/status, arquivar ou excluir a
  campanha. **Relatórios, Biblioteca e Auditoria** por campanha continuam "em breve": os dois primeiros
  dependem de coisas que ainda não existem (Biblioteca real com o Drive) ou seriam redundantes com o que já
  existe (Relatórios global + Resumo já cobrem os números; Auditoria seria idêntica ao Histórico de hoje). Não
  há aba de IA por campanha — decidido para não gerar custo de API sem uso real definido; a IA global (`/ia`)
  segue como estava, só mock.
- **Fase 2, ainda mock**: Brand da Cardoso (só o brandbook institucional — Cardoso não tem um manual de marca
  de consumidor como Playmi/Tópi; me manda o PDF se/quando existir que eu aprofundo). A própria Biblioteca
  ainda não está ligada de verdade ao Google Drive — hoje as pastas/links são geridos manualmente no Hub;
  ligar isso à API do Drive (para o link aparecer sozinho quando alguém sobe um arquivo lá) é o próximo passo,
  e depende de habilitar a API no Google Workspace da Cardoso.
- **Demandas com prazo e atraso rastreado**: toda demanda (de projeto ou avulsa) pode ter início/prazo. Quando
  passa do prazo sem ser concluída, aparece um badge "🔴 atrasada" no kanban, e quem edita a demanda precisa
  preencher o motivo do atraso (campo obrigatório) — isso fica visível pra Diretoria e pra quem mais acompanha
  o projeto, direto no Resumo do projeto e no Dashboard (contador de demandas atrasadas, visível a todo mundo,
  não só Diretoria).
- **Demandas avulsas**: em Demandas → "+ Nova demanda" agora dá pra criar uma demanda sem vínculo com nenhum
  projeto (algo pontual), escolhendo "Sem projeto" no formulário.
- **Visão em lista nas Demandas**: tanto no board global (Demandas) quanto na aba Demandas de cada Projeto,
  agora dá pra alternar entre Kanban e Lista (tabela com prazo, atraso e agrupamento por responsável/projeto/
  prioridade) — mesmo padrão já usado nas campanhas.
- **Demanda no padrão Monday**: cada demanda agora tem Notas, Orçamento, Arquivos anexados (link, sem upload) e
  registro de quem fez a última atualização e quando — tudo visível tanto no modal de edição quanto na visão em
  lista. No board global, o projeto de cada demanda vira uma etiqueta clicável (ou "Avulsa", se não tiver
  projeto), fácil de identificar de onde ela vem.
- **Menu lateral organizado por seção**: Visão geral, Trabalho, Marca & Conteúdo, Campanhas, Registro e Sistema
  — mais fácil de navegar com o número maior de módulos.
- **Auditoria com escopo pessoal**: deixou de ser só da Diretoria. Diretoria/Administrador continuam vendo o
  feed completo de todo o time; Equipe agora também acessa Auditoria, mas vê só o que ela mesma fez, mais tudo
  que aconteceu nos projetos e campanhas em que participa (como membro, responsável por alguma demanda, ou
  papel de RACI numa campanha).
- **IA — módulo real**: deixou de ser mock. Prompts, templates, personas e brand voice das 3 marcas agora são
  de verdade (criar/editar/excluir), já populados com um acervo inicial cobrindo growth, social media, trade
  marketing, CRM, design e planejamento. Ainda sem resposta automática de IA — isso segue dependendo de
  conectar uma API de verdade, quando fizer sentido.
- **Responsivo para mobile**: menu vira gaveta com hambúrguer, grids empilham, kanban/tabelas/Gantt ganham
  scroll horizontal em vez de quebrar, formulários com campos lado a lado empilham em telas estreitas. Sem IA
  por campanha (removida por decisão explícita, para não gerar custo de API sem uso definido).
- **Departamentos** (visibilidade de menu por função, além do papel de privilégio Diretoria/Equipe/
  Administrador que já existia): cada pessoa tem um **departamento** — Diretoria, Growth, Coordenação, Design
  ou Assistente — que decide quais módulos aparecem pro dia a dia dela. Diretoria/Growth/Coordenação veem
  tudo; Design não vê Redes Sociais nem Relatórios (e, dentro de cada campanha, só Resumo/Planejamento/
  Produtos/Cronograma/Criativos/Conteúdos/Histórico); Assistente vê Biblioteca/Produtos/Brand mas só consulta
  (sem criar/editar/excluir, reforçado tanto na tela quanto no banco), não vê Relatórios, e dentro de cada
  campanha só tem Resumo/Demandas/Cronograma/Calendário Editorial/Conteúdos/Histórico. Configurações e
  Auditoria continuam controladas só pelo papel de privilégio (Diretoria/Administrador), independente do
  departamento. Ajuste o departamento de cada pessoa em **Configurações → Usuários**.
- **Visão em lista com cabeçalho**: as tabelas de Demandas (globais, por projeto e por campanha) agora têm
  título em cima de cada coluna — antes só as células apareciam, sem indicar o que cada uma significava.
- **Chat interno na demanda**: dentro de cada demanda (modal de edição) tem um painel de **Comentários**, com
  opção de marcar colegas (chips "@Nome" clicáveis acima do campo de texto) — quem é marcado vê um aviso
  "Menções pra você" no sino de notificações do Topbar. Comentário postado não pode ser editado nem excluído
  (igual ao padrão já usado nos comentários de Projeto e Campanha).
- **Correção de link quebrado**: links colados sem `http://`/`https://` (ex.: `www.exemplo.com`) agora recebem
  o protocolo automaticamente ao salvar, em qualquer lugar do Hub onde se cola um link manual (arquivos de
  demanda/projeto, documentos de campanha, links da Biblioteca) — antes, um link assim virava uma navegação
  interna quebrada (404) em vez de abrir o site de verdade.
- **Conferência de Embalagens (projeto real + status automático no Banco de Produtos)**: criado o projeto
  "Conferência de Embalagens" com as 109 demandas extraídas do quadro do Monday (grupos "Em Avaliação",
  "Produtos Importados - China", "Aprovados" e "Pendentes"), cada uma com prioridade, prazo e estágio
  já preenchidos. Cada demanda pode ser vinculada a um produto do catálogo (campo **Produto (embalagem)** no
  modal de edição) — quando vinculada, o **Banco de Produtos** mostra automaticamente uma coluna "Embalagem"
  com o estágio atual da demanda (Recebido/Planejamento/Produção/Revisão/Aprovação/Finalizado), sempre lida
  direto da demanda (não é um campo duplicado que pode ficar desatualizado). Das 109 demandas importadas, 91
  já vieram linkadas automaticamente pelo código de referência do produto; as outras 18 são SKUs novos ainda
  não cadastrados no catálogo.

## 1. Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New Project**.
2. Anote a **senha do banco** que você definir (não precisa dela no dia a dia, só se for acessar o Postgres
   direto).
3. Quando o projeto terminar de provisionar, vá em **SQL Editor** (menu lateral) → **New query**.
4. Cole todo o conteúdo do arquivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   deste repositório e clique em **Run**. Isso cria todas as tabelas, as políticas de segurança (RLS) e as 3
   marcas (Cardoso, Playmi, Tópi).
5. Em seguida, rode também [`supabase/migrations/0002_products_and_audit.sql`](supabase/migrations/0002_products_and_audit.sql)
   (nova query no SQL Editor). Esse arquivo cria as tabelas `products` e `audit_items`, já populadas com:
   - **315 produtos** extraídos automaticamente do catálogo PDF 2026 (alguns marcados `needs_review` —
     confira faixa etária/linha desses antes de considerar definitivo; veja
     `produtos_catalogo_2026.csv` para revisar antes, se preferir).
   - O projeto **"Auditoria de Mídias — Catálogo 2026"**, com a aba **Correções** mostrando os 315 produtos
     do catálogo — os **190** que a planilha de rastreamento já sinalizou com divergência aparecem com a
     pendência descrita; o restante aparece como **"Sem pendência"** até alguém sinalizar algo (editar
     status/responsável de qualquer produto cria o registro de auditoria na hora). Cada item de auditoria
     fica ligado ao produto real do catálogo — editar o produto no Banco de Produtos não duplica dado.
6. Rode também [`supabase/migrations/0003_social_posts.sql`](supabase/migrations/0003_social_posts.sql). Esse
   arquivo cria a tabela `social_posts` **e** o bucket de Storage `social-media` (público para leitura, upload
   restrito a quem estiver logado) — usado para guardar as imagens/vídeos enviados para aprovação em Redes
   Sociais. Não precisa criar o bucket manualmente no painel, o SQL já faz isso.
7. Rode também [`supabase/migrations/0004_topi_solapas_line.sql`](supabase/migrations/0004_topi_solapas_line.sql)
   — corrige a coluna `line` de 44 produtos Tópi que vieram sem categoria na extração automática (todos são
   "Solapas", o tipo de embalagem, confirmado pela planilha de correções). Os 4 produtos Tópi restantes (Tandy
   e Jeep Rally) não têm categoria confirmada em nenhuma fonte disponível e ficam marcados `needs_review` para
   alguém do time preencher manualmente. **Importante**: o catálogo PDF 2026 só tem esses 48 produtos Tópi —
   busquei "Tópi" no texto inteiro do arquivo e não achei mais nenhum. Se você sabe de produtos Tópi que
   deveriam estar no Hub e não estão, é porque eles não aparecem nesse PDF específico — me passe outra fonte
   (catálogo atualizado, lista) que eu cadastro.
8. Rode também [`supabase/migrations/0005_library_folders.sql`](supabase/migrations/0005_library_folders.sql) —
   cria as tabelas `library_folders`/`library_links` (a árvore da Biblioteca) já populadas com a estrutura
   oficial dos 3 Drives, para você não começar do zero.
9. Rode também [`supabase/migrations/0006_clean_product_names.sql`](supabase/migrations/0006_clean_product_names.sql)
   — limpa 84 nomes de produto que vieram com tagline de marketing, instrução de uso ou texto ilegível colado
   junto (ex.: "GELADEIRA SONHO DE MENINA CAIXA INDIVIDUAL 1º Puxe a casquinha 2º Aperte o botão..." vira só
   "GELADEIRA SONHO DE MENINA CAIXA INDIVIDUAL"), mantendo só o nome do produto como aparece no catálogo.
10. Rode também [`supabase/migrations/0007_campaigns.sql`](supabase/migrations/0007_campaigns.sql) — cria as
    tabelas `campaigns`, `campaign_milestones` e `campaign_budget_items`, e adiciona a coluna `campaign_id` em
    `activity_log` (para o Histórico de cada campanha funcionar).
11. Rode também [`supabase/migrations/0008_calendar_events.sql`](supabase/migrations/0008_calendar_events.sql)
    — cria a tabela `calendar_events`, usada pelos eventos avulsos criados direto no Calendário (título, data,
    marca opcional) — qualquer pessoa pode excluir o que criou, Diretoria/Administrador podem excluir
    qualquer um.
12. Rode também [`supabase/migrations/0009_campaign_workspace.sql`](supabase/migrations/0009_campaign_workspace.sql)
    — **atenção**: esse arquivo começa apagando `campaigns`, `campaign_milestones` e `campaign_budget_items`
    (reset combinado com você, já que só havia dado de teste) e recria tudo com o schema novo do Campaign
    Workspace: `campaigns` (sem mais `project_id` — campanha agora é autossuficiente), `campaign_products`,
    `campaign_objectives`, `campaign_kpis`/`campaign_kpi_history`, `campaign_tasks` (a demanda estilo ticket,
    com RACI e dependências), `campaign_task_dependencies`, `campaign_task_checklist_items`,
    `campaign_task_comments`, `campaign_checklist_items`, `campaign_documents`, `campaign_budget_items`
    (recriada), `campaign_risks`, `campaign_decisions`, e a coluna `campaign_task_id` em `activity_log`.
13. Rode também [`supabase/migrations/0010_campaign_wave2.sql`](supabase/migrations/0010_campaign_wave2.sql) —
    cria `campaign_creatives` (+ bucket de Storage `campaign-creatives`, público para leitura), `campaign_contents`,
    `campaign_influencers`, `campaign_trade_actions`, `campaign_marketplace_entries`, `campaign_leads`,
    `campaign_media_investments`, e adiciona a coluna `campaign_id` em `social_posts` (pra ligar posts de Redes
    Sociais a uma campanha sem duplicar dado).
14. Rode também [`supabase/migrations/0011_departments.sql`](supabase/migrations/0011_departments.sql) — adiciona
    a coluna `department` em `profiles` (padrão `growth` pra quem já existe) e restringe `products`/
    `library_folders`/`library_links` para que o departamento `assistente` só possa ler, não escrever.
15. Rode também [`supabase/migrations/0012_task_delays.sql`](supabase/migrations/0012_task_delays.sql) — libera
    `tasks.project_id` (demanda avulsa não precisa mais de projeto), adiciona `start_date`/`due_date`/
    `delay_reason`, e a coluna `task_id` em `activity_log`.
16. Rode também [`supabase/migrations/0013_ia_module.sql`](supabase/migrations/0013_ia_module.sql) — cria
    `ia_prompts`, `ia_templates`, `ia_personas` e `ia_brand_voice`, já populadas com um acervo inicial real
    (prompts e templates cobrindo growth, social, trade, CRM, design e planejamento; personas de consumidor e
    trade; brand voice derivado do que já está documentado em Brand).
17. Rode também [`supabase/migrations/0014_task_fields.sql`](supabase/migrations/0014_task_fields.sql) —
    adiciona `notes`/`budget`/`updated_by` em `tasks`, e libera `project_files.project_id` + adiciona `task_id`
    (pra anexar arquivo direto numa demanda, com ou sem projeto).
18. Rode também [`supabase/migrations/0015_task_comments.sql`](supabase/migrations/0015_task_comments.sql) —
    cria `task_comments` (comentários dentro de cada demanda, com `mentioned_ids` pra marcar colegas — quem é
    marcado vê um aviso no sino de notificações do Topbar).
19. Rode também [`supabase/migrations/0016_packaging_project.sql`](supabase/migrations/0016_packaging_project.sql) —
    adiciona `tasks.product_id` (liga uma demanda a um produto do catálogo) e já cria o projeto **"Conferência
    de Embalagens"** com as 109 demandas importadas do quadro do Monday, 91 delas já linkadas ao produto certo
    pelo código de referência (as outras 18 são SKUs novos que ainda não estão no Banco de Produtos).
20. Pegue as duas chaves de conexão:
   - Em **Settings → General**, copie o **ID do projeto** e monte a URL:
     `https://<id-do-projeto>.supabase.co` → vai virar `VITE_SUPABASE_URL`.
   - Em **Settings → Chaves de API** (aba "Chaves de API publicáveis e secretas"), copie a **Chave
     publicável** (`sb_publishable_...`) → vai virar `VITE_SUPABASE_ANON_KEY`. **Nunca** use a "Chave secreta"
     (`sb_secret_...`) aqui — ela equivale à antiga `service_role` e ignora todas as regras de RLS; não pode
     ir para um `.env` de app que roda no navegador.

## 2. Criar as contas da equipe

Não existe tela de "criar conta" pública — isso é proposital, para o Hub ficar restrito ao time.

1. No painel do Supabase, vá em **Authentication → Users → Add user → Create new user**.
2. Preencha e-mail e senha para cada pessoa (Fabiana, Júlio, Stefany, Aldair, etc.).
3. Isso cria automaticamente uma linha correspondente na tabela `profiles`, com papel padrão `equipe`.
4. Para ajustar nome, cargo e papel (Diretoria / Equipe / Administrador) de cada pessoa, entre no Hub já
   logado com uma conta marcada como `diretoria` (ajuste a primeira pessoa direto pela tabela `profiles` no
   **Table Editor** do Supabase) e use **Configurações → Usuários**.

## 3. Rodar localmente

```bash
npm install
cp .env.example .env
```

Edite `.env` com a URL e a anon key copiadas no passo 1:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

```bash
npm run dev
```

Abra o endereço mostrado no terminal e entre com um e-mail/senha criado no passo 2.

## 4. Publicar no Vercel

1. Suba este projeto para um repositório Git (GitHub/GitLab/Bitbucket).
2. Em [vercel.com](https://vercel.com), **New Project** → importe o repositório.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos
   valores do `.env` local.
4. Deploy. O Vercel detecta automaticamente que é um projeto Vite (`npm run build`, saída em `dist/`).

## Scripts

```bash
npm run dev       # servidor local
npm run build     # build de produção (roda o type-check antes)
npm run preview   # serve o build de produção localmente
npm run lint      # oxlint
```

## Estrutura

```
supabase/migrations/0001_init.sql                schema completo + RLS + seed de marcas
supabase/migrations/0002_products_and_audit.sql  tabelas products/audit_items + catálogo 2026 + auditoria de mídias
supabase/migrations/0003_social_posts.sql        tabela social_posts + bucket de Storage social-media
supabase/migrations/0004_topi_solapas_line.sql   correção de dados: linha "Solapas" nos produtos Tópi
supabase/migrations/0005_library_folders.sql     tabelas library_folders/library_links (árvore da Biblioteca)
supabase/migrations/0006_clean_product_names.sql correção de dados: 84 nomes de produto sem tagline/instrução misturada
supabase/migrations/0007_campaigns.sql           tabelas campaigns/campaign_milestones/campaign_budget_items (versão antiga, substituída pela 0009)
supabase/migrations/0008_calendar_events.sql     tabela calendar_events (eventos avulsos do Calendário)
supabase/migrations/0009_campaign_workspace.sql  reset + schema novo do Campaign Workspace (campanhas, objetivos, KPIs, demandas/RACI, riscos, decisões…)
supabase/migrations/0010_campaign_wave2.sql      criativos, conteúdos, influenciadores, trade, marketplace, CRM, mídia paga + campaign_id em social_posts
supabase/migrations/0011_departments.sql         coluna department em profiles + restrição de escrita (assistente) em products/library_*
supabase/migrations/0012_task_delays.sql         tasks.project_id opcional + start_date/due_date/delay_reason + task_id em activity_log
supabase/migrations/0013_ia_module.sql           ia_prompts/ia_templates/ia_personas/ia_brand_voice + acervo inicial real
supabase/migrations/0014_task_fields.sql         tasks.notes/budget/updated_by + project_files.task_id (arquivo por demanda)
supabase/migrations/0015_task_comments.sql       task_comments (chat interno por demanda, com menção @pessoa)
supabase/migrations/0016_packaging_project.sql   tasks.product_id + projeto "Conferência de Embalagens" (import Monday)
produtos_catalogo_2026.csv                       mesma extração do catálogo, para revisão antes/depois do import
src/lib/                                         cliente Supabase e helper de log de atividade
src/context/AuthContext.tsx                      sessão, perfil e papel do usuário logado
src/context/CampaignWorkspaceContext.tsx          contexto da campanha ativa (compartilhado pelas sub-páginas do workspace)
src/hooks/useProjectsOverview.ts                 dados agregados de projetos usados no Dashboard e em Projetos
src/hooks/useCampaignWorkspaceData.ts            dados da campanha ativa (usado pelo CampaignWorkspace)
src/components/                                  Sidebar, Topbar, KanbanBoard (drag-and-drop, genérico), ProjectCard, Modal,
                                                  TaskEditModal, AuditItemEditModal, CampaignTaskDrawer, etc.
src/pages/                                        páginas da Fase 1 + Calendário/Relatórios/IA reais
src/pages/campaigns/                             Campaign Workspace — Resumo, Planejamento, Objetivos, Produtos, Roadmap, KPIs,
                                                  Cronograma, Demandas, Criativos, Conteúdos, Calendário Editorial, Social,
                                                  Influenciadores, Trade, Marketplace, CRM, Mídia Paga, Financeiro, Aprovações,
                                                  Riscos, Decisões, Histórico, Configurações
src/pages/phase2/                                 páginas ainda em modo exemplo (Brand da Cardoso)
```

## Próximos passos (Fase 2)

Quando fizer sentido evoluir os módulos que hoje são só visuais, cada um segue o mesmo padrão já usado na
Fase 1: uma tabela nova na migration (com RLS), um hook ou fetch na página, e chamadas a
`logActivity()` nas ações que devem virar histórico.
