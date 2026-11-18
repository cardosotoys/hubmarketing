/* Cadência da Black Varejo (live ter 24/11, 10h). Textos do canal e marcos de cada dia.
   O prazo de 48h dos pedidos só aparece a partir do fim da live (M6). */
export type QuemCad = 'canal' | 'rep' | 'eq';
export type ItemCad = { h: string; quem: QuemCad; o: string; msg?: string; camp?: string };
export type DiaCad = { dia: string; data: string; iso: string; tag: string; itens: ItemCad[] };

export const QUEM_CAD: Record<QuemCad, string> = { canal: 'Canal', rep: 'Representantes', eq: 'Equipe' };

/** mensagens do canal do WhatsApp. {live} e {pedido} são trocados pelos links. */
export const MSG_CANAL: Record<string, { t: string; txt: string }> = {
  M3: { t: 'Boas-vindas', txt: `Boas-vindas à *Black Cardoso*!

Funciona assim:
1. Terça, 24/11, às 10h, live com os produtos da Black.
2. O pedido é feito por um link exclusivo, com o CNPJ da sua loja.
3. Caixa fechada e estoque limitado: quem coloca no carrinho primeiro garante.

Até lá, é por aqui que chegam os destaques e o link da live. Ative as notificações.` },
  M5: { t: 'Dia D', txt: `*É hoje, às 10h!*

Live: {live}
Pedidos: {pedido}

Entre com o CNPJ da loja e deixe o login feito antes de começar. Caixa fechada e estoque limitado: quem coloca no carrinho primeiro garante.` },
  M6: { t: 'Fim da live: pedidos abertos por 48h', txt: `*Obrigado por estar na live!*

Os pedidos da Black ficam abertos por *48 horas*, até *quinta-feira, 26/11, às 10h*.

Faça o seu pelo link, com o CNPJ da loja:
{pedido}

Caixa fechada e estoque limitado: o que está no carrinho fica reservado para você.` },
  M8: { t: 'Últimas horas', txt: `*Últimas horas da Black Cardoso.*

Os pedidos encerram hoje, *às 10h*. Depois disso, o link fecha e as condições da Black deixam de valer.

{pedido}` },
  M9: { t: 'Agradecimento', txt: `*Obrigado por fazer parte da Black Cardoso!*

Seu pedido já está com o seu representante, que vai confirmar os detalhes com você nos próximos dias.

Até a próxima!` },
};

export const CADENCIA: DiaCad[] = [
  { dia: 'Qua', data: '18/11', iso: '2026-11-18', tag: 'D-6', itens: [
    { h: '9h', quem: 'eq', o: 'Kit enviado aos representantes, cada um com o seu link (aba Links e QR)' },
    { h: '10h', quem: 'rep', o: 'Disparo do convite com o link do pré-cadastro' },
    { h: '17h', quem: 'rep', o: 'Reforço do convite para quem não respondeu' },
    { h: '17h', quem: 'eq', o: 'Relação de inscritos para cada representante (aba Inscritos)' }] },
  { dia: 'Qui', data: '19/11', iso: '2026-11-19', tag: 'D-5', itens: [
    { h: '10h', quem: 'canal', o: 'Canal novo no ar: boas-vindas e como vai funcionar', msg: 'M3' },
    { h: '15h', quem: 'canal', o: 'Teaser 1: linha em destaque (foto ou vídeo, sem preço)' },
    { h: '15h', quem: 'rep', o: 'Convite para quem ainda não se cadastrou' },
    { h: '15h', quem: 'eq', o: 'Aprovação dos cadastros em análise (aba Inscritos)' }] },
  { dia: 'Sex', data: '20/11', iso: '2026-11-20', tag: 'D-4', itens: [
    { h: '10h', quem: 'canal', o: 'Regras do pedido: caixa fechada, mínimo e frete' },
    { h: '10h', quem: 'eq', o: 'Relação de inscritos por representante' },
    { h: '16h', quem: 'canal', o: 'Teaser 2: licenciados (sem preço)' },
    { h: '16h', quem: 'rep', o: 'Segunda onda de convite' }] },
  { dia: 'Sáb', data: '21/11', iso: '2026-11-21', tag: 'D-3', itens: [
    { h: '10h', quem: 'canal', o: 'Teaser 3: o brinquedo mais vendido da primeira Black' }] },
  { dia: 'Seg', data: '23/11', iso: '2026-11-23', tag: 'D-1', itens: [
    { h: '10h', quem: 'canal', o: '"É amanhã às 10h" e como entrar (CNPJ e senha)' },
    { h: '10h', quem: 'eq', o: 'Lembrete individual para cada aprovado', camp: 'vespera' },
    { h: '18h', quem: 'eq', o: 'Pré-cadastro encerrado' },
    { h: '18h', quem: 'canal', o: 'Passo a passo do acesso (vídeo ou prints)' }] },
  { dia: 'Ter', data: '24/11', iso: '2026-11-24', tag: 'Dia D', itens: [
    { h: '8h', quem: 'canal', o: '"Hoje às 10h" com os links da live e do pedido', msg: 'M5' },
    { h: '8h', quem: 'eq', o: 'Mensagem individual com os links para cada aprovado', camp: 'live' },
    { h: '10h', quem: 'canal', o: 'Live no ar; pedidos abertos' },
    { h: 'Fim', quem: 'canal', o: 'Anúncio do prazo: pedidos abertos por 48h, até quinta às 10h', msg: 'M6' },
    { h: '15h', quem: 'eq', o: 'Contato com quem tem carrinho parado', camp: 'abandonado' }] },
  { dia: 'Qua', data: '25/11', iso: '2026-11-25', tag: 'D+1', itens: [
    { h: '10h', quem: 'canal', o: 'Destaques: produtos que estão acabando' },
    { h: '10h', quem: 'eq', o: 'Chamar quem ainda não comprou', camp: 'semcompra' },
    { h: '17h', quem: 'eq', o: 'Relação de pedidos e carrinhos por representante' }] },
  { dia: 'Qui', data: '26/11', iso: '2026-11-26', tag: 'D+2', itens: [
    { h: '8h', quem: 'canal', o: 'Últimas horas: pedidos encerram às 10h', msg: 'M8' },
    { h: '8h', quem: 'eq', o: 'Última chamada para carrinhos parados', camp: 'andamento' },
    { h: '10h', quem: 'eq', o: 'Pedidos encerrados; PDF de cada pedido aos representantes' },
    { h: '14h', quem: 'canal', o: 'Agradecimento no canal', msg: 'M9' },
    { h: '14h', quem: 'eq', o: 'Agradecimento individual para quem comprou', camp: 'comprou' }] },
  { dia: 'Sex', data: '27/11', iso: '2026-11-27', tag: 'D+3', itens: [
    { h: '10h', quem: 'rep', o: 'Confirma o pedido com o cliente e lança no Pdex' },
    { h: '10h', quem: 'eq', o: 'Relatório final para a diretoria' }] },
];
