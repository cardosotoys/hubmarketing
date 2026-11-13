// Espelho dos pedidos da Black para o representante lançar no sistema: abre uma página pronta para
// "Salvar como PDF" (um pedido por folha, no padrão visual da Black).

type P = {
  id: string; numero: string; cnpj: string; razao_social: string; fantasia: string; cidade: string; uf: string;
  representante: string; comprador: string; email: string; celular: string; observacao: string; caixas: number; pecas: number;
  total: number; ipi?: number; total_com_ipi?: number; frete: string; status: string; criado_em: string;
};
type I = { pedido_id: string; codigo: string; nome: string; caixas: number; pecas_caixa: number; preco_peca: number; total: number };
type C = { cnpj: string | null; grupo: string; situacao: string };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const int = (v: number) => Number(v || 0).toLocaleString('pt-BR');
const dig = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const cnpjFmt = (c: string) => dig(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const ST: Record<string, string> = { recebido: 'A confirmar', confirmado: 'Confirmado', cancelado: 'Cancelado' };

const CSS = `
@font-face{font-family:'CB Figtree';src:url('/black/fonts/figtree.woff2') format('woff2');font-weight:300 900}
@page{size:A4;margin:12mm 11mm 14mm}
*{box-sizing:border-box}body{margin:0;font-family:'CB Figtree',Arial,sans-serif;color:#141416;font-size:9.6pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ped{page-break-after:always}.ped:last-child{page-break-after:auto}
.hd{background:#0E0E10;color:#fff;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:14px}
.hd img{height:40px}.hd .t{flex:1}.hd h1{margin:0;font-size:16pt;font-weight:900;letter-spacing:-.2px}.hd p{margin:2px 0 0;font-size:8.5pt;color:#C9C9CF}
.hd .kp{display:flex;gap:6px}.hd .kp div{background:#1E1E22;border-radius:8px;padding:6px 10px;text-align:center;min-width:64px}.hd .kp div.r{background:#DA3A2F}.hd .kp b{display:block;font-size:12.5pt;font-weight:900;white-space:nowrap}.hd .kp small{font-size:6.6pt;letter-spacing:.6px;text-transform:uppercase;color:#E9E9EE}
.rep{margin-top:8px;background:#FFF5F4;border:1px solid #F6D5D2;border-radius:9px;padding:7px 12px;font-size:9.4pt}.rep b{color:#DA3A2F;font-weight:900}
td.im{width:46px;padding:3px 6px}td.im img{width:38px;height:38px;object-fit:contain;border-radius:6px;background:#fff;border:1px solid #EFECE8;display:block}
.hd .st{background:#DA3A2F;border-radius:8px;padding:6px 10px;text-align:right}.hd .st b{display:block;font-size:12pt;font-weight:900}.hd .st small{font-size:7pt;letter-spacing:.6px;text-transform:uppercase}
.g{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:8px;margin:10px 0}
.bx{border:1px solid #E7E4E0;border-radius:10px;padding:8px 11px;background:#FAF8F6}
.bx h3{margin:0 0 5px;font-size:7pt;letter-spacing:.7px;text-transform:uppercase;color:#DA3A2F;font-weight:900}
.bx div{display:flex;gap:6px;font-size:8.8pt;line-height:1.45}.bx div span{color:#6B6E73;min-width:66px}.bx div b{font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:4px}thead{display:table-header-group}tr{page-break-inside:avoid}
th{background:#DA3A2F;color:#fff;font-size:7pt;letter-spacing:.6px;text-transform:uppercase;text-align:left;padding:6px 7px;font-weight:800}
th:first-child{border-radius:7px 0 0 7px}th:last-child{border-radius:0 7px 7px 0}
td{padding:6px 7px;border-bottom:1px solid #EFECE8;font-size:9pt}td.r,th.r{text-align:right}td.c{font-weight:800;white-space:nowrap}
tbody tr:nth-child(even) td{background:#FAF8F6}
.tot{display:flex;justify-content:flex-end;margin-top:8px}.tot div{min-width:270px;border:1px solid #E7E4E0;border-radius:10px;overflow:hidden}
.tot p{margin:0;display:flex;justify-content:space-between;padding:6px 12px;font-size:9.2pt}.tot p.f{background:#0E0E10;color:#fff;font-weight:900;font-size:11pt}
.obs{margin-top:10px;border-left:3px solid #DA3A2F;padding:6px 10px;background:#FFF5F4;border-radius:0 8px 8px 0;font-size:9pt}
.ft{margin-top:10px;font-size:7.6pt;color:#6B6E73;display:flex;justify-content:space-between;gap:10px}
.capa{page-break-after:always}.capa .lista td{font-size:9.2pt}
@media screen{body{background:#EDEAE6;padding:20px}.ped,.capa{background:#fff;max-width:820px;margin:0 auto 20px;padding:18px;border-radius:12px;box-shadow:0 2px 14px rgba(0,0,0,.08)}
.barra{position:sticky;top:0;max-width:820px;margin:0 auto 14px;background:#0E0E10;color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:10px;align-items:center;z-index:2}
.barra button{background:#DA3A2F;color:#fff;border:0;border-radius:99px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer}.barra span{flex:1;font-size:9.5pt}}
@media print{.barra{display:none}}
`;

function folha(p: P, itens: I[], cart: C | undefined, img: Record<string, string>) {
  const ipi = Number(p.ipi ?? 0); const comIpi = Number(p.total_com_ipi ?? Number(p.total) + ipi);
  const linhas = itens.map((i) => `<tr><td class="im">${img[i.codigo] ? `<img src="${esc(img[i.codigo])}" alt="">` : ''}</td><td class="c">${esc(i.codigo)}</td><td><b>${esc(i.nome)}</b></td><td class="r">${int(i.caixas)}</td><td class="r">${int(i.pecas_caixa)}</td><td class="r">${int(i.caixas * i.pecas_caixa)}</td><td class="r">${brl(Number(i.preco_peca))}</td><td class="r"><b>${brl(Number(i.total))}</b></td></tr>`).join('');
  return `<section class="ped">
<div class="hd"><img src="/black/selo-black.webp" alt=""><div class="t"><h1>Pedido ${esc(p.numero)}</h1><p>Black Cardoso · enviado em ${dataHora(p.criado_em)} · ${esc(ST[p.status] ?? p.status)}</p></div>
<div class="kp"><div><b>${int(p.caixas)}</b><small>caixas</small></div><div><b>${int(p.pecas)}</b><small>peças</small></div><div class="r"><b>${brl(comIpi)}</b><small>total c/ IPI</small></div></div></div>
<div class="rep">Representante: <b>${esc(p.representante || '—')}</b> · lançar este pedido no sistema com os preços abaixo</div>
<div class="g">
<div class="bx"><h3>Cliente</h3><div><span>Razão social</span><b>${esc(p.razao_social)}</b></div><div><span>Fantasia</span><b>${esc(p.fantasia || '—')}</b></div><div><span>CNPJ</span><b>${esc(cnpjFmt(p.cnpj))}</b></div><div><span>Cidade/UF</span><b>${esc(p.cidade)}/${esc(p.uf)}</b></div>${cart ? `<div><span>Carteira</span><b>${esc([cart.grupo, cart.situacao].filter(Boolean).join(' · ') || 'na carteira')}</b></div>` : '<div><span>Carteira</span><b>fora da carteira</b></div>'}</div>
<div class="bx"><h3>Contato</h3><div><span>Comprador</span><b>${esc(p.comprador || '—')}</b></div><div><span>WhatsApp</span><b>${esc(p.celular || '—')}</b></div><div><span>E-mail</span><b>${esc(p.email || '—')}</b></div></div>
<div class="bx"><h3>Condições</h3><div><span>Pagamento</span><b>Antecipado</b></div><div><span>Venda</span><b>Caixa fechada</b></div><div><span>Frete</span><b>${esc(p.frete || '—')}</b></div><div><span>IPI</span><b>6,5% sobre o pedido</b></div></div>
</div>
<table><thead><tr><th></th><th>Código</th><th>Produto</th><th class="r">Caixas</th><th class="r">Pç/cx</th><th class="r">Peças</th><th class="r">Preço/pç</th><th class="r">Total</th></tr></thead><tbody>${linhas}</tbody></table>
<div class="tot"><div><p><span>${int(itens.length)} itens · ${int(p.caixas)} caixas · ${int(p.pecas)} peças</span></p><p><span>Produtos (preços líquidos)</span><b>${brl(Number(p.total))}</b></p><p><span>IPI (6,5%)</span><b>${brl(ipi)}</b></p><p class="f"><span>Total do pedido</span><span>${brl(comIpi)}</span></p></div></div>
${p.observacao ? `<div class="obs"><b>Observação do cliente:</b> ${esc(p.observacao)}</div>` : ''}
<div class="ft"><span>Espelho do pedido da Black Cardoso para lançamento no sistema. Preços da Black, já com o desconto.</span><span>${esc(p.numero)}</span></div>
</section>`;
}

/** abre a página com os pedidos (um por folha) para salvar em PDF. Com mais de um pedido, começa com a lista. */
export function abrirEspelhos(peds: P[], itens: I[], carteira: C[], titulo: string, img: Record<string, string> = {}) {
  const porCnpj = new Map(carteira.filter((c) => c.cnpj).map((c) => [dig(c.cnpj), c]));
  const ord = [...peds].sort((a, b) => (a.representante || '').localeCompare(b.representante || '', 'pt-BR') || a.numero.localeCompare(b.numero));
  const capa = ord.length > 1 ? `<section class="capa"><div class="hd"><img src="/black/selo-black.webp" alt=""><div class="t"><h1>${esc(titulo)}</h1><p>Black Cardoso · ${int(ord.length)} pedidos · gerado em ${dataHora(new Date().toISOString())}</p></div>
<div class="st"><small>Total c/ IPI</small><b>${brl(ord.reduce((t, p) => t + Number(p.total_com_ipi ?? Number(p.total) + Number(p.ipi ?? 0)), 0))}</b></div></div>
<table class="lista" style="margin-top:12px"><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>CNPJ</th><th>Representante</th><th class="r">Caixas</th><th class="r">Total c/ IPI</th></tr></thead><tbody>
${ord.map((p) => `<tr><td class="c">${esc(p.numero)}</td><td>${dataHora(p.criado_em)}</td><td><b>${esc(p.fantasia || p.razao_social)}</b></td><td>${esc(cnpjFmt(p.cnpj))}</td><td>${esc(p.representante || '—')}</td><td class="r">${int(p.caixas)}</td><td class="r"><b>${brl(Number(p.total_com_ipi ?? Number(p.total) + Number(p.ipi ?? 0)))}</b></td></tr>`).join('')}
</tbody></table></section>` : '';
  const corpo = ord.map((p) => folha(p, itens.filter((i) => i.pedido_id === p.id).sort((a, b) => a.codigo.localeCompare(b.codigo)), porCnpj.get(dig(p.cnpj)), img)).join('');
  const doc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>
<div class="barra"><span>${int(ord.length)} pedido${ord.length === 1 ? '' : 's'} · use <b>Salvar como PDF</b> na janela de impressão.</span><button onclick="print()">Salvar em PDF</button></div>
${capa}${corpo}<script>document.fonts.ready.then(function(){setTimeout(function(){print()},300)})</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(doc); w.document.close();
  return true;
}
