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
- **Fase 2, ainda mock**: IA (a global, em `/ia`) e Brand da Cardoso (só o brandbook institucional — Cardoso
  não tem um manual de marca de consumidor como Playmi/Tópi; me manda o PDF se/quando existir que eu
  aprofundo). A própria Biblioteca ainda não está ligada de verdade ao Google Drive — hoje as pastas/links são
  geridos manualmente no Hub; ligar isso à API do Drive (para o link aparecer sozinho quando alguém sobe um
  arquivo lá) é o próximo passo, e depende de habilitar a API no Google Workspace da Cardoso.

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
14. Pegue as duas chaves de conexão:
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
produtos_catalogo_2026.csv                       mesma extração do catálogo, para revisão antes/depois do import
src/lib/                                         cliente Supabase e helper de log de atividade
src/context/AuthContext.tsx                      sessão, perfil e papel do usuário logado
src/context/CampaignWorkspaceContext.tsx          contexto da campanha ativa (compartilhado pelas sub-páginas do workspace)
src/hooks/useProjectsOverview.ts                 dados agregados de projetos usados no Dashboard e em Projetos
src/hooks/useCampaignWorkspaceData.ts            dados da campanha ativa (usado pelo CampaignWorkspace)
src/components/                                  Sidebar, Topbar, KanbanBoard (drag-and-drop, genérico), ProjectCard, Modal,
                                                  TaskEditModal, AuditItemEditModal, CampaignTaskDrawer, etc.
src/pages/                                        páginas da Fase 1 + Calendário/Relatórios reais
src/pages/campaigns/                             Campaign Workspace — Resumo, Planejamento, Objetivos, Produtos, Roadmap, KPIs,
                                                  Cronograma, Demandas, Criativos, Conteúdos, Calendário Editorial, Social,
                                                  Influenciadores, Trade, Marketplace, CRM, Mídia Paga, Financeiro, Aprovações,
                                                  Riscos, Decisões, Histórico, Configurações
src/pages/phase2/                                 páginas ainda em modo exemplo (IA global, parte de Brand)
```

## Próximos passos (Fase 2)

Quando fizer sentido evoluir os módulos que hoje são só visuais, cada um segue o mesmo padrão já usado na
Fase 1: uma tabela nova na migration (com RLS), um hook ou fetch na página, e chamadas a
`logActivity()` nas ações que devem virar histórico.
