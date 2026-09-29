-- Cardoso Hub — o Centro-Oeste passa a ter tabela de preco.
-- Roda depois da 0106. Idempotente: rodar duas vezes nao duplica UF nenhuma.
--
-- Quando as quatro tabelas entraram (0102/0103), os quatro PDFs cobriam SP,
-- Sul/Sudeste e Nordeste/Norte. MT, MS, GO e DF nao apareciam em nenhum, e eu
-- registrei o buraco em vez de chutar em qual tabela eles cairiam — preco
-- errado num pre-pedido e preco errado numa nota.
--
-- A resposta veio da area comercial em 29/09/2026: a tabela Norte e Nordeste
-- serve para o Centro-Oeste. E so isso que esta migration faz.
--
-- Consequencia pratica: gerar_pre_pedido() parava com 'sem_tabela' para
-- qualquer lead de Goias, Mato Grosso, Mato Grosso do Sul e Distrito Federal,
-- porque tabela_de_preco_do_cliente() devolve NULO quando a UF nao esta em
-- tabela nenhuma. Passa a funcionar.
--
-- O nome muda junto. Ele aparece no cabecalho do documento interno
-- ("Pre-pedido · Nordeste - Norte"), e um lead de Goias com esse rotulo em cima
-- do proprio orcamento e confuso para quem esta vendendo. O lojista nao ve este
-- campo — quem ve e o comercial. O codigo da tabela NAO muda: e a chave, e
-- pre_pedidos.tabela_nome e fotografado, entao documento antigo continua com o
-- nome que tinha no dia.

set lock_timeout = '5s';

begin;

update public.price_tables
   set ufs = (
         select array_agg(distinct u order by u)
           from unnest(ufs || array['MT','MS','GO','DF']) u),
       nome = 'Nordeste, Norte e Centro-Oeste'
 where codigo = 'nordeste_norte'
   and vigente_ate is null;

do $$
declare n int; faltando text;
begin
  -- 1. as quatro entraram
  select count(*) into n from public.price_tables
   where codigo = 'nordeste_norte' and vigente_ate is null
     and ufs @> array['MT','MS','GO','DF'];
  if n <> 1 then
    raise exception 'ABORTADO: o Centro-Oeste nao entrou na tabela do Norte';
  end if;

  -- 2. nenhuma UF em duas tabelas vigentes ao mesmo tempo. Se estivesse,
  --    tabela_de_preco_do_cliente() escolheria uma das duas no silencio, e o
  --    preco do cliente dependeria da ordem das linhas no banco.
  --    SP e a excecao legitima: duas tabelas, separadas pelo Simples.
  select string_agg(u, ', ') into faltando from (
    select u
      from (select unnest(ufs) u, simples from public.price_tables where vigente_ate is null) x
     where simples is null
     group by u having count(*) > 1
  ) repetidas;
  if faltando is not null then
    raise exception 'ABORTADO: UF em mais de uma tabela geral: %', faltando;
  end if;

  -- 3. e agora o Brasil inteiro tem tabela. Esta trava e o ponto da migration:
  --    o buraco do Centro-Oeste so foi visto porque um lead caiu nele.
  select string_agg(uf, ', ' order by uf) into faltando
    from unnest(array['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
                      'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']) uf
   where not exists (select 1 from public.price_tables t
                      where t.vigente_ate is null and uf = any (t.ufs));
  if faltando is not null then
    raise exception 'ABORTADO: ainda sem tabela de preco: %', faltando;
  end if;

  -- 4. e a funcao responde de verdade para as quatro
  select string_agg(uf, ', ' order by uf) into faltando
    from unnest(array['MT','MS','GO','DF']) uf
   where public.tabela_de_preco_do_cliente(uf, false) is null
      or public.tabela_de_preco_do_cliente(uf, true) is null;
  if faltando is not null then
    raise exception 'ABORTADO: tabela_de_preco_do_cliente ainda devolve nulo para: %', faltando;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
