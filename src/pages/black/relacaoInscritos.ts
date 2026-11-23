// Inscritos por representante: uma folha por representante, no padrão visual da Black, para "Salvar como PDF".
// Serve para o representante ver quem da carteira dele já se cadastrou e ir atrás dos que faltam (com o link dele).
import { CSS } from './relacao';
import { REPRESENTANTES } from './representantes';
import { REPS_FORA } from './cadencia';

type Ins = { cnpj: string; fantasia: string; razao_social: string; comprador: string; celular: string; cidade: string; uf: string; representante: string; status: string; origem: string; criado_em: string };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dh = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const dd = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
const cnpjF = (c: string) => { const d = (c ?? '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : c; };
const ofc = (r: string | null | undefined) => (r ?? '').trim() || 'Sem representante';

const CSS_INS = `.meta{margin-top:10px;background:#DA3A2F;color:#fff;border-radius:10px;padding:10px 14px;display:grid;gap:3px}.meta b{font-size:11pt;font-weight:900}.meta span{font-size:8.8pt}.meta a{color:#fff;font-weight:800;word-break:break-all}
.tg.v{background:#1F7F88}`;

/** valor do seletor: uma folha para cada representante que tem ao menos um inscrito */
export const COM_INSCRITOS = '__com_inscritos';

export type RepIns = { ofc: string; nome: string; link: string };

/** todos os representantes ativos (escritório da carteira, nome da pessoa e link de pré-cadastro) */
export function repsInscritos(origin: string): RepIns[] {
  const m = new Map<string, RepIns>();
  Object.entries(REPRESENTANTES).forEach(([slug, v]) => {
    if (REPS_FORA.includes(slug) || m.has(v.r)) return;
    m.set(v.r, { ofc: v.r, nome: v.n, link: `${origin}/black/r/${slug}` });
  });
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function folha(r: RepIns, L: Ins[], quando: string, prazo: string) {
  const ap = L.filter((i) => i.status === 'aprovado').length;
  const an = L.filter((i) => i.status === 'analise').length;
  const tb = L.length ? `<table><thead><tr><th>Loja</th><th>Comprador</th><th>WhatsApp</th><th>Cidade/UF</th><th>Situação</th><th>Cadastro</th></tr></thead><tbody>${L.map((i) => `<tr><td><b>${esc(i.fantasia || i.razao_social)}</b><small>${esc(i.razao_social)} · ${esc(cnpjF(i.cnpj))}</small></td><td>${esc(i.comprador)}</td><td>${esc(i.celular)}</td><td>${esc(i.cidade)}/${esc(i.uf)}</td><td><span class="tg ${i.status === 'aprovado' ? 'v' : 'a'}">${i.status === 'aprovado' ? 'Aprovado' : 'Em análise'}</span></td><td>${dd(i.criado_em)}</td></tr>`).join('')}</tbody></table>` : '<div class="vz">Nenhum cliente da sua carteira se inscreveu ainda.</div>';
  return `<section class="rp"><div class="hd"><img src="/black/selo-black.webp" alt=""><div class="t"><h1>${esc(r.nome)} <span style="font-weight:600;font-size:10pt;color:#C9C9CF">· ${esc(r.ofc)}</span></h1><p>Clientes inscritos na Black Cardoso · posição de ${quando}</p></div>
<div class="kp"><div class="r"><b>${L.length}</b><small>inscritos</small></div><div><b>${ap}</b><small>aprovados</small></div><div><b>${an}</b><small>em análise</small></div></div></div>
<div class="meta"><b>Faltam clientes da sua carteira? O pré-cadastro fecha ${esc(prazo)}.</b><span>Mande o convite para quem ainda não está nesta lista, com o seu link:</span><a href="${esc(r.link)}">${esc(r.link)}</a></div>
<h2>Clientes inscritos <small>${L.length} · live na terça, 24/11, às 10h</small></h2><p class="dica">Aprovado: já pode participar. Em análise: a equipe está conferindo o cadastro.</p>${tb}
<div class="ft">Black Cardoso · inscritos de ${esc(r.nome)} (${esc(r.ofc)}) · quem se cadastrar pelo seu link entra na sua carteira.</div></section>`;
}

/** abre a lista de inscritos de um representante (ou de todos, uma folha cada) para salvar em PDF */
export function abrirInscritos(ins: Ins[], reps: RepIns[], so: string, titulo: string, prazo: string) {
  const L = ins.filter((i) => i.origem !== 'previa' && i.status !== 'recusado');
  const conhecidos = new Set(reps.map((r) => r.ofc));
  const extras = [...new Set(L.map((i) => ofc(i.representante)))].filter((o) => !conhecidos.has(o)).map((o) => ({ ofc: o, nome: o, link: '' }));
  const temIns = new Set(L.map((i) => ofc(i.representante)));
  const todos = [...reps, ...extras].filter((r) => (so === COM_INSCRITOS ? temIns.has(r.ofc) : !so || r.ofc === so));
  const quando = dh(new Date().toISOString());
  const corpo = todos.map((r) => folha(r, L.filter((i) => ofc(i.representante) === r.ofc).sort((a, b) => (a.fantasia || a.razao_social).localeCompare(b.fantasia || b.razao_social, 'pt-BR')), quando, prazo)).join('');
  const doc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}${CSS_INS}</style></head><body>
<div class="barra"><span>${todos.length} representante${todos.length === 1 ? '' : 's'} · use <b>Salvar como PDF</b> na janela de impressão.</span><button onclick="print()">Salvar em PDF</button></div>
${corpo || '<section class="rp"><div class="vz">Nada para este representante.</div></section>'}<script>document.fonts.ready.then(function(){setTimeout(function(){print()},300)})</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(doc); w.document.close();
  return true;
}
