// Relatório da Black Cardoso para a diretoria: uma página HTML interativa e independente
// (abre em tela cheia ou é baixada como arquivo). Os dados entram embutidos na página no momento em que é gerada.

export type DadosRelatorio = {
  geradoEm: string; abreEm: string; fechaEm: string; minimo: number; ipiPct: number;
  produtos: { c: string; n: string; fam: string; img: string; caixa: number; preco: number; cota: number | null; cx: number; pc: number; valor: number; lojas: number; qr: number; carCx: number }[];
  pedidos: { n: string; em: string; loja: string; cid: string; uf: string; rep: string; cx: number; pc: number; val: number; ipi: number; v: number; st: string; itens: number }[];
  reps: { rep: string; ins: number; comp: number; ped: number; val: number; car: number; carVal: number; sem: number }[];
  funil: { ins: number; aprov: number; entraram: number; carrinho: number; compraram: number; loginFalhou: number; fichas: number };
  carros: { loja: string; rep: string; cid: string; uf: string; val: number; cx: number; itens: [string, string, number][]; visto: string }[];
};

const BASE = 'https://cardoso-marketing.vercel.app';

export function gerarRelatorio(d: DadosRelatorio): string {
  const json = JSON.stringify(d).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Black Cardoso · Resultado</title>
<style>
@font-face{font-family:'Figtree';src:url('${BASE}/black/fonts/figtree.woff2') format('woff2');font-weight:300 900;font-display:swap}
:root{--red:#DA3A2F;--red2:#B8281F;--ink:#141416;--ink2:#4E5157;--ink3:#8A8D92;--line:#E7E4E0;--off:#FAF8F6;--soft:#FDECEA;--blk:#0E0E10;--blk2:#1E1E22;--gold:#F2B84B;--teal:#1F7F88;--hb:64px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:'Figtree',system-ui,sans-serif;color:var(--ink);background:#fff}
h1,h2,h3{margin:0;font-weight:900;letter-spacing:-.02em}p{margin:0}button,input,select{font:inherit}
#top{position:fixed;inset:0 0 auto 0;height:var(--hb);background:var(--blk);color:#fff;display:flex;align-items:center;gap:18px;padding:0 22px;z-index:50;box-shadow:0 2px 14px rgba(0,0,0,.25)}
#top img{height:40px}#top b{font-weight:900;font-size:17px;white-space:nowrap}
#tabs{display:flex;gap:4px;margin-left:auto;overflow-x:auto;scrollbar-width:none}#tabs::-webkit-scrollbar{display:none}
#tabs button{border:0;background:transparent;color:rgba(255,255,255,.72);padding:9px 15px;border-radius:999px;font-weight:700;font-size:14px;white-space:nowrap;cursor:pointer}
#tabs button:hover{color:#fff;background:rgba(255,255,255,.08)}#tabs button.on{background:var(--red);color:#fff}
.view{display:none;padding:calc(var(--hb) + 26px) 0 60px}.view.on{display:block}
.wrap{max-width:1200px;margin:0 auto;padding:0 28px}
.hero{background:var(--blk);color:#fff;border-radius:22px;padding:40px 44px;position:relative;overflow:hidden}
.hero:after{content:'';position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(218,58,47,.55),transparent 65%)}
.hero .st{display:inline-flex;gap:8px;align-items:center;background:rgba(255,255,255,.08);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:700}
.hero .st i{width:9px;height:9px;border-radius:50%;background:var(--gold)}.hero .st.fim i{background:#3DDC84}
.hero h1{font-size:clamp(34px,5vw,62px);line-height:1;margin:18px 0 12px;position:relative;z-index:1}.hero h1 em{font-style:normal;color:var(--red)}
.hero p{font-size:17px;opacity:.85;max-width:720px;position:relative;z-index:1}
.big{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:22px}
.k{background:var(--off);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.k small{display:block;font-size:11px;letter-spacing:.8px;text-transform:uppercase;font-weight:800;color:var(--ink2)}
.k b{display:block;font-size:30px;font-weight:900;margin-top:4px;letter-spacing:-.02em}.k span{font-size:13px;color:var(--ink3)}
.k.r{background:var(--red);border-color:var(--red);color:#fff}.k.r small,.k.r span{color:#FFE1DE}
.k.b{background:var(--blk);border-color:var(--blk);color:#fff}.k.b small,.k.b span{color:#C9C9CF}
.sec{margin-top:34px}.sec h2{font-size:26px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.sec h2 small{font-size:14px;color:var(--ink3);font-weight:600;letter-spacing:0}
.sec>p.d{color:var(--ink2);margin-top:4px;font-size:15px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:14px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}
.card{border:1px solid var(--line);border-radius:18px;padding:18px 20px;background:#fff}
.champ{display:flex;gap:14px;align-items:center;border-radius:18px;padding:16px;background:var(--blk);color:#fff}
.champ.r{background:var(--red)}.champ img{width:76px;height:76px;object-fit:contain;background:#fff;border-radius:12px;flex:none}
.champ small{font-size:11px;letter-spacing:.8px;text-transform:uppercase;font-weight:800;opacity:.75}.champ b{display:block;font-size:17px;line-height:1.15;margin:3px 0}.champ span{font-size:13.5px;opacity:.9}
.funil{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:14px}
.fs{position:relative;border-radius:16px;padding:16px;background:var(--off);border:1px solid var(--line);overflow:hidden}
.fs .bar{position:absolute;left:0;bottom:0;height:6px;background:var(--red)}
.fs small{font-size:11px;letter-spacing:.7px;text-transform:uppercase;font-weight:800;color:var(--ink2)}.fs b{display:block;font-size:30px;font-weight:900}.fs em{font-style:normal;font-size:13px;color:var(--red);font-weight:800}
.hb{display:grid;gap:7px;margin-top:12px}.hb .row{display:grid;grid-template-columns:minmax(120px,240px) 1fr auto;gap:10px;align-items:center;font-size:13.5px}
.hb .row .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hb .tr{height:14px;background:#F1EEEA;border-radius:99px;overflow:hidden}.hb .tr i{display:block;height:100%;background:var(--red);border-radius:99px}
.hb .row.k2 .tr i{background:var(--blk)}.hb .v{font-weight:800;white-space:nowrap;min-width:90px;text-align:right}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 10px;align-items:center}
.tools input,.tools select{border:1.5px solid var(--line);border-radius:999px;padding:9px 14px;background:#fff;min-width:200px}
.pill{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13.5px}.pill.on{background:var(--blk);color:#fff;border-color:var(--blk)}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:14px}
thead th{position:sticky;top:var(--hb);background:var(--red);color:#fff;text-align:left;font-size:11px;letter-spacing:.7px;text-transform:uppercase;padding:10px 10px;font-weight:800;cursor:pointer;white-space:nowrap;z-index:2}
thead th:first-child{border-radius:10px 0 0 10px}thead th:last-child{border-radius:0 10px 10px 0}thead th.s:after{content:' ▾'}thead th.s.up:after{content:' ▴'}
td{padding:9px 10px;border-bottom:1px solid #F0EDE9;vertical-align:middle}tbody tr:hover td{background:#FFF7F6}td.r,th.r{text-align:right}
td.p{display:flex;gap:10px;align-items:center}td.p img{width:38px;height:38px;object-fit:contain;border-radius:8px;border:1px solid #EFECE8;background:#fff;flex:none}
td small{display:block;color:var(--ink3);font-size:12px}.tg{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;margin-left:6px;vertical-align:1px}
.tg.esg{background:var(--blk);color:#fff}.tg.zero{background:var(--soft);color:var(--red2)}.tg.alt{background:var(--gold);color:var(--ink)}
.pb{display:inline-block;width:70px;height:8px;background:#F1EEEA;border-radius:99px;overflow:hidden;vertical-align:middle;margin-right:7px}.pb i{display:block;height:100%;background:var(--red)}
.tbl{border-radius:12px}@media(max-width:900px){.tbl{overflow-x:auto}thead th{position:static}}
.cols{display:flex;align-items:flex-end;gap:6px;height:180px;margin-top:16px;padding-bottom:22px;position:relative}
.cols div{flex:1;background:var(--red);border-radius:8px 8px 3px 3px;position:relative;min-height:3px}.cols div span{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:11px;color:var(--ink3);white-space:nowrap}
.cols div b{position:absolute;top:-19px;left:50%;transform:translateX(-50%);font-size:11.5px}
.jor{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:14px}.jor div{border-radius:16px;padding:14px;background:var(--off);border:1px solid var(--line);position:relative}
.jor div b{display:block;font-size:12px;letter-spacing:.7px;text-transform:uppercase;color:var(--red);font-weight:900}.jor div span{display:block;font-weight:800;margin:4px 0 3px;font-size:15px}.jor div p{font-size:13px;color:var(--ink2)}
.feat{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}.feat div{border-radius:16px;padding:16px 18px;border:1px solid var(--line)}.feat div b{display:block;font-size:16px;margin-bottom:4px}.feat div p{font-size:14px;color:var(--ink2)}
.lst{display:grid;gap:10px;margin-top:14px}.lst div{display:flex;gap:12px;align-items:flex-start;border-radius:14px;padding:14px 16px;background:var(--off);border:1px solid var(--line)}.lst div i{flex:none;width:28px;height:28px;border-radius:50%;background:var(--red);color:#fff;font-style:normal;font-weight:900;display:grid;place-items:center}.lst div b{display:block}.lst div p{font-size:14px;color:var(--ink2)}
@media(max-width:900px){.jor{grid-template-columns:1fr 1fr}.feat{grid-template-columns:1fr}}
.nota{font-size:12.5px;color:var(--ink3);margin-top:10px}
.foot{text-align:center;color:var(--ink3);font-size:12.5px;margin-top:40px}
@media(max-width:900px){.big,.grid3,.funil{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}#top b{display:none}}
@media print{#top{position:static}.view{display:block;padding-top:20px;page-break-before:always}thead th{position:static}}
</style></head><body>
<header id="top"><img src="${BASE}/black/selo-black.webp" alt="Black Cardoso"><b>Resultado da Black Cardoso</b><nav id="tabs"></nav></header>
<main id="app"></main>
<script>
const D=${json};
const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const brl0=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const n0=v=>Number(v||0).toLocaleString('pt-BR');const pct=v=>(isFinite(v)?v:0).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dh=s=>new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const img=u=>u?'<img src="'+esc(u)+'" alt="" loading="lazy">':'<img alt="">';
const P=D.produtos, PE=D.pedidos, F=D.funil;
const tot=PE.reduce((t,p)=>t+p.val,0), totIpi=PE.reduce((t,p)=>t+p.val+p.ipi,0), cx=PE.reduce((t,p)=>t+p.cx,0), pc=PE.reduce((t,p)=>t+p.pc,0);
const cota=P.reduce((t,p)=>t+(p.cota||0),0), cotaPc=P.reduce((t,p)=>t+(p.cota||0)*p.caixa,0);
const lojas=new Set(PE.map(p=>p.loja)).size; const fim=new Date(D.geradoEm)>=new Date(D.fechaEm);
const esg=P.filter(p=>p.cota&&p.cx>=p.cota), zero=P.filter(p=>!p.cx);
const carVal=D.carros.reduce((t,c)=>t+c.val,0);
const by=(a,k)=>[...a].sort((x,y)=>y[k]-x[k]);
const VIEWS=[['projeto','O projeto'],['geral','Resultado'],['produtos','Produtos'],['linhas','Linhas'],['reps','Representantes'],['pedidos','Pedidos'],['carrinhos','Carrinhos não enviados'],['engaj','Engajamento']];
document.getElementById('tabs').innerHTML=VIEWS.map(v=>'<button data-v="'+v[0]+'">'+v[1]+'</button>').join('');
document.getElementById('tabs').onclick=e=>{const b=e.target.closest('button');if(b)ir(b.dataset.v)};
function ir(v){document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x.dataset.v===v));scrollTo(0,0);try{history.replaceState(null,'','#'+v)}catch(e){}}
function hbars(list,lab,val,fmt,cls){const m=Math.max(1,...list.map(val));return '<div class="hb">'+list.map(x=>'<div class="row '+(cls||'')+'"><span class="n" title="'+esc(lab(x))+'">'+esc(lab(x))+'</span><span class="tr"><i style="width:'+(val(x)/m*100).toFixed(1)+'%"></i></span><span class="v">'+fmt(val(x))+'</span></div>').join('')+'</div>'}
function champ(t,p,l,cls){return p?'<div class="champ '+(cls||'')+'">'+img(p.img)+'<div><small>'+t+'</small><b>'+esc(p.c)+' · '+esc(p.n)+'</b><span>'+l+'</span></div></div>':''}
const status='<span class="st '+(fim?'fim':'')+'"><i></i>'+(fim?'Pedidos encerrados · resultado final de '+dh(D.fechaEm):'Resultado parcial · posição de '+dh(D.geradoEm))+'</span>';
let H='';
/* o projeto */
H+='<section class="view" id="v-projeto"><div class="wrap"><div class="hero">'+status+'<h1>Black Cardoso <em>2026</em></h1><p>A primeira Black Friday da Cardoso Toys feita só para lojas que vendem online: e-commerce próprio e marketplaces. Uma live de lançamento, uma vitrine exclusiva com preços Black e pedidos direto pelo link, com o representante de cada loja no circuito.</p></div>'
+'<div class="big"><div class="k r"><small>Vendido em produtos</small><b>'+brl0(tot)+'</b><span>com IPI: '+brl0(totIpi)+'</span></div><div class="k b"><small>Lojas que compraram</small><b>'+n0(lojas)+'</b><span>de '+n0(F.aprov)+' aprovadas</span></div><div class="k"><small>Pedidos</small><b>'+n0(PE.length)+'</b><span>ticket médio '+brl0(tot/Math.max(1,PE.length))+'</span></div><div class="k"><small>Produtos na Black</small><b>'+P.length+'</b><span>'+(P.length-zero.length)+' venderam</span></div></div>'
+'<div class="sec"><h2>O objetivo</h2><div class="grid3"><div class="card"><h3>Ativar o canal online</h3><p class="d" style="margin-top:6px">Levar a linha Cardoso para mais lojas de e-commerce e marketplace, com condição especial e material pronto para anunciar.</p></div><div class="card"><h3>Girar estoque com margem</h3><p class="d" style="margin-top:6px">Vender por caixa fechada, com pagamento antecipado e pedido mínimo, sem mexer na tabela do canal tradicional.</p></div><div class="card"><h3>Medir tudo</h3><p class="d" style="margin-top:6px">Do cadastro ao pedido, cada etapa registrada: quem entrou, o que viu, o que pôs no carrinho e o que comprou.</p></div></div></div>'
+'<div class="sec"><h2>Como funcionou</h2><div class="jor">'
+[['1','Pré-cadastro','Link por representante; CNPJ checado e cruzado com a carteira.'],['2','Aprovação','A equipe aprovou '+n0(F.aprov)+' de '+n0(F.ins)+' lojas inscritas.'],['3','Convite','Mensagem de WhatsApp com o link da live e do pedido.'],['4','Live','12/11 às 16h, com QR de cada produto levando à ficha com fotos e vídeos.'],['5','Pedidos','Pelo link, de 12/11 16h a '+dh(D.fechaEm)+', com estoque reservado no carrinho.'],['6','Representante','Pedido em PDF no padrão Black para lançar no sistema.']].map(x=>'<div><b>Etapa '+x[0]+'</b><span>'+x[1]+'</span><p>'+x[2]+'</p></div>').join('')+'</div></div>'
+'<div class="sec"><h2>O que foi construído</h2><p class="d">Tudo dentro do Hub da Cardoso, integrado à carteira, aos produtos e ao Drive.</p><div class="feat">'
+[['Vitrine e pedido','Catálogo com '+P.length+' produtos, preço Black, pedido mínimo de '+brl0(D.minimo)+', IPI de '+String(D.ipiPct).replace('.',',')+'% no fechamento e limite para a Totokinha.'],['Estoque em tempo real','A caixa no carrinho sai do estoque de todos na hora; carrinho parado devolve. Ninguém vende o que não tem.'],['Ficha do produto pelo QR','Fotos e vídeos de cada produto, no padrão de governança do Drive, para a loja usar nos anúncios.'],['Alteração e pedido manual','Cliente altera o pedido até o fechamento; a equipe faz pedido pelo cliente e libera pedidos depois do horário.'],['Comunicação','Mensagens por situação: convite, carrinho abandonado, em andamento, sem compra e agradecimento.'],['Relatórios','Relação por representante, PDF de cada pedido, filtros e este relatório, que atualiza sozinho.']].map(x=>'<div><b>'+x[0]+'</b><p>'+x[1]+'</p></div>').join('')+'</div></div>'
+'<div class="sec"><h2>O que aprendemos</h2><div class="lst">'
+[['Senha é a maior barreira','Foram '+n0(F.loginFalhou)+' tentativas de entrar com senha errada. Na próxima, entrar por link enviado no WhatsApp, sem senha.'],['Carrinho parado é venda na mesa',D.carros.length+' lojas deixaram '+brl0(carVal)+' no carrinho sem enviar. Lembrete automático e o representante ligando durante a live recuperam parte disso.'],['WhatsApp em massa tem limite','Disparar muitas mensagens iguais pelo WhatsApp pessoal bloqueou a conta por 24h. Para escala, usar a API oficial do WhatsApp Business.'],['Prazo curto concentra a venda','Veja na aba Pedidos o valor por hora: a janela logo depois da live é a mais forte, e o prazo até o dia seguinte serve para recuperar carrinhos.'],['Representante no circuito','A relação por representante, com carrinhos parados em destaque, deve sair durante a live, não só no fim, para o contato acontecer enquanto o estoque ainda está disponível.']].map((x,i)=>'<div><i>'+(i+1)+'</i><span><b>'+x[0]+'</b><p>'+x[1]+'</p></span></div>').join('')+'</div></div>'
+'<div class="sec"><h2>Próximos passos</h2><div class="lst">'
+[['Retomar os carrinhos não enviados','Representantes contatam as '+D.carros.length+' lojas com carrinho parado e as '+n0(D.reps.reduce((t,r)=>t+r.sem,0))+' aprovadas que não compraram.'],['Lançar os pedidos e acompanhar a entrega','Confirmar no sistema e medir a recompra dessas lojas em 60 e 90 dias.'],['Repetir o formato','Próximas datas: Natal e queima de estoque, com login sem senha, lembrete automático e WhatsApp oficial.']].map((x,i)=>'<div><i>'+(i+1)+'</i><span><b>'+x[0]+'</b><p>'+x[1]+'</p></span></div>').join('')+'</div></div></div></section>';
/* visão geral */
const cV=by(P,'valor')[0],cC=by(P,'pc')[0],cL=by(P,'lojas')[0],cQ=by(P,'qr')[0];
H+='<section class="view" id="v-geral"><div class="wrap"><div class="hero">'+status+'<h1>'+brl0(tot)+' <em>em '+n0(PE.length)+' pedidos</em></h1><p>Primeira Black da Cardoso feita só para lojas de e-commerce e marketplace: live de lançamento em 12/11 às 16h e pedidos pelo link até '+dh(D.fechaEm)+'. Valores em produtos (preços líquidos), sem IPI.</p></div>'
+'<div class="big"><div class="k r"><small>Vendido em produtos</small><b>'+brl0(tot)+'</b><span>com IPI: '+brl0(totIpi)+'</span></div><div class="k b"><small>Pedidos</small><b>'+n0(PE.length)+'</b><span>'+n0(lojas)+' lojas compraram</span></div><div class="k"><small>Ticket médio</small><b>'+brl0(tot/Math.max(1,PE.length))+'</b><span>por pedido, sem IPI</span></div><div class="k"><small>Conversão</small><b>'+pct(F.compraram/Math.max(1,F.aprov)*100)+'</b><span>das lojas aprovadas compraram</span></div>'
+'<div class="k"><small>Caixas vendidas</small><b>'+n0(cx)+'</b><span>'+pct(cx/Math.max(1,cota)*100)+' da cota da Black</span></div><div class="k"><small>Peças vendidas</small><b>'+n0(pc)+'</b><span>de '+n0(cotaPc)+' peças na Black</span></div><div class="k"><small>Produtos vendidos</small><b>'+(P.length-zero.length)+' de '+P.length+'</b><span>'+esg.length+' esgotados · '+zero.length+' sem venda</span></div><div class="k"><small>Carrinhos não enviados</small><b>'+brl0(carVal)+'</b><span>'+D.carros.length+' lojas pararam no carrinho</span></div></div>'
+'<div class="sec"><h2>Campeões</h2><div class="grid2">'+champ('Campeão em valor',cV,brl(cV&&cV.valor)+' · '+pct(cV?cV.valor/Math.max(1,tot)*100:0)+' do total','r')+champ('Campeão em peças',cC,n0(cC&&cC.pc)+' peças · '+n0(cC&&cC.cx)+' caixas')+champ('Comprado por mais lojas',cL,(cL&&cL.lojas)+' lojas')+champ('Mais visto no QR da live',cQ,(cQ&&cQ.qr)+' aberturas da ficha')+'</div></div>'
+'<div class="sec"><h2>Do cadastro à compra <small>lojas em cada etapa</small></h2><div class="funil">'+[['Inscritas',F.ins],['Aprovadas',F.aprov],['Entraram na página',F.entraram],['Montaram carrinho',F.carrinho],['Compraram',F.compraram]].map((x,i,a)=>'<div class="fs"><small>'+x[0]+'</small><b>'+n0(x[1])+'</b><em>'+(i?pct(x[1]/Math.max(1,a[i-1][1])*100)+' da etapa anterior':'&nbsp;')+'</em><span class="bar" style="width:'+(x[1]/Math.max(1,F.ins)*100)+'%"></span></div>').join('')+'</div><p class="nota">'+n0(F.loginFalhou)+' tentativas de entrar com senha errada. '+n0(F.fichas)+' aberturas de ficha de produto pelo QR e pelo link.</p></div>'
+'<div class="sec"><div class="grid2"><div class="card"><h3>Top 10 produtos em valor</h3>'+hbars(by(P,'valor').slice(0,10),x=>x.c+' · '+x.n,x=>x.valor,brl0)+'</div><div class="card"><h3>Valor por linha</h3>'+hbars(linhas(),x=>x.fam,x=>x.valor,brl0,'k2')+'</div></div></div></div></section>';
function linhas(){const m={};P.forEach(p=>{const a=m[p.fam]=m[p.fam]||{fam:p.fam,n:0,cota:0,cx:0,pc:0,valor:0,lojas:0};a.n++;a.cota+=p.cota||0;a.cx+=p.cx;a.pc+=p.pc;a.valor+=p.valor});return Object.values(m).sort((a,b)=>b.valor-a.valor)}
/* produtos */
const fams=[...new Set(P.map(p=>p.fam))];
H+='<section class="view" id="v-produtos"><div class="wrap"><div class="sec" style="margin-top:0"><h2>Estoque e venda por produto <small>'+P.length+' produtos na Black</small></h2><p class="d">Tinha = cota da Black. Vendeu = pedidos enviados. Sobrou = tinha − vendeu. Clique no título da coluna para ordenar.</p>'
+'<div class="tools"><input id="pq" placeholder="Buscar produto ou código"><select id="pf"><option value="">Todas as linhas</option>'+fams.map(f=>'<option>'+esc(f)+'</option>').join('')+'</select><button class="pill" data-pf="esg">Esgotados ('+esg.length+')</button><button class="pill" data-pf="zero">Sem venda ('+zero.length+')</button></div>'
+'<div class="tbl"><table id="tp"><thead><tr><th data-k="c">Produto</th><th class="r" data-k="preco">Preço/pç</th><th class="r" data-k="cota">Tinha cx</th><th class="r" data-k="cx">Vendeu cx</th><th class="r" data-k="pc">Vendeu pç</th><th class="r" data-k="sobra">Sobrou cx</th><th class="r" data-k="pv">% vendido</th><th class="r s" data-k="valor">Valor</th><th class="r" data-k="lojas">Lojas</th><th class="r" data-k="qr">QR</th></tr></thead><tbody></tbody></table></div></div></div></section>';
/* linhas */
H+='<section class="view" id="v-linhas"><div class="wrap"><div class="sec" style="margin-top:0"><h2>Resultado por linha</h2><div class="grid2"><div class="card"><h3>Valor vendido</h3>'+hbars(linhas(),x=>x.fam,x=>x.valor,brl0)+'</div><div class="card"><h3>% da cota vendida</h3>'+hbars(linhas(),x=>x.fam,x=>x.cota?x.cx/x.cota*100:0,pct,'k2')+'</div></div>'
+'<div class="tbl" style="margin-top:18px"><table><thead><tr><th>Linha</th><th class="r">Produtos</th><th class="r">Tinha cx</th><th class="r">Vendeu cx</th><th class="r">Peças</th><th class="r">% vendido</th><th class="r">Valor</th></tr></thead><tbody>'+linhas().map(a=>'<tr><td><b>'+esc(a.fam)+'</b></td><td class="r">'+a.n+'</td><td class="r">'+n0(a.cota)+'</td><td class="r">'+n0(a.cx)+'</td><td class="r">'+n0(a.pc)+'</td><td class="r">'+pct(a.cota?a.cx/a.cota*100:0)+'</td><td class="r"><b>'+brl(a.valor)+'</b></td></tr>').join('')+'</tbody></table></div></div></div></section>';
/* representantes */
const R=by(D.reps,'val');
H+='<section class="view" id="v-reps"><div class="wrap"><div class="sec" style="margin-top:0"><h2>Representantes <small>'+R.length+' com lojas inscritas</small></h2><div class="grid2"><div class="card"><h3>Valor vendido</h3>'+hbars(R.filter(r=>r.val).slice(0,12),x=>x.rep,x=>x.val,brl0)+'</div><div class="card"><h3>Lojas inscritas × que compraram</h3>'+hbars(by(D.reps,'ins').slice(0,12),x=>x.rep+' · '+x.comp+' compraram',x=>x.ins,n0,'k2')+'</div></div>'
+'<div class="tbl" style="margin-top:18px"><table><thead><tr><th>Representante</th><th class="r">Inscritas</th><th class="r">Compraram</th><th class="r">Conversão</th><th class="r">Pedidos</th><th class="r">Valor</th><th class="r">Carrinhos parados</th><th class="r">Sem compra</th></tr></thead><tbody>'+R.map(r=>'<tr><td><b>'+esc(r.rep)+'</b></td><td class="r">'+r.ins+'</td><td class="r">'+r.comp+'</td><td class="r">'+pct(r.comp/Math.max(1,r.ins)*100)+'</td><td class="r">'+r.ped+'</td><td class="r"><b>'+(r.val?brl(r.val):'—')+'</b></td><td class="r">'+(r.car?r.car+' · '+brl0(r.carVal):'—')+'</td><td class="r">'+r.sem+'</td></tr>').join('')+'</tbody></table></div></div></div></section>';
/* pedidos */
const hrs={};PE.forEach(p=>{const d=new Date(p.em);const k=d.toLocaleDateString('pt-BR',{day:'2-digit'})+'/'+String(d.getHours()).padStart(2,'0')+'h';hrs[k]=(hrs[k]||0)+p.val});
const hk=Object.keys(hrs);const hm=Math.max(1,...Object.values(hrs));
const ufs={};PE.forEach(p=>{ufs[p.uf]=(ufs[p.uf]||0)+p.val});
H+='<section class="view" id="v-pedidos"><div class="wrap"><div class="sec" style="margin-top:0"><h2>Pedidos <small>'+PE.length+' · '+brl(tot)+' sem IPI</small></h2><div class="grid2"><div class="card"><h3>Valor por hora em que o pedido entrou</h3><div class="cols">'+hk.map(k=>'<div style="height:'+(hrs[k]/hm*100)+'%"><b>'+(hrs[k]/1000).toLocaleString('pt-BR',{maximumFractionDigits:0})+'k</b><span>'+k+'</span></div>').join('')+'</div></div><div class="card"><h3>Valor por estado</h3>'+hbars(Object.entries(ufs).sort((a,b)=>b[1]-a[1]).map(([u,v])=>({u,v})),x=>x.u,x=>x.v,brl0,'k2')+'</div></div>'
+'<div class="tbl" style="margin-top:18px"><table><thead><tr><th>Pedido</th><th>Loja</th><th>Cidade/UF</th><th>Representante</th><th class="r">Itens</th><th class="r">Caixas</th><th class="r">Peças</th><th class="r">Valor</th><th class="r">c/ IPI</th></tr></thead><tbody>'+PE.map(p=>'<tr><td><b>'+esc(p.n)+'</b>'+(p.v>1?'<span class="tg alt">alterado v'+p.v+'</span>':'')+'<small>'+dh(p.em)+'</small></td><td><b>'+esc(p.loja)+'</b></td><td>'+(p.cid?esc(p.cid)+'/':'')+esc(p.uf)+'</td><td>'+esc(p.rep)+'</td><td class="r">'+(p.itens||'—')+'</td><td class="r">'+n0(p.cx)+'</td><td class="r">'+n0(p.pc)+'</td><td class="r"><b>'+brl(p.val)+'</b></td><td class="r">'+brl(p.val+p.ipi)+'</td></tr>').join('')+'</tbody></table></div></div></div></section>';
/* carrinhos */
H+='<section class="view" id="v-carrinhos"><div class="wrap"><div class="sec" style="margin-top:0"><h2>Carrinhos não enviados <small>'+D.carros.length+' lojas · '+brl(carVal)+' em produtos</small></h2><p class="d">Lojas que colocaram produtos no carrinho e não enviaram o pedido'+(fim?' até o fechamento. Os carrinhos ficaram congelados às '+dh(D.fechaEm)+'.':'.')+' É a oportunidade para o representante retomar o contato.</p>'
+'<div class="tbl" style="margin-top:14px"><table><thead><tr><th>Loja</th><th>Representante</th><th>No carrinho</th><th class="r">Caixas</th><th class="r">Valor</th><th>Última visita</th></tr></thead><tbody>'+by(D.carros,'val').map(c=>'<tr><td><b>'+esc(c.loja)+'</b><small>'+(c.cid?esc(c.cid)+'/':'')+esc(c.uf)+'</small></td><td>'+esc(c.rep)+'</td><td>'+(c.itens.length&&c.itens[0][1]?c.itens.slice(0,4).map(i=>i[2]+' cx · '+esc(i[1])).join('<br>')+(c.itens.length>4?'<small>+ '+(c.itens.length-4)+' produtos</small>':''):c.itens.length+' produto'+(c.itens.length>1?'s':''))+'</td><td class="r">'+c.cx+'</td><td class="r"><b>'+brl(c.val)+'</b></td><td>'+dh(c.visto)+'</td></tr>').join('')+'</tbody></table></div>'
+'<div class="card" style="margin-top:18px"><h3>Produtos que ficaram nos carrinhos</h3>'+hbars(by(P.filter(p=>p.carCx),'carCx').slice(0,12),x=>x.c+' · '+x.n,x=>x.carCx,v=>n0(v)+' cx')+'</div></div></div></section>';
/* engajamento */
H+='<section class="view" id="v-engaj"><div class="wrap"><div class="sec" style="margin-top:0"><h2>Engajamento</h2><div class="grid3"><div class="k b"><small>Aberturas de ficha</small><b>'+n0(F.fichas)+'</b><span>QR da live e link de pedido</span></div><div class="k"><small>Lojas que entraram</small><b>'+n0(F.entraram)+'</b><span>de '+n0(F.aprov)+' aprovadas</span></div><div class="k r"><small>Senha errada</small><b>'+n0(F.loginFalhou)+'</b><span>tentativas que falharam</span></div></div>'
+'<div class="grid2" style="margin-top:18px"><div class="card"><h3>Produtos mais vistos no QR</h3>'+hbars(by(P,'qr').slice(0,12),x=>x.c+' · '+x.n,x=>x.qr,n0,'k2')+'</div><div class="card"><h3>Mais vistos × vendidos (caixas)</h3>'+hbars(by(P,'qr').slice(0,12),x=>x.c+' · '+n0(x.qr)+' vistas',x=>x.cx,v=>n0(v)+' cx')+'</div></div></div></div></section>';
document.getElementById('app').innerHTML=H+'<p class="foot">Black Cardoso · gerado em '+dh(D.geradoEm)+' · Cardoso Toys</p>';
/* tabela de produtos com busca, filtro e ordem */
let ord='valor',up=false,pf='';
P.forEach(p=>{p.sobra=p.cota==null?null:Math.max(0,p.cota-p.cx);p.pv=p.cota?p.cx/p.cota*100:0});
function tp(){const q=document.getElementById('pq').value.toLowerCase(),f=document.getElementById('pf').value;
 let L=P.filter(p=>(!q||(p.c+' '+p.n).toLowerCase().includes(q))&&(!f||p.fam===f)&&(!pf||(pf==='esg'?(p.cota&&p.cx>=p.cota):!p.cx)));
 L.sort((a,b)=>{const x=a[ord],y=b[ord];const r=typeof x==='string'?String(x).localeCompare(y):(y??-1)-(x??-1);return up?-r:r});
 document.querySelector('#tp tbody').innerHTML=L.map(p=>'<tr><td class="p">'+img(p.img)+'<span><b>'+esc(p.n)+'</b>'+(p.cota&&p.cx>=p.cota?'<span class="tg esg">esgotado</span>':!p.cx?'<span class="tg zero">sem venda</span>':'')+'<small>'+esc(p.c)+' · '+esc(p.fam)+' · caixa com '+p.caixa+'</small></span></td><td class="r">'+brl(p.preco)+'</td><td class="r">'+(p.cota==null?'—':n0(p.cota))+'</td><td class="r"><b>'+n0(p.cx)+'</b></td><td class="r">'+n0(p.pc)+'</td><td class="r">'+(p.sobra==null?'—':n0(p.sobra))+'</td><td class="r"><span class="pb"><i style="width:'+Math.min(100,p.pv)+'%"></i></span>'+pct(p.pv)+'</td><td class="r"><b>'+(p.valor?brl(p.valor):'—')+'</b></td><td class="r">'+(p.lojas||'—')+'</td><td class="r">'+(p.qr||'—')+'</td></tr>').join('');
 document.querySelectorAll('#tp th').forEach(th=>{th.classList.toggle('s',th.dataset.k===ord);th.classList.toggle('up',th.dataset.k===ord&&up)})}
document.querySelector('#tp thead').onclick=e=>{const th=e.target.closest('th');if(!th)return;if(ord===th.dataset.k)up=!up;else{ord=th.dataset.k;up=false}tp()};
document.getElementById('pq').oninput=tp;document.getElementById('pf').onchange=tp;
document.querySelectorAll('[data-pf]').forEach(b=>b.onclick=()=>{pf=pf===b.dataset.pf?'':b.dataset.pf;document.querySelectorAll('[data-pf]').forEach(x=>x.classList.toggle('on',x.dataset.pf===pf));tp()});
tp();ir((location.hash||'#projeto').slice(1)in{projeto:1,geral:1,produtos:1,linhas:1,reps:1,pedidos:1,carrinhos:1,engaj:1}?(location.hash||'#projeto').slice(1):'projeto');
</script></body></html>`;
}
