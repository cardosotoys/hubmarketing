-- Cardoso Marketing Hub — módulo de IA real (deixa de ser mock)
-- Roda uma vez no SQL Editor, depois de 0001..0012 já terem rodado.
--
-- Cria as tabelas de verdade (prompts, templates, personas e brand voice) e já
-- popula com um acervo inicial real, cobrindo as principais funções do time
-- (copywriting, social media, growth/mídia paga, CRM, trade marketing, design,
-- planejamento, relatórios). Nada aqui responde de verdade ainda — é o acervo
-- de referência; a resposta automática de IA fica pra quando integrar uma API
-- de verdade, como já combinado.

create table public.ia_prompts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id),
  category text not null default '',
  title text not null,
  body text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ia_prompts (brand_id);
create index on public.ia_prompts (category);

create table public.ia_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id),
  category text not null default '',
  name text not null,
  description text not null default '',
  body text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ia_templates (brand_id);
create index on public.ia_templates (category);

create table public.ia_personas (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id),
  name text not null,
  description text not null default '',
  pains text not null default '',
  goals text not null default '',
  tone_notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ia_personas (brand_id);

create table public.ia_brand_voice (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands (id),
  archetype text not null default '',
  tone_of_voice text not null default '',
  dos text not null default '',
  donts text not null default '',
  sample_phrases text not null default '',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.ia_prompts enable row level security;
create policy "ia_prompts_select_authenticated" on public.ia_prompts for select to authenticated using (true);
create policy "ia_prompts_insert_authenticated" on public.ia_prompts for insert to authenticated with check (true);
create policy "ia_prompts_update_authenticated" on public.ia_prompts for update to authenticated using (true);
create policy "ia_prompts_delete_privileged" on public.ia_prompts for delete to authenticated using (public.is_privileged());

alter table public.ia_templates enable row level security;
create policy "ia_templates_select_authenticated" on public.ia_templates for select to authenticated using (true);
create policy "ia_templates_insert_authenticated" on public.ia_templates for insert to authenticated with check (true);
create policy "ia_templates_update_authenticated" on public.ia_templates for update to authenticated using (true);
create policy "ia_templates_delete_privileged" on public.ia_templates for delete to authenticated using (public.is_privileged());

alter table public.ia_personas enable row level security;
create policy "ia_personas_select_authenticated" on public.ia_personas for select to authenticated using (true);
create policy "ia_personas_insert_authenticated" on public.ia_personas for insert to authenticated with check (true);
create policy "ia_personas_update_authenticated" on public.ia_personas for update to authenticated using (true);
create policy "ia_personas_delete_privileged" on public.ia_personas for delete to authenticated using (public.is_privileged());

alter table public.ia_brand_voice enable row level security;
create policy "ia_brand_voice_select_authenticated" on public.ia_brand_voice for select to authenticated using (true);
create policy "ia_brand_voice_insert_authenticated" on public.ia_brand_voice for insert to authenticated with check (true);
create policy "ia_brand_voice_update_authenticated" on public.ia_brand_voice for update to authenticated using (true);

-- ============================================================
-- Brand voice — derivado do que já está documentado em Brand
-- ============================================================

insert into public.ia_brand_voice (brand_id, archetype, tone_of_voice, dos, donts, sample_phrases) values
(
  (select id from public.brands where key = 'playmi'),
  'Herói (posicionamento de mercado) + Inocente (com o consumidor)',
  'Próxima e acessível — simples e acolhedora, nunca complexa ou distante. Entusiástica e energética — animada e motivadora, nunca apática ou fria. Confiável e inspiradora — segura e educadora, nunca genérica ou indiferente. Respeitosa e inclusiva — acolhedora e familiar, nunca invasiva ou excludente.',
  'Falar diretamente com pais e crianças com leveza; reforçar aprendizado através da brincadeira; usar linguagem positiva e afetiva; celebrar descobertas e pequenas conquistas.',
  'Evitar tom técnico ou corporativo; evitar humor ácido ou irônico; não usar jargão de marketing; não soar distante ou institucional.',
  'Brincar é crescer, juntos! · O primeiro passo é brincar. · Descobrir, criar e crescer juntos.'
),
(
  (select id from public.brands where key = 'topi'),
  'Inocente (com o consumidor) + Cara Comum (no mercado)',
  'Próxima e verdadeira — sem formalismo, fala como quem está ao lado da família. Otimista e alegre — entusiasmo contagiante, nunca monótona. Confiável e segura — simples e transparente, nunca técnica demais. Inclusiva e empática — acessível a todas as famílias, nunca impositiva.',
  'Usar linguagem simples e popular; celebrar a alegria simples da infância; falar de preço acessível sem soar barato ou genérico; incluir todas as famílias.',
  'Evitar sofisticação ou exclusividade; evitar termos técnicos; não comparar diretamente com concorrentes; não soar formal.',
  'Brincar é Tópi. · Se divertir é Tópi. · Imaginar é Tópi!'
),
(
  (select id from public.brands where key = 'cardoso'),
  'Institucional — a matriz por trás de Playmi e Tópi',
  'Institucional e direta — comunica solidez, tradição e responsabilidade como fabricante. Tom corporativo, usado em relatórios, parcerias comerciais e comunicação institucional — não é a voz de consumidor final, essa fica com Playmi/Tópi. Nota: ainda não existe um manual de marca de consumidor para a Cardoso — este é um ponto de partida pragmático, não um brandbook oficial.',
  'Falar com clareza e objetividade em contextos B2B/institucionais; reforçar tradição e qualidade de fabricação; comunicar-se com parceiros comerciais e imprensa com formalidade adequada.',
  'Não usar o tom lúdico de Playmi/Tópi, que pertence às submarcas; evitar linguagem excessivamente informal.',
  ''
);

-- ============================================================
-- Personas
-- ============================================================

insert into public.ia_personas (brand_id, name, description, pains, goals, tone_notes) values
(
  (select id from public.brands where key = 'playmi'),
  'Mãe/pai Playmi',
  'Pais e mães de 28 a 40 anos, classes B-C, que priorizam brinquedos que estimulem o desenvolvimento da criança e tenham boa relação custo-benefício premium.',
  'Medo de comprar brinquedo de baixa qualidade ou inseguro; excesso de opções no mercado; pouco tempo para pesquisar antes de comprar.',
  'Encontrar brinquedos seguros, educativos e duráveis; presentear com algo que valha a pena; ver a criança se desenvolver brincando.',
  'Reforçar segurança, desenvolvimento e afeto — nunca só preço.'
),
(
  (select id from public.brands where key = 'topi'),
  'Mãe/pai Tópi',
  'Pais e mães de 25 a 45 anos, classes C-D, que compram brinquedos com frequência e priorizam preço acessível sem abrir mão da diversão.',
  'Orçamento apertado; medo de o brinquedo quebrar rápido; pouca disponibilidade de marcas populares a preço justo.',
  'Presentear os filhos com frequência sem pesar no bolso; ver alegria imediata na criança; confiar que o brinquedo vai durar.',
  'Tom popular, caloroso, direto — nunca comparar com concorrentes de forma agressiva.'
),
(
  null,
  'Criança usuária (3 a 8 anos)',
  'O público final que realmente brinca — não decide a compra, mas influencia fortemente através de pedidos aos pais e reação ao produto.',
  'Brinquedo chato ou que quebra rápido; embalagem difícil de abrir; brinquedo que não corresponde à expectativa da embalagem.',
  'Diversão imediata; brincar com personagens/temas que já conhece; orgulho de mostrar o brinquedo aos amigos.',
  'Embalagem e comunicação visual devem comunicar diversão instantânea — a criança reconhece a imagem antes de qualquer texto.'
),
(
  null,
  'Comprador de varejo / trade',
  'Compradores e gestores de categoria de redes de varejo (papelarias, magazines, atacarejos) que decidem quais produtos entram na loja ou na gôndola.',
  'Necessidade de girar estoque rápido; pressão por margem; medo de encalhar produto.',
  'Produtos com giro rápido, boa margem, e suporte de material de PDV/trade marketing da indústria.',
  'Comunicação B2B, objetiva, com dados de giro/margem — tom institucional da Cardoso, não o tom lúdico das submarcas.'
),
(
  null,
  'Influenciador / creator infantil',
  'Criadores de conteúdo (unboxing, reviews de brinquedo) que revisam produtos e influenciam a decisão de compra dos pais.',
  'Precisa de produtos que performem bem em vídeo; prazo curto para lançamentos.',
  'Conteúdo que gere engajamento; produtos com apelo visual forte para vídeo.',
  'Fornecer kit de informações rápidas (ficha técnica, diferenciais) para facilitar a criação de conteúdo.'
);

-- ============================================================
-- Prompts (cobrindo as principais funções do time)
-- ============================================================

insert into public.ia_prompts (brand_id, category, title, body) values
(null, 'Copywriting', 'Legenda de post Instagram', 'Crie 3 opções de legenda para um post de Instagram da marca {marca} sobre o produto {nome do produto}. Tom de voz: {descreva o tom, ex: acolhedor e educativo para Playmi, ou popular e alegre para Tópi}. Público: {pais/mães classe B-C ou C-D}. Objetivo do post: {ex: lançamento, promoção, engajamento}. Limite: até 150 caracteres por legenda, inclua 1 emoji relevante e termine com uma pergunta que incentive comentários.'),
(null, 'Social Media', 'Roteiro de vídeo curto (Reels/TikTok)', 'Escreva um roteiro de vídeo de até 30 segundos para Reels/TikTok apresentando o produto {nome do produto} da marca {marca}. Estrutura: gancho nos primeiros 3 segundos, demonstração do produto em uso, call-to-action final. Tom: {tom de voz da marca}. Inclua sugestões de trilha sonora e texto na tela.'),
(null, 'Growth/Mídia Paga', 'Texto de anúncio pago (Meta/Google Ads)', 'Crie 5 variações de texto de anúncio (título + descrição, dentro dos limites de caracteres do Meta Ads) para promover {produto/campanha} da marca {marca} para o público {persona}. Objetivo da campanha: {conversão/tráfego/reconhecimento}. Destaque o principal diferencial: {diferencial}. Inclua uma chamada para ação clara.'),
(null, 'CRM', 'E-mail de nutrição de lead comercial', 'Escreva uma sequência de 3 e-mails de nutrição para um lead comercial (varejista/lojista) interessado em revender produtos {marca}. E-mail 1: apresentação institucional da Cardoso e diferenciais de fabricação. E-mail 2: cases de giro/margem de produtos {marca}. E-mail 3: convite para reunião comercial com proposta de condições. Tom institucional e objetivo.'),
(null, 'Trade Marketing', 'Proposta de ação de trade em PDV', 'Elabore uma proposta de ação de trade marketing para o ponto de venda {tipo de loja, ex: papelaria/magazine} promovendo a linha {linha de produto} da marca {marca}. Inclua: objetivo comercial, material de PDV sugerido, mecânica da ação (ex: desconto, combo, gôndola temática), período sugerido e KPI de sucesso (ex: giro, sell-out).'),
(null, 'Design', 'Brief de embalagem', 'Monte um brief de design de embalagem para o produto {nome do produto} da linha {linha} da marca {marca}. Inclua: dimensões físicas do produto, informações obrigatórias (faixa etária, selo do Inmetro, código de barras), elementos de marca obrigatórios (logo, cores, tipografia), e o principal apelo visual que a embalagem deve comunicar em 3 segundos de exposição na gôndola.'),
(null, 'Planejamento', 'Briefing completo de campanha sazonal', 'Crie um briefing completo de campanha para a data sazonal {ex: Dia das Crianças, Black Friday, Natal} da marca {marca}. Estrutura: objetivo, público-alvo, produtos em destaque, mensagem principal, tom de voz, canais de comunicação, período da campanha, orçamento estimado e principais KPIs de sucesso.'),
(null, 'Social Media', 'Calendário editorial mensal', 'Monte um calendário editorial de 4 semanas para as redes sociais da marca {marca}, com 3 posts por semana. Para cada post, defina: data sugerida, tipo de conteúdo (produto, educativo, engajamento, promocional), tema, e um esboço de legenda. Considere datas comemorativas do mês de {mês}.'),
(null, 'Social Media', 'Resposta a comentário ou crise nas redes', 'A marca {marca} recebeu o seguinte comentário/reclamação nas redes sociais: "{cole o comentário aqui}". Escreva uma resposta pública que seja empática, resolutiva e alinhada ao tom de voz da marca, sem soar defensiva. Sugira também um encaminhamento interno (ex: SAC, troca de produto) se aplicável.'),
(null, 'Relatórios', 'Análise executiva de performance de campanha', 'Com base nos seguintes dados de campanha: {cole métricas: impressões, cliques, CTR, investimento, conversões}, escreva uma análise executiva de performance para apresentar à Diretoria. Inclua: principais aprendizados, o que funcionou bem, o que precisa de ajuste, e recomendações para a próxima campanha.'),
(null, 'Planejamento', 'Naming de produto ou linha nova', 'Sugira 10 opções de nome para uma nova linha de produtos {descreva a linha, ex: veículos de fricção infantis} da marca {marca}. O nome deve ser: curto (1 a 2 palavras), fácil de pronunciar por crianças, alinhado ao arquétipo de marca ({arquétipo}), e ainda não registrado por concorrentes conhecidos.'),
(null, 'Trade Marketing', 'Roteiro institucional B2B', 'Escreva um roteiro de vídeo institucional de até 90 segundos apresentando a Cardoso Indústria de Brinquedos para potenciais parceiros comerciais/varejistas. Destaque: tradição de fabricação, portfólio de marcas (Playmi e Tópi), capacidade produtiva e diferenciais competitivos (giro, margem, suporte de trade).'),
(null, 'Growth/Mídia Paga', 'Copy de produto para marketplace', 'Escreva a descrição de produto para marketplace (Amazon/Shopee/Mercado Livre) do item {nome do produto} da marca {marca}. Inclua: título otimizado para busca (até 60 caracteres), 5 bullet points de benefícios, e uma descrição longa de até 500 caracteres reforçando faixa etária, material e diferenciais.'),
(null, 'Relatórios', 'Pauta de imprensa / release', 'Redija um pitch de imprensa (release curto) anunciando {novidade: lançamento de produto, licenciamento, parceria} da marca {marca}/Cardoso. Estrutura: título chamativo, lide com as informações principais (o quê, quando, por quê importa), 2 parágrafos de contexto, e dados de contato para a imprensa.'),
(null, 'Social Media', 'Roteiro-guia de unboxing para influenciador', 'Crie um roteiro-guia para um influenciador infantil gravar um vídeo de unboxing do produto {nome do produto} da marca {marca}. Inclua: pontos-chave que devem aparecer no vídeo (embalagem, montagem se houver, demonstração de uso, reação), duração sugerida, e uma sugestão de call-to-action de encerramento.'),
(null, 'Planejamento', 'Plano de recuperação de prazo atrasado', 'A demanda "{nome da demanda}" do projeto/campanha "{nome}" está atrasada. Com base no motivo informado: "{motivo do atraso}", sugira um plano de recuperação de prazo em até 3 passos objetivos, e uma mensagem curta para comunicar a nova previsão de entrega para os envolvidos.');

-- ============================================================
-- Templates
-- ============================================================

insert into public.ia_templates (brand_id, category, name, description, body) values
(null, 'Planejamento', 'Briefing de Campanha', 'Estrutura base pra qualquer campanha nova — preencher antes de criar o workspace no Hub.', E'# Briefing de Campanha\n\n**Nome da campanha:**\n**Marca:**\n**Categoria:**\n**Período:**\n**Objetivo principal:**\n**Público-alvo:**\n**Produtos envolvidos:**\n**Mensagem principal:**\n**Tom de voz:**\n**Canais:**\n**Orçamento estimado:**\n**KPIs de sucesso:**\n**Responsável:**'),
(null, 'Design', 'Brief Criativo', 'Base pra pedir qualquer peça (banner, vídeo, embalagem) pro time de design.', E'# Brief Criativo\n\n**Peça:** (banner, vídeo, embalagem…)\n**Marca:**\n**Objetivo da peça:**\n**Mensagem principal:**\n**Formato/dimensões:**\n**Elementos obrigatórios:** (logo, selo, código de barras…)\n**Referências visuais:**\n**Prazo:**\n**Aprovador:**'),
(null, 'Relatórios', 'Relatório Mensal de Marketing', 'Estrutura pro fechamento mensal apresentado à Diretoria.', E'# Relatório Mensal — {mês/ano}\n\n## Resumo executivo\n\n## Campanhas ativas\n\n## Redes sociais (alcance, engajamento, seguidores)\n\n## Mídia paga (investimento, CTR, ROAS)\n\n## Produtos e trade\n\n## Próximos passos'),
(null, 'Trade Marketing', 'Proposta de Trade Marketing', 'Base pra propor qualquer ação comercial em PDV pra um cliente/rede.', E'# Proposta de Trade Marketing\n\n**Cliente/rede:**\n**Linha/produtos:**\n**Objetivo comercial:**\n**Mecânica da ação:**\n**Material de PDV:**\n**Período:**\n**Investimento:**\n**KPI de sucesso (giro/sell-out):**'),
(null, 'Social Media', 'Calendário Editorial', 'Planilha simples pra organizar posts do mês por marca.', E'# Calendário Editorial — {mês}\n\n| Data | Marca | Tipo | Tema | Legenda (rascunho) |\n|---|---|---|---|---|\n| | | | | |'),
(null, 'Planejamento', 'Análise de Concorrência', 'Comparativo rápido pra mapear um concorrente antes de decidir posicionamento.', E'# Análise de Concorrência\n\n**Concorrente:**\n**Produtos comparáveis:**\n**Faixa de preço:**\n**Pontos fortes:**\n**Pontos fracos:**\n**Oportunidade para nós:**'),
(null, 'Planejamento', 'Ficha de Persona', 'Base pra documentar uma persona nova antes de cadastrar no módulo de IA.', E'# Persona\n\n**Nome:**\n**Marca relacionada:**\n**Perfil (idade, classe, papel):**\n**Dores:**\n**Objetivos:**\n**Como devemos falar com ela:**'),
(null, 'Social Media', 'Post para Redes Sociais', 'Checklist rápido antes de subir qualquer peça pra aprovação em Redes Sociais.', E'**Marca:**\n**Tipo:** (post/story/reel)\n**Data sugerida:**\n**Legenda:**\n**Hashtags:**\n**Call-to-action:**\n**Aprovador:**');
