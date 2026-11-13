// Relação por representante: pedidos concluídos, carrinhos sem fechar e inscritos que não compraram.
// Abre uma página pronta para "Salvar como PDF", uma seção (folha) por representante.

type Ins = { cnpj: string; fantasia: string; razao_social: string; comprador: string; celular: string; cidade: string; uf: string; representante: string; status: string; origem: string };
type Ped = { cnpj: string; numero: string; fantasia: string; razao_social: string; comprador: string; celular: string; cidade: string; uf: string; representante: string; caixas: number; total: number; ipi?: number; total_com_ipi?: number; status: string; criado_em: string; versao?: number };
type Car = { cnpj: string; situacao: string; fantasia: string; razao_social: string; comprador: string; celular: string; cidade: string; uf: string; representante: string; caixas: number; valor: number; visto_em: string; itens: { codigo: string; nome: string; caixas: number }[] };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dig = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const dh = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const rep = (r: string | null | undefined) => (r ?? '').trim() || 'Sem representante';
const ST: Record<string, string> = { recebido: 'A confirmar', confirmado: 'Confirmado' };

const CSS = `
@font-face{font-family:'CB Figtree';src:url('/black/fonts/figtree.woff2') format('woff2');font-weight:300 900}
@page{size:A4;margin:11mm 10mm 13mm}
*{box-sizing:border-box}body{margin:0;font-family:'CB Figtree',Arial,sans-serif;color:#141416;font-size:9.4pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rp{page-break-after:always}.rp:last-child{page-break-after:auto}
.hd{background:#0E0E10;color:#fff;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:14px}
.hd img{height:40px}.hd .t{flex:1}.hd h1{margin:0;font-size:15pt;font-weight:900}.hd p{margin:2px 0 0;font-size:8.3pt;color:#C9C9CF}
.kp{display:flex;gap:6px}.kp div{background:#1E1E22;border-radius:8px;padding:6px 10px;text-align:center;min-width:70px}.kp div.r{background:#DA3A2F}
.kp b{display:block;font-size:12pt;font-weight:900;white-space:nowrap}.kp small{font-size:6.5pt;letter-spacing:.6px;text-transform:uppercase;color:#E9E9EE}
h2{font-size:11.5pt;font-weight:900;margin:14px 0 4px 2px;display:flex;gap:8px;align-items:baseline}h2 small{font-size:8pt;color:#55585C;font-weight:600}
.dica{font-size:8.3pt;color:#55585C;margin:0 2px 5px}
table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{page-break-inside:avoid}
th{background:#DA3A2F;color:#fff;font-size:6.9pt;letter-spacing:.6px;text-transform:uppercase;text-align:left;padding:5px 7px;font-weight:800}
th:first-child{border-radius:7px 0 0 7px}th:last-child{border-radius:0 7px 7px 0}
td{padding:6px 7px;border-bottom:1px solid #EFECE8;vertical-align:top}td.r,th.r{text-align:right}td small{display:block;color:#6B6E73;font-size:7.8pt}
tbody tr:nth-child(even) td{background:#FAF8F6}.vz{color:#8A8D92;font-style:italic;padding:6px 2px}
.tg{display:inline-block;font-size:6.8pt;font-weight:800;padding:1px 6px;border-radius:99px;margin-left:5px;background:#141416;color:#fff}.tg.a{background:#F2B84B;color:#141416}
.aten{margin-top:10px;background:#DA3A2F;color:#fff;border-radius:10px;padding:9px 13px;display:grid;gap:2px}.aten b{font-size:11pt;font-weight:900}.aten span{font-size:8.6pt}
.ft{margin-top:10px;font-size:7.5pt;color:#6B6E73}
@media screen{body{background:#EDEAE6;padding:20px}.rp{background:#fff;max-width:840px;margin:0 auto 20px;padding:18px;border-radius:12px}
.barra{position:sticky;top:0;max-width:840px;margin:0 auto 14px;background:#0E0E10;color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:10px;align-items:center;z-index:2}
.barra button{background:#DA3A2F;color:#fff;border:0;border-radius:99px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer}.barra span{flex:1}}
@media print{.barra{display:none}}
`;

function secao(nome: string, peds: Ped[], cars: Car[], sem: Ins[], quando: string) {
  const tot = peds.reduce((t, p) => t + Number(p.total_com_ipi ?? Number(p.total) + Number(p.ipi ?? 0)), 0);
  const tc = cars.reduce((t, c) => t + Number(c.valor), 0);
  const tbPed = peds.length ? `<table><thead><tr><th>Pedido</th><th>Loja</th><th>Comprador</th><th>Cidade/UF</th><th class="r">Caixas</th><th class="r">Total c/ IPI</th></tr></thead><tbody>${peds.map((p) => `<tr><td><b>${esc(p.numero)}</b>${(p.versao ?? 1) > 1 ? `<span class="tg">alterado v${p.versao}</span>` : ''}<small>${dh(p.criado_em)} · ${esc(ST[p.status] ?? p.status)}</small></td><td><b>${esc(p.fantasia || p.razao_social)}</b></td><td>${esc(p.comprador)}<small>${esc(p.celular)}</small></td><td>${esc(p.cidade)}/${esc(p.uf)}</td><td class="r">${p.caixas}</td><td class="r"><b>${brl(Number(p.total_com_ipi ?? Number(p.total) + Number(p.ipi ?? 0)))}</b></td></tr>`).join('')}</tbody></table>` : '<div class="vz">Nenhum pedido ainda.</div>';
  const tbCar = cars.length ? `<table><thead><tr><th>Loja</th><th>Comprador</th><th>No carrinho</th><th class="r">Valor</th><th>Última visita</th></tr></thead><tbody>${cars.map((c) => `<tr><td><b>${esc(c.fantasia || c.razao_social)}</b>${c.situacao === 'ativo' ? '<span class="tg a">na página agora</span>' : ''}<small>${esc(c.cidade)}/${esc(c.uf)}</small></td><td>${esc(c.comprador)}<small><b style="color:#141416">${esc(c.celular)}</b></small></td><td>${c.itens.map((i) => `${i.caixas} cx · ${esc(i.nome)}`).join('<br>')}</td><td class="r"><b>${brl(Number(c.valor))}</b><small>${c.caixas} cx</small></td><td>${dh(c.visto_em)}</td></tr>`).join('')}</tbody></table>` : '<div class="vz">Nenhum carrinho sem fechar.</div>';
  const tbSem = sem.length ? `<table><thead><tr><th>Loja</th><th>Comprador</th><th>WhatsApp</th><th>Cidade/UF</th></tr></thead><tbody>${sem.map((i) => `<tr><td><b>${esc(i.fantasia || i.razao_social)}</b></td><td>${esc(i.comprador)}</td><td>${esc(i.celular)}</td><td>${esc(i.cidade)}/${esc(i.uf)}</td></tr>`).join('')}</tbody></table>` : '<div class="vz">Todos os inscritos já compraram ou estão com carrinho.</div>';
  return `<section class="rp"><div class="hd"><img src="/black/selo-black.webp" alt=""><div class="t"><h1>${esc(nome)}</h1><p>Relação da Black Cardoso · posição de ${quando}</p></div>
<div class="kp"><div${cars.length ? ' class="r"' : ''}><b>${cars.length}</b><small>carrinhos parados</small></div><div><b>${peds.length}</b><small>pedidos</small></div><div><b>${brl(tot).replace(',00', '')}</b><small>vendido c/ IPI</small></div><div><b>${sem.length}</b><small>sem compra</small></div></div></div>
${cars.length ? `<div class="aten"><b>⚠ ATENÇÃO: ${cars.length} cliente${cars.length === 1 ? '' : 's'} com carrinho sem fechar · ${brl(tc)} parados</b><span>Ligue ou mande mensagem agora: os produtos ainda não são deles e os pedidos encerram no horário da Black. Comece pelos de maior valor.</span></div>` : ''}
<h2>Carrinho sem fechar <small>${cars.length} · ${brl(tc)} em produtos · prioridade</small></h2>${tbCar}
<h2>Pedidos concluídos <small>${peds.length} · ${brl(tot)} com IPI</small></h2>${tbPed}
<h2>Inscritos que ainda não compraram <small>${sem.length}</small></h2><p class="dica">Cadastro aprovado, sem pedido e sem carrinho.</p>${tbSem}
<div class="ft">Black Cardoso · relação de ${esc(nome)} · os pedidos encerram no horário da Black; alterações feitas pelo cliente aparecem como "alterado".</div></section>`;
}

/** abre a relação de um representante (ou de todos, uma folha cada) para salvar em PDF */
export function abrirRelacao(ins: Ins[], peds: Ped[], cars: Car[], so: string, titulo: string) {
  const validos = peds.filter((p) => p.status !== 'cancelado');
  const comprou = new Set(validos.map((p) => dig(p.cnpj)));
  const abertos = cars.filter((c) => (c.situacao === 'ativo' || c.situacao === 'abandonado') && c.itens.length && !comprou.has(dig(c.cnpj)));
  const comCarro = new Set(abertos.map((c) => dig(c.cnpj)));
  const aprov = ins.filter((i) => i.status === 'aprovado' && i.origem !== 'previa');
  const sem = aprov.filter((i) => !comprou.has(dig(i.cnpj)) && !comCarro.has(dig(i.cnpj)));
  const reps = [...new Set([...aprov.map((i) => rep(i.representante)), ...validos.map((p) => rep(p.representante))])]
    .filter((r) => !so || r === so)
    .sort((a, b) => abertos.filter((c) => rep(c.representante) === b).length - abertos.filter((c) => rep(c.representante) === a).length || a.localeCompare(b, 'pt-BR'));
  const quando = dh(new Date().toISOString());
  const corpo = reps.map((r) => secao(r, validos.filter((p) => rep(p.representante) === r).sort((a, b) => a.numero.localeCompare(b.numero)),
    abertos.filter((c) => rep(c.representante) === r).sort((a, b) => Number(b.valor) - Number(a.valor)),
    sem.filter((i) => rep(i.representante) === r).sort((a, b) => (a.fantasia || a.razao_social).localeCompare(b.fantasia || b.razao_social)), quando)).join('');
  const doc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>
<div class="barra"><span>${reps.length} representante${reps.length === 1 ? '' : 's'} · use <b>Salvar como PDF</b> na janela de impressão.</span><button onclick="print()">Salvar em PDF</button></div>
${corpo || '<section class="rp"><div class="vz">Nada para este representante.</div></section>'}<script>document.fonts.ready.then(function(){setTimeout(function(){print()},300)})</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(doc); w.document.close();
  return true;
}
