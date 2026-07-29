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
- **Projetos: filtro, ordenação, agrupamento e modelos (estilo Monday)**: a barra de ferramentas em Projetos
  agora é real — **pesquisar** (nome/subtítulo/categoria/ref), **Pessoa** (quem criou o projeto), **Status**,
  **Prioridade**, **Categoria**, **Ordenar** (recentes/nome/prioridade/prazo/progresso), **Agrupar por** (marca/
  status/prioridade/categoria/responsável) e **Ocultar concluídos**. Cada card de projeto ganhou um botão
  **Duplicar** (⧉) que copia o projeto (dados, checklist e demandas — com estágio resetado para "Recebido") pra
  um projeto novo, pronto pra ajustar datas e responsáveis. E tem uma aba nova **Modelos**: 4 modelos prontos
  (Lançamento de Produto Novo, Conferência/Aprovação de Embalagem, Auditoria de Mídias, Ação de Trade Marketing/
  PDV), cada um com checklist e demandas padrão — ao criar um projeto você pode "começar de um modelo" e o
  checklist + as demandas já vêm prontos. Dá pra criar, editar e excluir modelos (inclusive os seus próprios)
  direto pela aba Modelos.
- **Barra de ferramentas também dentro de cada projeto**: a aba Demandas de um projeto ganhou a mesma barra de
  pesquisa/filtro (responsável, prioridade, estágio) e ordenação (posição/título/prioridade/prazo) + ocultar
  finalizadas — funciona tanto no Kanban quanto na Lista do projeto.
- **Relatório Diário editável**: agora dá pra editar ou excluir um relatório já registrado (✎ / ✕ na tabela).
  Cada pessoa só mexe no próprio relatório; Diretoria e Administrador podem editar/excluir qualquer um.
- **Demandas: visibilidade por papel**: o board global de Demandas agora respeita o papel de cada pessoa —
  Diretoria e Administrador continuam vendo todas as demandas; Equipe vê só as demandas atribuídas a ela mesma
  (evita ruído com o trabalho de outras pessoas do time).
- **Monitor de Preços (MPM) — v1**: módulo novo que monitora automaticamente os preços dos produtos Cardoso/
  Playmi/Tópi pela internet toda (Mercado Livre, Amazon, Shopee, lojas próprias — via Google Shopping/SerpApi)
  e alerta quando um anúncio está abaixo do preço mínimo permitido. Arquitetura 100% dentro do Supabase (Edge
  Function agendada por `pg_cron`, sem servidor novo pra manter) e zero custo de IA (anúncio duvidoso vai pra
  revisão manual em vez de chamada de IA) — decisões tomadas com o time. Veja a seção
  [Monitor de Preços (MPM)](#monitor-de-preços-mpm) pra terminar a configuração.
- **Etapas editáveis por projeto**: o antigo fluxo fixo de 6 estágios (Recebido → Planejamento → Produção →
  Revisão → Aprovação → Finalizado) deixou de ser um valor travado no banco — agora cada projeto tem sua
  **própria lista de etapas**, que dá pra criar, renomear, reordenar e excluir livremente (aba "⚙ Etapas deste
  projeto", dentro de Demandas do projeto), sem afetar outros projetos. Um projeto sem etapas removidas ainda
  bloqueia mover uma demanda pra uma etapa marcada como **final** se ela não tiver responsável atribuído. Os
  **Modelos** (Projetos → Modelos) ganharam o mesmo poder — cada modelo agora define sua própria lista de
  etapas (ex.: "Homologação de Amostra", "Prova de Peça", "Teste de Material", "Execução da Obra"), não mais
  limitada aos 6 valores fixos, e 15 modelos novos, reais, já vêm prontos (Corrigir planilha de produtos,
  Compra de materiais, Cores/Embalagens China, Feira Reval/Ri Happy, Uniformes promotores/fábrica, Show room,
  Painéis/Avisos da fábrica, Display Fofush, Site comercial/conteúdo, Manual de marca). Ver seção
  [Etapas editáveis](#etapas-editáveis) pra detalhes. Consequência direta: o **board global de Demandas** deixou
  de ter Kanban (projetos diferentes agora podem ter etapas incompatíveis entre si) e virou uma lista agrupável
  por projeto/responsável/prioridade — o Kanban continua existindo normalmente **dentro de cada projeto**.
- **Workspace de Projeto (Planejamento, Financeiro, Riscos)**: cada Projeto ganhou 3 abas novas, no mesmo nível
  de profundidade que já existia em Campanhas — **Planejamento** (briefing completo: contexto, público/
  stakeholders, mensagem/posicionamento, estratégia), **Financeiro** (itens de verba previsto x executado) e
  **Riscos** (mapa de calor probabilidade × impacto + decision log). As tabelas de verba/riscos/decisões são
  as mesmas já usadas por Campanhas — reaproveitadas, não duplicadas. Ver seção
  [Workspace de Projeto](#workspace-de-projeto).
- **Modo claro/escuro por usuário + sidebar moderna**: botão ☀/☾ no canto superior direito troca entre modo
  escuro (padrão) e claro — a escolha é salva por pessoa (`profiles.theme`), não é só do navegador. A barra
  lateral ganhou um botão de recolher (vira uma régua só de ícones) e um toggle pra ver todos os módulos numa
  lista única em vez de agrupados por seção — ambos lembrados no navegador. O agrupamento de Demandas também
  trocou de `<select>` por chips clicáveis, mais rápido de bater o olho.
- **Perfil mais completo**: agora dá pra trocar a foto de verdade (upload real, guardado no Storage do
  Supabase — some no bucket `avatars`, um por pessoa), e editar nome, cargo, telefone e uma bio curta direto
  na tela. A foto aparece também no menu lateral e no topo — some do jeito antigo (só iniciais) quando a
  pessoa ainda não subiu uma.
- **IA: prompts mais legíveis + biblioteca de Skills**: os cards de prompt agora mostram o texto com quebras
  de linha preservadas (antes virava um parágrafo espremido) e clicar abre uma tela de leitura só com o
  conteúdo formatado + botão de copiar — editar passou a ser uma ação separada, não a única forma de ler. Nova
  aba **Skills**: instruções reutilizáveis mais focadas que um prompt solto (ex.: "revisar copy pro tom de voz
  Tópi"), mesmo modelo de card/leitura/edição dos Prompts.
- **Calendário mais completo**: agora mostra também o prazo das suas demandas (antes só tinha projeto/campanha/
  post/evento avulso), tem filtro por tipo (Projetos/Demandas/Campanhas/Marcos/Posts/Eventos) e destaca com ★ os
  itens importantes (marcos, demandas atrasadas ou urgentes) — o dia de hoje também fica com borda destacada.
- **Produtos: mais filtros**: além de marca/linha/busca, agora dá pra filtrar por faixa etária, tamanho e
  licenciado x marca própria.
- **Auditoria com filtros**: já mostrava tudo o que a pessoa fez + tudo em projetos/campanhas onde participa
  (Diretoria/Administrador veem tudo); agora tem barra de busca (ação/detalhe), filtro por pessoa, por projeto/
  campanha e por período — pra não depender de rolar a tabela toda procurando.
- **Visibilidade por participação + permissões granulares por pessoa**: Projetos e Demandas deixaram de ser
  visíveis pra qualquer pessoa logada — agora só quem participa de um projeto (`project_members`) o enxerga,
  e uma demanda avulsa (sem projeto) só é visível pra quem é responsável por ela; Diretoria e Administrador
  continuam vendo tudo. Isso é reforçado no banco (RLS), não só escondido na tela. Além disso, Configurações →
  **Perfis & Permissões** ganhou uma tela real: pra cada pessoa, dá pra **ocultar** um módulo que o papel/
  departamento dela normalmente liberaria, ou **liberar** um módulo extra (ex.: convidar alguém da Equipe pro
  módulo Redes Sociais como social media) — sem precisar mudar o papel dela. Redes Sociais, por sinal, mudou
  de padrão: agora só Diretoria/Administrador veem por padrão (antes também via automaticamente por
  departamento) — quem precisar de acesso (social media, gestor de tráfego etc.) precisa ser liberado
  manualmente ali. Ver seção [Permissões](#permissões).

## Etapas editáveis

A partir da migration `0022`, `tasks.stage` (o enum fixo) deixou de existir — cada demanda agora aponta pra uma
linha real da tabela `stages`, que pertence a um projeto específico (ou é uma etapa "global", pra demandas
avulsas sem projeto). Isso significa:

- **Dentro de um projeto** (aba Demandas → "⚙ Etapas deste projeto"): dá pra adicionar, renomear, marcar como
  "final" e reordenar (↑/↓) as etapas daquele projeto sem afetar nenhum outro projeto. Uma etapa só pode ser
  excluída se não tiver nenhuma demanda nela.
- **Modelos** (Projetos → Modelos → editar um modelo): mesma lógica, mas pra a lista de etapas *daquele modelo*
  — ao criar um projeto a partir dele, essa lista de etapas é clonada pro projeto novo (junto com as demandas
  padrão, já na etapa certa).
- **Projeto criado em branco** (sem modelo): ganha automaticamente as 6 etapas clássicas (Recebido/Planejamento/
  Produção/Revisão/Aprovação/Finalizado) como ponto de partida — editáveis normalmente depois.
- **Regra de bloqueio**: mover uma demanda pra uma etapa marcada como **final** exige que ela já tenha um
  responsável atribuído (evita "demanda concluída" sem dono).
- **Board global de Demandas**: como cada projeto pode ter etapas diferentes, não faz mais sentido um Kanban
  único pra todo mundo — a tela virou uma lista/tabela, agrupável por projeto (padrão), responsável ou
  prioridade. O Kanban continua funcionando normalmente dentro da aba Demandas de cada projeto.
- Dado existente (o projeto "Conferência de Embalagens" e os 4 modelos antigos) foi migrado automaticamente
  pela `0022` — cada um ganhou sua cópia própria das 6 etapas clássicas, sem perder nenhuma demanda.

## Workspace de Projeto

A partir da migration `0024`, cada Projeto passa a ter a mesma profundidade operacional que já existia só em
Campanhas, em 3 abas novas na página do projeto:

- **Planejamento**: briefing completo, salvo direto em colunas novas da tabela `projects` (`description`,
  `problem`, `opportunity`, `target_audience`, `personas`, `competitors`, `stakeholders`, `message_main`,
  `tone_of_voice`, `promise`, `value_proposition`, `differentiators`, `strategy`, `restrictions`,
  `assumptions`). O campo "Objetivo" continua editável na aba Resumo, como já era.
- **Financeiro**: itens de verba (previsto x executado), usando a mesma tabela `campaign_budget_items` de
  Campanhas — ela ganhou uma coluna `project_id` (opcional, ao lado de `campaign_id`) para isso.
- **Riscos**: mapa de calor (probabilidade × impacto) + lista de riscos, e logo abaixo um decision log — usando
  `campaign_risks` e `campaign_decisions`, que ganharam a mesma coluna `project_id` opcional.

Em todos os três casos, **cada linha pertence a uma campanha OU a um projeto, nunca aos dois** (garantido por um
`check` no banco) — nenhum dado de Campanhas foi alterado ou migrado, a mudança é só aditiva.

## Permissões

A partir da migration `0025`:

- **Projetos**: só quem está em `project_members` daquele projeto o enxerga — Diretoria e Administrador continuam
  vendo todos. Quem cria um projeto entra automaticamente como membro dele (senão deixaria de ver o próprio
  projeto que acabou de criar). Isso é reforçado no Postgres (RLS), não só escondido na tela — abrir a URL de um
  projeto que você não participa não funciona mais, mesmo digitando o link direto.
- **Demandas**: dentro de um projeto que você participa, continua vendo todas as demandas daquele projeto
  (kanban/colaboração intactos). Uma demanda avulsa (sem projeto) só é visível pra quem é responsável por ela.
  O board global de Demandas já filtrava isso na tela pro papel "Equipe"; agora também é reforçado no banco.
- **Dashboard e Relatórios**: como as consultas de projetos/demandas agora vêm filtradas pelo próprio banco, o
  Dashboard e os Relatórios de quem não é Diretoria/Administrador automaticamente só contam o que essa pessoa
  participa — não precisou de nenhum filtro extra nessas duas telas, é consequência direta da regra acima.
- **Redes Sociais**: mudou de "liberado por departamento" pra "só Diretoria/Administrador por padrão" — quem
  mais precisar (social media, gestor de tráfego) precisa ser liberado manualmente (ver abaixo).
- **Configurações → Perfis & Permissões**: tela nova — escolha uma pessoa e, pra cada módulo do Hub, três
  estados: **Padrão** (o que o papel/departamento dela já dá), **Ocultar** (remove um módulo que ela teria por
  padrão) ou **Liberar** (dá acesso a um módulo que ela não teria por padrão — é o jeito de convidar alguém pro
  Redes Sociais, por exemplo). Só Diretoria/Administrador podem alterar isso (reforçado no banco também).

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
20. Rode também [`supabase/migrations/0017_project_templates.sql`](supabase/migrations/0017_project_templates.sql) —
    cria `project_templates`/`project_template_checklist_items`/`project_template_tasks` e já semeia 4 modelos
    reais (Lançamento de Produto Novo, Conferência/Aprovação de Embalagem, Auditoria de Mídias, Ação de Trade
    Marketing/PDV), cada um com checklist e demandas padrão prontos.
21. Rode também [`supabase/migrations/0018_daily_reports_edit.sql`](supabase/migrations/0018_daily_reports_edit.sql) —
    libera `update`/`delete` em `daily_reports` pro próprio autor (ou Diretoria/Administrador), pra dar pra
    editar/excluir um relatório diário já registrado.
22. Rode também [`supabase/migrations/0019_mpm_schema.sql`](supabase/migrations/0019_mpm_schema.sql) — cria todo
    o schema do **Monitor de Preços** (veja a seção [Monitor de Preços (MPM)](#monitor-de-preços-mpm) mais
    abaixo pra terminar a configuração — tem uma Edge Function pra publicar e um cron pra agendar).
23. Rode também [`supabase/migrations/0021_mpm_drop_ml_oauth.sql`](supabase/migrations/0021_mpm_drop_ml_oauth.sql)
    — a v1 do Monitor de Preços tentou primeiro autenticar direto no Mercado Livre (migration
    `0020_mpm_ml_auth.sql`), mas eles bloqueiam busca de app terceiro por política; trocamos a fonte pra
    Google Shopping (via SerpApi) e essa migration remove as colunas que ficaram sem uso. Passo a passo
    completo de configuração na seção [Monitor de Preços (MPM)](#monitor-de-preços-mpm).
24. Rode também [`supabase/migrations/0022_editable_stages.sql`](supabase/migrations/0022_editable_stages.sql) —
    **atenção, essa é grande**: substitui o enum fixo de 6 estágios (`recebido/planejamento/producao/revisao/
    aprovacao/finalizado`) por uma tabela `stages` de verdade, com uma etapa real por projeto — editável (criar,
    renomear, reordenar, remover) sem afetar outros projetos. Faz backfill automático de tudo que já existe
    (todo projeto, incluindo "Conferência de Embalagens", e os modelos já cadastrados ganham suas próprias
    etapas espelhando o enum antigo) — nada se perde, mas o enum antigo deixa de existir depois desta migration.
    Veja a seção [Etapas editáveis](#etapas-editáveis) mais abaixo pra entender o que mudou na prática.
25. Rode também [`supabase/migrations/0023_new_project_templates.sql`](supabase/migrations/0023_new_project_templates.sql)
    — semeia **15 modelos de projeto novos** (Corrigir planilha de produtos, Compra de materiais, Cores/
    Embalagens China, Feira Reval, Feira Ri Happy, Uniformes promotores/fábrica, Show room, Painéis/Avisos da
    fábrica, Display Fofush, Site comercial/conteúdo, Manual de marca), cada um com sua própria lista de etapas
    (não mais limitada aos 6 valores fixos) e demandas padrão já posicionadas certinho.
26. Rode também [`supabase/migrations/0024_project_workspace.sql`](supabase/migrations/0024_project_workspace.sql)
    — dá a cada Projeto a mesma profundidade operacional das Campanhas: campos de briefing completo direto na
    tabela `projects`, e reaproveita as tabelas `campaign_budget_items`/`campaign_risks`/`campaign_decisions`
    (que passam a aceitar `project_id` além de `campaign_id`, nunca os dois ao mesmo tempo) pra Financeiro/
    Riscos/Decisões de projeto. Não mexe em nenhum dado de Campanhas já existente. Veja a seção
    [Workspace de Projeto](#workspace-de-projeto) mais abaixo.
27. Rode também [`supabase/migrations/0025_permissions.sql`](supabase/migrations/0025_permissions.sql) — muda quem
    enxerga projetos e demandas (só quem participa, exceto Diretoria/Administrador) e adiciona as colunas
    `hidden_modules`/`extra_modules` em `profiles`. **Atenção**: depois de rodar essa, confira em Configurações →
    Perfis & Permissões se alguém que precisa de Redes Sociais (social media, gestor de tráfego etc.) ficou sem
    acesso — o padrão mudou de "por departamento" pra "só Diretoria/Administrador", então essa pessoa provavelmente
    vai precisar ser liberada manualmente ali. Veja a seção [Permissões](#permissões).
28. Rode também [`supabase/migrations/0026_ui_preferences.sql`](supabase/migrations/0026_ui_preferences.sql) —
    adiciona `profiles.theme` (modo claro/escuro por pessoa, padrão `dark`).
29. Rode também [`supabase/migrations/0027_profile_details.sql`](supabase/migrations/0027_profile_details.sql) —
    adiciona `avatar_url`/`phone`/`bio` em `profiles` e cria o bucket de Storage `avatars` (foto real do
    Perfil).
30. Rode também [`supabase/migrations/0028_ia_skills.sql`](supabase/migrations/0028_ia_skills.sql) — cria a
    tabela `ia_skills` (biblioteca de Skills dentro do módulo IA).
31. Pegue as duas chaves de conexão:
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

## Monitor de Preços (MPM)

O módulo de Monitor de Preços tem uma parte que roda fora do Vite/Vercel: uma **Edge Function** do Supabase
(`supabase/functions/mpm-sync`) que faz a busca, valida o match e detecta violação de preço. Ela precisa ser
publicada e agendada separadamente — a tela do Hub (`/monitor-precos`) já funciona assim que a migration
`0019_mpm_schema.sql` rodar, mas sem a Edge Function agendada nada é buscado automaticamente (dá pra testar
clicando em "Sincronizar agora" na tela, que chama a function na hora).

A fonte de busca é a **Google Shopping API da [SerpApi](https://serpapi.com)** — cobre qualquer loja que o
Google indexe (Mercado Livre, Amazon, Shopee, lojas próprias, etc.), não só um marketplace específico. Testamos
a API direta do Mercado Livre primeiro, mas eles bloqueiam busca de app terceiro por política (erro 403,
mesmo autenticado via OAuth) — por isso a troca.

1. **Instale/rode o Supabase CLI via `npx`** (não precisa instalar global — em alguns Macs `npm install -g`
   dá erro de permissão): `npx supabase login`, depois `npx supabase link --project-ref <seu-project-ref>`
   (o project-ref é o mesmo ID que aparece na URL `https://<project-ref>.supabase.co`).
2. **Crie uma conta na [SerpApi](https://serpapi.com)** — tem plano grátis (250 buscas/mês) pra testar; se
   precisar de mais volume, o plano Starter ($25/mês, 1.000 buscas/mês) cobre tranquilamente uns 5-10 produtos
   monitorados diariamente. Pegue sua **API key** em **Your Account → API Key**.
3. **Guarde a chave como secret da function** (rode na raiz do repositório):
   ```bash
   npx supabase secrets set SERPAPI_KEY=sua_chave_aqui
   ```
4. **Publique a function**:
   ```bash
   npx supabase functions deploy mpm-sync
   ```
5. **Rode a migration `0021_mpm_drop_ml_oauth.sql`** — remove as colunas de OAuth do Mercado Livre que não
   são mais usadas (se você já tinha rodado a `0020_mpm_ml_auth.sql` antes de decidirmos trocar de fonte, essa
   migration limpa isso; se ainda não rodou nenhuma das duas, pode rodar `0021` direto).
6. **(Opcional) Ative e-mail de alerta**: crie uma conta grátis/barata no [Resend](https://resend.com), pegue a
   API key e rode:
   ```bash
   npx supabase secrets set RESEND_API_KEY=re_sua_chave_aqui
   ```
   Sem isso, o alerta por e-mail fica preparado mas não envia nada (o webhook e a notificação interna no Hub
   funcionam sem precisar disso).
7. **Agende a execução** com `pg_cron` + `pg_net` — no **SQL Editor** do Supabase, rode (trocando
   `<project-ref>` e `<service-role-key>` pelos valores reais do seu projeto, em **Settings → API**):
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select cron.schedule(
     'mpm-sync-hourly',
     '0 * * * *',
     $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/mpm-sync',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <service-role-key>',
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```
   Isso roda a checagem **de hora em hora**, mas a própria function decide se já é hora de buscar de verdade
   (olhando `mpm_settings.search_interval_hours`, ajustável na aba Configurações da tela) — então rodar de hora
   em hora não gera busca de hora em hora, só verifica se já passou o intervalo configurado (padrão: 24h).
   **Nunca** cole a `service-role-key` em nenhum arquivo do repositório — ela só deve existir dentro do SQL
   Editor do Supabase.
8. Na tela **Monitor de Preços → Produtos monitorados**, adicione os produtos que quer acompanhar (só produtos
   adicionados aqui são pesquisados — o resto do catálogo fica de fora). Preencha o **preço mínimo permitido**
   e, se quiser, palavras-chave/sinônimos pra melhorar a busca. Vale também preencher **EAN** e **imagem
   oficial** de cada produto na tela de Produtos — ajuda a bater o anúncio certo com mais confiança.

**v1 usa Google Shopping (via SerpApi) e zero IA** (anúncio duvidoso vai pra fila de revisão manual na própria
tela, com botões Confirmar/Rejeitar) — decisão tomada pra manter alta confiabilidade sem depender de aprovação
de nenhum marketplace específico. A arquitetura (marketplace detectado automaticamente pela loja do resultado,
camada de validação separada da de busca) já está pronta pra adicionar outras fontes (ex.: busca direta em site
específico) e reativar IA de validação no futuro, sem precisar reescrever nada.

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
supabase/migrations/0017_project_templates.sql   project_templates + checklist/tasks padrão + 4 modelos reais
supabase/migrations/0018_daily_reports_edit.sql  update/delete em daily_reports (autor ou Diretoria/Administrador)
supabase/migrations/0019_mpm_schema.sql          schema completo do Monitor de Preços (produtos, anúncios, histórico, alertas)
supabase/migrations/0020_mpm_ml_auth.sql         (obsoleta) colunas de token OAuth do Mercado Livre — removidas na 0021
supabase/migrations/0021_mpm_drop_ml_oauth.sql   remove colunas de OAuth do ML (trocamos a fonte pra SerpApi/Google Shopping)
supabase/functions/mpm-sync/index.ts             Edge Function que busca (SerpApi/Google Shopping), valida e compara preços
supabase/migrations/0022_editable_stages.sql     tabelas stages/project_template_stages (etapas editáveis por projeto) + backfill
supabase/migrations/0023_new_project_templates.sql  15 modelos novos, cada um com etapas e demandas próprias
supabase/migrations/0024_project_workspace.sql   briefing em projects + project_id em campaign_budget_items/campaign_risks/campaign_decisions
src/pages/projects/                              abas novas de Projeto (Planejamento, Financeiro, Riscos) que reaproveitam tabelas de Campanhas
supabase/migrations/0025_permissions.sql         visibilidade de projetos/demandas por participação (RLS) + hidden_modules/extra_modules em profiles
src/components/ModuleGate.tsx                    guarda de rota que só checa profiles.hidden_modules (usado nas rotas sem regra de papel/depto)
supabase/migrations/0026_ui_preferences.sql      profiles.theme (modo claro/escuro por pessoa)
supabase/migrations/0027_profile_details.sql     profiles.avatar_url/phone/bio + bucket de Storage avatars
src/components/Avatar.tsx                        foto real (avatar_url) com fallback pras iniciais
supabase/migrations/0028_ia_skills.sql           tabela ia_skills (biblioteca de Skills no módulo IA)
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
