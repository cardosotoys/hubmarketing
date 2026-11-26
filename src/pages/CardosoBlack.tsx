import { useSearchParams } from 'react-router-dom';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import DrivePicker, { type DriveItem } from './social-plan/DrivePicker';
import './black/black.css';
import { useRedonda } from './black/fonte';
import { ABAS, abaValida, linkComoCliente, type Aba } from './black/abas';
import { abrirEspelhos } from './black/espelho';
import { abrirRelacao } from './black/relacao';
import { abrirInscritos, COM_INSCRITOS, repsInscritos } from './black/relacaoInscritos';
import { gerarRelatorio, type DadosRelatorio } from './black/relatorioDiretoria';
import { driveId, midia } from './black/api';
import { REPRESENTANTES, slugDoRepresentante } from './black/representantes';
import { CADENCIA, MSG_CANAL, MSG_CONVITE, MSG_REP, QUEM_CAD, REPS_FORA } from './black/cadencia';
import { ABAS_ARQ, carrinhosRel, EDICOES, edicaoDe, ler, urlAba, type EdInfo } from './black/edicoes';

/* edição aberta na tela: a em andamento (tabelas black_*) ou uma arquivada (black_arq_*, só leitura) */
const EdCtx = createContext<EdInfo>(EDICOES[0]);
const useEd = () => useContext(EdCtx);

/* Cardoso Black — o lado de dentro (Hub). Tudo o que o lojista faz em /black cai aqui:
 *   Resumo      funil, valor, canais de venda, representantes, produtos mais abertos pelo QR
 *   Inscritos   pré-cadastros com a checagem antifraude; aprovar, recusar, link de nova senha
 *   Pedidos     pedidos do link; status e planilha para o Guarani
 *   Produtos    os produtos da Black (TAB), ordem na live, preço, caixa, estoque
 *   Carteira    clientes que podem entrar (importada por CSV; nunca vai para o Git)
 *   Links       link de cada representante, links da live e dos QR
 *   Ajustes     datas, mínimo, links do canal e da live
 * Acesso: Diretoria/Administrador ou quem tiver o módulo "Cardoso Black" liberado em Configurações. */

type Cfg = {
  id: number; inscricoes_ate: string; abre_em: string; fecha_em: string; pedido_minimo: number; frete_gratis_sp_rj: number;
  live_data: string; live_link: string; canal_link: string; desconto_pct: number; presentes_live?: number | null; ipi_pct?: number;
};
type Inscrito = {
  id: string; cnpj: string; razao_social: string; fantasia: string; cidade: string; uf: string; carteira_id: string | null;
  representante: string; rep_link: string; comprador: string; email: string; celular: string; canais: Record<string, string>;
  status: 'aprovado' | 'analise' | 'recusado'; origem: string; alertas: string[]; motivo: string; criado_em: string; decidido_em: string | null;
};
type Pedido = {
  id: string; numero: string; inscrito_id: string; cnpj: string; razao_social: string; fantasia: string; cidade: string; uf: string;
  representante: string; comprador: string; email: string; celular: string; observacao: string; caixas: number; pecas: number;
  total: number; ipi?: number; total_com_ipi?: number; frete: string; status: 'recebido' | 'confirmado' | 'cancelado'; criado_em: string;
  versao?: number; alterado_em?: string | null; alteracoes?: { codigo: string; nome: string; de: number; para: number }[] | null;
  edicoes?: Edicao[] | null;
};
type Edicao = { tipo: 'itens' | 'dados'; em: string; por: string; versao?: number; motivo?: string; cadastro?: boolean;
  mudou: ({ codigo: string; nome: string; de: number; para: number } | { campo: string; de: string | null; para: string | null })[] };
const difTxt = (a: { codigo: string; nome: string; de: number; para: number }) => (!a.de ? `+ ${a.para} cx ${a.codigo} ${a.nome} (novo)` : !a.para ? `− ${a.codigo} ${a.nome} (saiu, eram ${a.de} cx)` : `${a.codigo} ${a.nome}: ${a.de} → ${a.para} cx`);
type Item = { pedido_id: string; codigo: string; nome: string; caixas: number; pecas_caixa: number; preco_peca: number; total: number };
type BP = { codigo: string; ordem: number; nome?: string; familia: string; preco_peca: number | null; desconto_pct: number | null; caixa_qtd: number | null; estoque_caixas: number | null; ativo: boolean };
type Prod = { id: string; code: string; name: string; packaging_name: string; line: string; image_url: string; carton_quantity: number | null; brand?: { label: string } | { label: string }[] | null };
const marcaDe = (p?: Prod) => { const b = p?.brand; const l = Array.isArray(b) ? b[0]?.label : b?.label; return l === 'Playmi' || l === 'Tópi' ? l : 'Cardoso'; };
type Cart = { id: string; razao_social: string; cnpj: string | null; uf: string; representante: string; grupo: string; situacao: string; dias_sem_compra: number | null; importado_em: string };

const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const int = (v: number) => Number(v).toLocaleString('pt-BR');
const cnpjFmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const CANAL: Record<string, string> = { loja: 'Loja física', site: 'Site', ml: 'Mercado Livre', amz: 'Amazon', shp: 'Shopee', mgl: 'Magalu', out: 'Outro' };
const ST: Record<string, string> = { aprovado: 'Aprovado', analise: 'Em análise', recusado: 'Recusado', recebido: 'Recebido', confirmado: 'Confirmado', cancelado: 'Cancelado' };
const ALERTA: Record<string, string> = {
  fora_carteira: 'Fora da carteira', receita_fora: 'Receita indisponível na hora', receita_inativa: 'CNPJ inativo na Receita',
  email_repetido: 'E-mail já usado em outro CNPJ', celular_repetido: 'Celular já usado em outro CNPJ',
  empresa_ja_inscrita: 'Empresa da carteira já inscrita com outro CNPJ', email_descartavel: 'E-mail temporário',
  link_invalido: 'Link de loja inválido', ddd_outra_uf: 'DDD de outro estado (só aviso)',
};

/* ---------- CSV ---------- */
function baixarCsv(nome: string, linhas: (string | number | null)[][]) {
  const csv = '﻿' + linhas.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome; document.body.appendChild(a); a.click(); a.remove();
}
function lerCsv(txt: string): Record<string, string>[] {
  const t = txt.replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g)?.length ?? 0) >= (t.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let cur: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; continue; }
    if (c === '"') q = true; else if (c === sep) { cur.push(f); f = ''; } else if (c === '\n') { cur.push(f); rows.push(cur); cur = []; f = ''; } else if (c !== '\r') f += c;
  }
  if (f || cur.length) { cur.push(f); rows.push(cur); }
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');
  const head = (rows.shift() ?? []).map(norm);
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const num = (s: string | undefined) => { if (!s) return null; const n = Number(s.replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
async function paginar<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let i = 0; i < 50; i++) {
    const { data, error } = await q(i * 1000, i * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function CardosoBlack() {
  useRedonda();
  // a aba fica na URL (?aba=...): o menu navy da lateral (BlackNav) troca a aba pelo link
  const [params, setParams] = useSearchParams();
  const ed = edicaoDe(params.get('ed'));
  const arq = ed.arq;
  const abasEd = arq ? ABAS.filter((a) => ABAS_ARQ.includes(a[0])) : ABAS;
  const abaUrl = abaValida(params.get('aba'));
  const aba: Aba = abasEd.some((a) => a[0] === abaUrl) ? abaUrl : 'resumo';
  const qs = (k: Aba, e: EdInfo) => Object.fromEntries(new URLSearchParams(urlAba(k, e).split('?')[1] ?? ''));
  const setAba = (k: Aba) => setParams(qs(k, ed));
  const trocarEd = (e: EdInfo) => { if (e.id === ed.id) return; setCarregando(true); setParams(qs(e.arq && !ABAS_ARQ.includes(aba) ? 'resumo' : aba, e)); };
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [ins, setIns] = useState<Inscrito[]>([]);
  const [peds, setPeds] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [bps, setBps] = useState<BP[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [cart, setCart] = useState<Cart[]>([]);
  const [fichas, setFichas] = useState<Record<string, number>>({});
  const [mats, setMats] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [c, i, p, it, b, pr, ca, ev, m] = await Promise.all([
        ler('config', '*', arq).eq('id', 1).maybeSingle(),
        paginar<Inscrito>((a, z) => ler('inscritos', '*', arq).neq('origem', 'previa').order('criado_em', { ascending: false }).range(a, z) as unknown as PromiseLike<{ data: Inscrito[] | null; error: { message: string } | null }>),
        paginar<Pedido>((a, z) => ler('pedidos', '*', arq).order('criado_em', { ascending: false }).range(a, z) as unknown as PromiseLike<{ data: Pedido[] | null; error: { message: string } | null }>),
        paginar<Item>((a, z) => ler('pedido_itens', '*', arq).range(a, z) as unknown as PromiseLike<{ data: Item[] | null; error: { message: string } | null }>),
        ler('produtos', '*', arq).order('ordem'),
        paginar<Prod>((a, z) => supabase.from('products').select('id, code, name, packaging_name, line, image_url, carton_quantity, brand:brands(label)').order('code').range(a, z)),
        paginar<Cart>((a, z) => supabase.from('black_carteira').select('id, razao_social, cnpj, uf, representante, grupo, situacao, dias_sem_compra, importado_em').order('razao_social').range(a, z)),
        paginar<{ codigo: string }>((a, z) => ler('eventos', 'codigo', arq).eq('tipo', 'ficha').range(a, z) as unknown as PromiseLike<{ data: { codigo: string }[] | null; error: { message: string } | null }>),
        paginar<{ product_id: string }>((a, z) => supabase.from('content_materials').select('product_id').eq('status', 'liberado').range(a, z)),
      ]);
      if (c.error) throw new Error(c.error.message);
      setCfg(c.data as unknown as Cfg); setIns(i); setPeds(p); setItens(it); setBps((b.data as unknown as BP[]) ?? []); setProds(pr); setCart(ca);
      const f: Record<string, number> = {}; ev.forEach((e) => { f[e.codigo] = (f[e.codigo] ?? 0) + 1; }); setFichas(f);
      const mm: Record<string, number> = {}; m.forEach((x) => { mm[x.product_id] = (mm[x.product_id] ?? 0) + 1; }); setMats(mm);
      setErro('');
    } catch (e) {
      setErro(arq ? `Não consegui abrir a ${ed.nome}: ${(e as Error).message}` : (e as Error).message.includes('black_') ? 'As tabelas da Cardoso Black ainda não existem no banco: rode o SQL 0160_cardoso_black.sql no Supabase.' : (e as Error).message);
    }
    setCarregando(false);
  }, [arq, ed.nome]);
  useEffect(() => { carregar(); }, [carregar]);
  // durante a Black os números mudam a todo momento: pedidos, itens, inscritos e estoque se atualizam sozinhos a cada minuto
  // (e quando a aba volta a ficar visível), sem recarregar a página
  const [atualizado, setAtualizado] = useState<Date | null>(null);
  const atualizar = useCallback(async () => {
    if (document.hidden || arq) return; // edição encerrada não muda
    try {
      const [i, p, it, b] = await Promise.all([
        paginar<Inscrito>((a, z) => supabase.from('black_inscritos').select('*').neq('origem', 'previa').order('criado_em', { ascending: false }).range(a, z)),
        paginar<Pedido>((a, z) => supabase.from('black_pedidos').select('*').order('criado_em', { ascending: false }).range(a, z)),
        paginar<Item>((a, z) => supabase.from('black_pedido_itens').select('*').range(a, z)),
        supabase.from('black_produtos').select('*').order('ordem'),
      ]);
      if (b.error) return;
      setIns(i); setPeds(p); setItens(it); setBps((b.data as BP[]) ?? []); setAtualizado(new Date());
    } catch { /* tenta de novo no próximo minuto */ }
  }, [arq]);
  useEffect(() => {
    const t = setInterval(atualizar, 60000);
    const vis = () => { if (!document.hidden) atualizar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [atualizar]);

  const porCodigo = useMemo(() => Object.fromEntries(prods.map((p) => [p.code, p])), [prods]);

  if (carregando) return <Loading />;
  const nAn = ins.filter((x) => x.status === 'analise').length;

  const titulo = ABAS.find((x) => x[0] === aba)?.[1] ?? '';
  return (
    <EdCtx.Provider value={ed}>
    <div className="page cbx cbx-app">
      <div className="cbx-ed" role="tablist" aria-label="Edição da Black">
        {EDICOES.map((e) => <button key={e.id} type="button" role="tab" aria-selected={e.id === ed.id} className={e.id === ed.id ? 'on' : ''} onClick={() => trocarEd(e)}><b>{e.nome}</b><small>{e.datas}</small></button>)}
      </div>
      {arq && <div className="cbx-arq"><b>{ed.nome} · encerrada.</b> Os dados estão guardados e só podem ser consultados: medição, inscritos, pedidos, carrinhos, PDFs e relatório da diretoria saem com os números desta edição.</div>}
      <nav className="cbx-mtabs" aria-label="Cardoso Black">{abasEd.map(([k, l]) => <button key={k} type="button" className={aba === k ? 'on' : ''} onClick={() => setAba(k)}>{l}{k === 'inscritos' && nAn ? ` · ${nAn}` : ''}</button>)}</nav>
      <div className="cbx-main">
        <div className="cbx-ht">
          <h2>{titulo}</h2>
          {aba === 'resumo' && <span className="ex">{arq ? ed.nome : 'atualizado agora'}</span>}
          {aba === 'pedidos' && cfg && <span className="ex">{dt(cfg.abre_em)} a {dt(cfg.fecha_em)}</span>}
          <div className="r">{arq ? <small style={{ color: 'var(--text-3, #7C8A90)' }}>{ed.nome} · dados arquivados</small> : <><small style={{ color: 'var(--text-3, #7C8A90)', marginRight: 8 }}>Atualiza sozinho a cada minuto{atualizado ? ` · ${atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</small><button className="btn ghost sm" type="button" onClick={carregar}>Atualizar</button></>}</div>
        </div>
        {erro && <div className="alert">{erro}</div>}
        {!erro && cfg && (
          <>
            {aba === 'resumo' && <Resumo ins={ins} peds={peds} itens={itens} cart={cart} fichas={fichas} porCodigo={porCodigo} cfg={cfg} recarregar={carregar} />}
            {aba === 'inscritos' && <Inscritos ins={ins} cfg={cfg} recarregar={carregar} />}
            {aba === 'pedidos' && <Pedidos peds={peds} itens={itens} cart={cart} porCodigo={porCodigo} bps={bps} fechaEm={cfg?.fecha_em ?? null} recarregar={carregar} />}
            {aba === 'carrinhos' && <Carrinhos ins={ins} peds={peds} fechaEm={cfg?.fecha_em ?? null} />}
            {aba === 'relatorio' && cfg && <RelatorioDiretoria cfg={cfg} ins={ins} peds={peds} itens={itens} bps={bps} porCodigo={porCodigo} fichas={fichas} />}
            {aba === 'mensagens' && <Mensagens ins={ins} cfg={cfg} peds={peds} />}
            {aba === 'produtos' && <Produtos bps={bps} prods={prods} porCodigo={porCodigo} itens={itens} peds={peds} fichas={fichas} mats={mats} recarregar={carregar} />}
            {aba === 'carteira' && <Carteira cart={cart} ins={ins} recarregar={carregar} />}
            {aba === 'links' && <Links cart={cart} ins={ins} bps={bps} porCodigo={porCodigo} />}
            {aba === 'ajustes' && <Ajustes cfg={cfg} recarregar={carregar} />}
          </>
        )}
      </div>
    </div>
    </EdCtx.Provider>
  );
}

function Kpi({ l, v, c }: { l: string; v: ReactNode; c?: string }) {
  return <div className="cbx-kpi" style={c ? { ['--c' as string]: c } : undefined}><small>{l}</small><b>{v}</b></div>;
}
function Barras({ dados, fmt = int, cor }: { dados: [string, number][]; fmt?: (n: number) => string; cor?: string }) {
  const mx = Math.max(1, ...dados.map((d) => d[1]));
  if (!dados.length) return <p className="cbx-hint">Sem dados ainda.</p>;
  return <div className="cbx-bars">{dados.map(([k, v]) => <div key={k} className="cbx-br" style={cor ? { ['--c' as string]: cor } : undefined}><span title={k}>{k}</span><i><u style={{ width: `${(v / mx) * 100}%` }} /></i><b>{fmt(v)}</b></div>)}</div>;
}
const top = (m: Record<string, number>, n = 8) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);

/* ================= Resumo ================= */
function Resumo({ ins, peds, itens, cart, fichas, porCodigo, cfg, recarregar }: { ins: Inscrito[]; peds: Pedido[]; itens: Item[]; cart: Cart[]; fichas: Record<string, number>; porCodigo: Record<string, Prod>; cfg: Cfg; recarregar: () => void }) {
  const val = peds.filter((p) => p.status !== 'cancelado');
  const tv = val.reduce((s, p) => s + Number(p.total), 0);
  const lojas = new Set(val.map((p) => p.inscrito_id)).size;
  const ap = ins.filter((x) => x.status === 'aprovado').length;
  const pres = cfg.presentes_live ?? null;
  const [presTxt, setPresTxt] = useState(pres == null ? '' : String(pres));
  const [aviso, setAviso] = useState('');
  const ro = !!useEd().arq;
  async function salvarPresentes() {
    const n = presTxt.trim() === '' ? null : Math.max(0, Math.round(Number(presTxt.replace(/\D/g, ''))));
    const { error } = await supabase.from('black_config').update({ presentes_live: n }).eq('id', 1);
    setAviso(error ? (error.message.includes('presentes_live') ? 'Para guardar a presença, rode o SQL 0162_black_presentes_live.sql no Supabase.' : `Não consegui salvar: ${error.message}`) : 'Presença salva.');
    if (!error) recarregar();
  }
  const canais: Record<string, number> = {}; ins.forEach((x) => Object.keys(x.canais ?? {}).forEach((k) => { canais[CANAL[k] ?? k] = (canais[CANAL[k] ?? k] ?? 0) + 1; }));
  const porRep: Record<string, number> = {}; val.forEach((p) => { const r = p.representante || '(sem representante)'; porRep[r] = (porRep[r] ?? 0) + Number(p.total); });
  const vivos = new Set(val.map((p) => p.id));
  const cx: Record<string, number> = {}; itens.filter((i) => vivos.has(i.pedido_id)).forEach((i) => { cx[i.nome || i.codigo] = (cx[i.nome || i.codigo] ?? 0) + i.caixas; });
  const fi: Record<string, number> = {}; Object.entries(fichas).forEach(([c, n]) => { fi[porCodigo[c]?.name ?? c] = n; });
  const F: [string, number, string][] = [['Carteira', cart.length, '#7C8A90'], ['Inscritos', ins.length, '#0A2530'], ['Aprovados', ap, '#1F7F88'],
    ...(pres != null ? [['Presentes na live', pres, '#4CBDC7'] as [string, number, string]] : []), ['Compraram', lojas, '#DA3A2F']];
  const mx = Math.max(1, ...F.map((f) => f[1]));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  return (
    <>
      <div className="cbx-box">
        <div className="cbx-hrow"><h3>Funil da Cardoso Black</h3><button className="btn ghost sm" type="button" onClick={() => window.print()}>Relatório em PDF</button></div>
        <div className="cbx-funil">{F.map(([l, v, c]) => <div key={l} className="cbx-fu" style={{ ['--c' as string]: c }}><span>{l}</span><i><u style={{ width: `${(v / mx) * 100}%` }} /></i><b>{int(v)}</b></div>)}</div>
        <div className="cbx-acts cbx-noprint cbx-pres">
          <span className="cbx-hint">Presentes na live (relatório do Meet ou do Zoom)</span>
          {ro ? <b>{pres != null ? `${int(pres)} lojas` : 'não informado'}</b> : <>
          <input className="cbx-in" inputMode="numeric" style={{ width: 110 }} value={presTxt} placeholder="nº de lojas" onChange={(e) => setPresTxt(e.target.value)} />
          <button className="btn sm" type="button" onClick={salvarPresentes}>Salvar</button></>}
          {aviso && <span className="cbx-hint">{aviso}</span>}
        </div>
      </div>
      <div className="cbx-two">
        <div className="cbx-box"><h3>Inscritos por canal de venda</h3><Barras dados={top(canais)} cor="#0A2530" /></div>
        <div className="cbx-box"><h3>Resultado</h3>
          <div className="cbx-kpis cbx-kpis2">
            <Kpi l="Valor (sem IPI)" v={brl0(tv)} c="#DA3A2F" /><Kpi l="Pedido médio" v={brl0(val.length ? tv / val.length : 0)} c="#0A2530" />
            <Kpi l="Compraram / aprovados" v={pct(lojas, ap)} c="#1F7F88" /><Kpi l="Presença" v={pres != null ? pct(pres, ap) : '—'} c="#4CBDC7" />
            <Kpi l="Pedidos" v={int(val.length)} c="#7C8A90" /><Kpi l="Em análise" v={int(ins.filter((x) => x.status === 'analise').length)} c="#F2B84B" />
          </div>
        </div>
      </div>
      <div className="cbx-box"><h3>Produtos mais abertos pelo QR na live</h3><Barras dados={top(fi, 10)} cor="#DA3A2F" /></div>
      <div className="cbx-two">
        <div className="cbx-box"><h3>Valor por representante</h3><Barras dados={top(porRep, 10)} fmt={brl0} cor="#1F7F88" /></div>
        <div className="cbx-box"><h3>Produtos mais pedidos (caixas)</h3><Barras dados={top(cx, 10)} cor="#0A2530" /></div>
      </div>
    </>
  );
}

/* ================= Inscritos ================= */
/* mensagem 1 a 1 para cada inscrito, aberta no WhatsApp Web já preenchida */
const LS_V = 'varejo'; // muda a cada edição: textos editados e marcas de enviado da edição anterior não voltam
const lerLS = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const telWa = (c: string) => { const d = (c || '').replace(/\D/g, ''); if (!d) return ''; return d.length <= 11 ? `55${d}` : d; };
const nomeRep = (r: string) => { const s = slugDoRepresentante(r); return (s && REPRESENTANTES[s]?.n) || r || 'Equipe Cardoso'; };
const primeiroNome = (n: string) => { const p = (n || '').trim().split(/\s+/)[0] ?? ''; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ''; };
/* campanhas de mensagem: cada uma com o seu público, o seu texto e as suas marcas de enviado */
type Camp = 'vespera' | 'live' | 'andamento' | 'abandonado' | 'semcompra' | 'comprou';
const ASSIN = `Aqui é da *Cardoso*.`;
const CAMPS: { k: Camp; nome: string; quando: string; publico: string; padrao: string }[] = [
  { k: 'live', nome: 'Dia D', quando: 'Ter 24/11 · 8h', publico: 'Todos os aprovados', padrao: `Olá, *{comprador}*! Tudo bem?
Aqui é da *Cardoso*.

⏰ *É HOJE: BLACK CARDOSO VAREJO - 24.11 às 10h*

O cadastro da *{loja}* está aprovado e você já pode participar da Black feita para as lojas físicas.

📺 *Link da live (videochamada):*
{live}

🛒 *Link para fazer seu pedido:*
{pedido}
Entre com o *CNPJ da loja* e a *senha criada no pré-cadastro*.

🚨 *As compras são feitas somente pelo link de pedido, a partir das 10h.*

*Condições:*
• Produtos com *até 60% de desconto*, incluindo licenciados
• Pagamento antecipado · caixa fechada · pedido mínimo de R$ 2.500
• Frete grátis para a cidade de São Paulo
• IPI de 6,5% somado no fechamento do pedido
• Estoque limitado: a caixa fica garantida quando entra no seu carrinho

Seu representante: *{representante}*.
Te esperamos às 10h! 🖤` },
  { k: 'vespera', nome: 'Véspera', quando: 'Seg 23/11 · 10h', publico: 'Todos os aprovados', padrao: `Olá, *{comprador}*! Tudo bem?
${ASSIN}

⏰ *É amanhã!* A live da *Black Cardoso* começa na *terça, 24/11, às 10h*.

O cadastro da *{loja}* está aprovado. Faça um teste hoje: entre no link com o *CNPJ da loja* e a *senha criada no pré-cadastro* e veja se está tudo certo.
🛒 {pedido}

Teve alguma dificuldade? Responda esta mensagem que a gente te ajuda. Seu representante: *{representante}*.` },
  { k: 'abandonado', nome: 'Carrinho abandonado', quando: 'Ter 24/11 · 15h', publico: 'Deixaram produtos no carrinho, saíram da página e não enviaram o pedido', padrao: `Olá, *{comprador}*! Tudo bem?
${ASSIN}

Vimos que a *{loja}* deixou produtos no carrinho da *Black Cardoso* e o pedido ainda não foi enviado:
{itens}

⚠️ O estoque só fica garantido quando o pedido é enviado. Alguns itens já estão acabando.

⏰ *Os pedidos ficam abertos até quinta, 26/11, às 10h.* Depois disso o link fecha.

🛒 Finalize aqui: {pedido}
Entre com o *CNPJ* e a *senha*. O seu carrinho continua salvo.

Para fechar: *Carrinho → Continuar → marque "Estou de acordo" → Enviar pedido*.
Pedido mínimo de R$ 2.500 em produtos, caixa fechada.

Travou em alguma etapa? É só responder esta mensagem que a gente te ajuda. Seu representante: *{representante}*.` },
  { k: 'semcompra', nome: 'Ainda não compraram', quando: 'Qua 25/11 · 10h', publico: 'Aprovados sem pedido e sem carrinho', padrao: `Olá, *{comprador}*! Tudo bem?
${ASSIN}

A *Black Cardoso* está no ar e a *{loja}* ainda não fez o pedido. 🖤

⏰ *Os pedidos ficam abertos até quinta, 26/11, às 10h.* Depois disso o link fecha.

Produtos selecionados, condição especial e estoque limitado: quem coloca no carrinho primeiro garante.

🛒 Faça seu pedido aqui: {pedido}
Entre com o *CNPJ da loja* e a *senha criada no pré-cadastro*.

Esqueceu a senha ou ficou alguma dúvida? Responda esta mensagem que a gente te ajuda. Seu representante: *{representante}*.

Caixa fechada · pedido mínimo de R$ 2.500.` },
  { k: 'andamento', nome: 'Em andamento', quando: 'Qui 26/11 · 8h', publico: 'Estão montando o carrinho agora e ainda não enviaram', padrao: `Olá, *{comprador}*! Tudo bem?
${ASSIN}

Vimos que a *{loja}* está montando o pedido da *Black Cardoso*. Que bom! 🙌

Só um lembrete para não perder nada:
• O estoque só fica garantido quando o pedido é *enviado*
• Para fechar: *Carrinho → Continuar → marque "Estou de acordo" → Enviar pedido*
• Pedido mínimo de R$ 2.500 em produtos, caixa fechada

⏰ *Os pedidos encerram HOJE, 26/11, às 10h.*

🛒 {pedido}

Qualquer dúvida, responda aqui que a gente te ajuda na hora. Seu representante: *{representante}*.` },
  { k: 'comprou', nome: 'Agradecimento', quando: 'Qui 26/11 · 14h', publico: 'Lojas que enviaram pedido', padrao: `Olá, *{comprador}*! Tudo bem?
${ASSIN}

Passando para agradecer: o pedido *{numero}* da *{loja}* chegou certinho! 🎉

Próximos passos: o *{representante}* entra em contato para confirmar o pagamento e a entrega.

📸 As fotos e os vídeos dos produtos continuam na ficha de cada um (pelo QR ou pelo link de pedido). Use à vontade na sua loja e nas redes.

Obrigado pela confiança e boas vendas! 🖤
*Time Comercial*
Cardoso` },
];
const lsMod = (k: Camp) => `cb-msg-${k}-${LS_V}-modelo`;
const lsEnv = (k: Camp) => `cb-msg-${k}-${LS_V}-enviados`;
const soDig = (c: string) => (c || '').replace(/\D/g, '');

/** campanha que vale para hoje, pela cadência */
function campDoDia(): Camp {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  let k: Camp = 'vespera';
  CADENCIA.forEach((d) => { if (d.iso <= hoje) d.itens.forEach((i) => { if (i.camp && i.camp !== 'reps') k = i.camp as Camp; }); });
  return k;
}

function Cadencia({ live, pedido, irPara, irReps }: { live: string; pedido: string; irPara: (k: Camp) => void; irReps: () => void }) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [aberto, setAberto] = useState(true);
  const [ver, setVer] = useState('');
  const [ok, setOk] = useState('');
  const txt = (k: string) => MSG_CANAL[k].txt.replaceAll('{live}', live || '[link da live]').replaceAll('{pedido}', pedido);
  const copiar = async (k: string) => { try { await navigator.clipboard.writeText(txt(k)); setOk(k); setTimeout(() => setOk(''), 1500); } catch { /* sem área de transferência */ } };
  const MARCOS: [string, string][] = [['Convite aos clientes', 'Qua 18/11 · 10h'], ['Canal novo no ar', 'Qui 19/11 · 10h'], ['Fim do pré-cadastro', 'Seg 23/11 · 18h'], ['Live e pedidos abertos', 'Ter 24/11 · 10h'], ['Prazo de 48h anunciado', 'Ter 24/11 · fim da live'], ['Pedidos encerrados', 'Qui 26/11 · 10h'], ['Agradecimento', 'Qui 26/11 · 14h']];
  return (
    <div className="cbv">
      <section className="cbv-hero">
        <div>
          <span className="cbv-tag">Black Varejo · lojas físicas</span>
          <h2>Live na terça, 24/11, às 10h.<br /><em>Siga o dia de hoje, de cima para baixo.</em></h2>
          <p>Cada linha diz quem faz e o que fazer. <b>Abrir a lista</b> leva para as mensagens individuais já prontas. <b>Ver mensagem</b> mostra o texto do canal: toque no balão para copiar. O prazo de 48h dos pedidos só é anunciado no fim da live.</p>
          <button className="cbv-tg" onClick={() => setAberto((v) => !v)}>{aberto ? 'Esconder a cadência' : 'Mostrar a cadência'}</button>
        </div>
        <div className="cbv-marcos">{MARCOS.map(([l, d]) => <div key={l}><span>{l}</span><b>{d}</b></div>)}</div>
      </section>
      {aberto && <div className="cbv-days">
        {CADENCIA.map((d) => { const atual = d.iso === hoje; const passou = d.iso < hoje; return (
          <div key={d.iso} className={`cbv-day${d.tag === 'Dia D' ? ' dday' : ''}${atual ? ' hoje' : ''}${passou ? ' passou' : ''}`}>
            <div className="cbv-dd"><small>{d.dia}</small><b>{d.data}</b><span>{atual ? 'Hoje' : d.tag}</span></div>
            <ul>{d.itens.map((i, n) => { const k = `${d.iso}-${n}`; return (
              <li key={n}>
                <span className="h">{i.h}</span>
                <span className={`cbv-chip ${i.quem}`}>{QUEM_CAD[i.quem]}</span>
                <span className="o">{i.o}</span>
                <span className="go">
                  {i.msg && <button className="cbv-go" onClick={() => setVer(ver === k ? '' : k)}>{ver === k ? 'Fechar' : 'Ver mensagem'}</button>}
                  {i.camp && <button className="cbv-go red" onClick={() => (i.camp === 'reps' ? irReps() : irPara(i.camp as Camp))}>Abrir a lista</button>}
                </span>
                {i.msg && ver === k && i.video && <div className="cbv-wa cbv-vid"><video src={i.video} controls playsInline preload="metadata" /><div><b>1 · Envie o vídeo</b><span>Baixe e mande no canal. Em seguida, mande a mensagem abaixo.</span><a className="cbv-go red" href={i.video} download={i.video.split('/').pop()}>Baixar o vídeo</a></div></div>}
                {i.msg && ver === k && <div className="cbv-wa"><div className="cbv-bub" role="button" tabIndex={0} onClick={() => copiar(i.msg!)} onKeyDown={(e) => { if (e.key === 'Enter') copiar(i.msg!); }}>{txt(i.msg)}<em>{ok === i.msg ? 'Copiado ✓' : 'toque para copiar'}</em></div></div>}
              </li>); })}</ul>
          </div>); })}
      </div>}
    </div>
  );
}

/** disparo para os representantes: cada um recebe a mensagem com o link dele e o convite pronto para encaminhar */
const LS_REP = `cb-msg-reps-${LS_V}-enviados`;
function DisparoReps() {
  const o = window.location.origin;
  const reps = useMemo(() => Object.entries(REPRESENTANTES).filter(([s]) => !REPS_FORA.includes(s)).sort((a, b) => a[1].n.localeCompare(b[1].n, 'pt-BR')), []);
  const [env, setEnv] = useState<Record<string, string>>(() => lerLS(LS_REP, {}));
  useEffect(() => { try { localStorage.setItem(LS_REP, JSON.stringify(env)); } catch { /* sem armazenamento */ } }, [env]);
  const [busca, setBusca] = useState('');
  const [flt, setFlt] = useState<'pendentes' | 'enviados' | 'todos'>('pendentes');
  const [ok, setOk] = useState('');
  const link = (s: string) => `${o}/black/r/${s}`;
  const m1 = (i: number, s: string, n: string) => MSG_REP[i % 4].replaceAll('{n}', n).replaceAll('{l}', link(s));
  const m2 = (i: number, s: string) => MSG_CONVITE[(i + 1) % 4].replaceAll('{l}', link(s));
  const copiar = async (k: string, t: string) => { try { await navigator.clipboard.writeText(t); setOk(k); setTimeout(() => setOk(''), 1500); } catch { /* sem área de transferência */ } };
  const IMG = '/black/convite-varejo-loja.jpg';
  const copiarImg = async (k: string) => {
    try {
      const im = new Image(); im.src = IMG; await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d')!.drawImage(im, 0, 0);
      const blob = await new Promise<Blob>((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('imagem'))), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setOk(k); setTimeout(() => setOk(''), 1500);
    } catch { window.open(IMG, '_blank'); }
  };
  const nEnv = reps.filter(([s]) => env[s]).length;
  const q = busca.trim().toLowerCase();
  const lista = reps.map((x, i) => [x, i] as const).filter(([[s, v]]) => (flt === 'todos' || (flt === 'enviados' ? !!env[s] : !env[s])) && (!q || `${v.n} ${v.r}`.toLowerCase().includes(q)));
  return (
    <>
      <div className="cbx-kpis">
        <Kpi l="Representantes" v={int(reps.length)} c="#0A2530" />
        <Kpi l="Enviados" v={int(nEnv)} c="#1F7F88" />
        <Kpi l="Faltam" v={int(reps.length - nEnv)} c="#DA3A2F" />
      </div>
      <div className="cbx-box cbv-kit">
        <img src={IMG} alt="Arte do convite da Black Cardoso Varejo" />
        <div>
          <b>Kit dos representantes <small>· Qua 18/11 · cada linha já tem o link do representante</small></b>
          <ol>
            <li><b>1 · Mensagem</b>: copie, cole na conversa do representante e envie.</li>
            <li><b>2 · Imagem</b>: copie e cole na mesma conversa. O WhatsApp abre o campo de legenda.</li>
            <li><b>3 · Legenda</b>: copie e cole como legenda da imagem. Envie. É esse convite que o representante encaminha aos clientes de loja física.</li>
            <li><b>Marcar enviado</b> e siga para o próximo.</li>
          </ol>
          <p className="cbx-hint" style={{ margin: 0 }}>Para o número não ser bloqueado: salve o representante nos contatos, espere de 1 a 2 minutos entre um e outro, faça blocos de 15 com 10 minutos de pausa e não use lista de transmissão. Os textos variam de um representante para outro. As marcas de enviado ficam neste computador.</p>
          <div className="cbx-acts" style={{ marginTop: 8 }}><a className="btn sm" href={IMG} download="Black-Cardoso-Varejo-convite.jpg">Baixar a imagem</a></div>
        </div>
      </div>
      <div className="cbx-bar">
        {(['pendentes', 'enviados', 'todos'] as const).map((k) => <button key={k} className={`cbx-pill${flt === k ? ' on' : ''}`} onClick={() => setFlt(k)}>{k === 'pendentes' ? 'A enviar' : k === 'enviados' ? 'Enviados' : 'Todos'}<b>{k === 'todos' ? reps.length : k === 'enviados' ? nEnv : reps.length - nEnv}</b></button>)}
        <input type="search" placeholder="Representante ou escritório" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {lista.length === 0 ? <EmptyState title={flt === 'pendentes' ? 'Kit enviado para todos os representantes' : 'Ninguém nesta lista'} hint="" /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Representante</th><th>Link de pré-cadastro</th><th>Situação</th><th /></tr></thead>
            <tbody>{lista.map(([[s, v], i]) => (
              <tr key={s}>
                <td><b>{v.n}</b><small>{v.r}</small></td>
                <td><small style={{ wordBreak: 'break-all' }}>{link(s)}</small></td>
                <td>{env[s] ? <span style={{ color: '#1F7F88', fontWeight: 700 }}>Enviado {dt(env[s])}</span> : <span style={{ color: '#7C8A90' }}>A enviar</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm primary" title={m1(i, s, v.n)} onClick={() => copiar(s + '1', m1(i, s, v.n))}>{ok === s + '1' ? 'Copiada ✓' : '1 · Mensagem'}</button>
                  {' '}<button className="btn sm primary" onClick={() => copiarImg(s + 'i')}>{ok === s + 'i' ? 'Copiada ✓' : '2 · Imagem'}</button>
                  {' '}<button className="btn sm primary" title={m2(i, s)} onClick={() => copiar(s + '2', m2(i, s))}>{ok === s + '2' ? 'Copiada ✓' : '3 · Legenda'}</button>
                  {' '}{env[s]
                    ? <button className="btn ghost sm" onClick={() => setEnv((e) => { const x = { ...e }; delete x[s]; return x; })}>desmarcar</button>
                    : <button className="btn sm" onClick={() => setEnv((e) => ({ ...e, [s]: new Date().toISOString() }))}>Marcar enviado</button>}
                </td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Mensagens({ ins, cfg, peds }: { ins: Inscrito[]; cfg: Cfg; peds: Pedido[] }) {
  const [camp, setCamp] = useState<Camp>(() => campDoDia());
  const [reps, setReps] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) <= '2026-11-20');
  const C = CAMPS.find((c) => c.k === camp)!;
  const [modelos, setModelos] = useState<Record<Camp, string>>(() => Object.fromEntries(CAMPS.map((c) => [c.k, lerLS(lsMod(c.k), c.padrao)])) as Record<Camp, string>);
  const [envs, setEnvs] = useState<Record<Camp, Record<string, string>>>(() => Object.fromEntries(CAMPS.map((c) => [c.k, lerLS(lsEnv(c.k), {})])) as Record<Camp, Record<string, string>>);
  const [live, setLive] = useState(cfg.live_link || '');
  const [flt, setFlt] = useState<'pendentes' | 'enviados' | 'todos'>('pendentes');
  const [busca, setBusca] = useState('');
  const [editar, setEditar] = useState(false);
  const [cars, setCars] = useState<CarRel[]>([]);
  useEffect(() => { CAMPS.forEach((c) => { try { localStorage.setItem(lsMod(c.k), JSON.stringify(modelos[c.k])); } catch { /* sem armazenamento */ } }); }, [modelos]);
  useEffect(() => { CAMPS.forEach((c) => { try { localStorage.setItem(lsEnv(c.k), JSON.stringify(envs[c.k])); } catch { /* sem armazenamento */ } }); }, [envs]);
  const carregar = useCallback(async () => { const { data } = await supabase.rpc('black_carrinhos_relatorio'); setCars(Array.isArray(data) ? (data as CarRel[]) : []); }, []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  const modelo = modelos[camp]; const env = envs[camp];
  const setModelo = (v: string) => setModelos((m) => ({ ...m, [camp]: v }));
  const setEnv = (f: (e: Record<string, string>) => Record<string, string>) => setEnvs((x) => ({ ...x, [camp]: f(x[camp]) }));
  const pedido = `${window.location.origin}/black/pedido`;
  const aprov = ins.filter((i) => i.status === 'aprovado' && i.origem !== 'previa');
  // quem comprou (pedido não cancelado) e a situação do carrinho, pelo CNPJ
  const pedPor = useMemo(() => { const m = new Map<string, Pedido[]>(); peds.filter((p) => p.status !== 'cancelado').forEach((p) => { const k = soDig(p.cnpj); m.set(k, [...(m.get(k) ?? []), p]); }); return m; }, [peds]);
  const carPor = useMemo(() => { const m = new Map<string, CarRel>(); cars.filter((c) => c.situacao === 'ativo' || c.situacao === 'abandonado').forEach((c) => { if (c.itens.length) m.set(soDig(c.cnpj), c); }); return m; }, [cars]);
  const grupo = (i: Inscrito): Camp => { const k = soDig(i.cnpj); if (pedPor.has(k)) return 'comprou'; const c = carPor.get(k); if (c) return c.situacao === 'ativo' ? 'andamento' : 'abandonado'; return 'semcompra'; };
  const todos = (k: Camp) => k === 'live' || k === 'vespera';
  const publico = todos(camp) ? aprov : aprov.filter((i) => grupo(i) === camp);
  const nGrupo = (k: Camp) => (todos(k) ? aprov.length : aprov.filter((i) => grupo(i) === k).length);
  const msg = (i: Inscrito) => {
    const c = carPor.get(soDig(i.cnpj)); const ps = pedPor.get(soDig(i.cnpj)) ?? [];
    return modelo
      .replaceAll('{comprador}', primeiroNome(i.comprador) || 'tudo bem')
      .replaceAll('{loja}', i.fantasia || i.razao_social)
      .replaceAll('{representante}', nomeRep(i.representante))
      .replaceAll('{itens}', c ? c.itens.map((x) => `• ${x.caixas} cx · ${x.nome}`).join('\n') : '')
      .replaceAll('{numero}', ps.map((p) => p.numero).join(', '))
      .replaceAll('{live}', live).replaceAll('{pedido}', pedido);
  };
  const lista = publico.filter((i) => (flt === 'todos' || (flt === 'enviados' ? !!env[i.id] : !env[i.id]))
    && (!busca.trim() || `${i.fantasia} ${i.razao_social} ${i.comprador} ${i.representante} ${i.cidade}`.toLowerCase().includes(busca.trim().toLowerCase())));
  function abrir(i: Inscrito) {
    const tel = telWa(i.celular); if (!tel) return;
    window.open(`https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(msg(i))}`, 'cb-whatsapp');
    setEnv((e) => ({ ...e, [i.id]: new Date().toISOString() }));
  }
  const proximo = publico.find((i) => !env[i.id] && telWa(i.celular));
  const nEnv = publico.filter((i) => env[i.id]).length;
  const detalhe = (i: Inscrito) => { const c = carPor.get(soDig(i.cnpj)); const ps = pedPor.get(soDig(i.cnpj)); if (ps) return `${ps.map((p) => p.numero).join(', ')} · ${brl(ps.reduce((t, p) => t + Number(p.total), 0))}`; if (c) return `${c.caixas} cx · ${brl(Number(c.valor))} no carrinho`; return ''; };
  return (
    <>
      <Cadencia live={live} pedido={pedido} irPara={(k) => { setReps(false); setCamp(k); setEditar(false); setFlt('pendentes'); }} irReps={() => setReps(true)} />
      <div className="cbx-bar" style={{ marginBottom: 10 }}>
        <button className={`cbx-pill${reps ? ' on' : ''}`} title="Qua 18/11" onClick={() => setReps(true)}>Kit dos representantes</button>
        {CAMPS.map((c) => <button key={c.k} className={`cbx-pill${!reps && camp === c.k ? ' on' : ''}`} title={c.quando} onClick={() => { setReps(false); setCamp(c.k); setEditar(false); setFlt('pendentes'); }}>{c.nome}<b>{nGrupo(c.k)}</b></button>)}
      </div>
      {reps ? <DisparoReps /> : <>
      <div className="cbx-kpis">
        <Kpi l={C.nome} v={int(publico.length)} c="#0A2530" />
        <Kpi l="Enviados" v={int(nEnv)} c="#1F7F88" />
        <Kpi l="Faltam" v={int(publico.length - nEnv)} c="#DA3A2F" />
        <Kpi l="Sem WhatsApp" v={int(publico.filter((i) => !telWa(i.celular)).length)} c="#7C8A90" />
      </div>
      <div className="cbx-box" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <b style={{ flex: 1, minWidth: 220 }}>{C.nome} <small style={{ fontWeight: 500, color: 'var(--text-2)' }}>· {C.quando} · {C.publico}</small></b>
          <button className="btn sm" onClick={() => setEditar((v) => !v)}>{editar ? 'Fechar o modelo' : 'Editar a mensagem'}</button>
          <button className="btn sm primary" disabled={!proximo} onClick={() => proximo && abrir(proximo)}>{proximo ? `Abrir o próximo: ${proximo.fantasia || proximo.razao_social}` : 'Todos enviados'}</button>
        </div>
        <p className="cbx-hint" style={{ margin: 0 }}>Clique em <b>Abrir no WhatsApp</b>: a conversa abre no WhatsApp Web (sempre na mesma aba) com a mensagem já escrita. Confira e aperte <b>Enviar</b>. Cada campanha marca os seus enviados neste computador. As listas de carrinho se atualizam a cada minuto: quem fecha o pedido sai de Abandonado/Em andamento e entra em Agradecimento.</p>
        {camp === 'live' && <label className="cbx-hint" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>Link da live
          <input value={live} onChange={(e) => setLive(e.target.value)} style={{ flex: 1, minWidth: 260 }} /></label>}
        {editar && <>
          <textarea value={modelo} onChange={(e) => setModelo(e.target.value)} rows={18} style={{ width: '100%', font: 'inherit', fontSize: 13.5, lineHeight: 1.45 }} />
          <div className="cbx-hint" style={{ margin: 0 }}>Campos trocados em cada mensagem: <code>{'{comprador}'}</code> <code>{'{loja}'}</code> <code>{'{representante}'}</code> <code>{'{pedido}'}</code> <code>{'{itens}'}</code> (carrinho) <code>{'{numero}'}</code> (nº do pedido) <code>{'{live}'}</code> · <button className="btn ghost sm" onClick={() => setModelo(C.padrao)}>voltar ao texto original</button></div>
        </>}
      </div>
      <div className="cbx-bar">
        {(['pendentes', 'enviados', 'todos'] as const).map((k) => <button key={k} className={`cbx-pill${flt === k ? ' on' : ''}`} onClick={() => setFlt(k)}>{k === 'pendentes' ? 'A enviar' : k === 'enviados' ? 'Enviados' : 'Todos'}<b>{k === 'todos' ? publico.length : k === 'enviados' ? nEnv : publico.length - nEnv}</b></button>)}
        <input type="search" placeholder="Loja, comprador, cidade ou representante" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {lista.length === 0 ? <EmptyState title={flt === 'pendentes' && publico.length ? 'Mensagens enviadas para todos desta lista' : 'Ninguém nesta lista agora'} hint={C.publico} /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Loja</th><th>Comprador</th><th>WhatsApp</th><th>Representante</th><th>Situação</th><th></th></tr></thead>
            <tbody>{lista.map((i) => { const tel = telWa(i.celular); const d = detalhe(i); return (
              <tr key={i.id}>
                <td><b>{i.fantasia || i.razao_social}</b><small>{i.cidade}/{i.uf}{d ? ` · ${d}` : ''}</small></td>
                <td>{i.comprador}</td>
                <td>{i.celular || '—'}</td>
                <td>{nomeRep(i.representante)}</td>
                <td>{env[i.id] ? <span style={{ color: '#1F7F88', fontWeight: 700 }}>Enviado {dt(env[i.id])}</span> : <span style={{ color: '#7C8A90' }}>A enviar</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm primary" disabled={!tel} title={tel ? '' : 'Sem celular no cadastro'} onClick={() => abrir(i)}>{env[i.id] ? 'Abrir de novo' : 'Abrir no WhatsApp'}</button>
                  {' '}<button className="btn sm" onClick={() => navigator.clipboard?.writeText(msg(i))}>Copiar</button>
                  {env[i.id] && <>{' '}<button className="btn ghost sm" onClick={() => setEnv((e) => { const x = { ...e }; delete x[i.id]; return x; })}>desmarcar</button></>}
                </td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
      </>}
    </>
  );
}

function Inscritos({ ins, cfg, recarregar }: { ins: Inscrito[]; cfg: Cfg; recarregar: () => void }) {
  const ro = !!useEd().arq;
  const [flt, setFlt] = useState<'todos' | Inscrito['status']>('todos');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Inscrito | null>(null);
  const [link, setLink] = useState('');
  const [pedLink, setPedLink] = useState('');
  const [aviso, setAviso] = useState('');
  const [pdfRep, setPdfRep] = useState(COM_INSCRITOS);
  const repsPdf = useMemo(() => repsInscritos(window.location.origin), []);
  const nRep = (o: string) => ins.filter((x) => x.origem !== 'previa' && x.status !== 'recusado' && (x.representante ?? '').trim() === o).length;
  const prazoIns = (() => { const d = new Date(cfg.inscricoes_ate); const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); const dia = d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(':00', 'h').replace(/^0/, ''); return dia === hoje ? `hoje, às ${h}` : `${d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}, às ${h}`; })();
  const gerarPdf = () => { const r = repsPdf.find((x) => x.ofc === pdfRep); const nome = r ? r.nome.toUpperCase().replace(/\s+/g, '-') : pdfRep === COM_INSCRITOS ? 'COM-INSCRITOS' : 'TODOS'; if (!abrirInscritos(ins, repsPdf, pdfRep, `BLACK-CARDOSO_INSCRITOS_${nome}`, prazoIns)) setAviso('O navegador bloqueou a janela do PDF. Libere pop-ups para o Hub.'); };
  const vis = ins.filter((x) => (flt === 'todos' || x.status === flt)
    && (!busca.trim() || `${x.razao_social} ${x.fantasia} ${x.cnpj} ${x.comprador} ${x.representante}`.toLowerCase().includes(busca.trim().toLowerCase())));
  const n = (s: string) => ins.filter((x) => x.status === s).length;

  async function decidir(x: Inscrito, status: Inscrito['status']) {
    const motivo = status === 'recusado' ? (window.prompt('Motivo da recusa (fica só no Hub):') ?? '') : '';
    const { error } = await supabase.rpc('black_decidir', { p_inscrito: x.id, p_status: status, p_motivo: motivo });
    if (error) { setAviso(`Não consegui salvar: ${error.message}`); return; }
    setAviso(status === 'aprovado' ? `${x.fantasia || x.razao_social} aprovado. Copie a mensagem e envie ao cliente.` : 'Status atualizado.');
    setSel((v) => (v && v.id === x.id ? { ...x, status, motivo } : v)); recarregar();
  }
  async function gerarLink(x: Inscrito) {
    const { data, error } = await supabase.rpc('black_senha_link', { p_inscrito: x.id });
    if (error) { setAviso(`Não consegui gerar: ${error.message}`); return; }
    setLink(`${window.location.origin}/black/senha?t=${data}`);
  }
  const msgAprovado = (x: Inscrito) => `Olá, ${x.comprador.split(' ')[0]}. O cadastro de ${x.fantasia || x.razao_social} na Cardoso Black foi aprovado.\n\n${cfg.canal_link ? `Acesse o canal da Cardoso Black no WhatsApp:\n${cfg.canal_link}\n\n` : ''}A live acontece em ${cfg.live_data}. Os pedidos são feitos somente pelo link ${window.location.origin}/black/pedido, entrando com o CNPJ e a senha cadastrada.`;
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); setAviso('Copiado.'); } catch { setAviso('Não consegui copiar; selecione o texto e copie.'); } };

  return (
    <>
      <div className="cbx-kpis"><Kpi l="Inscritos" v={int(ins.length)} c="#0A2530" /><Kpi l="Aprovados" v={int(n('aprovado'))} c="#1F7F88" /><Kpi l="Em análise" v={int(n('analise'))} c="#F2B84B" /><Kpi l="Recusados" v={int(n('recusado'))} c="#7C8A90" /></div>
      <div className="cbx-bar">
        {(['todos', 'analise', 'aprovado', 'recusado'] as const).map((k) => <button key={k} className={`cbx-pill${flt === k ? ' on' : ''}`} onClick={() => setFlt(k)}>{k === 'todos' ? 'Todos' : ST[k]}<b>{k === 'todos' ? ins.length : n(k)}</b></button>)}
        <input type="search" placeholder="Loja, CNPJ, comprador ou representante" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn ghost sm" onClick={() => baixarCsv('convidados-live-cardoso-black.csv', [['nome', 'email', 'loja', 'cnpj', 'representante'], ...ins.filter((x) => x.status === 'aprovado').map((x) => [x.comprador, x.email, x.fantasia || x.razao_social, x.cnpj, x.representante])])}>Exportar convidados da live</button>
      </div>
      <div className="cbx-box" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ flex: 1, minWidth: 240 }}>Inscritos por representante <small style={{ fontWeight: 500, display: 'block' }}>PDF com os clientes inscritos de cada representante e o link dele para convidar quem falta. Pré-cadastro fecha {prazoIns}.</small></b>
        <select value={pdfRep} onChange={(e) => setPdfRep(e.target.value)} style={{ borderRadius: 999, padding: '7px 12px' }}><option value="">Todos (uma folha por representante)</option><option value={COM_INSCRITOS}>Só quem tem inscritos ({repsPdf.filter((r) => nRep(r.ofc) > 0).length} representantes)</option>{repsPdf.map((r) => <option key={r.ofc} value={r.ofc}>{r.nome} · {r.ofc} ({nRep(r.ofc)})</option>)}</select>
        <button className="btn sm primary" onClick={gerarPdf}>Gerar PDF</button>
      </div>
      {aviso && <div className="alert">{aviso}</div>}
      {vis.length === 0 ? <EmptyState title="Nenhum pré-cadastro" hint="Os cadastros feitos em /black aparecem aqui na hora." /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Loja e canais</th><th>Representante</th><th>Cadastro</th><th>Status</th></tr></thead>
            <tbody>{vis.map((x) => (
              <tr key={x.id} className="click" onClick={() => { setSel(x); setLink(''); setPedLink(''); setAviso(''); }}>
                <td><b>{x.fantasia || x.razao_social}</b><small>{cnpjFmt(x.cnpj)} · {x.comprador} · {x.cidade}/{x.uf}</small>
                  <div className="cbx-chips" style={{ marginTop: 5 }}>{Object.keys(x.canais ?? {}).map((k) => <span key={k}>{CANAL[k] ?? k}</span>)}</div></td>
                <td>{x.representante || '—'}</td>
                <td>{dt(x.criado_em)}</td>
                <td><div style={{ display: 'grid', gap: 5, justifyItems: 'start' }}>
                  <span className={`cbx-st ${x.status}`}>{ST[x.status]}</span>
                  {x.alertas?.filter((a) => a !== 'ddd_outra_uf').length > 0 && <small>{x.alertas.filter((a) => a !== 'ddd_outra_uf').map((a) => ALERTA[a] ?? a).join(' · ')}</small>}
                  {x.status === 'analise' && !ro && <button className="btn sm cbx-ok" type="button" onClick={(e) => { e.stopPropagation(); decidir(x, 'aprovado'); }}>Aprovar</button>}
                </div></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {sel && (
        <Modal title={sel.fantasia || sel.razao_social} onClose={() => setSel(null)} wide>
          <div style={{ display: 'grid', gap: 14 }}>
            <div><span className={`cbx-st ${sel.status}`}>{ST[sel.status]}</span> <span className="cbx-hint" style={{ display: 'inline' }}>{sel.origem === 'carteira' ? 'Encontrado na carteira' : 'Fora da carteira'}</span></div>
            {sel.alertas?.length > 0 && <div className="alert">{sel.alertas.map((a) => ALERTA[a] ?? a).join(' · ')}</div>}
            <dl className="cbx-dl">
              <div><dt>Razão social</dt><dd>{sel.razao_social}</dd></div><div><dt>CNPJ</dt><dd>{cnpjFmt(sel.cnpj)}</dd></div>
              <div><dt>Cidade/UF</dt><dd>{sel.cidade}/{sel.uf}</dd></div><div><dt>Representante</dt><dd>{sel.representante || '—'}{sel.rep_link && sel.rep_link !== sel.representante ? ` (link de ${sel.rep_link})` : ''}</dd></div>
              <div><dt>Comprador</dt><dd>{sel.comprador}</dd></div><div><dt>E-mail</dt><dd>{sel.email}</dd></div><div><dt>Celular</dt><dd>{sel.celular}</dd></div>
              {Object.entries(sel.canais ?? {}).map(([k, v]) => <div key={k}><dt>{CANAL[k] ?? k}</dt><dd>{/^https?:\/\//.test(v) || /\.[a-z]{2,}/i.test(v) ? <a href={/^https?:/.test(v) ? v : `https://${v}`} target="_blank" rel="noreferrer">{v}</a> : v}</dd></div>)}
              {sel.motivo && <div><dt>Motivo</dt><dd>{sel.motivo}</dd></div>}
            </dl>
            <div className="cbx-acts">
              {!ro && <>
              {sel.status !== 'aprovado' && <button className="btn" onClick={() => decidir(sel, 'aprovado')}>Aprovar</button>}
              {sel.status !== 'recusado' && <button className="btn ghost" onClick={() => decidir(sel, 'recusado')}>Recusar</button>}
              {sel.status === 'recusado' && <button className="btn ghost" onClick={() => decidir(sel, 'analise')}>Voltar para análise</button>}
              {sel.status === 'aprovado' && <button className="btn" onClick={async () => { setPedLink(''); const r = await linkComoCliente(sel.id); if (r.link) { setPedLink(r.link); try { await navigator.clipboard.writeText(r.link); } catch { /* sem área de transferência */ } setAviso(''); } else setAviso(r.erro ?? ''); }}>Fazer pedido por este cliente</button>}
              {sel.status === 'aprovado' && <button className="btn ghost" onClick={() => copiar(msgAprovado(sel))}>Copiar mensagem de aprovação</button>}
              <button className="btn ghost" onClick={() => gerarLink(sel)}>Gerar link de nova senha</button>
              </>}
              {sel.celular && <a className="btn ghost" href={`https://wa.me/55${sel.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
            </div>
            {pedLink && <div className="alert"><b>Link copiado.</b> Cole no Google Chrome para fazer o pedido como {sel.fantasia || sel.razao_social} (vale 3 horas; use um cliente por vez em cada navegador): <b style={{ wordBreak: 'break-all' }}>{pedLink}</b> <button className="btn sm" onClick={() => copiar(pedLink)}>Copiar de novo</button></div>}
            {link && <div className="alert">Link de nova senha (vale 3 dias): <b style={{ wordBreak: 'break-all' }}>{link}</b> <button className="btn sm" onClick={() => copiar(link)}>Copiar</button></div>}
            {aviso && <p className="cbx-hint">{aviso}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ================= Pedidos ================= */
type CarRel = {
  id: string; criado_em: string; atualizado_em: string; visto_em: string; finalizado_em: string | null;
  situacao: 'ativo' | 'abandonado' | 'finalizado' | 'vazio'; fantasia: string; razao_social: string; cnpj: string; cidade: string; uf: string;
  representante: string; comprador: string; celular: string; email: string; pedido: string | null; caixas: number; valor: number;
  itens: { codigo: string; nome: string; caixas: number }[]; mudancas: number; retirados: { codigo: string; max: number }[];
};
const SIT: Record<CarRel['situacao'], string> = { ativo: 'Em andamento', abandonado: 'Abandonado', finalizado: 'Finalizado', vazio: 'Vazio' };
const SITC: Record<CarRel['situacao'], string> = { ativo: '#F2B84B', abandonado: '#DA3A2F', finalizado: '#1F7F88', vazio: '#7C8A90' };
/* carrinhos da Black: abandonados, em andamento e finalizados (cada mudança de quantidade fica registrada) */
/* filtros comuns de Pedidos e Carrinhos: representante, UF, produto e ordem */
type Ordem = 'recente' | 'antigo' | 'valor' | 'caixas';
function Filtros({ reps, ufs, prods, f, set }: {
  reps: string[]; ufs: string[]; prods: [string, string][];
  f: { rep: string; uf: string; prod: string; ordem: Ordem }; set: (k: 'rep' | 'uf' | 'prod' | 'ordem', v: string) => void;
}) {
  const ativo = f.rep || f.uf || f.prod || f.ordem !== 'recente';
  return (
    <div className="cbx-bar">
      <select value={f.rep} onChange={(e) => set('rep', e.target.value)}><option value="">Todos os representantes</option>{reps.map((r) => <option key={r} value={r}>{r}</option>)}</select>
      <select value={f.uf} onChange={(e) => set('uf', e.target.value)}><option value="">Todos os estados</option>{ufs.map((u) => <option key={u} value={u}>{u}</option>)}</select>
      <select value={f.prod} onChange={(e) => set('prod', e.target.value)}><option value="">Todos os produtos</option>{prods.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</select>
      <select value={f.ordem} onChange={(e) => set('ordem', e.target.value)}>
        <option value="recente">Mais recentes primeiro</option><option value="antigo">Mais antigos primeiro</option><option value="valor">Maior valor</option><option value="caixas">Mais caixas</option>
      </select>
      {ativo && <button className="btn ghost sm" onClick={() => { set('rep', ''); set('uf', ''); set('prod', ''); set('ordem', 'recente'); }}>Limpar filtros</button>}
    </div>
  );
}
const unicos = (v: (string | null | undefined)[]) => [...new Set(v.map((x) => (x ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

function Carrinhos({ ins, peds, fechaEm }: { ins: Inscrito[]; peds: Pedido[]; fechaEm: string | null }) {
  const { arq } = useEd();
  const congelado = !!fechaEm && Date.now() >= new Date(fechaEm).getTime();
  const [rel, setRel] = useState<CarRel[] | null>(null);
  const [erro, setErro] = useState('');
  const [flt, setFlt] = useState<'todos' | CarRel['situacao']>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [fx, setFx] = useState<{ rep: string; uf: string; prod: string; ordem: Ordem }>({ rep: '', uf: '', prod: '', ordem: 'recente' });
  const [relRep, setRelRep] = useState('');
  const repsRel = useMemo(() => unicos([...ins.filter((i) => i.status === 'aprovado').map((i) => i.representante), ...peds.map((p) => p.representante)]), [ins, peds]);
  const arqRel = (r: string) => 'CARDOSO_BLACK-CARDOSO_RELACAO_' + (r || 'TODOS').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const carregar = useCallback(async () => {
    const { data, error } = await carrinhosRel(arq);
    if (error) { setErro(error.message.includes('black_carrinhos_relatorio') ? `Para ver os carrinhos${arq ? ' desta edição' : ''}, rode o SQL ${arq ? '0181' : '0172'} no Supabase.` : error.message); setRel([]); return; }
    setErro(''); setRel(Array.isArray(data) ? (data as CarRel[]) : []);
  }, [arq]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  const L = (rel ?? []).filter((c) => c.situacao !== 'vazio');
  const n = (k: CarRel['situacao']) => L.filter((c) => c.situacao === k);
  const soma = (x: CarRel[]) => x.reduce((t, c) => t + Number(c.valor), 0);
  const conv = L.length ? Math.round((n('finalizado').length / L.length) * 100) : 0;
  const vis = L.filter((c) => (flt === 'todos' || c.situacao === flt)
    && (!busca.trim() || `${c.fantasia} ${c.razao_social} ${c.cnpj} ${c.representante} ${c.cidade}`.toLowerCase().includes(busca.trim().toLowerCase()))
    && (!fx.rep || (c.representante ?? '').trim() === fx.rep) && (!fx.uf || c.uf === fx.uf)
    && (!fx.prod || c.itens.some((i) => i.codigo === fx.prod)))
    .sort((a, b) => fx.ordem === 'valor' ? Number(b.valor) - Number(a.valor) : fx.ordem === 'caixas' ? b.caixas - a.caixas
      : fx.ordem === 'antigo' ? a.atualizado_em.localeCompare(b.atualizado_em) : b.atualizado_em.localeCompare(a.atualizado_em));
  const prodsCar = useMemo(() => { const m = new Map<string, string>(); (rel ?? []).forEach((c) => c.itens.forEach((i) => m.set(i.codigo, i.nome))); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [rel]);
  const cxProd = (c: CarRel) => (fx.prod ? c.itens.find((i) => i.codigo === fx.prod)?.caixas ?? 0 : c.caixas);
  // produtos deixados em carrinhos abandonados
  const prodAb = useMemo(() => {
    const m: Record<string, { nome: string; caixas: number; lojas: number }> = {};
    (rel ?? []).filter((c) => c.situacao === 'abandonado').forEach((c) => c.itens.forEach((i) => { m[i.codigo] ??= { nome: i.nome, caixas: 0, lojas: 0 }; m[i.codigo].caixas += i.caixas; m[i.codigo].lojas++; }));
    return Object.entries(m).sort((a, b) => b[1].caixas - a[1].caixas);
  }, [rel]);
  function csv() {
    baixarCsv('carrinhos-cardoso-black.csv', [
      ['situacao', 'loja', 'razao_social', 'cnpj', 'cidade', 'uf', 'representante', 'comprador', 'whatsapp', 'email', 'criado_em', 'ultima_mudanca', 'ultima_visita', 'finalizado_em', 'pedido', 'caixas', 'valor_produtos', 'mudancas', 'itens', 'retirou_do_carrinho'],
      ...vis.map((c) => [SIT[c.situacao], c.fantasia, c.razao_social, c.cnpj, c.cidade, c.uf, c.representante, c.comprador, c.celular, c.email, dt(c.criado_em), dt(c.atualizado_em), dt(c.visto_em), dt(c.finalizado_em), c.pedido ?? '', c.caixas, Number(c.valor).toFixed(2).replace('.', ','), c.mudancas,
        c.itens.map((i) => `${i.codigo} ${i.nome} (${i.caixas} cx)`).join(' | '), c.retirados.map((r) => `${r.codigo} (chegou a ${r.max} cx)`).join(' | ')]),
    ]);
  }
  if (rel === null) return <div className="cbx-hint">Carregando carrinhos…</div>;
  return (
    <>
      {erro && <div className="alert">{erro}</div>}
      {congelado && <div className="alert" style={{ background: '#0E0E10', color: '#fff', borderColor: '#0E0E10' }}><b>Black encerrada em {dt(fechaEm)}: carrinhos congelados.</b> Ninguém consegue mais enviar pedido nem mexer no carrinho. Os carrinhos com produtos que não viraram pedido aparecem como <b>Congelado · não enviado</b>.</div>}
      <div className="cbx-kpis">
        <Kpi l={congelado ? 'Congelados (não enviados)' : 'Abandonados'} v={`${int(n('abandonado').length)} · ${brl0(soma(n('abandonado')))}`} c="#DA3A2F" />
        <Kpi l="Em andamento agora" v={`${int(n('ativo').length)} · ${brl0(soma(n('ativo')))}`} c="#F2B84B" />
        <Kpi l="Finalizados" v={`${int(n('finalizado').length)} · ${brl0(soma(n('finalizado')))}`} c="#1F7F88" />
        <Kpi l="Conversão de carrinho" v={`${conv}%`} c="#0A2530" />
      </div>
      <div className="cbx-bar">
        {(['todos', 'abandonado', 'ativo', 'finalizado'] as const).map((k) => <button key={k} className={`cbx-pill${flt === k ? ' on' : ''}`} onClick={() => setFlt(k)}>{k === 'todos' ? 'Todos' : SIT[k]}<b>{k === 'todos' ? L.length : n(k).length}</b></button>)}
        <input type="search" placeholder="Loja, CNPJ, cidade ou representante" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn sm" onClick={csv}>Baixar relatório (CSV)</button>
      </div>
      <div className="cbx-box" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ flex: 1, minWidth: 240 }}>Relação para o representante <small style={{ fontWeight: 500, display: 'block' }}>Pedidos concluídos, carrinhos sem fechar e inscritos que não compraram, em PDF.</small></b>
        <select value={relRep} onChange={(e) => setRelRep(e.target.value)} style={{ borderRadius: 999, padding: '7px 12px' }}><option value="">Todos (uma folha por representante)</option>{repsRel.map((r) => { const n = L.filter((c) => (c.situacao === 'abandonado' || c.situacao === 'ativo') && (c.representante ?? '').trim() === r && !peds.some((p) => p.status !== 'cancelado' && p.cnpj.replace(/\D/g, '') === c.cnpj.replace(/\D/g, ''))).length; return <option key={r} value={r}>{r}{n ? ` · ⚠ ${n} carrinho${n > 1 ? 's' : ''} parado${n > 1 ? 's' : ''}` : ''}</option>; })}</select>
        <button className="btn sm primary" onClick={() => { if (!abrirRelacao(ins, peds, rel ?? [], relRep, arqRel(relRep))) setErro('O navegador bloqueou a janela do PDF. Libere pop-ups para o Hub.'); }}>Gerar PDF</button>
      </div>
      <Filtros reps={unicos(L.map((c) => c.representante))} ufs={unicos(L.map((c) => c.uf))} prods={prodsCar} f={fx} set={(k, v) => setFx((x) => ({ ...x, [k]: v }))} />
      <p className="cbx-hint"><b>{int(vis.length)} carrinho{vis.length === 1 ? '' : 's'}</b> · {brl(soma(vis))} em produtos · {int(vis.reduce((t, c) => t + cxProd(c), 0))} caixas{fx.prod ? ` de ${fx.prod}` : ''}. O CSV baixa só o que está filtrado.</p>
      <p className="cbx-hint">A caixa no carrinho sai do estoque de todos na hora. Carrinho parado há mais de 30 minutos (cliente saiu da página) devolve o estoque e passa a <b>Abandonado</b>; se o cliente voltar, ele reserva de novo o que ainda houver. Atualiza a cada minuto.</p>
      {vis.length === 0 ? <EmptyState title="Nenhum carrinho" hint="Os carrinhos aparecem aqui assim que o cliente coloca a primeira caixa." /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Loja</th><th>Representante</th><th>Situação</th><th className="num">Caixas</th><th className="num">Produtos</th><th>Última mudança</th><th>Pedido</th></tr></thead>
            <tbody>{vis.map((c) => (
              <Fragment key={c.id}>
                <tr className="click" onClick={() => setAberto(aberto === c.id ? null : c.id)}>
                  <td><b>{c.fantasia || c.razao_social}</b><small>{cnpjFmt(c.cnpj)} · {c.cidade}/{c.uf}</small></td>
                  <td>{c.representante || '—'}</td>
                  <td><b style={{ color: SITC[c.situacao] }}>{congelado && (c.situacao === 'ativo' || c.situacao === 'abandonado') ? 'Congelado · não enviado' : SIT[c.situacao]}</b></td>
                  <td className="num">{c.caixas}</td>
                  <td className="num">{brl(Number(c.valor))}</td>
                  <td>{dt(c.atualizado_em)}<small>visto {dt(c.visto_em)}</small></td>
                  <td>{c.pedido ?? '—'}</td>
                </tr>
                {aberto === c.id && (
                  <tr><td colSpan={7} style={{ background: 'var(--surface-2)' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {c.itens.map((i) => <div key={i.codigo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{i.codigo} · {i.nome}</span><b>{i.caixas} cx</b></div>)}
                      {c.retirados.length > 0 && <small>Retirou do carrinho: {c.retirados.map((r) => `${r.codigo} (chegou a ${r.max} cx)`).join(', ')}</small>}
                      <small>Comprador: {c.comprador} · {c.email} · {c.celular} · {c.mudancas} mudança{c.mudancas === 1 ? '' : 's'} de quantidade · criado {dt(c.criado_em)}</small>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}</tbody>
          </table>
        </div>
      )}
      {prodAb.length > 0 && (
        <div className="cbx-box" style={{ marginTop: 14 }}>
          <h3>Produtos deixados em carrinhos abandonados</h3>
          <table className="cbx-table"><thead><tr><th>Produto</th><th className="num">Caixas</th><th className="num">Lojas</th></tr></thead>
            <tbody>{prodAb.map(([cod, x]) => <tr key={cod}><td>{cod} · {x.nome}</td><td className="num">{x.caixas}</td><td className="num">{x.lojas}</td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}

const CAMPO: Record<string, string> = { razao_social: 'Razão social', fantasia: 'Nome fantasia', cnpj: 'CNPJ', cidade: 'Cidade', uf: 'UF', representante: 'Representante', comprador: 'Comprador', email: 'E-mail', celular: 'WhatsApp', observacao: 'Observação' };
// quem fez a última alteração de produtos: a equipe (registrada em edicoes) ou o cliente
function quemAlterou(p: Pedido) {
  const e = [...(p.edicoes ?? [])].reverse().find((x) => x.tipo === 'itens');
  return e && p.alterado_em && Math.abs(new Date(e.em).getTime() - new Date(p.alterado_em).getTime()) < 5000 ? `pela equipe (${e.por})` : 'pelo cliente';
}
const AVISO: Record<string, (a: Record<string, unknown>) => string> = {
  estoque: (a) => `${a.codigo}: só há ${a.disponivel} cx disponíveis`,
  minimo: (a) => `o pedido fica em ${brl(Number(a.total))}, abaixo do mínimo de ${brl(Number(a.minimo))}`,
  limite: (a) => `Totokinhas 0300/0301 somam ${brl(Number(a.valor))}, acima do limite de ${brl(Number(a.maximo))}`,
  inativo: (a) => `${a.codigo} está fora da Black (inativo)`,
};
/* a equipe edita o pedido do cliente: dados cadastrais e produtos (quantidade, incluir, tirar) */
function EditarPedido({ p, itens, bps, porCodigo, fechar, salvo }: { p: Pedido; itens: Item[]; bps: BP[]; porCodigo: Record<string, Prod>; fechar: () => void; salvo: (msg: string) => void }) {
  const campos = ['razao_social', 'fantasia', 'cnpj', 'cidade', 'uf', 'representante', 'comprador', 'email', 'celular', 'observacao'] as const;
  const [dados, setDados] = useState<Record<string, string>>(() => Object.fromEntries(campos.map((k) => [k, String(p[k] ?? '')])));
  const [cadastro, setCadastro] = useState(true);
  const [qt, setQt] = useState<Record<string, number>>(() => Object.fromEntries(itens.map((i) => [i.codigo, i.caixas])));
  const [novo, setNovo] = useState({ codigo: '', caixas: '' });
  const [motivo, setMotivo] = useState('');
  const [avisos, setAvisos] = useState<Record<string, unknown>[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const nomeDe = (c: string) => itens.find((i) => i.codigo === c)?.nome || bps.find((b) => b.codigo === c)?.nome || porCodigo[c]?.packaging_name || porCodigo[c]?.name || c;
  const linha = (c: string) => { const i = itens.find((x) => x.codigo === c); const b = bps.find((x) => x.codigo === c);
    const pc = i?.pecas_caixa ?? b?.caixa_qtd ?? porCodigo[c]?.carton_quantity ?? 1; const pr = i ? Number(i.preco_peca) : Number(b?.preco_peca ?? 0); return { pc, pr, novo: !i }; };
  const codigos = [...new Set([...itens.map((i) => i.codigo), ...Object.keys(qt)])];
  const total = codigos.reduce((t, c) => { const l = linha(c); return t + (qt[c] ?? 0) * l.pc * l.pr; }, 0);
  const mudouDados = campos.some((k) => (dados[k] ?? '') !== String(p[k] ?? ''));
  const mudouItens = codigos.some((c) => (qt[c] ?? 0) !== (itens.find((i) => i.codigo === c)?.caixas ?? 0));
  const opcoes = bps.filter((b) => !(b.codigo in qt)).sort((a, b) => a.codigo.localeCompare(b.codigo));
  function incluir() { const n = Math.floor(Number(novo.caixas)); if (!novo.codigo || !(n > 0)) return; setQt((q) => ({ ...q, [novo.codigo]: n })); setNovo({ codigo: '', caixas: '' }); setAvisos(null); }
  async function salvar(forcar = false) {
    setErro(''); setSalvando(true); const msgs: string[] = [];
    try {
      if (mudouDados) {
        const { data, error } = await supabase.rpc('black_pedido_admin_dados', { p_pedido: p.id, p_dados: dados, p_cadastro: cadastro });
        if (error) throw new Error(error.message);
        const r = data as { erro?: string }; if (!r?.erro) msgs.push(`dados do cliente${cadastro ? ' (pedido e cadastro)' : ''}`);
      }
      if (mudouItens) {
        const lista = Object.entries(qt).filter(([, n]) => n > 0).map(([codigo, caixas]) => ({ codigo, caixas }));
        if (!lista.length) throw new Error('O pedido precisa de pelo menos um produto. Para tirar tudo, mude o status para Cancelado.');
        const { data, error } = await supabase.rpc('black_pedido_admin_itens', { p_pedido: p.id, p_itens: lista, p_forcar: forcar, p_motivo: motivo });
        if (error) throw new Error(error.message);
        const r = data as { erro?: string; avisos?: Record<string, unknown>[]; codigo?: string; versao?: number };
        if (r?.erro === 'avisos') { setAvisos(r.avisos ?? []); if (msgs.length) salvo(`${p.numero}: ${msgs.join(' e ')} salvo. Os produtos ainda não: veja os avisos.`); return; }
        if (r?.erro === 'produto') throw new Error(`O produto ${r.codigo} não tem preço na Black.`);
        if (r?.erro && r.erro !== 'igual') throw new Error(`Não consegui salvar (${r.erro}).`);
        if (!r?.erro) msgs.push(`produtos (agora versão ${r.versao})`);
      }
      salvo(msgs.length ? `${p.numero}: ${msgs.join(' e ')} salvo.` : 'Nada mudou.');
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setSalvando(false); }
  }
  const inp: React.CSSProperties = { width: '100%' };
  return (
    <div className="cbx-box" style={{ display: 'grid', gap: 14, background: 'var(--surface)', margin: '4px 0' }}>
      <div>
        <b>Dados do cliente</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, marginTop: 8 }}>
          {campos.map((k) => <label key={k} style={{ display: 'grid', gap: 3, fontSize: 12 }}>{CAMPO[k]}
            {k === 'observacao' ? <textarea rows={2} style={inp} value={dados[k]} onChange={(e) => setDados((d) => ({ ...d, [k]: e.target.value }))} />
              : <input style={inp} value={dados[k]} maxLength={k === 'uf' ? 2 : undefined} onChange={(e) => setDados((d) => ({ ...d, [k]: e.target.value }))} />}</label>)}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={cadastro} onChange={(e) => setCadastro(e.target.checked)} />Atualizar também o cadastro do cliente (inscrição), não só este pedido</label>
      </div>
      <div>
        <b>Produtos</b> <small style={{ display: 'inline' }}>· zere a quantidade para tirar o produto</small>
        <table className="cbx-table" style={{ marginTop: 6 }}>
          <thead><tr><th>Produto</th><th className="num">Caixas</th><th className="num">Pç/cx</th><th className="num">Preço pç</th><th className="num">Total</th><th></th></tr></thead>
          <tbody>{codigos.map((c) => { const l = linha(c); const n = qt[c] ?? 0; const antes = itens.find((i) => i.codigo === c)?.caixas ?? 0; return (
            <tr key={c} style={{ opacity: n ? 1 : 0.5 }}>
              <td>{c} · {nomeDe(c)}{l.novo && <small style={{ display: 'inline', color: '#1F7F88', fontWeight: 700 }}> novo</small>}{n !== antes && !l.novo && <small style={{ display: 'inline', color: '#DA3A2F', fontWeight: 700 }}> era {antes}</small>}</td>
              <td className="num"><input type="number" min={0} step={1} value={n} style={{ width: 80, textAlign: 'right' }} onChange={(e) => { setQt((q) => ({ ...q, [c]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })); setAvisos(null); }} /></td>
              <td className="num">{l.pc}</td><td className="num">{brl(l.pr)}</td><td className="num">{brl(n * l.pc * l.pr)}</td>
              <td>{n > 0 ? <button className="btn ghost sm" onClick={() => { setQt((q) => ({ ...q, [c]: 0 })); setAvisos(null); }}>Tirar</button> : l.novo ? <button className="btn ghost sm" onClick={() => setQt((q) => { const x = { ...q }; delete x[c]; return x; })}>Desfazer</button> : null}</td>
            </tr>); })}</tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <select value={novo.codigo} onChange={(e) => setNovo((x) => ({ ...x, codigo: e.target.value }))} style={{ maxWidth: 360 }}>
            <option value="">Incluir produto…</option>
            {opcoes.map((b) => <option key={b.codigo} value={b.codigo}>{b.codigo} · {nomeDe(b.codigo)}{b.ativo ? '' : ' (fora da Black)'}</option>)}
          </select>
          <input type="number" min={1} placeholder="caixas" value={novo.caixas} onChange={(e) => setNovo((x) => ({ ...x, caixas: e.target.value }))} style={{ width: 90 }} />
          <button className="btn sm" disabled={!novo.codigo || !(Number(novo.caixas) > 0)} onClick={incluir}>Incluir</button>
          <span style={{ marginLeft: 'auto' }}>Novo total em produtos: <b>{brl(total)}</b> <small style={{ display: 'inline' }}>(antes {brl(Number(p.total))}; produto novo entra com o preço Black atual)</small></span>
        </div>
        {mudouItens && <label style={{ display: 'grid', gap: 3, fontSize: 12, marginTop: 8 }}>Motivo da alteração (fica no histórico)<input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: pedido do representante por WhatsApp" /></label>}
      </div>
      {avisos && <div className="alert" style={{ margin: 0 }}><b>Antes de salvar os produtos, confira:</b><ul style={{ margin: '6px 0 8px 18px' }}>{avisos.map((a, k) => <li key={k}>{AVISO[String(a.tipo)]?.(a) ?? String(a.tipo)}</li>)}</ul>
        <button className="btn sm primary" disabled={salvando} onClick={() => salvar(true)}>Salvar mesmo assim</button> <button className="btn ghost sm" onClick={() => setAvisos(null)}>Voltar e ajustar</button></div>}
      {erro && <div className="alert" style={{ margin: 0 }}>{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary" disabled={salvando || (!mudouDados && !mudouItens) || !!avisos} onClick={() => salvar(false)}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
        <button className="btn ghost" onClick={fechar}>Cancelar</button>
        <small style={{ alignSelf: 'center' }}>Alterar produtos gera uma nova versão do pedido (o PDF do representante mostra o que mudou). O cliente não é avisado.</small>
      </div>
    </div>
  );
}

function Pedidos({ peds, itens, cart, porCodigo, bps, fechaEm, recarregar }: { peds: Pedido[]; itens: Item[]; cart: Cart[]; porCodigo: Record<string, Prod>; bps: BP[]; fechaEm: string | null; recarregar: () => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const ro = !!useEd().arq;
  const aposFechar = (p: Pedido) => !!fechaEm && (p.criado_em > fechaEm || (!!p.alterado_em && p.alterado_em > fechaEm));
  const { profile } = useAuth();
  const [flt, setFlt] = useState<'todos' | 'alterados' | Pedido['status']>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [fx, setFx] = useState<{ rep: string; uf: string; prod: string; ordem: Ordem }>({ rep: '', uf: '', prod: '', ordem: 'recente' });
  const comProd = useMemo(() => { const m = new Map<string, Set<string>>(); itens.forEach((i) => { if (!m.has(i.codigo)) m.set(i.codigo, new Set()); m.get(i.codigo)!.add(i.pedido_id); }); return m; }, [itens]);
  const prodsPed = useMemo(() => { const m = new Map<string, string>(); itens.forEach((i) => m.set(i.codigo, i.nome)); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [itens]);
  const vis = peds.filter((p) => (flt === 'todos' || (flt === 'alterados' ? (p.versao ?? 1) > 1 : p.status === flt))
    && (!busca.trim() || `${p.numero} ${p.razao_social} ${p.fantasia} ${p.cnpj} ${p.representante}`.toLowerCase().includes(busca.trim().toLowerCase()))
    && (!fx.rep || (p.representante ?? '').trim() === fx.rep) && (!fx.uf || p.uf === fx.uf)
    && (!fx.prod || !!comProd.get(fx.prod)?.has(p.id)))
    .sort((a, b) => fx.ordem === 'valor' ? Number(b.total) - Number(a.total) : fx.ordem === 'caixas' ? b.caixas - a.caixas
      : fx.ordem === 'antigo' ? a.criado_em.localeCompare(b.criado_em) : b.criado_em.localeCompare(a.criado_em));
  const visOk = vis.filter((p) => p.status !== 'cancelado');
  const imgs = useMemo(() => Object.fromEntries(Object.values(porCodigo).filter((p) => p.image_url).map((p) => [p.code, p.image_url])), [porCodigo]);
  // nome do arquivo: CARDOSO_BLACK-CARDOSO_<pedido>_<cliente>
  const arq = (...partes: string[]) => 'CARDOSO_BLACK-CARDOSO_' + partes.map((x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean).join('_');
  function pdf(L: Pedido[], titulo: string) { if (!abrirEspelhos(L, itens, cart, titulo, imgs)) setAviso('O navegador bloqueou a janela do PDF. Libere pop-ups para o Hub e tente de novo.'); }
  const itProd = fx.prod ? itens.filter((i) => i.codigo === fx.prod && visOk.some((p) => p.id === i.pedido_id)) : [];
  const val = peds.filter((p) => p.status !== 'cancelado'); const tv = val.reduce((s, p) => s + Number(p.total), 0);
  async function status(p: Pedido, s: Pedido['status']) {
    const { error } = await supabase.from('black_pedidos').update({ status: s, atualizado_em: new Date().toISOString(), atualizado_por: profile?.id ?? null }).eq('id', p.id);
    setAviso(error ? `Não consegui salvar: ${error.message}` : `${p.numero}: ${ST[s]}`); if (!error) recarregar();
  }
  function guarani(soConfirmados: boolean) {
    const L = peds.filter((p) => (soConfirmados ? p.status === 'confirmado' : p.status !== 'cancelado'));
    const ids = new Map(L.map((p) => [p.id, p]));
    baixarCsv(`pedidos-cardoso-black${soConfirmados ? '-confirmados' : ''}.csv`, [
      ['pedido', 'data', 'status', 'cnpj', 'razao_social', 'cidade', 'uf', 'representante', 'comprador', 'email', 'whatsapp', 'codigo', 'produto', 'caixas', 'pecas_por_caixa', 'pecas', 'preco_peca', 'total_item', 'produtos_pedido', 'ipi_pedido', 'total_pedido_com_ipi', 'frete', 'observacao'],
      ...itens.filter((i) => ids.has(i.pedido_id)).map((i) => { const p = ids.get(i.pedido_id)!; return [p.numero, dt(p.criado_em), ST[p.status], p.cnpj, p.razao_social, p.cidade, p.uf, p.representante, p.comprador, p.email, p.celular, i.codigo, i.nome, i.caixas, i.pecas_caixa, i.caixas * i.pecas_caixa, String(i.preco_peca).replace('.', ','), Number(i.total).toFixed(2).replace('.', ','), Number(p.total).toFixed(2).replace('.', ','), Number(p.ipi ?? 0).toFixed(2).replace('.', ','), Number(p.total_com_ipi ?? p.total).toFixed(2).replace('.', ','), p.frete, p.observacao]; }),
    ]);
  }
  return (
    <>
      <div className="cbx-kpis"><Kpi l="Valor em produtos (sem IPI)" v={brl0(tv)} c="#DA3A2F" /><Kpi l="Pedidos" v={int(val.length)} /><Kpi l="Confirmados" v={int(peds.filter((p) => p.status === 'confirmado').length)} c="#1F7F88" /><Kpi l="A confirmar" v={int(peds.filter((p) => p.status === 'recebido').length)} c="#F2B84B" /></div>
      <div className="cbx-bar">
        {(['todos', 'recebido', 'confirmado', 'cancelado', 'alterados'] as const).map((k) => <button key={k} className={`cbx-pill${flt === k ? ' on' : ''}`} onClick={() => setFlt(k)}>{k === 'todos' ? 'Todos' : k === 'alterados' ? 'Alterados' : ST[k]}<b>{k === 'todos' ? peds.length : k === 'alterados' ? peds.filter((p) => (p.versao ?? 1) > 1).length : peds.filter((p) => p.status === k).length}</b></button>)}
        <input type="search" placeholder="Pedido, loja, CNPJ ou representante" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn sm" onClick={() => guarani(true)}>Planilha Guarani (confirmados)</button>
        <button className="btn ghost sm" onClick={() => guarani(false)}>Todos os pedidos</button>
        <button className="btn sm primary" disabled={!visOk.length} onClick={() => pdf(visOk, arq('PEDIDOS', fx.rep || 'GERAL'))}>PDF geral{fx.rep ? ` · ${fx.rep}` : ''} ({visOk.length})</button>
      </div>
      <Filtros reps={unicos(peds.map((p) => p.representante))} ufs={unicos(peds.map((p) => p.uf))} prods={prodsPed} f={fx} set={(k, v) => setFx((x) => ({ ...x, [k]: v }))} />
      <p className="cbx-hint"><b>{int(vis.length)} pedido{vis.length === 1 ? '' : 's'}</b> no filtro · {brl(visOk.reduce((t, p) => t + Number(p.total), 0))} em produtos, sem IPI · {int(visOk.reduce((t, p) => t + p.caixas, 0))} caixas (sem os cancelados){fx.prod ? ` · ${fx.prod}: ${int(itProd.reduce((t, i) => t + i.caixas, 0))} cx, ${int(itProd.reduce((t, i) => t + i.caixas * i.pecas_caixa, 0))} pç, ${brl(itProd.reduce((t, i) => t + Number(i.total), 0))}` : ''}</p>
      {!ro && <p className="cbx-hint">Mude para <b>Confirmado</b> quando o pedido for lançado no Guarani: a partir daí o estoque dele passa a ser contado pelo saldo do Guarani.</p>}
      {aviso && <div className="alert">{aviso}</div>}
      {vis.length === 0 ? <EmptyState title="Nenhum pedido" hint="Os pedidos enviados pelo link aparecem aqui na hora." /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Pedido</th><th>Loja</th><th>Representante</th><th className="num">Caixas</th><th className="num">Produtos</th><th className="num">Total c/ IPI</th><th>PDF · Status</th></tr></thead>
            <tbody>{vis.map((p) => (
              <Fragment key={p.id}>
                <tr className="click" onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                  <td><b>{p.numero}</b>{(p.versao ?? 1) > 1 && <span style={{ marginLeft: 6, background: '#DA3A2F', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>ALTERADO · v{p.versao}</span>}{!!p.edicoes?.length && <span style={{ marginLeft: 6, background: '#1F7F88', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>EDITADO PELA EQUIPE</span>}{aposFechar(p) && <span style={{ marginLeft: 6, background: '#0E0E10', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>LIBERADO APÓS 12H</span>}<small>{dt(p.criado_em)}{p.alterado_em ? ` · alterado ${dt(p.alterado_em)}` : ''}</small></td>
                  <td><b>{p.fantasia || p.razao_social}</b><small>{cnpjFmt(p.cnpj)} · {p.cidade}/{p.uf}</small></td>
                  <td>{p.representante || '—'}</td>
                  <td className="num">{p.caixas}</td>
                  <td className="num">{brl(Number(p.total))}</td>
                  <td className="num"><b>{brl(Number(p.total_com_ipi ?? p.total))}</b>{Number(p.ipi) > 0 && <small>IPI {brl(Number(p.ipi))}</small>}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm" title="Imprimir ou salvar o PDF deste pedido" onClick={() => pdf([p], arq((p.versao ?? 1) > 1 ? `${p.numero}-V${p.versao}` : p.numero, p.fantasia || p.razao_social))}>PDF</button>{' '}
                    {ro ? <span className={`cbx-st ${p.status}`}>{ST[p.status]}</span> : <select value={p.status} onChange={(e) => status(p, e.target.value as Pedido['status'])}>{(['recebido', 'confirmado', 'cancelado'] as const).map((s) => <option key={s} value={s}>{ST[s]}</option>)}</select>}
                  </td>
                </tr>
                {aberto === p.id && (
                  <tr><td colSpan={6} style={{ background: 'var(--surface-2)' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {(p.versao ?? 1) > 1 && !!p.alteracoes?.length && <div className="alert" style={{ margin: 0 }}><b>Alterado {quemAlterou(p)} em {dt(p.alterado_em ?? null)} (versão {p.versao}):</b> {p.alteracoes.map(difTxt).join(' · ')}</div>}
                      {editando === p.id ? <EditarPedido p={p} itens={itens.filter((i) => i.pedido_id === p.id)} bps={bps} porCodigo={porCodigo} fechar={() => setEditando(null)} salvo={(m) => { setEditando(null); setAviso(m); recarregar(); }} />
                        : !ro && <div><button className="btn sm primary" onClick={() => setEditando(p.id)}>Editar pedido (dados do cliente e produtos)</button></div>}
                      {itens.filter((i) => i.pedido_id === p.id).map((i) => <div key={i.codigo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{i.codigo} · {i.nome} <small style={{ display: 'inline' }}>({i.caixas} cx × {i.pecas_caixa} pç · {brl(Number(i.preco_peca))})</small></span><b>{brl(Number(i.total))}</b></div>)}
                      <small>Comprador: {p.comprador} · {p.email} · {p.celular} · {p.frete}{p.observacao ? ` · Obs.: ${p.observacao}` : ''}</small>
                      {!!p.edicoes?.length && <div style={{ display: 'grid', gap: 2 }}><b style={{ fontSize: 12 }}>Edições da equipe</b>{p.edicoes.map((e, k) => <small key={k}>{dt(e.em)} · {e.por} · {e.tipo === 'itens' ? `produtos (v${e.versao}): ` : `dados${e.cadastro ? ' (e cadastro)' : ''}: `}{e.mudou.map((m) => ('campo' in m ? `${CAMPO[m.campo] ?? m.campo}: ${m.de || '—'} → ${m.para || '—'}` : difTxt(m))).join(' · ')}{e.motivo ? ` · motivo: ${e.motivo}` : ''}</small>)}</div>}
                      
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ================= Relatório da diretoria ================= */
function RelatorioDiretoria({ cfg, ins, peds, itens, bps, porCodigo, fichas }: { cfg: Cfg; ins: Inscrito[]; peds: Pedido[]; itens: Item[]; bps: BP[]; porCodigo: Record<string, Prod>; fichas: Record<string, number> }) {
  const ed = useEd(); const { arq } = ed;
  const [cars, setCars] = useState<CarRel[] | null>(null);
  const [ev, setEv] = useState<{ inscrito_id: string | null; tipo: string }[]>([]);
  const [aviso, setAviso] = useState('');
  const carregar = useCallback(async () => {
    const [c, e] = await Promise.all([
      carrinhosRel(arq),
      paginar<{ inscrito_id: string | null; tipo: string }>((a, z) => ler('eventos', 'inscrito_id, tipo', arq).in('tipo', ['login', 'login_falhou']).range(a, z) as unknown as PromiseLike<{ data: { inscrito_id: string | null; tipo: string }[] | null; error: { message: string } | null }>),
    ]);
    setCars(Array.isArray(c.data) ? (c.data as CarRel[]) : []); setEv(e);
  }, [arq]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  const dados = useMemo<DadosRelatorio | null>(() => {
    if (!cars) return null;
    const dig = (x: string | null | undefined) => (x ?? '').replace(/\D/g, '');
    const rep = (r: string | null | undefined) => (r ?? '').trim() || 'Sem representante';
    const val = peds.filter((p) => p.status !== 'cancelado'); const ids = new Set(val.map((p) => p.id));
    const its = itens.filter((i) => ids.has(i.pedido_id)); const pedDe = new Map(val.map((p) => [p.id, p]));
    const comprou = new Set(val.map((p) => dig(p.cnpj)));
    const aprov = ins.filter((i) => i.status === 'aprovado');
    const produtos = bps.filter((b) => b.ativo).sort((a, b) => a.ordem - b.ordem).map((b) => {
      const pr = porCodigo[b.codigo]; const ii = its.filter((i) => i.codigo === b.codigo);
      return {
        c: b.codigo, n: b.nome || pr?.packaging_name || pr?.name || b.codigo, fam: b.familia, img: pr?.image_url ?? '',
        caixa: b.caixa_qtd ?? pr?.carton_quantity ?? 1, preco: Number(b.preco_peca ?? 0), cota: b.estoque_caixas,
        cx: ii.reduce((t, i) => t + i.caixas, 0), pc: ii.reduce((t, i) => t + i.caixas * i.pecas_caixa, 0), valor: ii.reduce((t, i) => t + Number(i.total), 0),
        lojas: new Set(ii.map((i) => pedDe.get(i.pedido_id)?.cnpj)).size, qr: fichas[b.codigo] ?? 0,
        carCx: 0, // carrinho abandonado não sai do estoque e não entra no relatório
      };
    });
    const repsN = [...new Set([...aprov.map((i) => rep(i.representante)), ...val.map((p) => rep(p.representante))])];
    const reps = repsN.map((r) => {
      const ii = aprov.filter((i) => rep(i.representante) === r); const pp = val.filter((p) => rep(p.representante) === r);
      return { rep: r, ins: ii.length, comp: new Set(pp.map((p) => dig(p.cnpj))).size, ped: pp.length, val: pp.reduce((t, p) => t + Number(p.total), 0),
        car: 0, carVal: 0, sem: ii.filter((i) => !comprou.has(dig(i.cnpj))).length };
    });
    const insIds = new Set(aprov.map((i) => i.id));
    const comCarrinho = new Set([...cars.filter((c) => c.itens.length || c.situacao === 'finalizado').map((c) => dig(c.cnpj)), ...comprou]);
    return {
      ed: { nome: ed.nome, sobre: ed.sobre, geral: ed.geral, objetivo: ed.objetivo, live: ed.live },
      geradoEm: new Date().toISOString(), abreEm: cfg.abre_em, fechaEm: cfg.fecha_em, minimo: Number(cfg.pedido_minimo), ipiPct: Number(cfg.ipi_pct ?? 6.5),
      produtos,
      pedidos: [...val].sort((a, b) => a.criado_em.localeCompare(b.criado_em)).map((p) => ({ n: p.numero, em: p.criado_em, loja: p.fantasia || p.razao_social, cid: p.cidade, uf: p.uf, rep: rep(p.representante),
        cx: p.caixas, pc: p.pecas, val: Number(p.total), ipi: Number(p.ipi ?? 0), v: p.versao ?? 1, st: p.status, itens: its.filter((i) => i.pedido_id === p.id).length })),
      reps,
      funil: { ins: ins.length, aprov: aprov.length, entraram: new Set(ev.filter((e) => e.tipo === 'login' && e.inscrito_id && insIds.has(e.inscrito_id)).map((e) => e.inscrito_id)).size,
        carrinho: aprov.filter((i) => comCarrinho.has(dig(i.cnpj))).length, compraram: aprov.filter((i) => comprou.has(dig(i.cnpj))).length,
        loginFalhou: ev.filter((e) => e.tipo === 'login_falhou').length, fichas: Object.values(fichas).reduce((t, n) => t + n, 0) },
      // carrinhos abandonados ficam no sistema (aba Carrinhos), fora do relatório: não contam nem sujam o resultado
      carros: [],
    };
  }, [cars, ev, ins, peds, itens, bps, porCodigo, fichas, cfg, ed]);
  const html = useMemo(() => (dados ? gerarRelatorio(dados) : ''), [dados]);
  const nomeArq = () => `CARDOSO_BLACK-CARDOSO_RELATORIO-DIRETORIA_${ed.arq ? `${ed.id}A-EDICAO_` : ''}${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\D+/g, '-')}.html`;
  function telaCheia() { const w = window.open('', '_blank'); if (!w) { setAviso('O navegador bloqueou a janela. Libere pop-ups para o Hub.'); return; } w.document.open(); w.document.write(html); w.document.close(); }
  function baixar() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = nomeArq(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  if (!dados) return <div className="cbx-hint">Montando o relatório…</div>;
  const fim = Date.now() >= new Date(cfg.fecha_em).getTime();
  return (
    <>
      <div className="cbx-bar" style={{ marginBottom: 10 }}>
        <span className="cbx-hint" style={{ flex: 1, margin: 0 }}>{fim ? <><b>Pedidos encerrados.</b> O relatório mostra o resultado final.</> : <><b>Resultado parcial.</b> Atualiza sozinho a cada minuto; depois de {dt(cfg.fecha_em)} vira o resultado final.</>} O arquivo baixado guarda os números do momento em que foi gerado.</span>
        <button className="btn sm" onClick={telaCheia}>Abrir em tela cheia</button>
        <button className="btn sm primary" onClick={baixar}>Baixar HTML para apresentar</button>
      </div>
      {aviso && <div className="alert">{aviso}</div>}
      <iframe title="Relatório da Black Cardoso" srcDoc={html} style={{ width: '100%', height: 'calc(100vh - 210px)', minHeight: 640, border: '1px solid var(--border)', borderRadius: 14, background: '#fff' }} />
    </>
  );
}

/* ================= Produtos da Black ================= */
function Produtos({ bps, prods, porCodigo, itens, peds, fichas, mats, recarregar }: {
  bps: BP[]; prods: Prod[]; porCodigo: Record<string, Prod>; itens: Item[]; peds: Pedido[]; fichas: Record<string, number>; mats: Record<string, number>; recarregar: () => void;
}) {
  const { profile } = useAuth();
  const [aviso, setAviso] = useState('');
  const [novo, setNovo] = useState({ codigo: '', preco: '' });
  // edição em texto (aceita vírgula); converte para número só ao salvar
  const [ed, setEd] = useState<Record<string, Record<string, string | boolean>>>({});
  const [midias, setMidias] = useState<Prod | null>(null);
  const vivos = new Set(peds.filter((p) => p.status !== 'cancelado').map((p) => p.id));
  const vend: Record<string, number> = {}; itens.filter((i) => vivos.has(i.pedido_id)).forEach((i) => { vend[i.codigo] = (vend[i.codigo] ?? 0) + i.caixas; });
  const semCadastro = bps.filter((b) => b.ativo && !porCodigo[b.codigo]);
  type Disp = { codigo: string; guarani_pecas: number | null; guarani_em: string | null; disponivel: number | null };
  const [disp, setDisp] = useState<Record<string, Disp>>({});
  const carregarDisp = useCallback(async () => {
    const { data, error } = await supabase.rpc('black_disponibilidade');
    if (!error && Array.isArray(data)) setDisp(Object.fromEntries((data as Disp[]).map((d) => [d.codigo, d])));
  }, []);
  useEffect(() => { carregarDisp(); const t = setInterval(carregarDisp, 60000); return () => clearInterval(t); }, [carregarDisp, bps]);
  const ultimaLeitura = Object.values(disp).map((d) => d.guarani_em).filter(Boolean).sort().at(-1) ?? null;
  async function estoqueGuarani(file: File) {
    const L = lerCsv(await file.text());
    const linhas = L.map((r) => ({
      codigo: (r.codigo || r.cod || r.produto || r.sku || r.referencia || r.ref || '').trim(),
      pecas: num(r.pecas || r.estoque || r.saldo || r.quantidade || r.qtd || r.disponivel),
    })).filter((r) => r.codigo && r.pecas !== null);
    if (!linhas.length) { setAviso('Não encontrei as colunas codigo e estoque (em peças) no arquivo.'); return; }
    const { error } = await supabase.rpc('estoque_guarani_atualizar', { p_linhas: linhas, p_origem: 'csv' });
    setAviso(error ? `Não consegui atualizar o estoque: ${error.message}` : `Estoque do Guarani atualizado: ${linhas.length} códigos.`);
    if (!error) carregarDisp();
  }

  async function salvar(b: BP) {
    const e = ed[b.codigo]; if (!e) return;
    const m: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e)) {
      if (k === 'ativo') m[k] = v;
      else if (k === 'familia') m[k] = String(v).trim();
      else if (k === 'ordem') m[k] = num(String(v)) ?? 0;
      else m[k] = num(String(v));
    }
    if (m.preco_peca !== undefined && m.preco_peca !== null && Number(m.preco_peca) <= 0) { setAviso('Preço por peça precisa ser maior que zero.'); return; }
    const { error } = await supabase.from('black_produtos').update({ ...m, atualizado_em: new Date().toISOString(), atualizado_por: profile?.id ?? null }).eq('codigo', b.codigo);
    setAviso(error ? `Não consegui salvar ${b.codigo}: ${error.message}` : `${b.codigo} salvo.`);
    if (!error) { setEd((e) => { const n = { ...e }; delete n[b.codigo]; return n; }); recarregar(); }
  }
  async function adicionar() {
    const cod = novo.codigo.trim(); const preco = num(novo.preco);
    if (!cod) return;
    const { error } = await supabase.from('black_produtos').upsert({ codigo: cod, preco_peca: preco, ordem: (bps.at(-1)?.ordem ?? 0) + 1, familia: porCodigo[cod]?.line ?? '' });
    setAviso(error ? `Não consegui adicionar: ${error.message}` : `${cod} adicionado.`); if (!error) { setNovo({ codigo: '', preco: '' }); recarregar(); }
  }
  async function remover(b: BP) {
    if (!window.confirm(`Tirar ${b.codigo} da Black? Pedidos já feitos continuam.`)) return;
    const { error } = await supabase.from('black_produtos').delete().eq('codigo', b.codigo);
    setAviso(error ? `Não consegui remover: ${error.message}` : `${b.codigo} removido.`); if (!error) recarregar();
  }
  async function importar(file: File) {
    const L = lerCsv(await file.text());
    // zero ou negativo vira vazio: caixa vazia usa a da ficha técnica; preço vazio usa a Tabela de Preços
    const pos = (v: number | null) => (v !== null && v > 0 ? v : null);
    const linhas = L.map((r, i) => ({
      codigo: (r.codigo || r.ref || r.cod || '').trim().replace(/^\D+/, ''),
      ordem: Math.round(num(r.ordem) ?? i + 1), familia: r.familia || r.fam || '', nome: (r.nome || '').trim(), preco_tabela: pos(num(r.preco_tabela || r.tabela || r.tabela_atual)), preco_peca: pos(num(r.preco_peca || r.preco || r.black)),
      caixa_qtd: pos(num(r.caixa_qtd || r.caixa || r.cx)) === null ? null : Math.round(num(r.caixa_qtd || r.caixa || r.cx)!),
      estoque_caixas: (() => { const e = num(r.estoque_caixas || r.estoque); return e === null || e < 0 ? null : Math.round(e); })(),
      // coluna ativo opcional: 0 / não / nao / false tira o produto da Black sem apagar
      ativo: !/^(0|n|nao|não|false)$/i.test(String(r.ativo ?? '').trim()),
    })).filter((r) => r.codigo);
    // coluna que não veio na planilha não apaga o que já está no Hub (ex.: cota de estoque digitada à mão)
    const tem = new Set(Object.keys(L[0] ?? {}).map((k) => k.trim().toLowerCase()));
    const veio: Record<string, string[]> = { nome: ['nome'], preco_tabela: ['preco_tabela', 'tabela', 'tabela_atual'], ordem: ['ordem'], familia: ['familia', 'fam'], preco_peca: ['preco_peca', 'preco', 'black'], caixa_qtd: ['caixa_qtd', 'caixa', 'cx'], estoque_caixas: ['estoque_caixas', 'estoque'] };
    for (const r of linhas) for (const [k, cols] of Object.entries(veio)) if (!cols.some((c) => tem.has(c))) delete (r as Record<string, unknown>)[k];
    const semCaixa = linhas.filter((r) => 'caixa_qtd' in r && r.caixa_qtd === null).map((r) => r.codigo);
    // o catálogo do Hub guarda o código com 4 dígitos (0275); a TAB às vezes vem sem o zero
    const codes = new Set(prods.map((p) => p.code));
    linhas.forEach((r) => { if (!codes.has(r.codigo) && codes.has(r.codigo.padStart(4, '0'))) r.codigo = r.codigo.padStart(4, '0'); });
    const { error } = await supabase.from('black_produtos').upsert(linhas);
    setAviso(error ? `Não consegui importar: ${error.message}` : `${linhas.length} produtos importados.${semCaixa.length ? ` Sem caixa na planilha (usa a caixa master da ficha técnica): ${semCaixa.join(', ')}.` : ''}`); if (!error) recarregar();
  }
  const set = (c: string, k: keyof BP, v: string | boolean) => setEd((e) => ({ ...e, [c]: { ...e[c], [k]: v } }));
  const txt = (b: BP, k: keyof BP) => { const v = ed[b.codigo]?.[k]; if (typeof v === 'string') return v; const o = b[k]; return o === null || o === undefined ? '' : String(o).replace('.', ','); };
  const ativo = (b: BP) => { const v = ed[b.codigo]?.ativo; return typeof v === 'boolean' ? v : b.ativo; };

  return (
    <>
      <div className="cbx-box">
        <h3>Importar a TAB da Black (CSV)</h3>
        <p className="cbx-hint">Colunas: <b>codigo; nome; ordem; familia; preco_peca; caixa_qtd; estoque_caixas; ativo</b>. Nome é o nome de vitrine na Black (vazio = nome do cadastro). Preço por peça é o preço líquido (o IPI soma no fechamento do pedido). Ativo = 0 tira o produto da Black. Vazio = usa a Tabela de Preços da região do cliente com o desconto dos Ajustes. Caixa vazia = caixa master da ficha técnica. Estoque = cota da Black (vazio = sem cota; o limite passa a ser o saldo do Guarani).</p>
        <div className="cbx-acts" style={{ marginTop: 10 }}>
          <label className="btn">Escolher arquivo<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} /></label>
          <input className="tp-search" style={{ maxWidth: 140 }} placeholder="Código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
          <input className="tp-search" style={{ maxWidth: 140 }} placeholder="Preço por peça" value={novo.preco} onChange={(e) => setNovo({ ...novo, preco: e.target.value })} />
          <button className="btn ghost" onClick={adicionar}>Adicionar um produto</button>
        </div>
      </div>
      <PrepararMidias bps={bps} porCodigo={porCodigo} />
      <div className="cbx-box">
        <h3>Estoque do Guarani</h3>
        <p className="cbx-hint">Disponível na Black = saldo do Guarani em caixas − pedidos da Black ainda não lançados no Guarani, limitado pela cota da Black (se preenchida). Pedidos de fora da Black já saem do saldo do Guarani. <b>Confirme o pedido aqui quando ele for lançado no Guarani.</b></p>
        <p className="cbx-hint" style={{ marginTop: 6 }}>Última leitura: <b>{ultimaLeitura ? dt(ultimaLeitura) : 'nenhuma ainda'}</b>{ultimaLeitura && Date.now() - new Date(ultimaLeitura).getTime() > 3600000 ? ' · mais de 1 hora sem atualizar' : ''}. Arquivo: colunas <b>codigo; estoque</b> (em peças), exportado do Guarani.</p>
        <div className="cbx-acts" style={{ marginTop: 10 }}>
          <label className="btn">Atualizar estoque do Guarani (CSV)<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) estoqueGuarani(f); e.target.value = ''; }} /></label>
          <button className="btn ghost" onClick={carregarDisp}>Recalcular disponível</button>
        </div>
      </div>
      {semCadastro.length > 0 && <div className="alert">Sem cadastro no catálogo do Hub (a ficha fica sem foto e sem dados técnicos): {semCadastro.map((b) => b.codigo).join(', ')}</div>}
      {aviso && <div className="alert">{aviso}</div>}
      {bps.length === 0 ? <EmptyState title="Nenhum produto na Black" hint="Importe a TAB em CSV ou adicione pelo código." /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Ordem</th><th>Produto</th><th>Família</th><th className="num">Preço/peça</th><th className="num">Caixa</th><th className="num">Cota Black (cx)</th><th className="num">Guarani (cx)</th><th className="num">Disponível</th><th className="num">Vendidas</th><th className="num">QR</th><th className="num">Materiais</th><th>Ativo</th><th /></tr></thead>
            <tbody>{[...bps.filter((x) => x.ativo), ...bps.filter((x) => !x.ativo)].map((b) => { const p = porCodigo[b.codigo]; const sujo = !!ed[b.codigo]; return (
              <tr key={b.codigo} style={b.ativo ? undefined : { opacity: 0.45 }}>
                <td style={{ width: 70 }}><input inputMode="numeric" value={txt(b, 'ordem')} onChange={(e) => set(b.codigo, 'ordem', e.target.value)} /></td>
                <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{p?.image_url ? <img className="cbx-thumb" src={p.image_url} alt="" /> : <span className="cbx-thumb" />}<div><b>{b.nome || p?.packaging_name || p?.name || '—'}</b><small>{b.codigo}{b.ativo ? '' : ' · fora da Black'}</small></div></div></td>
                <td style={{ minWidth: 150 }}><input value={txt(b, 'familia')} placeholder={p?.line} onChange={(e) => set(b.codigo, 'familia', e.target.value)} /></td>
                <td className="num" style={{ width: 110 }}><input inputMode="decimal" value={txt(b, 'preco_peca')} placeholder="tabela" onChange={(e) => set(b.codigo, 'preco_peca', e.target.value)} /></td>
                <td className="num" style={{ width: 80 }}><input inputMode="numeric" value={txt(b, 'caixa_qtd')} placeholder={String(p?.carton_quantity ?? '')} onChange={(e) => set(b.codigo, 'caixa_qtd', e.target.value)} /></td>
                <td className="num" style={{ width: 90 }}><input inputMode="numeric" value={txt(b, 'estoque_caixas')} placeholder="sem cota" onChange={(e) => set(b.codigo, 'estoque_caixas', e.target.value)} /></td>
                <td className="num">{disp[b.codigo]?.guarani_pecas == null ? '—' : int(Math.floor(Number(disp[b.codigo].guarani_pecas) / Math.max(1, b.caixa_qtd ?? p?.carton_quantity ?? 1)))}</td>
                <td className="num"><b>{disp[b.codigo]?.disponivel == null ? 'sem limite' : int(disp[b.codigo].disponivel!)}</b></td>
                <td className="num">{vend[b.codigo] ?? 0}</td>
                <td className="num">{fichas[b.codigo] ?? 0}</td>
                <td className="num">{p ? (mats[p.id] ?? 0) : '—'}</td>
                <td><input type="checkbox" style={{ width: 'auto' }} checked={ativo(b)} onChange={(e) => set(b.codigo, 'ativo', e.target.checked)} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>{sujo && <button className="btn sm" onClick={() => salvar(b)}>Salvar</button>} {p && <button className="btn ghost sm" type="button" onClick={() => setMidias(p)}>Mídias{mats[p.id] ? ` (${mats[p.id]})` : ''}</button>} <a className="btn ghost sm" href={`/black/p/${b.codigo}`} target="_blank" rel="noreferrer">Ficha</a> <button className="btn ghost sm" onClick={() => remover(b)}>Tirar</button></td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
      {midias && <MidiasProduto prod={midias} matriz={matrizDe(midias, prods)} onClose={() => { setMidias(null); recarregar(); }} />}
      <p className="cbx-hint">Fotos e vídeos da ficha vêm de Produtos (foto do produto e da embalagem) e do banco de materiais com status <b>Liberado</b>. Para incluir fotos e vídeos do Drive, use o botão <b>Mídias</b> do produto.</p>
    </>
  );
}

/* ================= Carteira ================= */
function Carteira({ cart, ins, recarregar }: { cart: Cart[]; ins: Inscrito[]; recarregar: () => void }) {
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');
  const [flt, setFlt] = useState<'todos' | 'inscritos' | 'falta'>('todos');
  const [rep, setRep] = useState('');
  const [indo, setIndo] = useState(false);
  const inscritos = new Set(ins.map((x) => x.carteira_id).filter(Boolean));
  const reps = [...new Set(cart.map((c) => c.representante).filter(Boolean))].sort();
  const vis = cart.filter((c) => (flt === 'todos' || (flt === 'inscritos' ? inscritos.has(c.id) : !inscritos.has(c.id)))
    && (!rep || c.representante === rep)
    && (!busca.trim() || `${c.razao_social} ${c.cnpj ?? ''} ${c.grupo}`.toLowerCase().includes(busca.trim().toLowerCase())));
  async function importar(file: File, substituir: boolean) {
    setIndo(true); setAviso('');
    const L = lerCsv(await file.text()).map((r) => ({
      razao_social: r.razao_social || r.razao || r.cliente || r.nome || '', cnpj: r.cnpj || '', fantasia: r.fantasia || r.nome_fantasia || '',
      cidade: r.cidade || r.municipio || '', uf: r.uf || '', representante: r.representante || r.rep || '', grupo: r.grupo || '',
      situacao: r.situacao || '', dias_sem_compra: num(r.dias_sem_compra), faturamento_12m: num(r.faturamento_12m),
    })).filter((r) => r.razao_social);
    let total = 0;
    for (let i = 0; i < L.length; i += 1000) {
      const { data, error } = await supabase.rpc('black_carteira_importar', { p_linhas: L.slice(i, i + 1000), p_substituir: substituir && i === 0 });
      if (error) { setAviso(`Parei na linha ${i + 1}: ${error.message}`); setIndo(false); return; }
      total = (data as { total: number }).total;
    }
    setIndo(false); setAviso(`${L.length} linhas lidas · ${total} clientes na carteira.`); recarregar();
  }
  return (
    <>
      <div className="cbx-kpis"><Kpi l="Clientes na carteira" v={int(cart.length)} /><Kpi l="Já inscritos" v={int(inscritos.size)} c="#1F7F88" /><Kpi l="Faltam inscrever" v={int(cart.length - inscritos.size)} c="#DA3A2F" /><Kpi l="Com CNPJ" v={int(cart.filter((c) => c.cnpj).length)} c="#0A2530" /></div>
      {cart.length > 0 && (() => {
        const ult = cart.reduce((m, c) => (c.importado_em > m ? c.importado_em : m), '');
        return <div className="cbx-box cbx-last"><span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg></span>
          <div><b>Última importação: {dt(ult)}</b><small>{int(cart.length)} clientes · {int(cart.filter((c) => c.cnpj).length)} com CNPJ</small></div></div>;
      })()}
      <div className="cbx-box">
        <h3>Importar carteira (CSV)</h3>
        <p className="cbx-hint">Colunas: <b>razao_social; cnpj; fantasia; cidade; uf; representante; grupo; situacao</b>. Sem CNPJ, a checagem usa a razão social oficial da Receita + UF. Estes dados ficam só no banco; nunca vão para o Git.</p>
        <div className="cbx-acts" style={{ marginTop: 10 }}>
          <label className="btn">{indo ? 'Importando…' : 'Substituir carteira'}<input type="file" accept=".csv,text/csv" hidden disabled={indo} onChange={(e) => { const f = e.target.files?.[0]; if (f && window.confirm('Substituir a carteira inteira por este arquivo?')) importar(f, true); e.target.value = ''; }} /></label>
          <label className="btn ghost">Acrescentar / atualizar<input type="file" accept=".csv,text/csv" hidden disabled={indo} onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f, false); e.target.value = ''; }} /></label>
        </div>
      </div>
      {aviso && <div className="alert">{aviso}</div>}
      <div className="cbx-bar">
        {(['todos', 'inscritos', 'falta'] as const).map((k) => <button key={k} className={`cbx-pill${flt === k ? ' on' : ''}`} onClick={() => setFlt(k)}>{k === 'todos' ? 'Todos' : k === 'inscritos' ? 'Inscritos' : 'Faltam inscrever'}</button>)}
        <select value={rep} onChange={(e) => setRep(e.target.value)}><option value="">Todos os representantes</option>{reps.map((r) => <option key={r}>{r}</option>)}</select>
        <input type="search" placeholder="Razão social, CNPJ ou grupo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn ghost sm" onClick={() => baixarCsv('carteira-faltam-inscrever.csv', [['razao_social', 'uf', 'representante', 'grupo', 'situacao'], ...vis.filter((c) => !inscritos.has(c.id)).map((c) => [c.razao_social, c.uf, c.representante, c.grupo, c.situacao])])}>Baixar lista (quem falta)</button>
      </div>
      <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
        <table className="cbx-table">
          <thead><tr><th>Cliente</th><th>UF</th><th>Representante</th><th>Grupo</th><th>Situação</th><th>Pré-cadastro</th></tr></thead>
          <tbody>{vis.slice(0, 300).map((c) => <tr key={c.id}><td><b>{c.razao_social}</b>{c.cnpj && <small>{cnpjFmt(c.cnpj)}</small>}</td><td>{c.uf}</td><td>{c.representante}</td><td>{c.grupo === '(sem grupo)' ? '' : c.grupo}</td><td>{c.situacao}</td><td>{inscritos.has(c.id) ? <span className="cbx-st inscrito">Inscrito</span> : <span className="cbx-st falta">Falta</span>}</td></tr>)}</tbody>
        </table>
        {vis.length > 300 && <p className="cbx-hint" style={{ padding: 12 }}>Mostrando 300 de {int(vis.length)}. Use a busca ou o filtro de representante.</p>}
      </div>
    </>
  );
}

/* ================= Links ================= */
function Links({ cart, ins, bps, porCodigo }: { cart: Cart[]; ins: Inscrito[]; bps: BP[]; porCodigo: Record<string, Prod> }) {
  const o = window.location.origin;
  const [ok, setOk] = useState('');
  const reps = useMemo(() => {
    const m: Record<string, { cli: number; ins: number }> = {};
    cart.forEach((c) => { if (c.representante) { m[c.representante] ??= { cli: 0, ins: 0 }; m[c.representante].cli++; } });
    ins.forEach((x) => { if (x.representante) { m[x.representante] ??= { cli: 0, ins: 0 }; m[x.representante].ins++; } });
    return Object.entries(m).sort((a, b) => b[1].cli - a[1].cli);
  }, [cart, ins]);
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); setOk(t); setTimeout(() => setOk(''), 1500); } catch { /* sem permissão */ } };
  // aberturas do pré-cadastro por link ('' = link geral), contadas a partir da versão de 07/11
  type Ac = { rep: string; aberturas: number; pessoas: number };
  const [ac, setAc] = useState<Record<string, Ac>>({});
  useEffect(() => {
    supabase.rpc('black_acessos_resumo').then(({ data }) => setAc(Object.fromEntries((Array.isArray(data) ? (data as Ac[]) : []).map((x) => [x.rep, x]))));
  }, []);
  const cadPorLink = useMemo(() => { const m: Record<string, number> = {}; ins.forEach((x) => { const k = x.rep_link ?? ''; m[k] = (m[k] ?? 0) + 1; }); return m; }, [ins]);
  const comAcesso = Object.keys(ac).filter((k) => k && !reps.some(([r]) => r === k));
  const linhas: [string, { cli: number; ins: number }][] = [...reps, ...comAcesso.map((k) => [k, { cli: 0, ins: 0 }] as [string, { cli: number; ins: number }])]
    .sort((a, b) => (ac[b[0]]?.aberturas ?? 0) - (ac[a[0]]?.aberturas ?? 0) || b[1].cli - a[1].cli);
  const totAb = Object.values(ac).reduce((t, x) => t + Number(x.aberturas), 0);
  const totPe = Object.values(ac).reduce((t, x) => t + Number(x.pessoas), 0);
  // link curto quando o representante está em representantes.ts; senão o formato antigo (?r=)
  const L = (r: string) => { const sl = slugDoRepresentante(r); return sl ? `${o}/black/r/${sl}` : `${o}/black?r=${encodeURIComponent(r)}`; };
  return (
    <>
      <div className="cbx-box">
        <h3>Links gerais</h3>
        <div className="cbx-acts">
          {[['Pré-cadastro', `${o}/black`], ['Página de pedido', `${o}/black/pedido`]].map(([l, u]) => <button key={u} className="btn ghost" onClick={() => copiar(u)}>{ok === u ? 'Copiado' : `Copiar · ${l}`}</button>)}
          <button className="btn ghost" onClick={() => baixarCsv('links-qr-produtos.csv', [['ordem', 'codigo', 'produto', 'link_qr'], ...bps.filter((b) => b.ativo).map((b) => [b.ordem, b.codigo, b.nome || porCodigo[b.codigo]?.name || '', `${o}/black/p/${b.codigo}?live=1`])])}>Baixar links dos QR (CSV)</button>
          <button className="btn ghost" onClick={() => baixarCsv('links-representantes.csv', [['representante', 'clientes', 'aberturas', 'pessoas', 'cadastros_pelo_link', 'inscritos', 'link'], ...linhas.map(([r, v]) => [r, v.cli, Number(ac[r]?.aberturas ?? 0), Number(ac[r]?.pessoas ?? 0), cadPorLink[r] ?? 0, v.ins, L(r)])])}>Baixar links dos representantes (CSV)</button>
        </div>
        <div className="cbx-kpis" style={{ marginTop: 12 }}>
          <Kpi l="Aberturas do pré-cadastro" v={int(totAb)} c="#DA3A2F" />
          <Kpi l="Pessoas que abriram" v={int(totPe)} c="#0A2530" />
          <Kpi l="Link geral (sem representante)" v={int(Number(ac['']?.aberturas ?? 0))} c="#1F7F88" />
          <Kpi l="Pré-cadastros enviados" v={int(ins.length)} c="#4CBDC7" />
        </div>
        <p className="cbx-hint" style={{ marginTop: 10 }}>Aberturas contadas a partir de 07/11 à noite. A mesma pessoa abrindo de novo em menos de 30 minutos conta uma vez; “pessoas” = navegadores diferentes.</p>
        <p className="cbx-hint" style={{ marginTop: 10 }}>Os QR da live apontam para {o}/black/p/&lt;código&gt;?live=1 (a ficha mostra “Visto agora na live”). Se o endereço do Hub mudar (ex.: app.cardosotoys.com.br), gere os QR de novo.</p>
      </div>
      <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
        <table className="cbx-table">
          <thead><tr><th>Representante</th><th className="num">Clientes</th><th className="num">Aberturas</th><th className="num">Pessoas</th><th className="num">Cadastros pelo link</th><th className="num">Inscritos (total)</th><th>Link de pré-cadastro</th><th /></tr></thead>
          <tbody>{linhas.map(([r, v]) => <tr key={r}><td><b>{r}</b></td><td className="num">{int(v.cli)}</td><td className="num"><b>{int(Number(ac[r]?.aberturas ?? 0))}</b></td><td className="num">{int(Number(ac[r]?.pessoas ?? 0))}</td><td className="num">{int(cadPorLink[r] ?? 0)}</td><td className="num">{int(v.ins)}</td><td><small style={{ wordBreak: 'break-all' }}>{L(r)}</small></td><td><button className="btn sm" onClick={() => copiar(L(r))}>{ok === L(r) ? 'Copiado' : 'Copiar'}</button></td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

/* ================= Ajustes ================= */
const local = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function Ajustes({ cfg, recarregar }: { cfg: Cfg; recarregar: () => void }) {
  const { profile } = useAuth();
  const [f, setF] = useState({ ...cfg, inscricoes_ate: local(cfg.inscricoes_ate), abre_em: local(cfg.abre_em), fecha_em: local(cfg.fecha_em) });
  const [aviso, setAviso] = useState('');
  async function salvar() {
    const { error } = await supabase.from('black_config').update({
      inscricoes_ate: new Date(f.inscricoes_ate).toISOString(), abre_em: new Date(f.abre_em).toISOString(), fecha_em: new Date(f.fecha_em).toISOString(),
      pedido_minimo: Number(f.pedido_minimo), frete_gratis_sp_rj: Number(f.frete_gratis_sp_rj), desconto_pct: Number(f.desconto_pct), ipi_pct: Number(f.ipi_pct ?? 6.5),
      live_data: f.live_data, live_link: f.live_link.trim(), canal_link: f.canal_link.trim(),
      atualizado_em: new Date().toISOString(), atualizado_por: profile?.id ?? null,
    }).eq('id', 1);
    setAviso(error ? `Não consegui salvar: ${error.message}` : 'Ajustes salvos.'); if (!error) recarregar();
  }
  const campo = (l: string, k: keyof typeof f, type = 'text', hint = '') => (
    <div className="form-field"><label>{l}</label><input type={type} value={String(f[k] ?? '')} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{hint && <small className="cbx-hint">{hint}</small>}</div>
  );
  return (
    <div className="cbx-box">
      <div className="cbx-cfg">
        {campo('Inscrições até', 'inscricoes_ate', 'datetime-local')}
        {campo('Pedidos abrem em', 'abre_em', 'datetime-local', 'O preço só aparece para o cliente a partir daqui.')}
        {campo('Pedidos fecham em', 'fecha_em', 'datetime-local')}
        {campo('Pedido mínimo (R$)', 'pedido_minimo', 'number')}
        {campo('Frete grátis SP/RJ a partir de (R$)', 'frete_gratis_sp_rj', 'number')}
        {campo('Desconto sobre a Tabela de Preços (%)', 'desconto_pct', 'number', 'Só para produtos sem preço fixo na Black.')}
        {campo('IPI no fechamento (%)', 'ipi_pct', 'number', 'Os preços da Black são líquidos; o IPI soma uma vez, sobre o pedido inteiro, no carrinho.')}
        {campo('Data da live (texto)', 'live_data', 'text', 'Ex.: Quinta-feira, 12/11 · 14h')}
        {campo('Link da live (Meet ou Zoom)', 'live_link', 'url', 'Só aparece para cadastro aprovado.')}
        {campo('Link do canal no WhatsApp', 'canal_link', 'url', 'Só aparece para cadastro aprovado.')}
      </div>
      <div className="modal-actions" style={{ marginTop: 14 }}><button className="btn" onClick={salvar}>Salvar ajustes</button></div>
      {aviso && <p className="cbx-hint">{aviso}</p>}
    </div>
  );
}

/* ================= Mídias do produto (Drive) ================= */
type Mat = { id: string; kind: 'foto' | 'video' | 'kit' | 'documento'; name: string; drive_url: string; status: string; created_at: string };
const KIND: Record<string, string> = { foto: 'Foto', video: 'Vídeo', kit: 'Kit', documento: 'Documento' };
const STM: Record<string, string> = { liberado: 'Na ficha', aguardando: 'Aguardando liberação', producao: 'Em produção', pedido: 'Pedido' };
/* caixa individual: mesmo produto da REF matriz, muda só a embalagem ("Geladeira Sonho de Menina Caixa Individual" → "Geladeira Sonho de Menina") */
const nomeBase = (n: string) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(?\s*(caixa|cx\.?)\s+individual\s*\)?/g, ' ').replace(/\s+/g, ' ').trim();
function matrizDe(p: Prod, todos: Prod[]): Prod | null {
  if (!/(caixa|cx\.?)\s+individual/i.test(p.name)) return null;
  const alvo = nomeBase(p.name);
  return todos.find((x) => x.code !== p.code && !/(caixa|cx\.?)\s+individual/i.test(x.name) && nomeBase(x.name) === alvo) ?? null;
}
function MidiasProduto({ prod, matriz, onClose }: { prod: Prod; matriz: Prod | null; onClose: () => void }) {
  const { profile } = useAuth();
  const [lista, setLista] = useState<Mat[]>([]);
  const [drive, setDrive] = useState(false);
  const [aviso, setAviso] = useState('');
  const carregar = useCallback(async () => {
    const { data } = await supabase.from('content_materials').select('id, kind, name, drive_url, status, created_at').eq('product_id', prod.id).order('created_at');
    setLista((data as Mat[]) ?? []);
  }, [prod.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar(urls: string[], itens: DriveItem[]) {
    setDrive(false);
    const ja = new Set(lista.map((m) => m.drive_url));
    const novos = urls.map((u, i) => ({ u, it: itens[i] })).filter((x) => !ja.has(x.u));
    if (!novos.length) { setAviso('Esses arquivos já estão no produto.'); return; }
    const linhas = (status: string) => novos.map(({ u, it }) => ({
      product_id: prod.id, brand: marcaDe(prod), kind: it?.tipo === 'video' ? 'video' : 'foto', name: it?.nome ?? 'Arquivo do Drive',
      drive_url: u, status, ...(status === 'liberado' ? { released_by: profile?.id ?? null, released_at: new Date().toISOString() } : {}),
    }));
    let { error } = await supabase.from('content_materials').insert(linhas('liberado'));
    let msg = `${novos.length} arquivo${novos.length > 1 ? 's' : ''} na ficha.`;
    if (error) { // sem permissão de liberar: entra para a liberação do aprovador
      ({ error } = await supabase.from('content_materials').insert(linhas('aguardando')));
      msg = `${novos.length} arquivo${novos.length > 1 ? 's' : ''} enviado${novos.length > 1 ? 's' : ''} para liberação (Redes Sociais → Banco de materiais).`;
    }
    setAviso(error ? `Não consegui adicionar: ${error.message}` : msg);
    carregar();
  }
  async function liberar(m: Mat) {
    const { error } = await supabase.from('content_materials').update({ status: 'liberado', released_by: profile?.id ?? null, released_at: new Date().toISOString() }).eq('id', m.id);
    setAviso(error ? `Não consegui liberar: ${error.message}` : 'Liberado. Já aparece na ficha.'); carregar();
  }
  async function tirar(m: Mat) {
    if (!window.confirm(`Tirar "${m.name}" do produto? O arquivo continua no Drive.`)) return;
    const { error } = await supabase.from('content_materials').delete().eq('id', m.id);
    setAviso(error ? `Não consegui tirar: ${error.message}` : 'Retirado.'); carregar();
  }
  return (
    <>
      <Modal title={`Mídias · ${prod.packaging_name || prod.name} (${prod.code})`} onClose={onClose} wide>
        <div style={{ display: 'grid', gap: 12 }}>
          <p className="cbx-hint">Fotos e vídeos do Drive que aparecem na ficha do QR, além da foto do cadastro do produto. O vídeo aparece primeiro. Não precisa deixar o arquivo público no Drive.</p>
          {matriz && <div className="alert">Caixa individual: o Drive mostra o material da REF {matriz.code} ({matriz.name}) e, desta REF, só a embalagem.</div>}
          <div className="cbx-acts">
            <button className="btn" type="button" onClick={() => setDrive(true)}>Adicionar do Drive</button>
            <a className="btn ghost" href={`/black/p/${prod.code}`} target="_blank" rel="noreferrer">Ver a ficha</a>
          </div>
          {aviso && <div className="alert">{aviso}</div>}
          <div className="cbx-mid">
            {prod.image_url && <div className="it"><img src={prod.image_url} alt="" /><div><b>Foto do cadastro</b><small>Produtos · sempre na ficha</small></div></div>}
            {lista.map((m) => (
              <div key={m.id} className="it">
                <span className="ic">{m.kind === 'video' ? '▶' : m.kind === 'foto' ? '🖼' : '📄'}</span>
                <div><b title={m.name}>{m.name}</b><small>{KIND[m.kind]} · <span className={`cbx-st ${m.status === 'liberado' ? 'aprovado' : 'analise'}`}>{STM[m.status] ?? m.status}</span></small></div>
                <div className="ac">
                  {m.drive_url && <a className="btn ghost sm" href={m.drive_url} target="_blank" rel="noreferrer">Drive</a>}
                  {m.status !== 'liberado' && <button className="btn sm" type="button" onClick={() => liberar(m)}>Liberar</button>}
                  <button className="btn ghost sm" type="button" onClick={() => tirar(m)}>Tirar</button>
                </div>
              </div>
            ))}
            {!lista.length && !prod.image_url && <p className="cbx-hint">Nenhuma mídia ainda.</p>}
          </div>
        </div>
      </Modal>
      {drive && <DrivePicker marca={marcaDe(prod)} pasta="Material Finalizado" produto={prod.code} matriz={matriz?.code} multiple unidade="arquivo"
        hints={{ product: prod.name, sku: prod.code }} onPick={adicionar} onClose={() => setDrive(false)} />}
    </>
  );
}

/* Deixa fotos e vídeos das fichas no CDN antes da live: a 1ª pessoa que abrir a ficha não espera o Drive. */
function PrepararMidias({ bps, porCodigo }: { bps: BP[]; porCodigo: Record<string, Prod> }) {
  const [st, setSt] = useState<{ feitos: number; total: number; erros: number } | null>(null);
  async function preparar() {
    const ids = bps.filter((b) => b.ativo).map((b) => porCodigo[b.codigo]?.id).filter(Boolean) as string[];
    const arqs: string[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from('content_materials').select('drive_url, kind').in('product_id', ids.slice(i, i + 100)).eq('status', 'liberado').in('kind', ['foto', 'video']);
      (data ?? []).forEach((m: { drive_url: string | null }) => { const id = driveId(m.drive_url ?? ''); if (id) arqs.push(id); });
    }
    const lista = [...new Set(arqs)];
    let feitos = 0, erros = 0;
    setSt({ feitos, total: lista.length, erros });
    // 3 por vez: rápido sem sobrecarregar o Drive
    const fila = [...lista];
    await Promise.all([0, 1, 2].map(async () => {
      while (fila.length) {
        const id = fila.shift()!;
        try { const r = await fetch(midia(id, 'preparar')); if (!r.ok) erros++; } catch { erros++; }
        feitos++; setSt({ feitos, total: lista.length, erros });
      }
    }));
  }
  const rodando = st != null && st.feitos < st.total;
  return (
    <div className="cbx-box">
      <h3>Fotos e vídeos das fichas</h3>
      <p className="cbx-hint">A ficha abre as mídias por uma cópia rápida (CDN). Rode antes da live, e de novo quando liberar material novo, para que nenhum cliente espere o arquivo vir do Drive.</p>
      <div className="cbx-acts" style={{ marginTop: 10, alignItems: 'center' }}>
        <button className="btn" type="button" disabled={rodando} onClick={preparar}>{rodando ? `Preparando ${st!.feitos} de ${st!.total}…` : 'Preparar mídias para a live'}</button>
        {st && !rodando && <span className="cbx-hint">{st.total === 0 ? 'Nenhuma foto ou vídeo liberado nos produtos da Black.' : `${st.total - st.erros} de ${st.total} prontos${st.erros ? ` · ${st.erros} com erro (arquivo grande demais ou fora do Drive)` : ''}.`}</span>}
      </div>
    </div>
  );
}
