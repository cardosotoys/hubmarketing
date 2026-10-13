-- Cardoso Marketing Hub — troca do plano de mídias: entra o plano 14/10/2026 a 05/01/2027.
--
-- Fonte: Plano_Midias_Cardoso_Playmi_Topi_14out26-05jan27.xlsx (abas Peças, Produção e Marcos).
-- 112 assuntos · 405 destinos · 23 marcos comerciais.
--
-- O plano antigo (Ago/26–Mar/27) SAI do Hub. Antes de apagar, uma cópia completa fica em tabelas
-- de backup (backup_plano_20261013_*), fechadas por RLS sem policy: o app não lê, só o SQL Editor.
-- Comentários e reações das peças antigas vão junto para o backup.
--
-- Regras da importação:
--   · cada assunto tem 1 matriz; reaproveita herda legenda e criativo; adapta tem legenda própria
--     (e criativo próprio só quando o link do Drive é diferente do da matriz)
--   · Instagram feed/Reels/Carrossel saem espelhados no Facebook (cadeia da Cardoso)
--   · licenciado = coluna "licenciado" da aba Produção (aguarda o aval do licenciador)
--   · produto do catálogo é ligado quando a REF é uma só e existe em products
--   · todas as etapas começam pendentes
--
-- Roda depois de 0113. Idempotente: rodar de novo não duplica nem apaga o plano novo.

set lock_timeout = '10s';

begin;

-- 1) backup do plano antigo (só na primeira vez)
create table if not exists public.backup_plano_20261013_items as table public.social_plan_items with no data;
create table if not exists public.backup_plano_20261013_topics as table public.social_topics with no data;
create table if not exists public.backup_plano_20261013_comments as table public.social_plan_comments with no data;
create table if not exists public.backup_plano_20261013_deadlines as table public.social_plan_deadlines with no data;
alter table public.backup_plano_20261013_items enable row level security;
alter table public.backup_plano_20261013_topics enable row level security;
alter table public.backup_plano_20261013_comments enable row level security;
alter table public.backup_plano_20261013_deadlines enable row level security;

-- só na primeira vez: depois que o plano novo entrou, rodar de novo não toca no que foi criado no Hub
do $$
begin
  if exists (select 1 from public.social_topics where ext_key like 'plano-2026-10:%') then
    raise notice 'Plano novo já está no banco: backup e limpeza pulados.';
    return;
  end if;
  insert into public.backup_plano_20261013_items
    select * from public.social_plan_items i
     where coalesce(i.ext_id, '') not like 'plano-2026-10:%'
       and not exists (select 1 from public.backup_plano_20261013_items b where b.id = i.id);
  insert into public.backup_plano_20261013_topics
    select * from public.social_topics t
     where coalesce(t.ext_key, '') not like 'plano-2026-10:%'
       and not exists (select 1 from public.backup_plano_20261013_topics b where b.id = t.id);
  insert into public.backup_plano_20261013_comments
    select c.* from public.social_plan_comments c
      join public.social_plan_items i on i.id = c.item_id
     where coalesce(i.ext_id, '') not like 'plano-2026-10:%'
       and not exists (select 1 from public.backup_plano_20261013_comments b where b.id = c.id);
  insert into public.backup_plano_20261013_deadlines
    select * from public.social_plan_deadlines d
     where coalesce(d.ext_key, '') not like 'plano-2026-10:%'
       and not exists (select 1 from public.backup_plano_20261013_deadlines b where b.id = d.id);

    -- 2) apaga o plano antigo (peças, assuntos e marcos que não são do plano novo)
  delete from public.comment_reactions
   where source = 'social_plan'
     and comment_id in (select c.id from public.social_plan_comments c join public.social_plan_items i on i.id = c.item_id
                         where coalesce(i.ext_id, '') not like 'plano-2026-10:%');
  update public.social_plan_items set merged_into = null where coalesce(ext_id, '') not like 'plano-2026-10:%';
  delete from public.social_plan_items where coalesce(ext_id, '') not like 'plano-2026-10:%';
  delete from public.social_topics where coalesce(ext_key, '') not like 'plano-2026-10:%';
  delete from public.social_plan_deadlines where coalesce(ext_key, '') not like 'plano-2026-10:%';
end $$;

-- 3) assuntos do plano novo
create temp table _t (ext_key text, title text, brand text, sku text, front text, objective text, strategy text, cta text, media_use text, licensed boolean) on commit drop;
insert into _t values
  ('plano-2026-10:t001','Miniaturas Spidey: o herói que cabe na mão','Playmi','3103','Outubro · Personagens','Colocar o Spidey na lista de Natal das famílias com fã do herói','Pós Dia das Crianças a lista de Natal começa a se formar; a venda de licenciados Marvel vai até 31/03/27 e o Natal é a maior janela','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t002','Robô-Blocks: monta, desmonta e vira outro','Tópi','7172 · 7173 · 7174 · 7175','Outubro · Sem. 1 · Achadinho que rende brincadeira','Mostrar o Robô-Blocks em ação para gerar desejo por impulso','10 vídeos prontos; montar e transformar prende os 3 primeiros segundos, o formato que mais retém no Reels e no TikTok','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t003','Você vende online? A Cardoso entrega o conteúdo pronto','Cardoso','Banco de materiais Playmi e Tópi','Outubro · Sem. 1 · Conteúdo pronto para e-commerce','Gerar contato de donos de e-commerce interessados em revender','Diferencial para quem vende online: foto e vídeo prontos cortam o tempo de cadastro antes do Natal, quando o anúncio precisa estar no ar rápido','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t004','Totokinha Spidey: o primeiro passeio do pequeno herói','Playmi','3098','Outubro · Personagens','Mostrar a Totokinha Spidey como presente para o pequeno fã a partir de 18 meses','Segunda peça do Spidey em sequência fixa o herói na memória; une a Totokinha (curva A nº 1 da Playmi) à licença Marvel','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t005','Carrinho de Boneca Passeio do Bebê: hora do passeio','Tópi','0125','Outubro · Sem. 1 · Curva A sem conteúdo','Dar vitrine ao produto Tópi que mais vende e ainda não tinha conteúdo','Item nº 1 da Tópi no ano e sem nenhum vídeo; Reels com imagem gerada coloca o produto na busca de Natal','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t006','3 jeitos de brincar com o Boliche','Tópi','7001','Outubro · Sem. 1 · Ideia de brincadeira','Gerar salvamento com ideia de brincadeira em família','Boliche é curva A em volume (mais de 800 clientes no semestre) e tem 24 imagens prontas; carrossel de ideias é o formato mais salvo','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t007','Natal Musical: aperta, toca, encanta','Cardoso','Kits NM-01 · NM-02 · NM-03 · NM-04','Outubro · Sem. 2 · Natal Musical','Levar os 4 kits do Natal Musical ao lojista no início da campanha','Natal Musical começa em 19/10 (diretriz); a janela de reposição de Natal do lojista vai até 28/11','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t008','Desde 1987: o que significa comprar direto da fábrica','Cardoso','Institucional','Outubro · Sem. 2 · Por que revender Cardoso','Apresentar a Cardoso a compradores de e-commerce que ainda não revendem a marca','Outubro e novembro são quando o e-commerce fecha o sortimento de Natal; quem decide agora entra também na reposição de março','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t009','Estação de Resgate: 10 blocos e uma missão','Playmi','8025','Outubro · Brincar de verdade','Mostrar a Estação de Resgate em uso para quem procura brinquedo de montar a partir de 3 anos','Produto parado no estoque (diretriz comercial); conteúdo de consumidor ajuda o lojista a girar antes do Natal','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t010','Teltaluga e Tortuga: as tartarugas da Tópi','Tópi','3007 · 3008','Outubro · Sem. 2 · Achadinho que rende brincadeira','Gerar desejo com produto em movimento para os pequenos','5 vídeos prontos; brinquedo para 18 meses+ amplia o público da Tópi','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t011','Do molde à caixa: a fábrica Cardoso','Cardoso','Institucional','Outubro · Sem. 2 · Por que revender Cardoso','Gerar confiança e contato de novos revendedores','Fábrica própria responde à principal dúvida de quem compra de indústria pela primeira vez: entrega e qualidade; vídeos ''Nossa história'' prontos','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t012','Carrinho de Puxar Rosa: blocos que acompanham os primeiros passos','Playmi','8028','Outubro · Brincar de verdade','Apresentar o Carrinho de Puxar como presente para quem está começando a andar','A faixa de 12 meses+ tem pouca oferta no feed; blocos combinam com a busca de presente para o primeiro ano','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t013','Tópi Sabidinho Plus: descoberta que cabe no bolso','Tópi','3059','Outubro · Sem. 2 · Curva A sem conteúdo','Dar vitrine ao 2º Tópi mais vendido','2º item mais vendido da Tópi e sem conteúdo; imagem gerada','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t014','Totokross: equilíbrio antes da bicicleta','Playmi','8018','Outubro · Brincar de verdade','Posicionar a Totokross como presente que desenvolve equilíbrio a partir de 12 meses','Produto parado no estoque (diretriz) com mais de 50 imagens prontas; equilíbrio é argumento forte para a mãe que decide pelo desenvolvimento','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t015','Mesinha de Atividades: tudo num lugar só','Tópi','3054','Outubro · Sem. 2 · Ideia de brincadeira','Mostrar o valor da mesinha para os pequenos','Vídeos e 11 imagens prontos; carrossel explicativo gera salvamento','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t016','Esquenta Cardoso Black (interno)','Cardoso','Lista Cardoso Black','Outubro · Sem. 3 · Cardoso Black (interno)','Preparar representantes e lojistas pequenos para a Black que começa em 03/11','Diretriz: representantes avisam no esquenta (26/10 a 02/11); Black não é comunicada nas redes, só WhatsApp e área comercial','Fale com seu representante','Interno · sem redes',false),
  ('plano-2026-10:t017','Natal Musical: os 4 kits por dentro','Cardoso','Kits NM-01 · NM-02 · NM-03 · NM-04','Outubro · Sem. 3 · Natal Musical','Mostrar o conteúdo de cada kit para acelerar o pedido','Segunda semana da campanha; mostrar o que vem em cada kit tira a dúvida que trava o pedido','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t018','E-commerce no Natal: o anúncio que sobe primeiro vende primeiro','Cardoso','Banco de materiais','Outubro · Sem. 3 · Conteúdo pronto para e-commerce','Atrair e-commerces para a revenda com o argumento do conteúdo pronto','Fim de outubro o e-commerce corre para cadastrar o Natal; o conteúdo pronto é o argumento certo na hora certa','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t019','Totokinha Bolinha: a língua e os bracinhos se mexem','Playmi','3034 · 3033','Outubro · Brincar de verdade','Mostrar o detalhe que diferencia a Totokinha Bolinha','Linha Totokinha é a curva A nº 1 da Playmi; um detalhe por modelo mantém a linha no feed sem repetir o mesmo vídeo','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t020','Dino Sabidinho: o dino companheiro','Tópi','1007','Outubro · Sem. 3 · Achadinho que rende brincadeira','Gerar desejo pelo Dino Sabidinho','Curva A em volume (mais de 700 clientes no semestre) com 4 vídeos prontos','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t021','Uma indústria, duas marcas: Playmi e Tópi','Cardoso','Portfólio Playmi e Tópi','Outubro · Sem. 3 · Por que revender Cardoso','Mostrar ao revendedor que o mix cobre públicos e faixas de preço diferentes','Quem monta loja ou e-commerce precisa de mix: Playmi (valor agregado, B–C) e Tópi (alto giro, C–D) resolvem os dois públicos com um fornecedor','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t022','Totokinha Sport Azul: o carrinho dos primeiros passeios','Playmi','3067','Outubro · Brincar de verdade','Reforçar o produto mais vendido da Playmi como presente de Natal','Item mais vendido da Playmi no ano, com vídeos finalizados; fechar outubro com ele aquece a busca de Natal','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t023','Tópi Escolar e Tópi Bombeirinho','Tópi','3058 · 3057','Outubro · Sem. 3 · Curva A sem conteúdo','Dar vitrine ao 3º e 4º Tópi mais vendidos','Curva A da Tópi sem conteúdo; imagem gerada','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t024','Primeiros passos, grandes descobertas: todas as Totokinhas','Playmi','Linha Totokinha (0300 · 0301 · 3033 · 3034 · 3066 · 3067)','Outubro · Brincar de verdade','Mostrar a linha inteira para a mãe escolher o modelo que combina com a criança','Fecha a sequência de outubro com a família completa e prepara o Guia de Natal de novembro; curva A nº 1 da Playmi','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t025','Monte a cozinha de faz de conta Tópi','Tópi','4021 · 7220 · 4026','Outubro · Sem. 3 · Ideia de brincadeira','Mostrar os itens de faz de conta da Tópi juntos','Fogãozinho e Cestinha estão parados no estoque (diretriz); juntos no carrossel ganham contexto de brincadeira','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t026','Começou a Cardoso Black (interno)','Cardoso','Lista Cardoso Black','Novembro · Sem. 1 · Cardoso Black (interno)','Ativar o lojista pequeno a repetir o pedido de nov/25','Black do lojista vai de 03 a 27/11 (diretriz); Finados (02/11) desloca a largada para terça','Fale com seu representante','Interno · sem redes',false),
  ('plano-2026-10:t027','Licenciados no Natal: personagem vende','Cardoso','Licenciados Marvel · Disney · DC · Os Smurfs · Pocoyo','Novembro · Sem. 1 · Licenciados: Natal','Abrir a fase Natal do projeto Licenciados com lojistas e e-commerces','Venda dos licenciados vai até 31/03/27; a fase Natal (nov–dez) é a de maior giro (diretriz); lâmina aprovada pelo licenciador até 07/11','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t028','Doce Cozinha Gourmet: restaurante de faz de conta','Playmi','2020 · 2021 · 2022 · 2023 · 2024','Novembro · Sem. 1 · Brincar de verdade','Mostrar a linha completa da cozinha como presente de faz de conta para 3+ anos','Linha com 12 vídeos e mais de 30 imagens prontas; faz de conta de cozinha é busca forte de Natal para 3+','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t029','Representante Cardoso: atendimento perto da sua loja','Cardoso','Institucional','Novembro · Sem. 1 · Por que revender Cardoso','Mostrar que a revenda tem atendimento próximo','Comprador novo quer saber quem atende; a Cardoso atende clientes em todos os estados com representantes','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t030','Invictus Sky: decolagem autorizada','Tópi','1053','Novembro · Sem. 1 · Achadinho que rende brincadeira','Gerar desejo pelo Invictus Sky','Vídeos e imagens prontos; veículo com helicóptero rende vídeo de ação','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t031','Foto, vídeo e texto: o kit de cada produto','Cardoso','Banco de materiais','Novembro · Sem. 1 · Conteúdo pronto para e-commerce','Gerar contato de e-commerces','Novembro é o mês em que o e-commerce mais cadastra produto; mostrar o kit pronto de um produto real prova o argumento','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t032','Fofilhotes: os bichinhos dos primeiros meses','Playmi','3090 · 3091 · 3092 · 3093 · 3094 · 3095','Novembro · Sem. 1 · Brincar de verdade','Apresentar os Fofilhotes como presente para os bem pequenos','Mais de 24 vídeos prontos da linha; presente para o primeiro ano é o que mais falta no feed da Playmi','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t033','Tópi Trator Escavadeira e Retroescavadeira','Tópi','4022 · 4023','Novembro · Sem. 1 · Curva A sem conteúdo','Dar vitrine aos tratores Tópi','Tratores Tópi estão na curva A sem conteúdo; tema construção funciona no público C–D','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t034','Presente para 18 meses: Dino Sabidinho Plus','Playmi','3029','Novembro · Sem. 1 · Presente certo','Ajudar quem vai presentear a escolher pela idade','Início da busca por presente de Natal; carrossel por idade é salvo e consultado até dezembro; 45 imagens IA prontas','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t035','Banda em casa: musicais da Tópi','Tópi','4009 · 4012 · 7110','Novembro · Sem. 1 · Ideia de brincadeira','Mostrar os musicais Tópi como brincadeira em família','Vídeos prontos (Tambor, reel Brinquedos musicais); apoia o Natal Musical na loja do lojista','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t036','Cardoso Black: faltam 18 dias (interno)','Cardoso','Lista Cardoso Black','Novembro · Sem. 2 · Cardoso Black (interno)','Manter a urgência da Black com os representantes','Contagem às segundas (diretriz)','Fale com seu representante','Interno · sem redes',false),
  ('plano-2026-10:t037','Licenciados que mais giram no Natal','Cardoso','Totokinha Spidey · Totokinha Princesas · Bonecos de banho Disney','Novembro · Sem. 2 · Licenciados: Natal','Mostrar ao lojista os licenciados que saem sozinhos','Grupo A da diretriz (sai sozinho): mostrar o que gira dá segurança para o pedido de dezembro','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t038','Natal Musical: reposição até 28/11','Cardoso','Kits NM-01 · NM-02 · NM-03 · NM-04','Novembro · Sem. 2 · Natal Musical','Lembrar compradores de varejo e e-commerce da janela de reposição','Reposição de Natal fecha em 28/11 (diretriz); kit pronto acelera o pedido','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t039','Lançamento Patinete Bluey','Playmi','7229','Novembro · Sem. 2 · Personagens','Lançar o Patinete Bluey para as famílias que acompanham a personagem','Lançamento 2026 com imagens IA prontas; Bluey é a licença mais nova e chega a tempo da lista de Natal (enviar ao licenciador até 31/10)','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t040','Tandy Caçamba e Tandy Tractor','Tópi','0071 · 0072','Novembro · Sem. 2 · Achadinho que rende brincadeira','Dar vitrine aos Tandy da Tópi','Tandy Caçamba e Tractor estão na curva A da Tópi sem conteúdo','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t041','Quase 40 anos fazendo brinquedo em São Paulo','Cardoso','Institucional','Novembro · Sem. 2 · Por que revender Cardoso','Gerar contato de novos revendedores','História e fábrica própria reduzem o risco percebido de quem nunca comprou da indústria','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t042','Doce Cozinha Plus: chá da tarde de faz de conta','Playmi','7205 · 7206 · 7207','Novembro · Sem. 2 · Brincar de verdade','Mostrar o chá da tarde como brincadeira de faz de conta para 3+ anos','Linha com mais de 80 imagens e 3 vídeos prontos; reforça o faz de conta na semana em que a lista de Natal fecha','Onde comprar (link na bio)','Orgânico',false),
  ('plano-2026-10:t043','Leva Papinha: brincar de cuidar','Tópi','0124','Novembro · Sem. 2 · Achadinho que rende brincadeira','Mostrar o Leva Papinha no faz de conta de cuidar','Curva A em volume com imagens prontas; brincar de cuidar é tema forte de Natal 3+','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t044','Musicais Playmi: presente para 1 a 2 anos','Playmi','7109 · 7107 · 7155 · 7111','Novembro · Sem. 2 · Presente certo','Apoiar o giro dos musicais no varejo durante o Natal Musical','A Cardoso está repondo musicais no lojista até 28/11 (Natal Musical); conteúdo de consumidor puxa a venda na loja dele','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t045','Amigo secreto da escola: lembrancinhas Tópi','Tópi','7189 · 7190 · 4014 · 4026','Novembro · Sem. 2 · Ideia de brincadeira','Resolver o ''o que dar'' do amigo secreto infantil','Fim de novembro começa o amigo secreto da escola; o público C–D busca presente de valor acessível','Salve para consultar','Mídia paga liberada',false),
  ('plano-2026-10:t046','Cardoso Black: corte de faturamento (interno)','Cardoso','Lista Cardoso Black','Novembro · Sem. 3 · Cardoso Black (interno)','Antecipar pedidos para chegarem antes da Black do lojista','Diretriz: pedido faturado até 20/11 chega antes de 27/11. 20/11 é feriado nacional: confirmar o corte com o comercial','Fale com seu representante','Interno · sem redes',false),
  ('plano-2026-10:t047','Natal Musical: última semana de reposição','Cardoso','Kits NM-01 · NM-02 · NM-03 · NM-04','Novembro · Sem. 3 · Natal Musical','Fechar a reposição de musicais antes de 28/11','D-12 do fim da janela de reposição; última chamada para o lojista','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t048','Você cadastra, a gente fotografa','Cardoso','Banco de materiais','Novembro · Sem. 3 · Conteúdo pronto para e-commerce','Atrair e-commerces para a revenda','Segunda quinzena de novembro: pico de cadastro de produtos de Natal no e-commerce','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t049','Acqua Bubble: o verão começa no quintal','Playmi','2018','Novembro · Sem. 3 · Brincar de verdade','Mostrar o Acqua Bubble como presente de Natal com cara de verão','Curva A (mais de 600 clientes no semestre) com 59 imagens e 2 vídeos prontos; Natal no Brasil é verão','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t050','Mesinha de Atividades em ação','Tópi','3054','Novembro · Sem. 3 · Achadinho que rende brincadeira','Converter quem salvou o carrossel da mesinha','Repetir o produto com vídeo pronto depois do carrossel de outubro','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t051','Seu e-commerce pronto para o Natal','Cardoso','Banco de materiais','Novembro · Sem. 3 · Conteúdo pronto para e-commerce','Gerar contato de e-commerces','D-36 do Natal: quem começa agora ainda vende dezembro','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t052','Família Bluey: Totokinha e Little Figs','Playmi','3123 · 3113','Novembro · Sem. 3 · Personagens','Ampliar o lançamento Bluey com a linha completa','Segunda peça Bluey em 10 dias fixa a licença na memória enquanto a lista de Natal fecha (enviar ao licenciador até 07/11)','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t053','Tópi Blocos de Montar: construa o que quiser','Tópi','7189 · 7190','Novembro · Sem. 3 · Curva A sem conteúdo','Dar vitrine aos blocos Tópi','Feriado de 20/11 aumenta o tempo das famílias em casa; blocos rendem vídeo de montagem','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t054','Guia de Natal Playmi: um presente para cada idade','Playmi','8018 · 3067 · 3029 · 7229 · 2020','Novembro · Sem. 3 · Presente certo','Converter a busca de Natal com um guia salvável por idade','Natal D-34: o guia publicado agora é salvo e consultado até a compra; reúne os produtos mais fortes do período','Salve para consultar','Mídia paga liberada',true),
  ('plano-2026-10:t055','Guia de Natal Tópi: achadinhos por idade','Tópi','3059 · 3058 · 0125 · 7175','Novembro · Sem. 3 · Ideia de brincadeira','Converter a busca de Natal do público C–D','Natal D-34: guia salvável com os produtos mais fortes da Tópi','Salve para consultar','Mídia paga liberada',false),
  ('plano-2026-10:t056','Cardoso Black: reta final (interno)','Cardoso','Lista Cardoso Black','Novembro · Sem. 4 · Cardoso Black (interno)','Fechar os últimos pedidos da Black','Última semana da campanha (até 27/11)','Fale com seu representante','Interno · sem redes',false),
  ('plano-2026-10:t057','Representante Cardoso: quem atende a sua região','Cardoso','Institucional','Novembro · Sem. 4 · Por que revender Cardoso','Gerar contato de novos revendedores pelo atendimento próximo','Reforça o argumento de atendimento na semana de maior movimento do varejo','Quero revender: fale no WhatsApp Comercial','Orgânico',false),
  ('plano-2026-10:t058','Licenciados: kits por licença para redes e e-commerces','Cardoso','Licenciados Marvel · Disney · DC · Os Smurfs · Pocoyo','Novembro · Sem. 4 · Licenciados: Natal','Levar a fase Natal dos licenciados a compradores de redes e e-commerces','Fase Natal (nov–dez) da diretriz; dezembro é a última grande janela antes da Páscoa','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t059','Fofush Falante: o bichinho que conversa','Playmi','7204 · 7227 · 7228','Novembro · Sem. 4 · Brincar de verdade','Apresentar o Fofush Falante como presente de Natal','3 vídeos prontos; brinquedo que reage à criança é o tipo de vídeo que mais retém nos primeiros segundos','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t060','Robô-Blocks Corrida: montou, acelerou','Tópi','7177 · 7178 · 7179 · 7180','Novembro · Sem. 4 · Achadinho que rende brincadeira','Apresentar a linha Corrida do Robô-Blocks','Segunda linha Robô-Blocks reforça o produto que mais tem vídeo na Tópi','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t061','Março é mês de pedido: comece a revender agora','Cardoso','Institucional','Novembro · Sem. 4 · Por que revender Cardoso','Gerar contato de novos revendedores com horizonte além do Natal','No histórico de pedidos da Cardoso, março é um dos meses de maior volume; quem começa agora fecha o Natal e chega pronto à reposição','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t062','Totokinha Princesas: um passeio real','Playmi','3124','Novembro · Sem. 4 · Personagens','Acelerar o giro da Totokinha Princesas no Natal','Licença Disney tem venda permitida até 31/03/27 (diretriz Licenciados); Natal é a maior janela; enviar ao licenciador até 14/11','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t063','Tópi Festa: festa de faz de conta','Tópi','7208 · 7209 · 7210 · 7211','Novembro · Sem. 4 · Curva A sem conteúdo','Mostrar a linha Festa como presente de faz de conta','Linha Festa sem conteúdo; tema de festa combina com dezembro','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t064','Os Smurfs de pelúcia: presente fofo para o Natal','Playmi','7222 · 7223 · 7224','Novembro · Sem. 4 · Presente certo','Dar giro às pelúcias dos Smurfs no Natal','Pelúcias Smurfs estão no grupo que não gira sozinho (diretriz Licenciados, venda até 31/03/27); 36 imagens e vídeos prontos; enviar ao licenciador até 16/11','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t065','Presente até 3 anos: escolhas Tópi','Tópi','3007 · 3054 · 1007 · 3057','Novembro · Sem. 4 · Ideia de brincadeira','Ajudar a escolher presente para bebês','Natal D-27; a faixa de bebês é a que mais compra Tópi (usuário de 1 a 10 anos)','Salve para consultar','Mídia paga liberada',false),
  ('plano-2026-10:t066','Cardoso Black encerrada: obrigado (interno)','Cardoso','Lista Cardoso Black','Novembro · Sem. 5 · Cardoso Black (interno)','Fechar a campanha com o time comercial','Encerramento da Black; resultado da semana entra no painel de segunda','Fale com seu representante','Interno · sem redes',false),
  ('plano-2026-10:t067','Dezembro: reposição de licenciados para o Natal','Cardoso','Licenciados Marvel · Disney · DC · Os Smurfs · Pocoyo','Dezembro · Sem. 1 · Licenciados: Natal','Puxar a reposição de dezembro dos licenciados','Primeira semana de dezembro: lojista repõe o que vendeu na Black; licenciados têm venda até 31/03/27','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t068','Kit pronto: como a Cardoso atende o lojista no Natal','Cardoso','Institucional','Dezembro · Sem. 1 · Por que revender Cardoso','Mostrar a operação que sustenta a revenda','Dezembro é quando o atendimento é testado; mostrar kit pronto e separação por caixa reforça confiança','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t069','Bonecas Luna: o Show da Luna na brincadeira','Playmi','3102 · 3115 · 3116','Dezembro · Sem. 1 · Personagens','Gerar desejo pela Boneca Luna e levar a mãe a quem vende (Amazon é o maior cliente)','Mais de 150 imagens IA e vídeos prontos; reforço orgânico enquanto a Luna recebe a ação de Amazon Ads; enviar à Pinguim até 21/11','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t070','Pet Home com Blocos: a casinha do pet','Tópi','7120 · 7121','Dezembro · Sem. 1 · Achadinho que rende brincadeira','Dar giro ao Pet Home','Pet Home está parado no estoque (diretriz); imagens prontas','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t071','A biblioteca de conteúdo do revendedor','Cardoso','Banco de materiais','Dezembro · Sem. 1 · Conteúdo pronto para e-commerce','Gerar contato de e-commerces','Mostrar a área comercial por dentro é a prova mais concreta do diferencial','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t072','Moto Speed XR: equilíbrio com estilo','Playmi','8029 · 8030','Dezembro · Sem. 1 · Brincar de verdade','Dar giro à Moto Speed XR no Natal','Produto Play&Molto no grupo que não gira sozinho (diretriz); 4 vídeos prontos; o Natal é a segunda chance depois do Dia das Crianças','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t073','Carrinho de Boneca Meu Nenê','Tópi','2001 · 2003','Dezembro · Sem. 1 · Curva A sem conteúdo','Dar vitrine aos carrinhos de boneca Tópi','Carrinhos de boneca estão na curva A da Tópi; segundo produto da família depois do Passeio do Bebê','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t074','Guia de Natal Playmi: presentes para 3 anos ou mais','Playmi','2020 · 2018 · 3113 · 7184','Dezembro · Sem. 1 · Presente certo','Converter a busca de Natal para crianças maiores','Natal D-20; segundo guia cobre a faixa 3+ com produtos que já têm imagem pronta','Salve para consultar','Mídia paga liberada',true),
  ('plano-2026-10:t075','Natal em família: 4 brincadeiras para a ceia','Tópi','7001 · 7189 · 3054','Dezembro · Sem. 1 · Ideia de brincadeira','Gerar salvamento com ideias para o Natal em família','Natal D-20: conteúdo útil para o dia da festa','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t076','Licenciados: os que saem sozinhos no Natal','Cardoso','Licenciados grupo A','Dezembro · Sem. 2 · Licenciados: Natal','Reforçar a reposição dos licenciados de maior giro','Natal D-18: última reposição que chega a tempo','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t077','Do primeiro ano aos 10 anos: o mix Cardoso','Cardoso','Portfólio Playmi e Tópi','Dezembro · Sem. 2 · Por que revender Cardoso','Apresentar o mix a compradores que planejam 2027','Dezembro é planejamento de compra do 1º trimestre','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t078','Totokinha Galinha Pintadinha Mini: passeio com a turma','Playmi','3112','Dezembro · Sem. 2 · Personagens','Manter a Galinha Pintadinha presente no Natal com o produto de mais conteúdo','Licença divulgada há pouco: uma peça só no mês; mais de 60 imagens prontas; enviar ao licenciador até 13/11','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t079','Boliche em ação','Tópi','7001','Dezembro · Sem. 2 · Achadinho que rende brincadeira','Converter quem salvou o carrossel do Boliche','2 vídeos prontos; curva A em volume','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t080','Revender Cardoso em 3 passos','Cardoso','Institucional','Dezembro · Sem. 2 · Por que revender Cardoso','Gerar contato de novos revendedores','Explicar o caminho reduz a fricção de quem ainda não falou com a Cardoso','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t081','Dino Jurássico: 30 blocos para montar o seu','Playmi','8001','Dezembro · Sem. 2 · Brincar de verdade','Mostrar o Dino Jurássico como presente de montar','Vídeo e imagens prontos; dinossauro + blocos é tema de alta busca no Natal','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t082','Tópi Combo Construction','Tópi','4028','Dezembro · Sem. 2 · Curva A sem conteúdo','Dar vitrine ao combo de construção','Combo é presente completo para o tema construção, o mais forte da Tópi','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t083','Presente para o primeiro ano','Playmi','3090 · 8028 · 8018 · 7155','Dezembro · Sem. 2 · Presente certo','Converter a busca de presente para bebês de 1 ano','Natal D-13; faixa do primeiro ano tem poucos guias no feed','Salve para consultar','Mídia paga liberada',false),
  ('plano-2026-10:t084','Última semana para o presente: achadinhos Tópi','Tópi','0125 · 3059 · 7175 · 0124','Dezembro · Sem. 2 · Ideia de brincadeira','Converter a compra de Natal','Natal D-13: lista curta para quem ainda não comprou','Salve para consultar','Mídia paga liberada',false),
  ('plano-2026-10:t085','Verão no lojista: praia e água','Cardoso','0205 · 2018','Dezembro · Sem. 3 · Reposição de verão','Puxar a reposição de itens de verão','Verão começa em 21/12; praia e água vendem dezembro e janeiro','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t086','Conteúdo pronto também para o verão','Cardoso','Banco de materiais','Dezembro · Sem. 3 · Conteúdo pronto para e-commerce','Atrair e-commerces','Temporada de verão abre nova janela de cadastro','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t087','Patinete Bluey: ainda dá tempo para o Natal','Playmi','7229','Dezembro · Sem. 3 · Personagens','Converter quem viu o lançamento e ainda não comprou','Natal D-10; repetir o herói do lançamento na última janela de compra (aval do licenciador já obtido no lançamento)','Onde comprar (link na bio)','Orgânico',true),
  ('plano-2026-10:t088','Baldão de Praia: o verão chegou','Tópi','0205','Dezembro · Sem. 3 · Achadinho que rende brincadeira','Abrir o verão com o Baldão de Praia','Verão começa em 21/12; vídeo pronto; praia é o tema de dezembro e janeiro','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t089','Clientes em todos os estados','Cardoso','Institucional','Dezembro · Sem. 3 · Por que revender Cardoso','Gerar contato de novos revendedores','Prova de alcance nacional reforça confiança antes do planejamento de 2027','Quero revender: fale no WhatsApp Comercial','Mídia paga liberada',false),
  ('plano-2026-10:t090','Studio Fashion Celebridades: salão de beleza de faz de conta','Playmi','7184 · 7185 · 7186','Dezembro · Sem. 3 · Brincar de verdade','Dar giro ao Studio Fashion no Natal','Produto parado no estoque (diretriz); imagens prontas; faz de conta de salão é presente forte para 3+','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t091','Tópi Mileva','Tópi','4016','Dezembro · Sem. 3 · Curva A sem conteúdo','Dar vitrine à Tópi Mileva','Mileva está na curva A da Tópi e sem conteúdo','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t092','Última chamada: presentes Playmi que chegam a tempo','Playmi','3067 · 7229 · 3124 · 2020 · 8018','Dezembro · Sem. 3 · Presente certo','Converter a compra de última hora','Natal D-6: a mãe que ainda não comprou procura o que encontra perto','Onde comprar (link na bio)','Mídia paga liberada',true),
  ('plano-2026-10:t093','Férias em casa: brincadeiras Tópi','Tópi','Linha Tópi','Dezembro · Sem. 3 · Ideia de brincadeira','Gerar salvamento para as férias','Início das férias escolares; conteúdo útil mantém a marca no feed','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t094','Feliz Natal, lojista','Cardoso','Institucional','Dezembro · Sem. 4 · Datas','Agradecer quem vendeu Cardoso em 2026','Semana do Natal; peça institucional de relacionamento','Comente com a gente','Orgânico',false),
  ('plano-2026-10:t095','Obrigado a quem vendeu Cardoso em 2026','Cardoso','Institucional','Dezembro · Sem. 4 · Datas','Fechar o ano no LinkedIn com relacionamento','Última semana útil do ano','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t096','Natal sobre rodinhas: as Totokinhas','Playmi','Linha Totokinha','Dezembro · Sem. 4 · Brincar de verdade','Lembrar a linha nº 1 da Playmi na semana do Natal','Natal D-3; reaproveitar vídeos finalizados das Totokinhas na semana de maior busca','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t097','Robô-Blocks na ceia de Natal','Tópi','7172 · 7173 · 7174 · 7175','Dezembro · Sem. 4 · Achadinho que rende brincadeira','Repetir o produto com mais vídeo na semana do Natal','Natal D-2: reaproveita vídeo pronto','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t098','Feliz Natal Playmi','Playmi','Institucional Playmi','Dezembro · Sem. 4 · Datas','Celebrar o Natal com as famílias que acompanham a marca','Data de maior conexão emocional do ano; peça sem produto, só a marca','Comente com a gente','Orgânico',false),
  ('plano-2026-10:t099','Feliz Natal Tópi','Tópi','Institucional Tópi','Dezembro · Sem. 4 · Datas','Celebrar o Natal com quem acompanha a marca','Data de maior conexão emocional do ano; reel de logo pronto','Comente com a gente','Orgânico',false),
  ('plano-2026-10:t100','Depois do presente: como aproveitar o brinquedo novo','Playmi','Linha Playmi','Dezembro · Sem. 4 · Presente certo','Ajudar a família a brincar mais com o brinquedo recebido','Pós-Natal: o brinquedo está em casa; dica de uso gera salvamento e prova de valor para a próxima compra','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t101','Depois do presente: brincadeira que dura','Tópi','Linha Tópi','Dezembro · Sem. 4 · Ideia de brincadeira','Prolongar o uso do brinquedo recebido','Pós-Natal: dica de uso gera salvamento e prova de valor','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t102','2027 começa com a Páscoa: licenciados','Cardoso','Licenciados (pelúcias e miniaturas)','Dezembro · Sem. 5 · Licenciados: Páscoa','Abrir a fase Páscoa dos licenciados com redes e lojistas','Páscoa 2027 é em 28/03; as redes compram em jan–fev (diretriz); licenciados têm venda até 31/03/27','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t103','Anote: ABRIN 2027, de 4 a 7 de abril','Cardoso','ABRIN 2027','Dezembro · Sem. 5 · ABRIN 2027','Garantir que compradores reservem a data da feira','Save the date antecipado: comprador planeja viagens do 1º semestre em janeiro','Agende uma visita ao stand','Orgânico',false),
  ('plano-2026-10:t104','Acqua Bubble: férias de verão','Playmi','2018','Dezembro · Sem. 5 · Brincar de verdade','Manter o Acqua Bubble em alta nas férias','Férias escolares e calor: repetir o produto de verão com o vídeo pronto','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t105','Baldão de Praia: férias na areia','Tópi','0205','Dezembro · Sem. 5 · Achadinho que rende brincadeira','Manter o tema praia nas férias','Semana de Réveillon: maior fluxo para a praia','Onde comprar (link na bio)','Mídia paga liberada',false),
  ('plano-2026-10:t106','Feliz 2027 Playmi','Playmi','Institucional Playmi','Dezembro · Sem. 5 · Datas','Fechar o ano com a marca','Virada do ano; peça institucional leve','Comente com a gente','Orgânico',false),
  ('plano-2026-10:t107','Feliz 2027 Tópi','Tópi','Institucional Tópi','Dezembro · Sem. 5 · Datas','Fechar o ano com a marca','Virada do ano; peça institucional leve','Comente com a gente','Orgânico',false),
  ('plano-2026-10:t108','Férias sem tela: 5 brincadeiras Playmi','Playmi','Linha Playmi','Janeiro · Sem. 1 · Presente certo','Gerar salvamento com ideias para as férias','Férias escolares: a busca por ''o que fazer com as crianças'' sobe; carrossel útil mantém a marca no feed sem venda direta','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t109','Férias em casa: 5 brincadeiras sem tela','Tópi','Linha Tópi','Janeiro · Sem. 1 · Ideia de brincadeira','Gerar salvamento nas férias','Férias escolares: a busca por o que fazer com as crianças sobe','Salve para consultar','Orgânico',false),
  ('plano-2026-10:t110','Páscoa: as redes compram agora','Cardoso','Licenciados (pelúcias e miniaturas)','Janeiro · Sem. 1 · Licenciados: Páscoa','Ativar a fase Páscoa dos licenciados','Início da janela de compra de Páscoa das redes (04/01 a 28/02, diretriz)','Fale com seu representante','Orgânico',false),
  ('plano-2026-10:t111','Por que revender Cardoso em 2027','Cardoso','Institucional','Janeiro · Sem. 1 · Por que revender Cardoso','Abrir o ano com o argumento de revenda','Janeiro é planejamento de fornecedores para o ano','Seja um revendedor: fale com a Cardoso','Orgânico',false),
  ('plano-2026-10:t112','Volta às aulas começa em casa: Play&Learn','Playmi','3029 · 7111','Janeiro · Sem. 2 · Brincar de verdade','Abrir o tema volta às aulas com os brinquedos que estimulam aprendizado','Primeira semana de janeiro: famílias começam a pensar na rotina escolar; abre a frente de Volta às aulas','Onde comprar (link na bio)','Orgânico',false);

insert into public.social_topics (ext_key, title, brand, sku, front, objective, strategy, cta, media_use, licensed)
select ext_key, title, brand, coalesce(sku, ''), coalesce(front, ''), coalesce(objective, ''), coalesce(strategy, ''), coalesce(cta, ''), coalesce(media_use, ''), licensed
  from _t
on conflict (ext_key) do nothing;

-- produto do catálogo quando a REF é uma só (sem zeros à esquerda na comparação)
update public.social_topics t
   set product_id = p.id, product = p.name
  from public.products p
 where t.ext_key like 'plano-2026-10:%' and t.product_id is null
   and t.sku ~ '^[0-9]+$' and ltrim(p.code, '0') = ltrim(t.sku, '0');

-- 4) destinos (matriz primeiro, para quem herda já encontrar a matriz)
create temp table _i (ext_id text, topic_key text, canal text, link_kind text, pub_date date, pub_time time, weekday text, month_label text,
  piece_type text, format text, origin text, caption text, creative_url text, creative_changed boolean, mirror_facebook boolean) on commit drop;
insert into _i values
  ('plano-2026-10:t001:0','plano-2026-10:t001','Playmi · Instagram','matriz','2026-10-14','12:00','Quarta','Out/26','Reels','Reels','Original','O Spidey agora cabe na palma da mão! 🕷️
As Little Figs Marvel Spidey são para colecionar, montar a cena e inventar a próxima missão. A partir de 3 anos.
Qual herói é o favorito aí na sua casa?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Spidey #LittleFigs','https://drive.google.com/drive/folders/1FdspgTwhypCK7OkFRccy-1qXK3Zz4ANB',false,true),
  ('plano-2026-10:t001:1','plano-2026-10:t001','Playmi · Instagram','reaproveita','2026-10-14','19:30','Quarta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t001:2','plano-2026-10:t001','Cardoso · YouTube · playlist Playmi','reaproveita','2026-10-15','18:00','Quinta','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t001:3','plano-2026-10:t001','Cardoso · WhatsApp · Status','reaproveita','2026-10-16','18:00','Sexta','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t002:0','plano-2026-10:t002','Tópi · Instagram','matriz','2026-10-14','12:00','Quarta','Out/26','Reels','Reels','Original','Monta, desmonta e vira outro! 🤖🚑
Os Robô-Blocks Serviço viram ambulância, caminhão-pipa, delivery e varredor. É peça pra todo lado e criatividade pra dar e vender.
Qual a sua criança montaria primeiro?
Brincar é Tópi! 🧡
#Tópi #RobôBlocks #BlocosDeMontar','https://drive.google.com/drive/folders/1MxNVArOe2b7NmA7sshZO8kZoezXnBY9d',false,true),
  ('plano-2026-10:t002:1','plano-2026-10:t002','Tópi · Instagram','reaproveita','2026-10-14','19:30','Quarta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t002:2','plano-2026-10:t002','Tópi · TikTok','reaproveita','2026-10-15','19:00','Quinta','Out/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t002:3','plano-2026-10:t002','Cardoso · YouTube · playlist Tópi','reaproveita','2026-10-17','18:00','Sábado','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t003:0','plano-2026-10:t003','Cardoso · Instagram','matriz','2026-10-15','11:00','Quinta','Out/26','Reels','Reels','Original','Você vende brinquedo online? 📦
Revendendo Cardoso, você recebe fotos e vídeos prontos de cada produto, nos formatos do anúncio, do feed e dos stories.
Menos tempo cadastrando, mais tempo vendendo no Natal.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso #Ecommerce #Brinquedos','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t003:1','plano-2026-10:t003','Cardoso · Instagram','adapta','2026-10-16','10:30','Sexta','Out/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t003:2','plano-2026-10:t003','Cardoso · WhatsApp · Status','reaproveita','2026-10-17','18:00','Sábado','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t004:0','plano-2026-10:t004','Playmi · Instagram','matriz','2026-10-16','12:00','Sexta','Out/26','Reels','Reels','Original','Todo herói começa com um primeiro passeio! 🕷️🚗
A Totokinha Marvel Spidey é para os pequenos a partir de 18 meses: senta, impulsiona com os pés e sai explorando a casa inteira.
Presente de Natal para o pequeno fã do Spidey.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Spidey #Totokinha','https://drive.google.com/drive/folders/16Nisx1t7EJTYgeojBabkoCQ7Uteiljvp',false,true),
  ('plano-2026-10:t004:1','plano-2026-10:t004','Playmi · Instagram','reaproveita','2026-10-16','19:30','Sexta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t004:2','plano-2026-10:t004','Cardoso · WhatsApp · Status','reaproveita','2026-10-17','18:00','Sábado','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t004:3','plano-2026-10:t004','Cardoso · YouTube · playlist Playmi','reaproveita','2026-10-17','18:00','Sábado','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t005:0','plano-2026-10:t005','Tópi · Instagram','matriz','2026-10-16','12:00','Sexta','Out/26','Reels','Reels','Original','Hora do passeio da boneca! 👶🌸
O Carrinho de Boneca Passeio do Bebê é dobrável e acompanha a brincadeira de cuidar, do quarto até a pracinha. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #CarrinhoDeBoneca #BrincarDeCuidar','https://drive.google.com/drive/folders/1ovmPmiegYqvlAxjfZIYVPmxcyBg-2WHG',false,true),
  ('plano-2026-10:t005:1','plano-2026-10:t005','Tópi · Instagram','reaproveita','2026-10-16','19:30','Sexta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t005:2','plano-2026-10:t005','Tópi · Instagram','adapta','2026-10-17','10:30','Sábado','Out/26','Stories','Stories','Original','Qual o passeio favorito da boneca? 🌸 [enquete: Pracinha / Visita na vovó]',null,false,false),
  ('plano-2026-10:t005:3','plano-2026-10:t005','Tópi · TikTok','reaproveita','2026-10-17','19:00','Sábado','Out/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t006:0','plano-2026-10:t006','Tópi · Instagram','matriz','2026-10-17','20:30','Sábado','Out/26','Feed','Carrossel','Original','Salve para o fim de semana! 🎳
1) Boliche das cores: cada pino vale um ponto.
2) Boliche das letras: cole uma letra em cada pino; derrubou, fala uma palavra.
3) Campeonato da família: quem derruba mais em 3 jogadas.
A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Boliche #BrincadeiraEmFamília','https://drive.google.com/drive/folders/1VRl_QMSxHiEdEjkkMxw-BC_mC1F4YWTy',false,true),
  ('plano-2026-10:t006:1','plano-2026-10:t006','Tópi · Instagram','reaproveita','2026-10-17','21:00','Sábado','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t007:0','plano-2026-10:t007','Cardoso · Instagram','matriz','2026-10-19','11:00','Segunda','Out/26','Reels','Reels','Original','Aperta, toca, encanta. 🎶
Para o Natal, a Cardoso montou os brinquedos musicais em 4 kits prontos: Bichinhos, Carrinhos, Dinos e Bandinha.
O lojista pede o kit e recebe tudo separado, sem montar pedido item por item.
Fale com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#NatalMusical #CardosoToys #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t007:1','plano-2026-10:t007','Cardoso · WhatsApp · Canal Representantes','adapta','2026-10-19','14:00','Segunda','Out/26','WhatsApp','Aviso','Original','Começou o Natal Musical (19/10 até fev). 4 kits prontos: NM-01 Bichinhos, NM-02 Carrinhos, NM-03 Dinos, NM-04 Bandinha. Lâmina, fotos e vídeos dos kits na área comercial. Ordem de ataque: e-commerces, depois quem comprou musical de abr a jul/26. [link da área comercial]',null,false,false),
  ('plano-2026-10:t007:2','plano-2026-10:t007','Cardoso · WhatsApp · Status','reaproveita','2026-10-19','18:00','Segunda','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t007:3','plano-2026-10:t007','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-10-21','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Natal Musical Cardoso: 4 kits prontos de brinquedos musicais (Bichinhos, Carrinhos, Dinos e Bandinha). Fotos e vídeos para divulgar estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t007:4','plano-2026-10:t007','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-10-21','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Natal Musical Cardoso: 4 kits prontos de brinquedos musicais (Bichinhos, Carrinhos, Dinos e Bandinha). Fotos e vídeos para divulgar estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t007:5','plano-2026-10:t007','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-10-21','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Natal Musical Cardoso: 4 kits prontos de brinquedos musicais (Bichinhos, Carrinhos, Dinos e Bandinha). Fotos e vídeos para divulgar estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t007:6','plano-2026-10:t007','Cardoso · WhatsApp · Clientes Sul','adapta','2026-10-21','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Natal Musical Cardoso: 4 kits prontos de brinquedos musicais (Bichinhos, Carrinhos, Dinos e Bandinha). Fotos e vídeos para divulgar estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t008:0','plano-2026-10:t008','Cardoso · LinkedIn','matriz','2026-10-20','08:30','Terça','Out/26','LinkedIn','Post','Original','Desde 1987, a Cardoso fabrica brinquedos em São Paulo.

São mais de 30 mil m² de fábrica e mais de 400 brinquedos no portfólio, com as marcas Playmi e Tópi e personagens licenciados.

Para quem vende online, isso significa três coisas: fabricação própria, um mix que vai do primeiro ano aos 10 anos e conteúdo pronto para o anúncio.

Você tem um e-commerce e quer revender Cardoso? Fale com a gente pela página.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t008:1','plano-2026-10:t008','Cardoso · Google Meu Negócio','adapta','2026-10-21','10:00','Quarta','Out/26','Post','Atualização','Original','Cardoso Toys: fábrica de brinquedos em São Paulo desde 1987, com as marcas Playmi e Tópi e personagens licenciados. Quer revender? Fale com o nosso comercial.',null,false,false),
  ('plano-2026-10:t009:0','plano-2026-10:t009','Playmi · Instagram','matriz','2026-10-20','12:00','Terça','Out/26','Reels','Reels','Original','Alerta na cidade: hora de montar o resgate! 🚒🧱
A Estação de Resgate vem com 10 blocos para construir, desmontar e criar uma missão nova a cada brincadeira. A partir de 3 anos.
Qual seria o primeiro resgate de hoje?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #BlocosDeMontar','https://drive.google.com/drive/folders/1piA0xt2t4WElrBh_DenSGpcGjqIyXrjl',false,true),
  ('plano-2026-10:t009:1','plano-2026-10:t009','Playmi · Instagram','reaproveita','2026-10-20','19:30','Terça','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t009:2','plano-2026-10:t009','Cardoso · YouTube · playlist Playmi','reaproveita','2026-10-21','18:00','Quarta','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t009:3','plano-2026-10:t009','Cardoso · WhatsApp · Status','reaproveita','2026-10-22','18:00','Quinta','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t010:0','plano-2026-10:t010','Tópi · Instagram','matriz','2026-10-21','12:00','Quarta','Out/26','Reels','Reels','Original','Chegaram devagarinho e conquistaram a brincadeira! 🐢
Teltaluga e Tortuga são as tartarugas da Tópi para os pequenos a partir de 18 meses.
Qual combina mais com a sua criança?
Brincar é Tópi! 🧡
#Tópi #BrinquedoBebê','https://drive.google.com/drive/folders/1xBQg4H_d3XXTRiSROEUmLDJJ6bl9eFK6',false,true),
  ('plano-2026-10:t010:1','plano-2026-10:t010','Tópi · Instagram','reaproveita','2026-10-21','19:30','Quarta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t010:2','plano-2026-10:t010','Tópi · TikTok','reaproveita','2026-10-22','19:00','Quinta','Out/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t010:3','plano-2026-10:t010','Cardoso · YouTube · playlist Tópi','reaproveita','2026-10-24','18:00','Sábado','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t011:0','plano-2026-10:t011','Cardoso · Instagram','matriz','2026-10-22','11:00','Quinta','Out/26','Reels','Reels','Original','Do molde à caixa, tudo acontece aqui. 🏭
Há quase 40 anos a Cardoso fabrica brinquedos em São Paulo, numa fábrica com mais de 30 mil m².
É por isso que o lojista sabe o que vai receber.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#CardosoToys #RevendaCardoso','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t011:1','plano-2026-10:t011','Cardoso · Instagram','adapta','2026-10-23','10:30','Sexta','Out/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t011:2','plano-2026-10:t011','Cardoso · WhatsApp · Status','reaproveita','2026-10-24','18:00','Sábado','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t012:0','plano-2026-10:t012','Playmi · Instagram','matriz','2026-10-22','12:00','Quinta','Out/26','Reels','Reels','Original','Anda, puxa, empilha e começa tudo de novo! 💗🧱
O Carrinho de Puxar vem com 20 blocos e acompanha os primeiros passos: a criança leva o carrinho pela casa e ainda monta as próprias torres. A partir de 12 meses.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PrimeirosPassos #Blocos',null,false,true),
  ('plano-2026-10:t012:1','plano-2026-10:t012','Playmi · Instagram','reaproveita','2026-10-22','19:30','Quinta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t012:2','plano-2026-10:t012','Cardoso · YouTube · playlist Playmi','reaproveita','2026-10-23','18:00','Sexta','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t012:3','plano-2026-10:t012','Cardoso · WhatsApp · Status','reaproveita','2026-10-24','18:00','Sábado','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t013:0','plano-2026-10:t013','Tópi · Instagram','matriz','2026-10-23','12:00','Sexta','Out/26','Reels','Reels','Original','Cabe no bolso, rende brincadeira! 🦕
O Tópi Sabidinho Plus é para os pequenos a partir de 18 meses explorarem com as mãos.
Já conhecia?
Brincar é Tópi! 🧡
#Tópi #BrinquedoEducativo','https://drive.google.com/drive/folders/1O5MzzxHrdWoSaz1pPWoSBTXhHalQnSfB',false,true),
  ('plano-2026-10:t013:1','plano-2026-10:t013','Tópi · Instagram','reaproveita','2026-10-23','19:30','Sexta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t013:2','plano-2026-10:t013','Tópi · Instagram','adapta','2026-10-24','10:30','Sábado','Out/26','Stories','Stories','Original','Seu pequeno tem quantos meses? 👶 [caixinha]',null,false,false),
  ('plano-2026-10:t013:3','plano-2026-10:t013','Tópi · TikTok','reaproveita','2026-10-24','19:00','Sábado','Out/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t014:0','plano-2026-10:t014','Playmi · Instagram','matriz','2026-10-24','12:00','Sábado','Out/26','Reels','Reels','Original','Antes da bicicleta, vem o equilíbrio. 🏍️❤️
A Totokross é a moto de equilíbrio da Playmi para os pequenos a partir de 12 meses: senta, apoia os pés e ganha confiança a cada volta.
Um presente que acompanha o crescimento.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Totokross #MotoDeEquilíbrio','https://drive.google.com/drive/folders/1JIK4z_1fl01M32vBLSggjgSOTar4XlSw',false,true),
  ('plano-2026-10:t014:1','plano-2026-10:t014','Playmi · Instagram','reaproveita','2026-10-24','19:30','Sábado','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t014:2','plano-2026-10:t014','Cardoso · WhatsApp · Status','reaproveita','2026-10-26','18:00','Segunda','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t014:3','plano-2026-10:t014','Cardoso · YouTube · playlist Playmi','reaproveita','2026-10-26','18:00','Segunda','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t015:0','plano-2026-10:t015','Tópi · Instagram','matriz','2026-10-24','20:30','Sábado','Out/26','Feed','Carrossel','Original','Salve para entender cada lado da brincadeira! 🧩
A Mesinha de Atividades da Tópi reúne várias brincadeiras num lugar só para os pequenos a partir de 18 meses.
Arraste e veja os detalhes.
Brincar é Tópi! 🧡
#Tópi #MesinhaDeAtividades','https://drive.google.com/drive/folders/1YZXOeGA8xKDV6QocPidQZKo3-pcddmnS',false,true),
  ('plano-2026-10:t015:1','plano-2026-10:t015','Tópi · Instagram','reaproveita','2026-10-24','21:00','Sábado','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t016:0','plano-2026-10:t016','Cardoso · WhatsApp · Canal Representantes','matriz','2026-10-26','10:00','Segunda','Out/26','WhatsApp','Aviso','Original','Esquenta Cardoso Black: começa em 03/11 e vai até 27/11, para o lojista pequeno. Avise sua carteira esta semana. Tabela, lista de produtos e kit de divulgação na área comercial a partir de 30/10. [link da área comercial]',null,false,false),
  ('plano-2026-10:t016:1','plano-2026-10:t016','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-10-28','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Vem aí a Cardoso Black: de 3 a 27/11, condição especial para você abastecer o Natal da sua loja. Fale com o seu representante e prepare o seu pedido. [link da área comercial]',null,false,false),
  ('plano-2026-10:t016:2','plano-2026-10:t016','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-10-28','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Vem aí a Cardoso Black: de 3 a 27/11, condição especial para você abastecer o Natal da sua loja. Fale com o seu representante e prepare o seu pedido. [link da área comercial]',null,false,false),
  ('plano-2026-10:t016:3','plano-2026-10:t016','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-10-28','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Vem aí a Cardoso Black: de 3 a 27/11, condição especial para você abastecer o Natal da sua loja. Fale com o seu representante e prepare o seu pedido. [link da área comercial]',null,false,false),
  ('plano-2026-10:t016:4','plano-2026-10:t016','Cardoso · WhatsApp · Clientes Sul','adapta','2026-10-28','10:00','Quarta','Out/26','WhatsApp','Aviso','Original','Vem aí a Cardoso Black: de 3 a 27/11, condição especial para você abastecer o Natal da sua loja. Fale com o seu representante e prepare o seu pedido. [link da área comercial]',null,false,false),
  ('plano-2026-10:t017:0','plano-2026-10:t017','Cardoso · Instagram','matriz','2026-10-26','11:00','Segunda','Out/26','Feed','Carrossel','Original','O que vem em cada kit do Natal Musical? 🎶
Bichinhos: sapo, polvo, elefante, tucano e turma.
Carrinhos: ônibus, bombeiro, polícia e soft trucks.
Dinos: dinos musicais e xilofone.
Bandinha: baterias e pianos.
Peça o kit pronto com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#NatalMusical #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t017:1','plano-2026-10:t017','Cardoso · WhatsApp · Status','reaproveita','2026-10-26','18:00','Segunda','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t018:0','plano-2026-10:t018','Cardoso · LinkedIn','matriz','2026-10-27','08:30','Terça','Out/26','LinkedIn','Post','Original','No Natal, quem vende online corre contra o relógio: cadastrar produto, tirar foto, editar vídeo.

Quem revende Cardoso recebe esse trabalho pronto: fotos e vídeos de cada produto Playmi e Tópi, nos formatos do anúncio, do feed e dos stories, direto na área comercial.

Tem um e-commerce de brinquedos ou presentes? Fale com o nosso comercial pela página.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t018:1','plano-2026-10:t018','Cardoso · Google Meu Negócio','adapta','2026-10-28','10:00','Quarta','Out/26','Post','Atualização','Original','Revenda Cardoso: fotos e vídeos prontos de cada produto Playmi e Tópi para o seu e-commerce. Fale com o nosso comercial.',null,false,false),
  ('plano-2026-10:t019:0','plano-2026-10:t019','Playmi · Instagram','matriz','2026-10-27','12:00','Terça','Out/26','Reels','Reels','Original','Já viu uma Totokinha que mostra a língua? 😛
Na Totokinha Bolinha, a língua e os bracinhos se mexem enquanto a criança passeia. Diversão a partir de 18 meses, em azul e rosa.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Totokinha #TotokinhaBolinha','https://drive.google.com/drive/folders/1Drm51DaRxBUazSK9529e2C8Teq_XvHN3',false,true),
  ('plano-2026-10:t019:1','plano-2026-10:t019','Playmi · Instagram','reaproveita','2026-10-27','19:30','Terça','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t019:2','plano-2026-10:t019','Cardoso · YouTube · playlist Playmi','reaproveita','2026-10-28','18:00','Quarta','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t019:3','plano-2026-10:t019','Cardoso · WhatsApp · Status','reaproveita','2026-10-29','18:00','Quinta','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t020:0','plano-2026-10:t020','Tópi · Instagram','matriz','2026-10-28','12:00','Quarta','Out/26','Reels','Reels','Original','O dino que vira companheiro de toda brincadeira! 🦖
Dino Sabidinho, a partir de 18 meses.
Já tem um aí?
Brincar é Tópi! 🧡
#Tópi #DinoSabidinho','https://drive.google.com/drive/folders/1UVIheejHCuOE5swE_Num439GhyNlexG-',false,true),
  ('plano-2026-10:t020:1','plano-2026-10:t020','Tópi · Instagram','reaproveita','2026-10-28','19:30','Quarta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t020:2','plano-2026-10:t020','Tópi · TikTok','reaproveita','2026-10-29','19:00','Quinta','Out/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t020:3','plano-2026-10:t020','Cardoso · YouTube · playlist Tópi','reaproveita','2026-10-31','18:00','Sábado','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t021:0','plano-2026-10:t021','Cardoso · Instagram','matriz','2026-10-29','11:00','Quinta','Out/26','Reels','Reels','Original','Uma indústria, duas marcas, do primeiro ano aos 10 anos. 🧸
Playmi para quem busca valor agregado e desenvolvimento. Tópi para o giro rápido e o preço acessível.
Tudo da mesma fábrica, com o mesmo representante.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso #Playmi #Tópi','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t021:1','plano-2026-10:t021','Cardoso · Instagram','adapta','2026-10-30','10:30','Sexta','Out/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t021:2','plano-2026-10:t021','Cardoso · WhatsApp · Status','reaproveita','2026-10-31','18:00','Sábado','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t022:0','plano-2026-10:t022','Playmi · Instagram','matriz','2026-10-29','12:00','Quinta','Out/26','Reels','Reels','Original','Visual esportivo para os primeiros passeios! 🏁💙
A Totokinha Sport é para os pequenos a partir de 18 meses: senta, impulsiona com os pés e descobre que consegue ir sozinho.
Presente de Natal que sai da caixa direto para a brincadeira.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #TotokinhaSport','https://drive.google.com/drive/folders/14L86KiBJiUyFbaQgWvYr1CA_uQkx6-Iq',false,true),
  ('plano-2026-10:t022:1','plano-2026-10:t022','Playmi · Instagram','reaproveita','2026-10-29','19:30','Quinta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t022:2','plano-2026-10:t022','Cardoso · YouTube · playlist Playmi','reaproveita','2026-10-30','18:00','Sexta','Out/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t022:3','plano-2026-10:t022','Cardoso · WhatsApp · Status','reaproveita','2026-10-31','18:00','Sábado','Out/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t023:0','plano-2026-10:t023','Tópi · Instagram','matriz','2026-10-30','12:00','Sexta','Out/26','Reels','Reels','Original','Fila do recreio ou chamada de emergência? 🚌🚒
Tópi Escolar e Tópi Bombeirinho levam a brincadeira para onde a imaginação mandar, a partir de 18 meses.
Qual vai primeiro na sua casa?
Brincar é Tópi! 🧡
#Tópi #BrinquedoBebê','https://drive.google.com/drive/folders/1_xO79J-t4Z1T5pW26UXG0OhNgKfWliSN',false,true),
  ('plano-2026-10:t023:1','plano-2026-10:t023','Tópi · Instagram','reaproveita','2026-10-30','19:30','Sexta','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t023:2','plano-2026-10:t023','Tópi · Instagram','adapta','2026-10-31','10:30','Sábado','Out/26','Stories','Stories','Original','Escolar ou Bombeirinho? 🚌🚒 [enquete]',null,false,false),
  ('plano-2026-10:t023:3','plano-2026-10:t023','Tópi · TikTok','reaproveita','2026-10-31','19:00','Sábado','Out/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t024:0','plano-2026-10:t024','Playmi · Instagram','matriz','2026-10-31','12:00','Sábado','Out/26','Reels','Reels','Original','Primeiros passos, grandes descobertas. 💙💗
Clássica, Bolinha, Sport e com personagens: tem uma Totokinha para cada pequeno a partir de 18 meses. Todas para sentar, impulsionar com os pés e sair explorando o mundo.
Qual é a cara da sua criança?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Totokinha #PrimeirosPassos','https://drive.google.com/drive/folders/16rorQzSTkDhgqztEzzG63e7Yfoj0c7VJ',false,true),
  ('plano-2026-10:t024:1','plano-2026-10:t024','Playmi · Instagram','reaproveita','2026-10-31','19:30','Sábado','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t024:2','plano-2026-10:t024','Cardoso · WhatsApp · Status','reaproveita','2026-11-02','18:00','Segunda','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t024:3','plano-2026-10:t024','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-02','18:00','Segunda','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t025:0','plano-2026-10:t025','Tópi · Instagram','matriz','2026-10-31','20:30','Sábado','Out/26','Feed','Carrossel','Original','Monte a cozinha de faz de conta da Tópi! 🍳
Tópi Fogãozinho, Tópi Chef Cozinha Preparar e Cozinhar e Tópi Cestinha Didática: juntos viram restaurante, piquenique e feirinha.
Veja a idade de cada um nos cards. Salve as ideias.
Brincar é Tópi! 🧡
#Tópi #FazDeConta','https://drive.google.com/drive/folders/18UmU8eRoRvuGSxz7UfzXVB9B_l39tVRL',false,true),
  ('plano-2026-10:t025:1','plano-2026-10:t025','Tópi · Instagram','reaproveita','2026-10-31','21:00','Sábado','Out/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t026:0','plano-2026-10:t026','Cardoso · WhatsApp · Canal Representantes','matriz','2026-11-03','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Começou a Cardoso Black (3 a 27/11). Faltam 24 dias. Kit da campanha (posts, vídeos, lâmina, tabela e script) na área comercial. Onda 1 desta semana: lojistas que compraram itens da Black de abr a jul/26. [link da área comercial]',null,false,false),
  ('plano-2026-10:t026:1','plano-2026-10:t026','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-11-04','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Começou a Cardoso Black! De 3 a 27/11, condição especial para abastecer o seu Natal. Fotos e vídeos dos produtos prontos para o seu Instagram e WhatsApp estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t026:2','plano-2026-10:t026','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-11-04','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Começou a Cardoso Black! De 3 a 27/11, condição especial para abastecer o seu Natal. Fotos e vídeos dos produtos prontos para o seu Instagram e WhatsApp estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t026:3','plano-2026-10:t026','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-11-04','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Começou a Cardoso Black! De 3 a 27/11, condição especial para abastecer o seu Natal. Para SP e RJ, consulte também a condição de frete com o seu representante. Fotos e vídeos prontos na área comercial. [link da área comercial]',null,false,false),
  ('plano-2026-10:t026:4','plano-2026-10:t026','Cardoso · WhatsApp · Clientes Sul','adapta','2026-11-04','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Começou a Cardoso Black! De 3 a 27/11, condição especial para abastecer o seu Natal. Fotos e vídeos dos produtos prontos para o seu Instagram e WhatsApp estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t027:0','plano-2026-10:t027','Cardoso · Instagram','matriz','2026-11-03','11:00','Terça','Nov/26','Reels','Reels','Original','No Natal, o personagem vende sozinho. 🎁
Spidey, Princesas Disney, Os Smurfs, Pocoyo e mais: a Cardoso tem kits por licença prontos para a sua loja ou o seu e-commerce.
Fale com o seu representante e garanta o sortimento de dezembro.
Construímos muito mais que brinquedos. Construímos confiança.
#Licenciados #Lojista #CardosoToys','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t027:1','plano-2026-10:t027','Cardoso · WhatsApp · Status','reaproveita','2026-11-03','18:00','Terça','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t028:0','plano-2026-10:t028','Playmi · Instagram','matriz','2026-11-03','12:00','Terça','Nov/26','Reels','Reels','Original','Na cozinha da Playmi, quem manda é a criança! 👩‍🍳
Air fryer, batedeira, liquidificador, máquina de café espresso e micro-ondas: a Doce Cozinha Gourmet transforma a tarde em restaurante de faz de conta. A partir de 3 anos.
Qual seria o primeiro prato?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #DoceCozinha #FazDeConta','https://drive.google.com/drive/folders/1JT6otkJAPYtapRDVdNEmzpqHYpY6i7R_',false,true),
  ('plano-2026-10:t028:1','plano-2026-10:t028','Playmi · Instagram','reaproveita','2026-11-03','19:30','Terça','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t028:2','plano-2026-10:t028','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-04','18:00','Quarta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t028:3','plano-2026-10:t028','Cardoso · WhatsApp · Status','reaproveita','2026-11-06','18:00','Sexta','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t028:4','plano-2026-10:t028','Cardoso · Pinterest','adapta','2026-11-06','21:00','Sexta','Nov/26','Pin','Pin','Original','Doce Cozinha Gourmet Playmi | Air fryer, batedeira, liquidificador, cafeteira e micro-ondas de brinquedo para o faz de conta. Ideia de presente de Natal para crianças a partir de 3 anos.',null,false,false),
  ('plano-2026-10:t029:0','plano-2026-10:t029','Cardoso · LinkedIn','matriz','2026-11-04','08:30','Quarta','Nov/26','LinkedIn','Post','Original','Revender Cardoso é ter alguém por perto.

A Cardoso atende lojistas e e-commerces em todos os estados do Brasil, com representantes que conhecem a sua região, o seu público e o que gira na sua praça.

Quer saber quem atende a sua cidade? Fale com a gente pela página.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t029:1','plano-2026-10:t029','Cardoso · Google Meu Negócio','adapta','2026-11-05','10:00','Quinta','Nov/26','Post','Atualização','Original','A Cardoso atende lojistas e e-commerces em todo o Brasil com representantes regionais. Fale com o nosso comercial.',null,false,false),
  ('plano-2026-10:t030:0','plano-2026-10:t030','Tópi · Instagram','matriz','2026-11-04','12:00','Quarta','Nov/26','Reels','Reels','Original','Decolagem autorizada! 🚁
Invictus Sky, com helicóptero, leva a brincadeira para o alto. A partir de 3 anos.
Quem aí é piloto?
Brincar é Tópi! 🧡
#Tópi #InvictusSky','https://drive.google.com/drive/folders/1oauipjoCgpjmUfLepmjVTQJjraNPAkMZ',false,true),
  ('plano-2026-10:t030:1','plano-2026-10:t030','Tópi · Instagram','reaproveita','2026-11-04','19:30','Quarta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t030:2','plano-2026-10:t030','Tópi · TikTok','reaproveita','2026-11-05','19:00','Quinta','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t030:3','plano-2026-10:t030','Cardoso · Pinterest','adapta','2026-11-06','21:00','Sexta','Nov/26','Pin','Pin','Original','Invictus Sky Tópi | Caminhão com helicóptero de brinquedo, a partir de 3 anos. Ideia de presente de Natal.',null,false,false),
  ('plano-2026-10:t030:4','plano-2026-10:t030','Cardoso · YouTube · playlist Tópi','reaproveita','2026-11-07','18:00','Sábado','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t031:0','plano-2026-10:t031','Cardoso · Instagram','matriz','2026-11-05','11:00','Quinta','Nov/26','Reels','Reels','Original','Isto é o que o revendedor Cardoso recebe de cada produto: 📸🎬
foto para o anúncio, foto para o feed, vídeo vertical e texto.
É só baixar, subir na loja e vender.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso #Ecommerce','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t031:1','plano-2026-10:t031','Cardoso · Instagram','adapta','2026-11-06','10:30','Sexta','Nov/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t031:2','plano-2026-10:t031','Cardoso · WhatsApp · Status','reaproveita','2026-11-07','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t032:0','plano-2026-10:t032','Playmi · Instagram','matriz','2026-11-05','12:00','Quinta','Nov/26','Reels','Reels','Original','Cavalinho, girafinha, hipopótamo, leãozinho, tigre: qual Fofilhote vai ser o primeiro amigo? 🦒🦁
Os Fofilhotes acompanham os pequenos nas primeiras descobertas.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Fofilhotes #PrimeiroAno','https://drive.google.com/drive/folders/1vU7k1yDXMJZLTS5KHf4-njiqTeTaLEJr',false,true),
  ('plano-2026-10:t032:1','plano-2026-10:t032','Playmi · Instagram','reaproveita','2026-11-05','19:30','Quinta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t032:2','plano-2026-10:t032','Playmi · Instagram','adapta','2026-11-06','10:30','Sexta','Nov/26','Stories','Stories','Original','Qual Fofilhote é a cara do seu bebê? 🦒🦁 [enquete: Girafinha / Leãozinho]',null,false,false),
  ('plano-2026-10:t032:3','plano-2026-10:t032','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-06','18:00','Sexta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t032:4','plano-2026-10:t032','Cardoso · WhatsApp · Status','reaproveita','2026-11-07','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t033:0','plano-2026-10:t033','Tópi · Instagram','matriz','2026-11-06','12:00','Sexta','Nov/26','Reels','Reels','Original','Obra liberada! 🚜
Tópi Trator Escavadeira e Tópi Trator Retroescavadeira: cava, carrega e transporta a brincadeira inteira. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Trator #Construção','https://drive.google.com/drive/folders/1_6BnvGBz6b4XCuwqedc9TXMvzDflchN_',false,true),
  ('plano-2026-10:t033:1','plano-2026-10:t033','Tópi · Instagram','reaproveita','2026-11-06','19:30','Sexta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t033:2','plano-2026-10:t033','Tópi · Instagram','adapta','2026-11-07','10:30','Sábado','Nov/26','Stories','Stories','Original','Escavadeira ou retroescavadeira? 🚜 [enquete]',null,false,false),
  ('plano-2026-10:t033:3','plano-2026-10:t033','Tópi · TikTok','reaproveita','2026-11-07','19:00','Sábado','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t034:0','plano-2026-10:t034','Playmi · Instagram','matriz','2026-11-07','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Presente para quem tem a partir de 18 meses? Salve este post. 🦕
O Dino Sabidinho Plus é um dino didático feito para explorar com as mãos, na fase em que tudo vira descoberta.
Arraste para ver a brincadeira acontecendo.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PresentePorIdade #NatalPlaymi','https://drive.google.com/drive/folders/11U4jw_5FUKePQcgO99E1JAfRryFzNmF-',false,true),
  ('plano-2026-10:t034:1','plano-2026-10:t034','Playmi · Instagram','reaproveita','2026-11-07','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t035:0','plano-2026-10:t035','Tópi · Instagram','matriz','2026-11-07','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Monte a banda da casa! 🥁🎶
Tópi Tambor, Tópi Pandeiro e Tucano Musical: cada um num instrumento e o show começa.
Salve e chame a família.
Brincar é Tópi! 🧡
#Tópi #BrinquedoMusical','https://drive.google.com/drive/folders/12Dp5LGVIFY52F4-S0J83VC88qE-Ozmcl',false,true),
  ('plano-2026-10:t035:1','plano-2026-10:t035','Tópi · Instagram','reaproveita','2026-11-07','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t036:0','plano-2026-10:t036','Cardoso · WhatsApp · Canal Representantes','matriz','2026-11-09','10:00','Segunda','Nov/26','WhatsApp','Aviso','Original','Segunda de contagem: faltam 18 dias de Cardoso Black. Onda 2 desta semana: lojistas que compraram na Black de nov/25. Lista na área comercial. Ranking semanal no grupo. [link da área comercial]',null,false,false),
  ('plano-2026-10:t037:0','plano-2026-10:t037','Cardoso · Instagram','matriz','2026-11-09','11:00','Segunda','Nov/26','Reels','Reels','Original','Quer licenciado que sai sozinho da prateleira? 🕷️👑
Totokinha Marvel Spidey, Totokinha Princesas e os bonecos de banho Disney estão entre os que mais giram.
Peça o kit de Natal com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#Licenciados #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t037:1','plano-2026-10:t037','Cardoso · WhatsApp · Status','reaproveita','2026-11-09','18:00','Segunda','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t038:0','plano-2026-10:t038','Cardoso · LinkedIn','matriz','2026-11-10','08:30','Terça','Nov/26','LinkedIn','Post','Original','31 brinquedos musicais, 4 kits prontos. 🎶

Para o Natal, a Cardoso montou o sortimento musical em kits: Bichinhos, Carrinhos, Dinos e Bandinha. O lojista pede o código do kit e recebe tudo separado.

A reposição de Natal vai até 28 de novembro. Fale com o seu representante ou com o nosso comercial.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t038:1','plano-2026-10:t038','Cardoso · Google Meu Negócio','adapta','2026-11-11','10:00','Quarta','Nov/26','Post','Atualização','Original','Natal Musical Cardoso: 4 kits prontos de brinquedos musicais para lojistas. Reposição de Natal até 28/11.',null,false,false),
  ('plano-2026-10:t038:2','plano-2026-10:t038','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-11-11','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Natal Musical: os 4 kits prontos estão na área comercial, com fotos e vídeos para divulgar. Reposição de Natal até 28/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t038:3','plano-2026-10:t038','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-11-11','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Natal Musical: os 4 kits prontos estão na área comercial, com fotos e vídeos para divulgar. Reposição de Natal até 28/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t038:4','plano-2026-10:t038','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-11-11','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Natal Musical: os 4 kits prontos estão na área comercial, com fotos e vídeos para divulgar. Reposição de Natal até 28/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t038:5','plano-2026-10:t038','Cardoso · WhatsApp · Clientes Sul','adapta','2026-11-11','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Natal Musical: os 4 kits prontos estão na área comercial, com fotos e vídeos para divulgar. Reposição de Natal até 28/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t039:0','plano-2026-10:t039','Playmi · Instagram','matriz','2026-11-10','12:00','Terça','Nov/26','Reels','Reels','Original','Novidade na Playmi: Patinete Bluey! 💙
Para a criança que vive pulando com a Bluey e a Bingo, agora a brincadeira ganha rodinhas. A partir de 2 anos.
Já tem quem vai pedir de Natal?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Bluey #Lançamento','https://drive.google.com/drive/folders/1kbziN6NXGTQZQpwVwBNEAz6vvIzY_0Az',false,true),
  ('plano-2026-10:t039:1','plano-2026-10:t039','Playmi · Instagram','reaproveita','2026-11-10','19:30','Terça','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t039:2','plano-2026-10:t039','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-11','18:00','Quarta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t039:3','plano-2026-10:t039','Cardoso · WhatsApp · Status','reaproveita','2026-11-13','18:00','Sexta','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t039:4','plano-2026-10:t039','Cardoso · Pinterest','adapta','2026-11-13','21:00','Sexta','Nov/26','Pin','Pin','Original','Patinete Bluey Playmi | Lançamento para crianças a partir de 2 anos. Ideia de presente de Natal para fãs da Bluey.',null,false,false),
  ('plano-2026-10:t040:0','plano-2026-10:t040','Tópi · Instagram','matriz','2026-11-11','12:00','Quarta','Nov/26','Reels','Reels','Original','Carrega, despeja e começa de novo! 🚛
Tandy Caçamba e Tandy Tractor para os pequenos construtores da casa.
Brincar é Tópi! 🧡
#Tópi #Tandy #Caminhão','https://drive.google.com/drive/folders/1ZGz8gzY1u8SRQ8agAsU-GMDxrHi1KF3k',false,true),
  ('plano-2026-10:t040:1','plano-2026-10:t040','Tópi · Instagram','reaproveita','2026-11-11','19:30','Quarta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t040:2','plano-2026-10:t040','Tópi · TikTok','reaproveita','2026-11-12','19:00','Quinta','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t040:3','plano-2026-10:t040','Cardoso · Pinterest','adapta','2026-11-13','21:00','Sexta','Nov/26','Pin','Pin','Original','Tandy Caçamba Tópi | Caminhão de brinquedo para pequenos construtores. Ideia de presente.',null,false,false),
  ('plano-2026-10:t040:4','plano-2026-10:t040','Cardoso · YouTube · playlist Tópi','reaproveita','2026-11-14','18:00','Sábado','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t041:0','plano-2026-10:t041','Cardoso · Instagram','matriz','2026-11-12','11:00','Quinta','Nov/26','Reels','Reels','Original','1987. Uma fábrica em São Paulo e a vontade de fazer brinquedo de verdade. 🧡
Quase 40 anos depois, são mais de 400 brinquedos e duas marcas: Playmi e Tópi.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#CardosoToys #RevendaCardoso','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t041:1','plano-2026-10:t041','Cardoso · Instagram','adapta','2026-11-13','10:30','Sexta','Nov/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t041:2','plano-2026-10:t041','Cardoso · WhatsApp · Status','reaproveita','2026-11-14','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t042:0','plano-2026-10:t042','Playmi · Instagram','matriz','2026-11-12','12:00','Quinta','Nov/26','Reels','Reels','Original','Hora do chá! ☕🍪
Biscoitos, bolinhos e rosquinhas: com a Doce Cozinha Plus Chá, a criança recebe as visitas e serve a mesa do jeitinho dela. A partir de 3 anos.
Quem seria o primeiro convidado?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #DoceCozinha #ChaDaTarde','https://drive.google.com/drive/folders/1fMdFnGO8nIvbe4X1e1Agk4ygpdWpMcu_',false,true),
  ('plano-2026-10:t042:1','plano-2026-10:t042','Playmi · Instagram','reaproveita','2026-11-12','19:30','Quinta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t042:2','plano-2026-10:t042','Playmi · Instagram','adapta','2026-11-13','10:30','Sexta','Nov/26','Stories','Stories','Original','Chá com biscoitos, bolinhos ou rosquinhas? ☕ [enquete]',null,false,false),
  ('plano-2026-10:t042:3','plano-2026-10:t042','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-13','18:00','Sexta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t042:4','plano-2026-10:t042','Cardoso · WhatsApp · Status','reaproveita','2026-11-14','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t043:0','plano-2026-10:t043','Tópi · Instagram','matriz','2026-11-13','12:00','Sexta','Nov/26','Reels','Reels','Original','Hora da papinha da boneca! 🥣💗
Com o Leva Papinha, a criança prepara, leva e serve a refeição do bebê dela. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #BrincarDeCuidar','https://drive.google.com/drive/folders/1yISeWu89w5VJMEHhpVar3i5VrNc7YOmN',false,true),
  ('plano-2026-10:t043:1','plano-2026-10:t043','Tópi · Instagram','reaproveita','2026-11-13','19:30','Sexta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t043:2','plano-2026-10:t043','Tópi · Instagram','adapta','2026-11-14','10:30','Sábado','Nov/26','Stories','Stories','Original','Sua pequena cuida das bonecas? 💗 [enquete]',null,false,false),
  ('plano-2026-10:t043:3','plano-2026-10:t043','Tópi · TikTok','reaproveita','2026-11-14','19:00','Sábado','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t044:0','plano-2026-10:t044','Playmi · Instagram','matriz','2026-11-14','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Presente para os pequenos de 1 a 2 anos? Os musicais da Playmi estão aqui. 🎶
Sapo Musical, Polvo Musical, Dino Ecológico Musical e Mesinha de Atividades Musical: som e botão para apertar mil vezes. Veja a idade de cada um nos cards.
Arraste e salve para a lista de Natal.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #BrinquedoMusical #NatalPlaymi','https://drive.google.com/drive/folders/1FFoLW6uYfGcxlqjicL1IHdGKGOAgTwPP',false,true),
  ('plano-2026-10:t044:1','plano-2026-10:t044','Playmi · Instagram','reaproveita','2026-11-14','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t045:0','plano-2026-10:t045','Tópi · Instagram','matriz','2026-11-14','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Amigo secreto da escola chegando? 🎁
Salve esta lista: Tópi Blocos de Montar para os construtores, Tópi Tortuga para os pequenos e Tópi Cestinha Didática para quem ama descobrir.
Veja a idade na embalagem.
Brincar é Tópi! 🧡
#Tópi #AmigoSecreto #Lembrancinha','https://drive.google.com/drive/folders/1tGsbOjTOKtXk4AzznJCA0qfD1uGldb20',false,true),
  ('plano-2026-10:t045:1','plano-2026-10:t045','Tópi · Instagram','reaproveita','2026-11-14','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t046:0','plano-2026-10:t046','Cardoso · WhatsApp · Canal Representantes','matriz','2026-11-16','10:00','Segunda','Nov/26','WhatsApp','Aviso','Original','Faltam 11 dias. Atenção ao corte: pedido faturado até 20/11 chega antes da Black do lojista (27/11) — confirmar data por causa do feriado. Onda 3: quem comprou itens da Black de jul/25 a mar/26. [link da área comercial]',null,false,false),
  ('plano-2026-10:t046:1','plano-2026-10:t046','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-11-17','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Cardoso Black: para receber antes da sua Black (27/11), o pedido precisa ser faturado até 20/11. Fale hoje com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t046:2','plano-2026-10:t046','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-11-17','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Cardoso Black: para receber antes da sua Black (27/11), o pedido precisa ser faturado até 20/11. Fale hoje com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t046:3','plano-2026-10:t046','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-11-17','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Cardoso Black: para receber antes da sua Black (27/11), o pedido precisa ser faturado até 20/11. Fale hoje com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t046:4','plano-2026-10:t046','Cardoso · WhatsApp · Clientes Sul','adapta','2026-11-17','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Cardoso Black: para receber antes da sua Black (27/11), o pedido precisa ser faturado até 20/11. Fale hoje com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t047:0','plano-2026-10:t047','Cardoso · Instagram','matriz','2026-11-16','11:00','Segunda','Nov/26','Reels','Reels','Original','Última chamada do Natal Musical! 🎶
Os 4 kits (Bichinhos, Carrinhos, Dinos e Bandinha) chegam prontos na sua loja. A reposição de Natal vai até 28/11.
Fale com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#NatalMusical #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t047:1','plano-2026-10:t047','Cardoso · WhatsApp · Status','reaproveita','2026-11-16','18:00','Segunda','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t047:2','plano-2026-10:t047','Cardoso · WhatsApp · Canal Representantes','adapta','2026-11-21','10:00','Sábado','Nov/26','WhatsApp','Aviso','Original','Natal Musical: última semana de reposição (até 28/11). Ofereça o kit pronto a quem comprou musical de abr a jul/26 e a quem parou. [link da área comercial]',null,false,false),
  ('plano-2026-10:t048:0','plano-2026-10:t048','Cardoso · LinkedIn','matriz','2026-11-17','08:30','Terça','Nov/26','LinkedIn','Post','Original','Quanto custa, para um e-commerce, fotografar cada produto novo?

Na Cardoso, esse trabalho já vem feito: cada produto Playmi e Tópi tem foto para anúncio, foto para feed e vídeo vertical, disponíveis na área comercial para o revendedor.

Vende brinquedos ou presentes online? Fale com o nosso comercial.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t048:1','plano-2026-10:t048','Cardoso · Google Meu Negócio','adapta','2026-11-18','10:00','Quarta','Nov/26','Post','Atualização','Original','Revenda Cardoso: conteúdo pronto (foto e vídeo) de cada produto para o seu e-commerce. Fale com o comercial.',null,false,false),
  ('plano-2026-10:t049:0','plano-2026-10:t049','Playmi · Instagram','matriz','2026-11-17','12:00','Terça','Nov/26','Reels','Reels','Original','Verão chegando, bolha pra todo lado! 🫧☀️
Acqua Bubble, da Playmi, para brincar no quintal, na varanda e nas férias. A partir de 3 anos.
Presente de Natal com cara de verão.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #AcquaBubble #Verão','https://drive.google.com/drive/folders/1hvfur44PUruhXmAboWBGi-3dz9TyRM6O',false,true),
  ('plano-2026-10:t049:1','plano-2026-10:t049','Playmi · Instagram','reaproveita','2026-11-17','19:30','Terça','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t049:2','plano-2026-10:t049','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-18','18:00','Quarta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t049:3','plano-2026-10:t049','Cardoso · WhatsApp · Status','reaproveita','2026-11-20','18:00','Sexta','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t049:4','plano-2026-10:t049','Cardoso · Pinterest','adapta','2026-11-20','21:00','Sexta','Nov/26','Pin','Pin','Original','Acqua Bubble Playmi | Brinquedo de verão para crianças a partir de 3 anos. Ideia de presente de Natal para brincar ao ar livre.',null,false,false),
  ('plano-2026-10:t050:0','plano-2026-10:t050','Tópi · Instagram','matriz','2026-11-18','12:00','Quarta','Nov/26','Reels','Reels','Original','Aperta, gira, encaixa e começa tudo de novo! 🧩
A Mesinha de Atividades da Tópi em ação, para os pequenos a partir de 18 meses.
Brincar é Tópi! 🧡
#Tópi #MesinhaDeAtividades','https://drive.google.com/drive/folders/1YZXOeGA8xKDV6QocPidQZKo3-pcddmnS',false,true),
  ('plano-2026-10:t050:1','plano-2026-10:t050','Tópi · Instagram','reaproveita','2026-11-18','19:30','Quarta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t050:2','plano-2026-10:t050','Tópi · TikTok','reaproveita','2026-11-19','19:00','Quinta','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t050:3','plano-2026-10:t050','Cardoso · Pinterest','adapta','2026-11-20','21:00','Sexta','Nov/26','Pin','Pin','Original','Mesinha de Atividades Tópi | Brinquedo para bebês a partir de 18 meses. Ideia de presente de Natal.',null,false,false),
  ('plano-2026-10:t050:4','plano-2026-10:t050','Cardoso · YouTube · playlist Tópi','reaproveita','2026-11-21','18:00','Sábado','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t051:0','plano-2026-10:t051','Cardoso · Instagram','matriz','2026-11-19','11:00','Quinta','Nov/26','Reels','Reels','Original','Ainda dá tempo de colocar Playmi e Tópi no seu e-commerce para o Natal. 🎄
Produto da fábrica, representante na sua região e conteúdo pronto para subir hoje.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso #Ecommerce #Natal','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t051:1','plano-2026-10:t051','Cardoso · Instagram','adapta','2026-11-20','10:30','Sexta','Nov/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t051:2','plano-2026-10:t051','Cardoso · WhatsApp · Status','reaproveita','2026-11-21','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t052:0','plano-2026-10:t052','Playmi · Instagram','matriz','2026-11-19','12:00','Quinta','Nov/26','Reels','Reels','Original','A família Bluey está completa na Playmi! 💙
Totokinha Bluey para os primeiros passeios (a partir de 18 meses) e Little Figs Bluey para colecionar e criar histórias (a partir de 3 anos).
Qual é o favorito aí na sua casa?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Bluey','https://drive.google.com/drive/folders/1WvhEZaWUBr_9vDm07r6ACR2ZlIfBhoqi',false,true),
  ('plano-2026-10:t052:1','plano-2026-10:t052','Playmi · Instagram','reaproveita','2026-11-19','19:30','Quinta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t052:2','plano-2026-10:t052','Playmi · Instagram','adapta','2026-11-20','10:30','Sexta','Nov/26','Stories','Stories','Original','Time Bluey ou time Bingo? 💙🧡 [enquete]',null,false,false),
  ('plano-2026-10:t052:3','plano-2026-10:t052','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-20','18:00','Sexta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t052:4','plano-2026-10:t052','Cardoso · WhatsApp · Status','reaproveita','2026-11-21','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t053:0','plano-2026-10:t053','Tópi · Instagram','matriz','2026-11-20','12:00','Sexta','Nov/26','Reels','Reels','Original','Uma caixa, muitas construções! 🧱
Com os Tópi Blocos de Montar, a criança cria casa, carro, torre e o que a imaginação mandar.
Brincar é Tópi! 🧡
#Tópi #BlocosDeMontar','https://drive.google.com/drive/folders/1tGsbOjTOKtXk4AzznJCA0qfD1uGldb20',false,true),
  ('plano-2026-10:t053:1','plano-2026-10:t053','Tópi · Instagram','reaproveita','2026-11-20','19:30','Sexta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t053:2','plano-2026-10:t053','Tópi · Instagram','adapta','2026-11-21','10:30','Sábado','Nov/26','Stories','Stories','Original','O que sai primeiro: casa ou carro? 🧱 [enquete]',null,false,false),
  ('plano-2026-10:t053:3','plano-2026-10:t053','Tópi · TikTok','reaproveita','2026-11-21','19:00','Sábado','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t054:0','plano-2026-10:t054','Playmi · Instagram','matriz','2026-11-21','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Guia de Natal Playmi: um presente para cada idade. 🎄
Salve e mande para quem vai presentear!
12 meses+: Totokross
18 meses+: Totokinha Sport e Dino Sabidinho Plus
2 anos+: Patinete Bluey
3 anos+: Doce Cozinha Gourmet
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #GuiaDeNatal #PresentePorIdade',null,false,true),
  ('plano-2026-10:t054:1','plano-2026-10:t054','Playmi · Instagram','reaproveita','2026-11-21','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t055:0','plano-2026-10:t055','Tópi · Instagram','matriz','2026-11-21','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Guia de Natal Tópi! 🎄 Salve e mostre pra quem vai presentear.
18 meses+: Tópi Sabidinho Plus e Tópi Escolar
3 anos+: Carrinho de Boneca Passeio do Bebê
Para os construtores: Robô-Blocks
Brincar é Tópi! 🧡
#Tópi #GuiaDeNatal',null,false,true),
  ('plano-2026-10:t055:1','plano-2026-10:t055','Tópi · Instagram','reaproveita','2026-11-21','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t056:0','plano-2026-10:t056','Cardoso · WhatsApp · Canal Representantes','matriz','2026-11-23','10:00','Segunda','Nov/26','WhatsApp','Aviso','Original','Reta final: faltam 4 dias de Cardoso Black (até 27/11). Onda 4: lojistas pequenos que ainda não compraram itens da Black. Ranking da semana no grupo. [link da área comercial]',null,false,false),
  ('plano-2026-10:t056:1','plano-2026-10:t056','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-11-24','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Última semana de Cardoso Black: vai até 27/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t056:2','plano-2026-10:t056','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-11-24','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Última semana de Cardoso Black: vai até 27/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t056:3','plano-2026-10:t056','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-11-24','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Última semana de Cardoso Black: vai até 27/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t056:4','plano-2026-10:t056','Cardoso · WhatsApp · Clientes Sul','adapta','2026-11-24','10:00','Terça','Nov/26','WhatsApp','Aviso','Original','Última semana de Cardoso Black: vai até 27/11. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t057:0','plano-2026-10:t057','Cardoso · Instagram','matriz','2026-11-23','11:00','Segunda','Nov/26','Reels','Reels','Original','Em todos os estados, tem um representante Cardoso perto da sua loja. 🗺️
Ele conhece a sua praça e o que gira na sua região.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t057:1','plano-2026-10:t057','Cardoso · WhatsApp · Status','reaproveita','2026-11-23','18:00','Segunda','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t058:0','plano-2026-10:t058','Cardoso · LinkedIn','matriz','2026-11-24','08:30','Terça','Nov/26','LinkedIn','Post','Original','Personagem vende, e no Natal vende mais. 🎁

A Cardoso está com kits por licença para redes, lojistas e e-commerces: Marvel, Disney, DC, Os Smurfs e Pocoyo, com o personagem puxando a venda do kit.

Fale com o seu representante ou com o nosso comercial e garanta o sortimento de licenciados para dezembro.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t058:1','plano-2026-10:t058','Cardoso · Google Meu Negócio','adapta','2026-11-25','10:00','Quarta','Nov/26','Post','Atualização','Original','Kits de licenciados Cardoso para o Natal: Marvel, Disney, DC, Os Smurfs e Pocoyo. Fale com o comercial.',null,false,false),
  ('plano-2026-10:t058:2','plano-2026-10:t058','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-11-25','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Kits de licenciados para o Natal (Marvel, Disney, DC, Os Smurfs e Pocoyo) estão na área comercial, com material para divulgar. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t058:3','plano-2026-10:t058','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-11-25','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Kits de licenciados para o Natal (Marvel, Disney, DC, Os Smurfs e Pocoyo) estão na área comercial, com material para divulgar. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t058:4','plano-2026-10:t058','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-11-25','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Kits de licenciados para o Natal (Marvel, Disney, DC, Os Smurfs e Pocoyo) estão na área comercial, com material para divulgar. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t058:5','plano-2026-10:t058','Cardoso · WhatsApp · Clientes Sul','adapta','2026-11-25','10:00','Quarta','Nov/26','WhatsApp','Aviso','Original','Kits de licenciados para o Natal (Marvel, Disney, DC, Os Smurfs e Pocoyo) estão na área comercial, com material para divulgar. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t059:0','plano-2026-10:t059','Playmi · Instagram','matriz','2026-11-24','12:00','Terça','Nov/26','Reels','Reels','Original','Ele fala, ela responde, e a conversa não acaba mais! 🦄🐰🐱
Unicórnio, coelho ou gato: qual Fofush Falante vai virar o melhor amigo da sua criança?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Fofush #PresenteDeNatal','https://drive.google.com/drive/folders/1ZEOR7681QScHs9zQQshHi5wtYjImrdar',false,true),
  ('plano-2026-10:t059:1','plano-2026-10:t059','Playmi · Instagram','reaproveita','2026-11-24','19:30','Terça','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t059:2','plano-2026-10:t059','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-25','18:00','Quarta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t059:3','plano-2026-10:t059','Cardoso · WhatsApp · Status','reaproveita','2026-11-27','18:00','Sexta','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t059:4','plano-2026-10:t059','Cardoso · Pinterest','adapta','2026-11-27','21:00','Sexta','Nov/26','Pin','Pin','Original','Fofush Falante Playmi | Unicórnio, coelho e gato que falam. Ideia de presente de Natal.',null,false,false),
  ('plano-2026-10:t060:0','plano-2026-10:t060','Tópi · Instagram','matriz','2026-11-25','12:00','Quarta','Nov/26','Reels','Reels','Original','Montou, acelerou! 🏎️🤖
Os Robô-Blocks Corrida viram carro de corrida: F-CAR, F-ROAD, F-QUADRI e F-RUN.
Qual vence a corrida aí?
Brincar é Tópi! 🧡
#Tópi #RobôBlocks','https://drive.google.com/drive/folders/10ArsFjTtF86Kuos-nWA0a1NF2SuKjgoW',false,true),
  ('plano-2026-10:t060:1','plano-2026-10:t060','Tópi · Instagram','reaproveita','2026-11-25','19:30','Quarta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t060:2','plano-2026-10:t060','Tópi · TikTok','reaproveita','2026-11-26','19:00','Quinta','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t060:3','plano-2026-10:t060','Cardoso · Pinterest','adapta','2026-11-27','21:00','Sexta','Nov/26','Pin','Pin','Original','Robô-Blocks Corrida Tópi | Blocos de montar que viram carro de corrida. Ideia de presente de Natal.',null,false,false),
  ('plano-2026-10:t060:4','plano-2026-10:t060','Cardoso · YouTube · playlist Tópi','reaproveita','2026-11-28','18:00','Sábado','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t061:0','plano-2026-10:t061','Cardoso · Instagram','matriz','2026-11-26','11:00','Quinta','Nov/26','Reels','Reels','Original','O Natal é só o começo. 📈
Março é um dos meses de maior pedido na Cardoso, com a reposição do lojista. Quem começa a revender agora fecha o Natal e chega em março com sortimento, conteúdo e representante.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso #Ecommerce','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t061:1','plano-2026-10:t061','Cardoso · Instagram','adapta','2026-11-27','10:30','Sexta','Nov/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t061:2','plano-2026-10:t061','Cardoso · WhatsApp · Status','reaproveita','2026-11-28','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t062:0','plano-2026-10:t062','Playmi · Instagram','matriz','2026-11-26','12:00','Quinta','Nov/26','Reels','Reels','Original','Toda princesa merece um passeio real! 👑
Totokinha Princesas, a partir de 18 meses: o primeiro carrinho para passear como nos contos.
Presente de Natal para a pequena fã das princesas Disney.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Princesas #Totokinha','https://drive.google.com/drive/folders/1ejYKSrJuIogfEHGGWa9KFVF-FZyKGt1s',false,true),
  ('plano-2026-10:t062:1','plano-2026-10:t062','Playmi · Instagram','reaproveita','2026-11-26','19:30','Quinta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t062:2','plano-2026-10:t062','Playmi · Instagram','adapta','2026-11-27','10:30','Sexta','Nov/26','Stories','Stories','Original','Qual princesa sua pequena ama? 👑 [caixinha de perguntas]',null,false,false),
  ('plano-2026-10:t062:3','plano-2026-10:t062','Cardoso · YouTube · playlist Playmi','reaproveita','2026-11-27','18:00','Sexta','Nov/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t062:4','plano-2026-10:t062','Cardoso · WhatsApp · Status','reaproveita','2026-11-28','18:00','Sábado','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t063:0','plano-2026-10:t063','Tópi · Instagram','matriz','2026-11-27','12:00','Sexta','Nov/26','Reels','Reels','Original','Pizza, sorvete, frutinhas e guloseimas: a festa é por conta da criança! 🍕🍦
Linha Tópi Festa para o faz de conta.
Brincar é Tópi! 🧡
#Tópi #FazDeConta #Festa','https://drive.google.com/drive/folders/1WNwKx5RiS2rFTs5V-Y3ASNvJImAxuPLL',false,true),
  ('plano-2026-10:t063:1','plano-2026-10:t063','Tópi · Instagram','reaproveita','2026-11-27','19:30','Sexta','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t063:2','plano-2026-10:t063','Tópi · Instagram','adapta','2026-11-28','10:30','Sábado','Nov/26','Stories','Stories','Original','Festa de pizza ou de sorvete? 🍕🍦 [enquete]',null,false,false),
  ('plano-2026-10:t063:3','plano-2026-10:t063','Tópi · TikTok','reaproveita','2026-11-28','19:00','Sábado','Nov/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t064:0','plano-2026-10:t064','Playmi · Instagram','matriz','2026-11-28','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Fofura azul para abraçar! 💙
Smurf, Papai Smurf e Smurfette em pelúcia: presente de Natal para quem cresceu com eles e para quem está conhecendo agora.
Arraste e escolha o seu favorito.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #OsSmurfs #Pelúcia','https://drive.google.com/drive/folders/1Dd6sfRGvUp4HfydVFYn_DTtBY6rZTkti',false,true),
  ('plano-2026-10:t064:1','plano-2026-10:t064','Playmi · Instagram','reaproveita','2026-11-28','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t065:0','plano-2026-10:t065','Tópi · Instagram','matriz','2026-11-28','20:30','Sábado','Nov/26','Feed','Carrossel','Original','Presente para os pequenos até 3 anos? Salve! 🎁
Teltaluga, Mesinha de Atividades, Dino Sabidinho e Tópi Bombeirinho.
Brincar é Tópi! 🧡
#Tópi #PresenteBebê',null,false,true),
  ('plano-2026-10:t065:1','plano-2026-10:t065','Tópi · Instagram','reaproveita','2026-11-28','21:00','Sábado','Nov/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t066:0','plano-2026-10:t066','Cardoso · WhatsApp · Canal Representantes','matriz','2026-11-30','10:00','Segunda','Nov/26','WhatsApp','Aviso','Original','Cardoso Black encerrada. Obrigado, time! Resultado final no painel desta semana. Agora o foco é a reposição de Natal dos licenciados. [link da área comercial]',null,false,false),
  ('plano-2026-10:t067:0','plano-2026-10:t067','Cardoso · Instagram','matriz','2026-11-30','11:00','Segunda','Nov/26','Reels','Reels','Original','O que vendeu na Black precisa voltar para a prateleira. 🎁
Reponha os licenciados para o Natal: Spidey, Princesas, Os Smurfs, Pocoyo e mais, em kits por licença.
Fale com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#Licenciados #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t067:1','plano-2026-10:t067','Cardoso · WhatsApp · Canal Representantes','adapta','2026-11-30','14:00','Segunda','Nov/26','WhatsApp','Aviso','Original','Dezembro = reposição de licenciados. Ofereça os kits por licença a quem comprou licenciado de abr a jul/26. [link da área comercial]',null,false,false),
  ('plano-2026-10:t067:2','plano-2026-10:t067','Cardoso · WhatsApp · Status','reaproveita','2026-11-30','18:00','Segunda','Nov/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t068:0','plano-2026-10:t068','Cardoso · LinkedIn','matriz','2026-12-01','08:30','Terça','Dez/26','LinkedIn','Post','Original','No Natal, o lojista não tem tempo a perder.

Por isso a Cardoso envia campanhas em kits prontos, separados por caixa, e entrega ao revendedor o conteúdo de cada produto para divulgar no mesmo dia.

Quer revender Cardoso em 2027? Fale com o nosso comercial.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t068:1','plano-2026-10:t068','Cardoso · Google Meu Negócio','adapta','2026-12-02','10:00','Quarta','Dez/26','Post','Atualização','Original','Cardoso: kits prontos para o lojista e conteúdo de divulgação de cada produto. Fale com o comercial.',null,false,false),
  ('plano-2026-10:t069:0','plano-2026-10:t069','Playmi · Instagram','matriz','2026-12-01','12:00','Terça','Dez/26','Reels','Reels','Original','Eu quero, eu posso, eu vou descobrir! 🔭
As Bonecas Luna chegam com vestidos para cada aventura: abelha, joaninha e melancia. A partir de 3 anos.
Qual a sua pequena escolheria?
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #ShowDaLuna #BonecaLuna','https://drive.google.com/drive/folders/15yBfkmWIWP7tNic3DVUdrAPH_bIasCGz',false,true),
  ('plano-2026-10:t069:1','plano-2026-10:t069','Playmi · Instagram','reaproveita','2026-12-01','19:30','Terça','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t069:2','plano-2026-10:t069','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-02','18:00','Quarta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t069:3','plano-2026-10:t069','Cardoso · WhatsApp · Status','reaproveita','2026-12-04','18:00','Sexta','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t069:4','plano-2026-10:t069','Cardoso · Pinterest','adapta','2026-12-04','21:00','Sexta','Dez/26','Pin','Pin','Original','Bonecas Luna Playmi | Show da Luna com vestidos de abelha, joaninha e melancia. Ideia de presente de Natal.',null,false,false),
  ('plano-2026-10:t070:0','plano-2026-10:t070','Tópi · Instagram','matriz','2026-12-02','12:00','Quarta','Dez/26','Reels','Reels','Original','Todo pet merece uma casinha! 🐶🏠
Pet Home com Blocos: monta a casa, cuida do bichinho e inventa a rotina dele.
Brincar é Tópi! 🧡
#Tópi #Pet #FazDeConta','https://drive.google.com/drive/folders/1QNpHn_nim0LrEhr4PaQ009N6wjIjIEH2',false,true),
  ('plano-2026-10:t070:1','plano-2026-10:t070','Tópi · Instagram','reaproveita','2026-12-02','19:30','Quarta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t070:2','plano-2026-10:t070','Tópi · TikTok','reaproveita','2026-12-03','19:00','Quinta','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t070:3','plano-2026-10:t070','Cardoso · Pinterest','adapta','2026-12-04','21:00','Sexta','Dez/26','Pin','Pin','Original','Pet Home com Blocos Tópi | Casinha de pet de brinquedo para montar. Ideia de presente.',null,false,false),
  ('plano-2026-10:t070:4','plano-2026-10:t070','Cardoso · YouTube · playlist Tópi','reaproveita','2026-12-05','18:00','Sábado','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t071:0','plano-2026-10:t071','Cardoso · Instagram','matriz','2026-12-03','11:00','Quinta','Dez/26','Reels','Reels','Original','Por dentro da área comercial da Cardoso: 📂
cada produto com foto, vídeo e texto prontos para o seu anúncio, o seu feed e o seu WhatsApp.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso #Ecommerce','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t071:1','plano-2026-10:t071','Cardoso · Instagram','adapta','2026-12-04','10:30','Sexta','Dez/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t071:2','plano-2026-10:t071','Cardoso · WhatsApp · Status','reaproveita','2026-12-05','18:00','Sábado','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t072:0','plano-2026-10:t072','Playmi · Instagram','matriz','2026-12-03','12:00','Quinta','Dez/26','Reels','Reels','Original','Velocidade de piloto, segurança de quem está aprendendo! 🏍️
A Moto Speed XR é a moto de equilíbrio da Playmi em vermelho e rosa, para ganhar confiança a cada volta.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #MotoDeEquilíbrio #PresenteDeNatal','https://drive.google.com/drive/folders/1tdgNAoTYzqA3UpsYK3oLyR9sbwGDfgry',false,true),
  ('plano-2026-10:t072:1','plano-2026-10:t072','Playmi · Instagram','reaproveita','2026-12-03','19:30','Quinta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t072:2','plano-2026-10:t072','Playmi · Instagram','adapta','2026-12-04','10:30','Sexta','Dez/26','Stories','Stories','Original','Vermelha ou rosa? 🏍️ [enquete]',null,false,false),
  ('plano-2026-10:t072:3','plano-2026-10:t072','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-04','18:00','Sexta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t072:4','plano-2026-10:t072','Cardoso · WhatsApp · Status','reaproveita','2026-12-05','18:00','Sábado','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t073:0','plano-2026-10:t073','Tópi · Instagram','matriz','2026-12-04','12:00','Sexta','Dez/26','Reels','Reels','Original','O nenê vai passear! 👶💗
Carrinho de Boneca Meu Nenê para a brincadeira de cuidar ganhar a rua.
Brincar é Tópi! 🧡
#Tópi #CarrinhoDeBoneca','https://drive.google.com/drive/folders/1UYjE34E5Jra4r61z7jkXCPx5H3jx09nL',false,true),
  ('plano-2026-10:t073:1','plano-2026-10:t073','Tópi · Instagram','reaproveita','2026-12-04','19:30','Sexta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t073:2','plano-2026-10:t073','Tópi · Instagram','adapta','2026-12-05','10:30','Sábado','Dez/26','Stories','Stories','Original','Qual o nome do nenê aí? 💗 [caixinha]',null,false,false),
  ('plano-2026-10:t073:3','plano-2026-10:t073','Tópi · TikTok','reaproveita','2026-12-05','19:00','Sábado','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t074:0','plano-2026-10:t074','Playmi · Instagram','matriz','2026-12-05','20:30','Sábado','Dez/26','Feed','Carrossel','Original','Presente para quem tem 3 anos ou mais? Salve este guia! 🎁
Doce Cozinha Gourmet para os chefs, Acqua Bubble para o verão, Little Figs Bluey para colecionar e Studio Fashion Celebridades para o salão de beleza de faz de conta.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #GuiaDeNatal',null,false,true),
  ('plano-2026-10:t074:1','plano-2026-10:t074','Playmi · Instagram','reaproveita','2026-12-05','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t075:0','plano-2026-10:t075','Tópi · Instagram','matriz','2026-12-05','20:30','Sábado','Dez/26','Feed','Carrossel','Original','Salve para a noite de Natal! 🎄
1) Campeonato de Boliche entre primos.
2) Torre de blocos mais alta da família.
3) Banda de Natal com os musicais.
4) Caça ao presente com pistas pela casa.
Brincar é Tópi! 🧡
#Tópi #NatalEmFamília','https://drive.google.com/drive/folders/1VRl_QMSxHiEdEjkkMxw-BC_mC1F4YWTy',false,true),
  ('plano-2026-10:t075:1','plano-2026-10:t075','Tópi · Instagram','reaproveita','2026-12-05','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t076:0','plano-2026-10:t076','Cardoso · Instagram','matriz','2026-12-07','11:00','Segunda','Dez/26','Reels','Reels','Original','Última reposição que chega antes do Natal. ⏰
Os licenciados que mais giram estão prontos para sair: fale com o seu representante hoje.
Construímos muito mais que brinquedos. Construímos confiança.
#Licenciados #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t076:1','plano-2026-10:t076','Cardoso · WhatsApp · Canal Representantes','adapta','2026-12-07','14:00','Segunda','Dez/26','WhatsApp','Aviso','Original','Natal D-18: última reposição de licenciados que chega a tempo. Priorize os 10 maiores clientes de licenciado da sua carteira. [link da área comercial]',null,false,false),
  ('plano-2026-10:t076:2','plano-2026-10:t076','Cardoso · WhatsApp · Status','reaproveita','2026-12-07','18:00','Segunda','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t076:3','plano-2026-10:t076','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-12-09','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Última reposição de licenciados que chega antes do Natal. Kits por licença e material de divulgação na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t076:4','plano-2026-10:t076','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-12-09','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Última reposição de licenciados que chega antes do Natal. Kits por licença e material de divulgação na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t076:5','plano-2026-10:t076','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-12-09','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Última reposição de licenciados que chega antes do Natal. Kits por licença e material de divulgação na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t076:6','plano-2026-10:t076','Cardoso · WhatsApp · Clientes Sul','adapta','2026-12-09','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Última reposição de licenciados que chega antes do Natal. Kits por licença e material de divulgação na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t077:0','plano-2026-10:t077','Cardoso · LinkedIn','matriz','2026-12-08','08:30','Terça','Dez/26','LinkedIn','Post','Original','Um fornecedor, um mix completo.

Playmi: valor agregado, com linhas para aprender, imaginar, colecionar e dirigir.
Tópi: preço acessível e alto giro, do primeiro ano aos 10 anos.

Planejando o sortimento de 2027? Fale com o nosso comercial.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t077:1','plano-2026-10:t077','Cardoso · Google Meu Negócio','adapta','2026-12-09','10:00','Quarta','Dez/26','Post','Atualização','Original','Cardoso: marcas Playmi e Tópi, brinquedos do primeiro ano aos 10 anos. Fale com o comercial.',null,false,false),
  ('plano-2026-10:t078:0','plano-2026-10:t078','Playmi · Instagram','matriz','2026-12-08','12:00','Terça','Dez/26','Reels','Reels','Original','Pó, pó, pó! Hora do passeio com a Galinha Pintadinha! 🐔💙
A Totokinha Galinha Pintadinha Mini é para os pequenos a partir de 18 meses saírem cantando pela casa.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #GalinhaPintadinha #Totokinha','https://drive.google.com/drive/folders/156ESL6ZhUrAz3YeE9Fn-sJNtXntL-tez',false,true),
  ('plano-2026-10:t078:1','plano-2026-10:t078','Playmi · Instagram','reaproveita','2026-12-08','19:30','Terça','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t078:2','plano-2026-10:t078','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-09','18:00','Quarta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t078:3','plano-2026-10:t078','Cardoso · WhatsApp · Status','reaproveita','2026-12-11','18:00','Sexta','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t078:4','plano-2026-10:t078','Cardoso · Pinterest','adapta','2026-12-11','21:00','Sexta','Dez/26','Pin','Pin','Original','Totokinha Galinha Pintadinha Mini Playmi | Para crianças a partir de 18 meses. Ideia de presente de Natal.',null,false,false),
  ('plano-2026-10:t079:0','plano-2026-10:t079','Tópi · Instagram','matriz','2026-12-09','12:00','Quarta','Dez/26','Reels','Reels','Original','Strike! 🎳
O Boliche da Tópi é diversão garantida para a família toda. A partir de 3 anos.
Brincar é Tópi! 🧡
#Tópi #Boliche','https://drive.google.com/drive/folders/1VRl_QMSxHiEdEjkkMxw-BC_mC1F4YWTy',false,true),
  ('plano-2026-10:t079:1','plano-2026-10:t079','Tópi · Instagram','reaproveita','2026-12-09','19:30','Quarta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t079:2','plano-2026-10:t079','Tópi · TikTok','reaproveita','2026-12-10','19:00','Quinta','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t079:3','plano-2026-10:t079','Cardoso · Pinterest','adapta','2026-12-11','21:00','Sexta','Dez/26','Pin','Pin','Original','Boliche Tópi | Jogo para a família, a partir de 3 anos. Ideia de presente de Natal.',null,false,false),
  ('plano-2026-10:t079:4','plano-2026-10:t079','Cardoso · YouTube · playlist Tópi','reaproveita','2026-12-12','18:00','Sábado','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t080:0','plano-2026-10:t080','Cardoso · Instagram','matriz','2026-12-10','11:00','Quinta','Dez/26','Reels','Reels','Original','Como revender Cardoso: 👇
1) Fale com o nosso comercial.
2) Conheça o representante da sua região.
3) Receba o conteúdo pronto e comece a vender.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t080:1','plano-2026-10:t080','Cardoso · Instagram','adapta','2026-12-11','10:30','Sexta','Dez/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t080:2','plano-2026-10:t080','Cardoso · WhatsApp · Status','reaproveita','2026-12-12','18:00','Sábado','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t081:0','plano-2026-10:t081','Playmi · Instagram','matriz','2026-12-10','12:00','Quinta','Dez/26','Reels','Reels','Original','Um dinossauro, 30 blocos e muita imaginação! 🦖🧱
Com o Dino Jurássico, a criança monta, desmonta e inventa o próprio dino.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Dinossauro #BlocosDeMontar','https://drive.google.com/drive/folders/1XwkTcIRXfW9HZzBsB7IzxjZtg1AoOCCg',false,true),
  ('plano-2026-10:t081:1','plano-2026-10:t081','Playmi · Instagram','reaproveita','2026-12-10','19:30','Quinta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t081:2','plano-2026-10:t081','Playmi · Instagram','adapta','2026-12-11','10:30','Sexta','Dez/26','Stories','Stories','Original','Seu pequeno é fã de dinossauro? 🦖 [enquete: Muito! / Sim]',null,false,false),
  ('plano-2026-10:t081:3','plano-2026-10:t081','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-11','18:00','Sexta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t081:4','plano-2026-10:t081','Cardoso · WhatsApp · Status','reaproveita','2026-12-12','18:00','Sábado','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t082:0','plano-2026-10:t082','Tópi · Instagram','matriz','2026-12-11','12:00','Sexta','Dez/26','Reels','Reels','Original','Obra completa numa caixa só! 🚧🚜
Tópi Combo Construction para o pequeno mestre de obras.
Brincar é Tópi! 🧡
#Tópi #Construção','https://drive.google.com/drive/folders/1bZkQdoj3LrMYosUW_XpRq88GvXo4Jj9C',false,true),
  ('plano-2026-10:t082:1','plano-2026-10:t082','Tópi · Instagram','reaproveita','2026-12-11','19:30','Sexta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t082:2','plano-2026-10:t082','Tópi · Instagram','adapta','2026-12-12','10:30','Sábado','Dez/26','Stories','Stories','Original','Seu pequeno é mestre de obras? 🚧 [enquete]',null,false,false),
  ('plano-2026-10:t082:3','plano-2026-10:t082','Tópi · TikTok','reaproveita','2026-12-12','19:00','Sábado','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t083:0','plano-2026-10:t083','Playmi · Instagram','matriz','2026-12-12','20:30','Sábado','Dez/26','Feed','Carrossel','Original','Presente para o primeiro aninho? Salve este post! 🎈
Fofilhotes para as primeiras descobertas, Carrinho de Puxar com 20 Blocos, Totokross para o equilíbrio e Dino Ecológico Musical para apertar e ouvir.
Veja a idade de cada um nos cards.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PresenteDe1Ano #NatalPlaymi',null,false,true),
  ('plano-2026-10:t083:1','plano-2026-10:t083','Playmi · Instagram','reaproveita','2026-12-12','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t084:0','plano-2026-10:t084','Tópi · Instagram','matriz','2026-12-12','20:30','Sábado','Dez/26','Feed','Carrossel','Original','Ainda sem presente? A Tópi resolve! 🎁
Carrinho de Boneca Passeio do Bebê, Tópi Sabidinho Plus, Robô-Blocks e Leva Papinha.
Salve e corra pra loja.
Brincar é Tópi! 🧡
#Tópi #PresenteDeNatal',null,false,true),
  ('plano-2026-10:t084:1','plano-2026-10:t084','Tópi · Instagram','reaproveita','2026-12-12','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t085:0','plano-2026-10:t085','Cardoso · Instagram','matriz','2026-12-14','11:00','Segunda','Dez/26','Reels','Reels','Original','O verão chegou na prateleira! 🏖️
Baldão de Praia Tópi e Acqua Bubble Playmi para as férias. Reponha com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#Verão #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t085:1','plano-2026-10:t085','Cardoso · WhatsApp · Canal Representantes','adapta','2026-12-14','14:00','Segunda','Dez/26','WhatsApp','Aviso','Original','Verão: ofereça Baldão de Praia e Acqua Bubble para a reposição de dezembro e janeiro. Fotos e vídeos na área comercial. [link da área comercial]',null,false,false),
  ('plano-2026-10:t085:2','plano-2026-10:t085','Cardoso · WhatsApp · Status','reaproveita','2026-12-14','18:00','Segunda','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t085:3','plano-2026-10:t085','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-12-16','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Reposição de verão: Baldão de Praia Tópi e Acqua Bubble Playmi, com fotos e vídeos prontos na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t085:4','plano-2026-10:t085','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-12-16','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Reposição de verão: Baldão de Praia Tópi e Acqua Bubble Playmi, com fotos e vídeos prontos na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t085:5','plano-2026-10:t085','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-12-16','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Reposição de verão: Baldão de Praia Tópi e Acqua Bubble Playmi, com fotos e vídeos prontos na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t085:6','plano-2026-10:t085','Cardoso · WhatsApp · Clientes Sul','adapta','2026-12-16','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Reposição de verão: Baldão de Praia Tópi e Acqua Bubble Playmi, com fotos e vídeos prontos na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t086:0','plano-2026-10:t086','Cardoso · LinkedIn','matriz','2026-12-15','08:30','Terça','Dez/26','LinkedIn','Post','Original','O verão também é temporada de brinquedo.

E-commerce que revende Cardoso tem foto e vídeo prontos dos itens de praia e água, para cadastrar e vender ainda em dezembro.

Fale com o nosso comercial.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t086:1','plano-2026-10:t086','Cardoso · Google Meu Negócio','adapta','2026-12-16','10:00','Quarta','Dez/26','Post','Atualização','Original','Revenda Cardoso: brinquedos de verão com foto e vídeo prontos para o seu e-commerce.',null,false,false),
  ('plano-2026-10:t087:0','plano-2026-10:t087','Playmi · Instagram','matriz','2026-12-15','12:00','Terça','Dez/26','Reels','Reels','Original','Ainda dá tempo de colocar o Patinete Bluey embaixo da árvore! 🎄💙
A partir de 2 anos, para a criança que vive pulando com a Bluey e a Bingo.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Bluey #Natal','https://drive.google.com/drive/folders/1kbziN6NXGTQZQpwVwBNEAz6vvIzY_0Az',false,true),
  ('plano-2026-10:t087:1','plano-2026-10:t087','Playmi · Instagram','reaproveita','2026-12-15','19:30','Terça','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t087:2','plano-2026-10:t087','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-16','18:00','Quarta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t087:3','plano-2026-10:t087','Cardoso · WhatsApp · Status','reaproveita','2026-12-18','18:00','Sexta','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t087:4','plano-2026-10:t087','Cardoso · Pinterest','adapta','2026-12-18','21:00','Sexta','Dez/26','Pin','Pin','Original','Patinete Bluey Playmi | Presente de Natal para fãs da Bluey a partir de 2 anos.',null,false,false),
  ('plano-2026-10:t088:0','plano-2026-10:t088','Tópi · Instagram','matriz','2026-12-16','12:00','Quarta','Dez/26','Reels','Reels','Original','Areia, sol e balde cheio! 🏖️
O Baldão de Praia da Tópi é o companheiro das férias.
Brincar é Tópi! 🧡
#Tópi #Praia #Verão','https://drive.google.com/drive/folders/1u3t4Hl0oQ_KGgaz28AB7z6xH5WcJAFmG',false,true),
  ('plano-2026-10:t088:1','plano-2026-10:t088','Tópi · Instagram','reaproveita','2026-12-16','19:30','Quarta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t088:2','plano-2026-10:t088','Tópi · TikTok','reaproveita','2026-12-17','19:00','Quinta','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t088:3','plano-2026-10:t088','Cardoso · Pinterest','adapta','2026-12-18','21:00','Sexta','Dez/26','Pin','Pin','Original','Baldão de Praia Tópi | Brinquedo de praia para as férias de verão.',null,false,false),
  ('plano-2026-10:t088:4','plano-2026-10:t088','Cardoso · YouTube · playlist Tópi','reaproveita','2026-12-19','18:00','Sábado','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t089:0','plano-2026-10:t089','Cardoso · Instagram','matriz','2026-12-17','11:00','Quinta','Dez/26','Reels','Reels','Original','Do Sul ao Norte, tem brinquedo Cardoso na prateleira. 🇧🇷
A Cardoso atende lojistas e e-commerces em todos os estados.
Quer revender na sua loja ou no seu e-commerce? Toque em Enviar mensagem e fale com o nosso comercial.
#RevendaCardoso','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t089:1','plano-2026-10:t089','Cardoso · Instagram','adapta','2026-12-18','10:30','Sexta','Dez/26','Stories','Stories','Original','Vende brinquedos? Revenda Cardoso 👉 [sticker de link: WhatsApp Comercial]',null,false,false),
  ('plano-2026-10:t089:2','plano-2026-10:t089','Cardoso · WhatsApp · Status','reaproveita','2026-12-19','18:00','Sábado','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t090:0','plano-2026-10:t090','Playmi · Instagram','matriz','2026-12-17','12:00','Quinta','Dez/26','Reels','Reels','Original','Corte, escova e penteado: o salão está aberto! 💇‍♀️✨
Com o Studio Fashion Celebridades, a criança vira cabeleireira e cuida do visual das clientes.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #FazDeConta #SalãoDeBeleza','https://drive.google.com/drive/folders/18DGTnBVYTpydCAiucRKJhXGFgJdwS3sD',false,true),
  ('plano-2026-10:t090:1','plano-2026-10:t090','Playmi · Instagram','reaproveita','2026-12-17','19:30','Quinta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t090:2','plano-2026-10:t090','Playmi · Instagram','adapta','2026-12-18','10:30','Sexta','Dez/26','Stories','Stories','Original','Corte ou penteado? 💇‍♀️ [enquete]',null,false,false),
  ('plano-2026-10:t090:3','plano-2026-10:t090','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-18','18:00','Sexta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t090:4','plano-2026-10:t090','Cardoso · WhatsApp · Status','reaproveita','2026-12-19','18:00','Sábado','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t091:0','plano-2026-10:t091','Tópi · Instagram','matriz','2026-12-18','12:00','Sexta','Dez/26','Reels','Reels','Original','Tópi Mileva: companheira da brincadeira de todo dia! 🧡
Brincar é Tópi! 🧡
#Tópi','https://drive.google.com/drive/folders/1pWHG2c1B4wWC6w1-BG-q5Ctmy702t9As',false,true),
  ('plano-2026-10:t091:1','plano-2026-10:t091','Tópi · Instagram','reaproveita','2026-12-18','19:30','Sexta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t091:2','plano-2026-10:t091','Tópi · Instagram','adapta','2026-12-19','10:30','Sábado','Dez/26','Stories','Stories','Original','Já conhecia a Tópi Mileva? 🧡 [enquete]',null,false,false),
  ('plano-2026-10:t091:3','plano-2026-10:t091','Tópi · TikTok','reaproveita','2026-12-19','19:00','Sábado','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t092:0','plano-2026-10:t092','Playmi · Instagram','matriz','2026-12-19','20:30','Sábado','Dez/26','Feed','Carrossel','Original','Ainda sem o presente? Respira! 🎄
Os favoritos da Playmi para encontrar nas lojas perto de você: Totokinha Sport, Patinete Bluey, Totokinha Princesas, Doce Cozinha Gourmet e Totokross.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PresenteDeÚltimaHora',null,false,true),
  ('plano-2026-10:t092:1','plano-2026-10:t092','Playmi · Instagram','reaproveita','2026-12-19','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t093:0','plano-2026-10:t093','Tópi · Instagram','matriz','2026-12-19','20:30','Sábado','Dez/26','Feed','Carrossel','Original','Férias começando! Salve estas ideias ☀️
1) Pista de carrinhos com fita no chão.
2) Restaurante de faz de conta.
3) Construção com blocos.
4) Banda da família.
Brincar é Tópi! 🧡
#Tópi #Férias',null,false,true),
  ('plano-2026-10:t093:1','plano-2026-10:t093','Tópi · Instagram','reaproveita','2026-12-19','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t094:0','plano-2026-10:t094','Cardoso · Instagram','matriz','2026-12-21','11:00','Segunda','Dez/26','Reels','Reels','Original','A cada brinquedo que saiu da sua prateleira, uma criança ganhou uma brincadeira nova. 🎄
Obrigado, lojista, por construir esse Natal com a gente.
Construímos muito mais que brinquedos. Construímos confiança.
#FelizNatal #CardosoToys','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t094:1','plano-2026-10:t094','Cardoso · WhatsApp · Canal Representantes','adapta','2026-12-21','14:00','Segunda','Dez/26','WhatsApp','Aviso','Original','Obrigado, time comercial, por 2026! Feliz Natal da Cardoso para você e sua família.',null,false,false),
  ('plano-2026-10:t094:2','plano-2026-10:t094','Cardoso · WhatsApp · Status','reaproveita','2026-12-21','18:00','Segunda','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t094:3','plano-2026-10:t094','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-12-22','10:00','Terça','Dez/26','WhatsApp','Aviso','Original','Obrigado por vender Cardoso em 2026! Feliz Natal da Cardoso para você, sua equipe e sua família. 🎄',null,false,false),
  ('plano-2026-10:t094:4','plano-2026-10:t094','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-12-22','10:00','Terça','Dez/26','WhatsApp','Aviso','Original','Obrigado por vender Cardoso em 2026! Feliz Natal da Cardoso para você, sua equipe e sua família. 🎄',null,false,false),
  ('plano-2026-10:t094:5','plano-2026-10:t094','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-12-22','10:00','Terça','Dez/26','WhatsApp','Aviso','Original','Obrigado por vender Cardoso em 2026! Feliz Natal da Cardoso para você, sua equipe e sua família. 🎄',null,false,false),
  ('plano-2026-10:t094:6','plano-2026-10:t094','Cardoso · WhatsApp · Clientes Sul','adapta','2026-12-22','10:00','Terça','Dez/26','WhatsApp','Aviso','Original','Obrigado por vender Cardoso em 2026! Feliz Natal da Cardoso para você, sua equipe e sua família. 🎄',null,false,false),
  ('plano-2026-10:t095:0','plano-2026-10:t095','Cardoso · LinkedIn','matriz','2026-12-22','08:30','Terça','Dez/26','LinkedIn','Post','Original','2026 foi o ano em que a Cardoso aproximou ainda mais a fábrica do lojista: kits prontos, conteúdo para cada produto e representantes em todo o Brasil.

Obrigado a cada revendedor que levou Playmi e Tópi para as crianças.

Feliz Natal e um 2027 de muitas vendas.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t095:1','plano-2026-10:t095','Cardoso · Google Meu Negócio','adapta','2026-12-23','10:00','Quarta','Dez/26','Post','Atualização','Original','Feliz Natal da Cardoso Toys! Obrigado a todos os lojistas e famílias que brincam com a gente.',null,false,false),
  ('plano-2026-10:t096:0','plano-2026-10:t096','Playmi · Instagram','matriz','2026-12-22','12:00','Terça','Dez/26','Reels','Reels','Original','O presente que sai da caixa e já sai passeando! 🎄🚗
As Totokinhas da Playmi são para os pequenos a partir de 18 meses: Clássica, Bolinha e Sport.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #Totokinha #Natal','https://drive.google.com/drive/folders/16rorQzSTkDhgqztEzzG63e7Yfoj0c7VJ',false,true),
  ('plano-2026-10:t096:1','plano-2026-10:t096','Playmi · Instagram','reaproveita','2026-12-22','19:30','Terça','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t096:2','plano-2026-10:t096','Cardoso · WhatsApp · Status','reaproveita','2026-12-23','18:00','Quarta','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t096:3','plano-2026-10:t096','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-23','18:00','Quarta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t097:0','plano-2026-10:t097','Tópi · Instagram','matriz','2026-12-23','12:00','Quarta','Dez/26','Reels','Reels','Original','Presente montado em minutos, brincadeira para o dia todo! 🤖🎄
Robô-Blocks Serviço.
Brincar é Tópi! 🧡
#Tópi #RobôBlocks #Natal','https://drive.google.com/drive/folders/1MxNVArOe2b7NmA7sshZO8kZoezXnBY9d',false,true),
  ('plano-2026-10:t097:1','plano-2026-10:t097','Tópi · Instagram','reaproveita','2026-12-23','19:30','Quarta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t097:2','plano-2026-10:t097','Tópi · TikTok','reaproveita','2026-12-24','19:00','Quinta','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t097:3','plano-2026-10:t097','Cardoso · YouTube · playlist Tópi','reaproveita','2026-12-26','18:00','Sábado','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t098:0','plano-2026-10:t098','Playmi · Instagram','matriz','2026-12-24','12:00','Quinta','Dez/26','Reels','Reels','Original','Que o Natal de vocês seja cheio de brincadeira, abraço e descoberta. 🎄💙
A Playmi deseja um Feliz Natal para todas as famílias que crescem junto com a gente.
Brincar é crescer, juntos! 💙
#Playmi #FelizNatal',null,false,true),
  ('plano-2026-10:t098:1','plano-2026-10:t098','Playmi · Instagram','reaproveita','2026-12-24','19:30','Quinta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t098:2','plano-2026-10:t098','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-25','18:00','Sexta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t098:3','plano-2026-10:t098','Playmi · Instagram','adapta','2026-12-26','10:30','Sábado','Dez/26','Stories','Stories','Original','O que o Papai Noel trouxe aí? 🎁 [caixinha de perguntas]',null,false,false),
  ('plano-2026-10:t099:0','plano-2026-10:t099','Tópi · Instagram','matriz','2026-12-25','12:00','Sexta','Dez/26','Reels','Reels','Original','Feliz Natal! 🎄🧡
Que a sua casa tenha muita brincadeira hoje e sempre.
Brincar é Tópi! 🧡
#Tópi #FelizNatal',null,false,true),
  ('plano-2026-10:t099:1','plano-2026-10:t099','Tópi · Instagram','reaproveita','2026-12-25','19:30','Sexta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t099:2','plano-2026-10:t099','Tópi · Instagram','adapta','2026-12-26','10:30','Sábado','Dez/26','Stories','Stories','Original','O que o Papai Noel trouxe aí? 🎁 [caixinha]',null,false,false),
  ('plano-2026-10:t099:3','plano-2026-10:t099','Tópi · TikTok','reaproveita','2026-12-26','19:00','Sábado','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t100:0','plano-2026-10:t100','Playmi · Instagram','matriz','2026-12-26','20:30','Sábado','Dez/26','Feed','Carrossel','Original','O presente chegou. E agora? 🎁
1) Brinque junto nos primeiros dias.
2) Deixe o brinquedo ao alcance da criança.
3) Alterne: guarde alguns por uma semana e traga de volta.
4) Invente uma história nova com o mesmo brinquedo.
Salve para lembrar nas férias.
Brincar é crescer, juntos! 💙
#Playmi #DicasDeBrincar',null,false,true),
  ('plano-2026-10:t100:1','plano-2026-10:t100','Playmi · Instagram','reaproveita','2026-12-26','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t101:0','plano-2026-10:t101','Tópi · Instagram','matriz','2026-12-26','20:30','Sábado','Dez/26','Feed','Carrossel','Original','Ganhou brinquedo novo? 🎁
1) Brinque junto no primeiro dia.
2) Crie um cantinho de brincar.
3) Reveze os brinquedos durante a semana.
Brincar é Tópi! 🧡
#Tópi #DicasDeBrincar',null,false,true),
  ('plano-2026-10:t101:1','plano-2026-10:t101','Tópi · Instagram','reaproveita','2026-12-26','21:00','Sábado','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t102:0','plano-2026-10:t102','Cardoso · Instagram','matriz','2026-12-28','11:00','Segunda','Dez/26','Reels','Reels','Original','A Páscoa de 2027 é em 28 de março, e as redes compram em janeiro. 🐰
Pelúcias e miniaturas licenciadas viram presente de Páscoa. Reserve com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#Páscoa #Licenciados #Lojista','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t102:1','plano-2026-10:t102','Cardoso · WhatsApp · Canal Representantes','adapta','2026-12-28','14:00','Segunda','Dez/26','WhatsApp','Aviso','Original','Páscoa 28/03: fase Páscoa dos licenciados começa em 04/01. Kit e lâmina da Páscoa na área comercial. [link da área comercial]',null,false,false),
  ('plano-2026-10:t102:2','plano-2026-10:t102','Cardoso · WhatsApp · Status','reaproveita','2026-12-28','18:00','Segunda','Dez/26','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t102:3','plano-2026-10:t102','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2026-12-30','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Páscoa 2027 (28/03): kits de licenciados para a Páscoa na área comercial a partir de 04/01. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t102:4','plano-2026-10:t102','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2026-12-30','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Páscoa 2027 (28/03): kits de licenciados para a Páscoa na área comercial a partir de 04/01. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t102:5','plano-2026-10:t102','Cardoso · WhatsApp · Clientes Sudeste','adapta','2026-12-30','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Páscoa 2027 (28/03): kits de licenciados para a Páscoa na área comercial a partir de 04/01. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t102:6','plano-2026-10:t102','Cardoso · WhatsApp · Clientes Sul','adapta','2026-12-30','10:00','Quarta','Dez/26','WhatsApp','Aviso','Original','Páscoa 2027 (28/03): kits de licenciados para a Páscoa na área comercial a partir de 04/01. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t103:0','plano-2026-10:t103','Cardoso · LinkedIn','matriz','2026-12-29','08:30','Terça','Dez/26','LinkedIn','Post','Original','Anote na agenda de 2027: a Cardoso estará na ABRIN, de 4 a 7 de abril, em São Paulo.

Vai ser a hora de conhecer os lançamentos Playmi e Tópi e fechar o pedido da temporada.

Quer agendar uma visita ao stand? Fale com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t103:1','plano-2026-10:t103','Cardoso · Google Meu Negócio','adapta','2026-12-30','10:00','Quarta','Dez/26','Post','Atualização','Original','A Cardoso estará na ABRIN 2027, de 4 a 7 de abril, em São Paulo. Agende sua visita.',null,false,false),
  ('plano-2026-10:t104:0','plano-2026-10:t104','Playmi · Instagram','matriz','2026-12-29','12:00','Terça','Dez/26','Reels','Reels','Original','Férias, calor e bolhas pra todo lado! 🫧☀️
Acqua Bubble para brincar no quintal e na varanda. A partir de 3 anos.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #AcquaBubble #Férias','https://drive.google.com/drive/folders/1hvfur44PUruhXmAboWBGi-3dz9TyRM6O',false,true),
  ('plano-2026-10:t104:1','plano-2026-10:t104','Playmi · Instagram','reaproveita','2026-12-29','19:30','Terça','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t104:2','plano-2026-10:t104','Cardoso · YouTube · playlist Playmi','reaproveita','2026-12-30','18:00','Quarta','Dez/26','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t104:3','plano-2026-10:t104','Cardoso · Pinterest','adapta','2027-01-01','21:00','Sexta','Jan/27','Pin','Pin','Original','Acqua Bubble Playmi | Brincadeira de verão para as férias, a partir de 3 anos.',null,false,false),
  ('plano-2026-10:t104:4','plano-2026-10:t104','Cardoso · WhatsApp · Status','reaproveita','2027-01-02','18:00','Sábado','Jan/27','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t105:0','plano-2026-10:t105','Tópi · Instagram','matriz','2026-12-30','12:00','Quarta','Dez/26','Reels','Reels','Original','Partiu praia! 🏖️
Baldão de Praia Tópi: castelo, piscininha e muita areia.
Brincar é Tópi! 🧡
#Tópi #Praia','https://drive.google.com/drive/folders/1u3t4Hl0oQ_KGgaz28AB7z6xH5WcJAFmG',false,true),
  ('plano-2026-10:t105:1','plano-2026-10:t105','Tópi · Instagram','reaproveita','2026-12-30','19:30','Quarta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t105:2','plano-2026-10:t105','Tópi · TikTok','reaproveita','2026-12-31','19:00','Quinta','Dez/26','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t105:3','plano-2026-10:t105','Cardoso · Pinterest','adapta','2027-01-01','21:00','Sexta','Jan/27','Pin','Pin','Original','Baldão de Praia Tópi | Brinquedo de praia para as férias.',null,false,false),
  ('plano-2026-10:t105:4','plano-2026-10:t105','Cardoso · YouTube · playlist Tópi','reaproveita','2027-01-02','18:00','Sábado','Jan/27','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t106:0','plano-2026-10:t106','Playmi · Instagram','matriz','2026-12-31','12:00','Quinta','Dez/26','Reels','Reels','Original','Que 2027 venha com muitas descobertas para crescer juntos! ✨💙
Feliz Ano Novo, de toda a Playmi.
Brincar é crescer, juntos! 💙
#Playmi #FelizAnoNovo',null,false,true),
  ('plano-2026-10:t106:1','plano-2026-10:t106','Playmi · Instagram','reaproveita','2026-12-31','19:30','Quinta','Dez/26','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t106:2','plano-2026-10:t106','Cardoso · YouTube · playlist Playmi','reaproveita','2027-01-01','18:00','Sexta','Jan/27','Shorts','Shorts','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t107:0','plano-2026-10:t107','Tópi · Instagram','matriz','2027-01-01','12:00','Sexta','Jan/27','Reels','Reels','Original','Ano novo, brincadeira nova! ✨🧡
Feliz 2027, de toda a Tópi.
Brincar é Tópi! 🧡
#Tópi #FelizAnoNovo',null,false,true),
  ('plano-2026-10:t107:1','plano-2026-10:t107','Tópi · Instagram','reaproveita','2027-01-01','19:30','Sexta','Jan/27','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t107:2','plano-2026-10:t107','Tópi · Instagram','adapta','2027-01-02','10:30','Sábado','Jan/27','Stories','Stories','Original','Qual brincadeira vai ser a primeira de 2027? ✨ [caixinha]',null,false,false),
  ('plano-2026-10:t107:3','plano-2026-10:t107','Tópi · TikTok','reaproveita','2027-01-02','19:00','Sábado','Jan/27','Reels','Vídeo','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t108:0','plano-2026-10:t108','Playmi · Instagram','matriz','2027-01-02','20:30','Sábado','Jan/27','Feed','Carrossel','Original','Férias sem tela? Salve estas 5 ideias! ☀️
1) Restaurante de faz de conta com a Doce Cozinha.
2) Circuito de equilíbrio com a Totokross.
3) Bolhas no quintal com o Acqua Bubble.
4) Cidade de blocos com a Estação de Resgate.
5) Desfile de Totokinhas pela casa.
Brincar é crescer, juntos! 💙
#Playmi #Férias #BrincarSemTela',null,false,true),
  ('plano-2026-10:t108:1','plano-2026-10:t108','Playmi · Instagram','reaproveita','2027-01-02','21:00','Sábado','Jan/27','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t109:0','plano-2026-10:t109','Tópi · Instagram','matriz','2027-01-02','20:30','Sábado','Jan/27','Feed','Carrossel','Original','Férias sem tela? Salve! ☀️
1) Cidade de blocos.
2) Feirinha de faz de conta.
3) Corrida de carrinhos.
4) Boliche no corredor.
5) Piquenique da boneca.
Brincar é Tópi! 🧡
#Tópi #Férias #BrincarSemTela',null,false,true),
  ('plano-2026-10:t109:1','plano-2026-10:t109','Tópi · Instagram','reaproveita','2027-01-02','21:00','Sábado','Jan/27','Stories','Stories','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t110:0','plano-2026-10:t110','Cardoso · Instagram','matriz','2027-01-04','11:00','Segunda','Jan/27','Reels','Reels','Original','Começou a temporada de compra da Páscoa. 🐰🎁
Kits de licenciados com pelúcias e miniaturas para a sua loja. Fale com o seu representante.
Construímos muito mais que brinquedos. Construímos confiança.
#Páscoa #Licenciados','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,true),
  ('plano-2026-10:t110:1','plano-2026-10:t110','Cardoso · WhatsApp · Canal Representantes','adapta','2027-01-04','14:00','Segunda','Jan/27','WhatsApp','Aviso','Original','Começou a fase Páscoa dos licenciados (até 28/02). Lote de Páscoa para redes e kits para lojistas e e-commerces na área comercial. [link da área comercial]',null,false,false),
  ('plano-2026-10:t110:2','plano-2026-10:t110','Cardoso · WhatsApp · Status','reaproveita','2027-01-04','18:00','Segunda','Jan/27','WhatsApp','Status','Reaproveitamento',null,null,false,false),
  ('plano-2026-10:t110:3','plano-2026-10:t110','Cardoso · WhatsApp · Clientes Centro-Oeste','adapta','2027-01-05','10:00','Terça','Jan/27','WhatsApp','Aviso','Original','Páscoa 2027: kits de licenciados com pelúcias e miniaturas estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t110:4','plano-2026-10:t110','Cardoso · WhatsApp · Clientes Norte/Nordeste','adapta','2027-01-05','10:00','Terça','Jan/27','WhatsApp','Aviso','Original','Páscoa 2027: kits de licenciados com pelúcias e miniaturas estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t110:5','plano-2026-10:t110','Cardoso · WhatsApp · Clientes Sudeste','adapta','2027-01-05','10:00','Terça','Jan/27','WhatsApp','Aviso','Original','Páscoa 2027: kits de licenciados com pelúcias e miniaturas estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t110:6','plano-2026-10:t110','Cardoso · WhatsApp · Clientes Sul','adapta','2027-01-05','10:00','Terça','Jan/27','WhatsApp','Aviso','Original','Páscoa 2027: kits de licenciados com pelúcias e miniaturas estão na área comercial. Fale com o seu representante. [link da área comercial]',null,false,false),
  ('plano-2026-10:t111:0','plano-2026-10:t111','Cardoso · LinkedIn','matriz','2027-01-05','08:30','Terça','Jan/27','LinkedIn','Post','Original','Três motivos para revender Cardoso em 2027:

1) Fábrica própria em São Paulo desde 1987.
2) Duas marcas, Playmi e Tópi, para públicos e faixas de preço diferentes.
3) Conteúdo pronto de cada produto para vender online.

Fale com o nosso comercial.
Construímos muito mais que brinquedos. Construímos confiança.','https://drive.google.com/drive/folders/1fG372fUI5m4fQLVRmT1Zz2PoibdF7pbA',false,false),
  ('plano-2026-10:t112:0','plano-2026-10:t112','Playmi · Instagram','matriz','2027-01-05','12:00','Terça','Jan/27','Reels','Reels','Original','Aprender também é brincadeira! 📚🦕
Na linha Play&Learn da Playmi, o Dino Sabidinho Plus e a Mesinha de Atividades Musical ajudam os pequenos a explorar formas, sons e cores antes da escola.
Onde comprar: link na bio.
Brincar é crescer, juntos! 💙
#Playmi #PlayAndLearn #VoltaÀsAulas','https://drive.google.com/drive/folders/11U4jw_5FUKePQcgO99E1JAfRryFzNmF-',false,true),
  ('plano-2026-10:t112:1','plano-2026-10:t112','Playmi · Instagram','reaproveita','2027-01-05','19:30','Terça','Jan/27','Stories','Stories','Reaproveitamento',null,null,false,false);

do $$
declare n int;
begin
  select count(*) into n from _i where not exists (
    select 1 from public.social_channels c where c.account || ' · ' || c.name = _i.canal);
  if n > 0 then raise exception 'ABORTADO: % destino(s) com canal que não existe no Hub', n; end if;
end $$;

insert into public.social_plan_items (ext_id, topic_id, channel_id, link_kind, pub_date, pub_time, weekday, month_label,
  week_theme, brand, network, channel, piece_type, format, origin, pauta, product, sku, objective, cta, media_use,
  product_id, caption, creative_url, creative_changed, mirror_facebook)
select i.ext_id, t.id, c.id, i.link_kind, i.pub_date, i.pub_time, i.weekday, i.month_label,
       t.front, t.brand, c.network, i.canal, i.piece_type, coalesce(i.format, ''), i.origin, t.title, t.product, t.sku, t.objective, t.cta, t.media_use,
       t.product_id, i.caption, nullif(i.creative_url, ''), i.creative_changed, i.mirror_facebook
  from _i i
  join public.social_topics t on t.ext_key = i.topic_key
  join public.social_channels c on c.account || ' · ' || c.name = i.canal
 order by (i.link_kind <> 'matriz'), i.ext_id
on conflict (ext_id) do nothing;

-- 5) marcos comerciais do plano novo
insert into public.social_plan_deadlines (ext_key, marco, dm, limite, acao, resp, ord) values
  ('plano-2026-10:m01','Natal Musical (19/10/2026)','D0','2026-10-19','Lançamento dos 4 kits nos canais Cardoso e no Canal Representantes','Digital + Comercial',1000),
  ('plano-2026-10:m02','Natal Musical (19/10/2026)','D+11','2026-10-30','Posts, vídeos e lâmina dos 4 kits na área comercial (diretriz)','Digital',1001),
  ('plano-2026-10:m03','Cardoso Black (03/11/2026)','D-8','2026-10-26','Esquenta interno: aviso no Canal Representantes e Clientes (sem redes)','Digital + Comercial',1002),
  ('plano-2026-10:m04','Cardoso Black (03/11/2026)','D-4','2026-10-30','Kit do lojista (posts, vídeos, lâmina, tabela, script) publicado na área comercial','Digital',1003),
  ('plano-2026-10:m05','Cardoso Black (03/11/2026)','D0','2026-11-03','Largada interna: Canal Representantes + 4 Canais Clientes (Finados desloca para terça)','Digital + Comercial',1004),
  ('plano-2026-10:m06a','Cardoso Black (27/11/2026)','D-18','2026-11-09','Contagem regressiva às segundas no Canal Representantes','Digital + Comercial',1005),
  ('plano-2026-10:m06b','Cardoso Black (27/11/2026)','D-11','2026-11-16','Contagem regressiva às segundas no Canal Representantes','Digital + Comercial',1006),
  ('plano-2026-10:m06c','Cardoso Black (27/11/2026)','D-4','2026-11-23','Contagem regressiva às segundas no Canal Representantes','Digital + Comercial',1007),
  ('plano-2026-10:m07','Faturamento Black (20/11/2026)','D-4','2026-11-16','Aviso de corte de faturamento. 20/11 é feriado nacional: confirmar a data de corte','Comercial + Logística',1008),
  ('plano-2026-10:m08','Cardoso Black (27/11/2026)','D+3','2026-11-30','Encerramento interno e resultado no painel','Comercial',1009),
  ('plano-2026-10:m09','Licenciados · fase Natal (01/11/2026)','D-7','2026-10-25','Pautas Playmi com Spidey/Princesas/Smurfs/Galinha/Luna enviadas aos licenciadores em lote','Digital + Licenciamento',1010),
  ('plano-2026-10:m10','Licenciados · fase Natal (01/11/2026)','D+6','2026-11-07','Lâmina dos kits e da Páscoa aprovada pelo licenciador (diretriz)','Digital + Licenciamento',1011),
  ('plano-2026-10:m11','Lançamento Patinete Bluey (10/11/2026)','D-10','2026-10-31','Material final enviado ao licenciador Bluey','Digital + Licenciamento',1012),
  ('plano-2026-10:m12','Natal Musical · fim da reposição (28/11/2026)','D-7','2026-11-21','Última chamada no Canal Representantes','Digital + Comercial',1013),
  ('plano-2026-10:m13','Natal (25/12/2026)','D-34','2026-11-21','Guia de Natal Playmi e Tópi no ar','Digital',1014),
  ('plano-2026-10:m14','Natal (25/12/2026)','D-6','2026-12-19','Última chamada consumidor (Playmi)','Digital',1015),
  ('plano-2026-10:m15','Verão (21/12/2026)','D-7','2026-12-14','Reposição de verão (praia e água) nos canais Cardoso','Digital + Comercial',1016),
  ('plano-2026-10:m16','Páscoa 2027 (28/03/2027)','D-90','2026-12-28','Pré-aviso da fase Páscoa dos licenciados','Digital + Comercial',1017),
  ('plano-2026-10:m17','Páscoa 2027 (28/03/2027)','D-83','2027-01-04','Abertura da fase Páscoa: kits na área comercial e avisos','Digital + Comercial',1018),
  ('plano-2026-10:m18','ABRIN 2027 (04/04/2027)','D-96','2026-12-29','Save the date no LinkedIn e Google Meu Negócio','Digital',1019),
  ('plano-2026-10:m19','Plano de fevereiro (01/02/2027)','D-27','2027-01-05','Pauta de fevereiro entregue à Fabiana (regra: dia 5 do mês anterior)','Digital',1020),
  ('plano-2026-10:m20','Plano de dezembro (01/12/2026)','D-26','2026-11-05','Pauta + legenda de dezembro aprovadas (etapa 1)','Digital',1021),
  ('plano-2026-10:m21','Plano de janeiro (01/01/2027)','D-27','2026-12-05','Pauta + legenda de janeiro aprovadas (etapa 1)','Digital',1022)
on conflict (ext_key) do nothing;

-- 6) conferência: aborta se o plano novo não entrou inteiro
do $$
declare nt int; ni int; nm int; sem_matriz int;
begin
  select count(*) into nt from public.social_topics where ext_key like 'plano-2026-10:%';
  select count(*) into ni from public.social_plan_items where ext_id like 'plano-2026-10:%';
  select count(*) into nm from public.social_plan_deadlines where ext_key like 'plano-2026-10:%';
  select count(*) into sem_matriz from public.social_topics t where t.ext_key like 'plano-2026-10:%'
     and (select count(*) from public.social_plan_items i where i.topic_id = t.id and i.link_kind = 'matriz') <> 1;
  if nt <> 112 or ni <> 405 or nm <> 23 or sem_matriz > 0 then
    raise exception 'ABORTADO: entraram % assuntos, % destinos e % marcos (esperado 112, 405 e 23); % assunto(s) sem 1 matriz', nt, ni, nm, sem_matriz;
  end if;
end $$;

commit;

-- Conferência:
--   select (select count(*) from social_topics) as assuntos, (select count(*) from social_plan_items where not archived) as destinos,
--          (select count(*) from social_plan_deadlines) as marcos, (select count(*) from backup_plano_20261013_items) as backup_pecas;
