import { useSearchParams } from 'react-router-dom';
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import DrivePicker, { type DriveItem } from './social-plan/DrivePicker';
import './black/black.css';
import { useRedonda } from './black/fonte';
import { ABAS, abaValida, type Aba } from './black/abas';
import { driveId, midia } from './black/api';

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
  live_data: string; live_link: string; canal_link: string; desconto_pct: number; presentes_live?: number | null;
};
type Inscrito = {
  id: string; cnpj: string; razao_social: string; fantasia: string; cidade: string; uf: string; carteira_id: string | null;
  representante: string; rep_link: string; comprador: string; email: string; celular: string; canais: Record<string, string>;
  status: 'aprovado' | 'analise' | 'recusado'; origem: string; alertas: string[]; motivo: string; criado_em: string; decidido_em: string | null;
};
type Pedido = {
  id: string; numero: string; inscrito_id: string; cnpj: string; razao_social: string; fantasia: string; cidade: string; uf: string;
  representante: string; comprador: string; email: string; celular: string; observacao: string; caixas: number; pecas: number;
  total: number; frete: string; status: 'recebido' | 'confirmado' | 'cancelado'; criado_em: string;
};
type Item = { pedido_id: string; codigo: string; nome: string; caixas: number; pecas_caixa: number; preco_peca: number; total: number };
type BP = { codigo: string; ordem: number; familia: string; preco_peca: number | null; desconto_pct: number | null; caixa_qtd: number | null; estoque_caixas: number | null; ativo: boolean };
type Prod = { id: string; code: string; name: string; packaging_name: string; line: string; image_url: string; carton_quantity: number | null; brand?: { label: string } | { label: string }[] | null };
const marcaDe = (p?: Prod) => { const b = p?.brand; const l = Array.isArray(b) ? b[0]?.label : b?.label; return l === 'Playmi' || l === 'Tópi' ? l : 'Cardoso'; };
type Cart = { id: string; razao_social: string; cnpj: string | null; uf: string; representante: string; grupo: string; situacao: string; dias_sem_compra: number | null; importado_em: string };

const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const int = (v: number) => Number(v).toLocaleString('pt-BR');
const cnpjFmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const CANAL: Record<string, string> = { site: 'Site', ml: 'Mercado Livre', amz: 'Amazon', shp: 'Shopee', mgl: 'Magalu', out: 'Outro' };
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
  const aba = abaValida(params.get('aba'));
  const setAba = (k: Aba) => setParams(k === 'resumo' ? {} : { aba: k });
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
        supabase.from('black_config').select('*').eq('id', 1).maybeSingle(),
        paginar<Inscrito>((a, z) => supabase.from('black_inscritos').select('*').neq('origem', 'previa').order('criado_em', { ascending: false }).range(a, z)),
        paginar<Pedido>((a, z) => supabase.from('black_pedidos').select('*').order('criado_em', { ascending: false }).range(a, z)),
        paginar<Item>((a, z) => supabase.from('black_pedido_itens').select('*').range(a, z)),
        supabase.from('black_produtos').select('*').order('ordem'),
        paginar<Prod>((a, z) => supabase.from('products').select('id, code, name, packaging_name, line, image_url, carton_quantity, brand:brands(label)').order('code').range(a, z)),
        paginar<Cart>((a, z) => supabase.from('black_carteira').select('id, razao_social, cnpj, uf, representante, grupo, situacao, dias_sem_compra, importado_em').order('razao_social').range(a, z)),
        paginar<{ codigo: string }>((a, z) => supabase.from('black_eventos').select('codigo').eq('tipo', 'ficha').range(a, z)),
        paginar<{ product_id: string }>((a, z) => supabase.from('content_materials').select('product_id').eq('status', 'liberado').range(a, z)),
      ]);
      if (c.error) throw new Error(c.error.message);
      setCfg(c.data as Cfg); setIns(i); setPeds(p); setItens(it); setBps((b.data as BP[]) ?? []); setProds(pr); setCart(ca);
      const f: Record<string, number> = {}; ev.forEach((e) => { f[e.codigo] = (f[e.codigo] ?? 0) + 1; }); setFichas(f);
      const mm: Record<string, number> = {}; m.forEach((x) => { mm[x.product_id] = (mm[x.product_id] ?? 0) + 1; }); setMats(mm);
      setErro('');
    } catch (e) {
      setErro((e as Error).message.includes('black_') ? 'As tabelas da Cardoso Black ainda não existem no banco: rode o SQL 0160_cardoso_black.sql no Supabase.' : (e as Error).message);
    }
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const porCodigo = useMemo(() => Object.fromEntries(prods.map((p) => [p.code, p])), [prods]);

  if (carregando) return <Loading />;
  const nAn = ins.filter((x) => x.status === 'analise').length;

  const titulo = ABAS.find((x) => x[0] === aba)?.[1] ?? '';
  return (
    <div className="page cbx cbx-app">
      <nav className="cbx-mtabs" aria-label="Cardoso Black">{ABAS.map(([k, l]) => <button key={k} type="button" className={aba === k ? 'on' : ''} onClick={() => setAba(k)}>{l}{k === 'inscritos' && nAn ? ` · ${nAn}` : ''}</button>)}</nav>
      <div className="cbx-main">
        <div className="cbx-ht">
          <h2>{titulo}</h2>
          {aba === 'resumo' && <span className="ex">atualizado agora</span>}
          {aba === 'pedidos' && cfg && <span className="ex">{dt(cfg.abre_em)} a {dt(cfg.fecha_em)}</span>}
          <div className="r"><button className="btn ghost sm" type="button" onClick={carregar}>Atualizar</button></div>
        </div>
        {erro && <div className="alert">{erro}</div>}
        {!erro && cfg && (
          <>
            {aba === 'resumo' && <Resumo ins={ins} peds={peds} itens={itens} cart={cart} fichas={fichas} porCodigo={porCodigo} cfg={cfg} recarregar={carregar} />}
            {aba === 'inscritos' && <Inscritos ins={ins} cfg={cfg} recarregar={carregar} />}
            {aba === 'pedidos' && <Pedidos peds={peds} itens={itens} recarregar={carregar} />}
            {aba === 'produtos' && <Produtos bps={bps} prods={prods} porCodigo={porCodigo} itens={itens} peds={peds} fichas={fichas} mats={mats} recarregar={carregar} />}
            {aba === 'carteira' && <Carteira cart={cart} ins={ins} recarregar={carregar} />}
            {aba === 'links' && <Links cart={cart} ins={ins} bps={bps} porCodigo={porCodigo} />}
            {aba === 'ajustes' && <Ajustes cfg={cfg} recarregar={carregar} />}
          </>
        )}
      </div>
    </div>
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
          <input className="cbx-in" inputMode="numeric" style={{ width: 110 }} value={presTxt} placeholder="nº de lojas" onChange={(e) => setPresTxt(e.target.value)} />
          <button className="btn sm" type="button" onClick={salvarPresentes}>Salvar</button>
          {aviso && <span className="cbx-hint">{aviso}</span>}
        </div>
      </div>
      <div className="cbx-two">
        <div className="cbx-box"><h3>Inscritos por canal de venda</h3><Barras dados={top(canais)} cor="#0A2530" /></div>
        <div className="cbx-box"><h3>Resultado</h3>
          <div className="cbx-kpis cbx-kpis2">
            <Kpi l="Valor" v={brl0(tv)} c="#DA3A2F" /><Kpi l="Pedido médio" v={brl0(val.length ? tv / val.length : 0)} c="#0A2530" />
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
function Inscritos({ ins, cfg, recarregar }: { ins: Inscrito[]; cfg: Cfg; recarregar: () => void }) {
  const [flt, setFlt] = useState<'todos' | Inscrito['status']>('todos');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Inscrito | null>(null);
  const [link, setLink] = useState('');
  const [aviso, setAviso] = useState('');
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
      {aviso && <div className="alert">{aviso}</div>}
      {vis.length === 0 ? <EmptyState title="Nenhum pré-cadastro" hint="Os cadastros feitos em /black aparecem aqui na hora." /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Loja e canais</th><th>Representante</th><th>Cadastro</th><th>Status</th></tr></thead>
            <tbody>{vis.map((x) => (
              <tr key={x.id} className="click" onClick={() => { setSel(x); setLink(''); setAviso(''); }}>
                <td><b>{x.fantasia || x.razao_social}</b><small>{cnpjFmt(x.cnpj)} · {x.comprador} · {x.cidade}/{x.uf}</small>
                  <div className="cbx-chips" style={{ marginTop: 5 }}>{Object.keys(x.canais ?? {}).map((k) => <span key={k}>{CANAL[k] ?? k}</span>)}</div></td>
                <td>{x.representante || '—'}</td>
                <td>{dt(x.criado_em)}</td>
                <td><div style={{ display: 'grid', gap: 5, justifyItems: 'start' }}>
                  <span className={`cbx-st ${x.status}`}>{ST[x.status]}</span>
                  {x.alertas?.filter((a) => a !== 'ddd_outra_uf').length > 0 && <small>{x.alertas.filter((a) => a !== 'ddd_outra_uf').map((a) => ALERTA[a] ?? a).join(' · ')}</small>}
                  {x.status === 'analise' && <button className="btn sm cbx-ok" type="button" onClick={(e) => { e.stopPropagation(); decidir(x, 'aprovado'); }}>Aprovar</button>}
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
              {sel.status !== 'aprovado' && <button className="btn" onClick={() => decidir(sel, 'aprovado')}>Aprovar</button>}
              {sel.status !== 'recusado' && <button className="btn ghost" onClick={() => decidir(sel, 'recusado')}>Recusar</button>}
              {sel.status === 'recusado' && <button className="btn ghost" onClick={() => decidir(sel, 'analise')}>Voltar para análise</button>}
              {sel.status === 'aprovado' && <button className="btn ghost" onClick={() => copiar(msgAprovado(sel))}>Copiar mensagem de aprovação</button>}
              <button className="btn ghost" onClick={() => gerarLink(sel)}>Gerar link de nova senha</button>
              {sel.celular && <a className="btn ghost" href={`https://wa.me/55${sel.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
            </div>
            {link && <div className="alert">Link de nova senha (vale 3 dias): <b style={{ wordBreak: 'break-all' }}>{link}</b> <button className="btn sm" onClick={() => copiar(link)}>Copiar</button></div>}
            {aviso && <p className="cbx-hint">{aviso}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ================= Pedidos ================= */
function Pedidos({ peds, itens, recarregar }: { peds: Pedido[]; itens: Item[]; recarregar: () => void }) {
  const { profile } = useAuth();
  const [flt, setFlt] = useState<'todos' | Pedido['status']>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const vis = peds.filter((p) => (flt === 'todos' || p.status === flt)
    && (!busca.trim() || `${p.numero} ${p.razao_social} ${p.fantasia} ${p.cnpj} ${p.representante}`.toLowerCase().includes(busca.trim().toLowerCase())));
  const val = peds.filter((p) => p.status !== 'cancelado'); const tv = val.reduce((s, p) => s + Number(p.total), 0);
  async function status(p: Pedido, s: Pedido['status']) {
    const { error } = await supabase.from('black_pedidos').update({ status: s, atualizado_em: new Date().toISOString(), atualizado_por: profile?.id ?? null }).eq('id', p.id);
    setAviso(error ? `Não consegui salvar: ${error.message}` : `${p.numero}: ${ST[s]}`); if (!error) recarregar();
  }
  function guarani(soConfirmados: boolean) {
    const L = peds.filter((p) => (soConfirmados ? p.status === 'confirmado' : p.status !== 'cancelado'));
    const ids = new Map(L.map((p) => [p.id, p]));
    baixarCsv(`pedidos-cardoso-black${soConfirmados ? '-confirmados' : ''}.csv`, [
      ['pedido', 'data', 'status', 'cnpj', 'razao_social', 'cidade', 'uf', 'representante', 'comprador', 'email', 'whatsapp', 'codigo', 'produto', 'caixas', 'pecas_por_caixa', 'pecas', 'preco_peca', 'total_item', 'frete', 'observacao'],
      ...itens.filter((i) => ids.has(i.pedido_id)).map((i) => { const p = ids.get(i.pedido_id)!; return [p.numero, dt(p.criado_em), ST[p.status], p.cnpj, p.razao_social, p.cidade, p.uf, p.representante, p.comprador, p.email, p.celular, i.codigo, i.nome, i.caixas, i.pecas_caixa, i.caixas * i.pecas_caixa, String(i.preco_peca).replace('.', ','), Number(i.total).toFixed(2).replace('.', ','), p.frete, p.observacao]; }),
    ]);
  }
  return (
    <>
      <div className="cbx-kpis"><Kpi l="Valor" v={brl0(tv)} c="#DA3A2F" /><Kpi l="Pedidos" v={int(val.length)} /><Kpi l="Confirmados" v={int(peds.filter((p) => p.status === 'confirmado').length)} c="#1F7F88" /><Kpi l="A confirmar" v={int(peds.filter((p) => p.status === 'recebido').length)} c="#F2B84B" /></div>
      <div className="cbx-bar">
        {(['todos', 'recebido', 'confirmado', 'cancelado'] as const).map((k) => <button key={k} className={`cbx-pill${flt === k ? ' on' : ''}`} onClick={() => setFlt(k)}>{k === 'todos' ? 'Todos' : ST[k]}<b>{k === 'todos' ? peds.length : peds.filter((p) => p.status === k).length}</b></button>)}
        <input type="search" placeholder="Pedido, loja, CNPJ ou representante" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn sm" onClick={() => guarani(true)}>Planilha Guarani (confirmados)</button>
        <button className="btn ghost sm" onClick={() => guarani(false)}>Todos os pedidos</button>
      </div>
      <p className="cbx-hint">Mude para <b>Confirmado</b> quando o pedido for lançado no Guarani: a partir daí o estoque dele passa a ser contado pelo saldo do Guarani.</p>
      {aviso && <div className="alert">{aviso}</div>}
      {vis.length === 0 ? <EmptyState title="Nenhum pedido" hint="Os pedidos enviados pelo link aparecem aqui na hora." /> : (
        <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
          <table className="cbx-table">
            <thead><tr><th>Pedido</th><th>Loja</th><th>Representante</th><th className="num">Caixas</th><th className="num">Total</th><th>Status</th></tr></thead>
            <tbody>{vis.map((p) => (
              <Fragment key={p.id}>
                <tr className="click" onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                  <td><b>{p.numero}</b><small>{dt(p.criado_em)}</small></td>
                  <td><b>{p.fantasia || p.razao_social}</b><small>{cnpjFmt(p.cnpj)} · {p.cidade}/{p.uf}</small></td>
                  <td>{p.representante || '—'}</td>
                  <td className="num">{p.caixas}</td>
                  <td className="num"><b>{brl(Number(p.total))}</b></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select value={p.status} onChange={(e) => status(p, e.target.value as Pedido['status'])}>{(['recebido', 'confirmado', 'cancelado'] as const).map((s) => <option key={s} value={s}>{ST[s]}</option>)}</select>
                  </td>
                </tr>
                {aberto === p.id && (
                  <tr><td colSpan={6} style={{ background: 'var(--surface-2)' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {itens.filter((i) => i.pedido_id === p.id).map((i) => <div key={i.codigo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{i.codigo} · {i.nome} <small style={{ display: 'inline' }}>({i.caixas} cx × {i.pecas_caixa} pç · {brl(Number(i.preco_peca))})</small></span><b>{brl(Number(i.total))}</b></div>)}
                      <small>Comprador: {p.comprador} · {p.email} · {p.celular} · {p.frete}{p.observacao ? ` · Obs.: ${p.observacao}` : ''}</small>
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
  const semCadastro = bps.filter((b) => !porCodigo[b.codigo]);
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
      ordem: Math.round(num(r.ordem) ?? i + 1), familia: r.familia || r.fam || '', preco_peca: pos(num(r.preco_peca || r.preco || r.black)),
      caixa_qtd: pos(num(r.caixa_qtd || r.caixa || r.cx)) === null ? null : Math.round(num(r.caixa_qtd || r.caixa || r.cx)!),
      estoque_caixas: (() => { const e = num(r.estoque_caixas || r.estoque); return e === null || e < 0 ? null : Math.round(e); })(),
      ativo: true,
    })).filter((r) => r.codigo);
    const semCaixa = linhas.filter((r) => r.caixa_qtd === null).map((r) => r.codigo);
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
        <p className="cbx-hint">Colunas: <b>codigo; ordem; familia; preco_peca; caixa_qtd; estoque_caixas</b>. Preço por peça é o preço final. Vazio = usa a Tabela de Preços da região do cliente com o desconto dos Ajustes. Caixa vazia = caixa master da ficha técnica. Estoque = cota da Black (vazio = sem cota; o limite passa a ser o saldo do Guarani).</p>
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
            <tbody>{bps.map((b) => { const p = porCodigo[b.codigo]; const sujo = !!ed[b.codigo]; return (
              <tr key={b.codigo}>
                <td style={{ width: 70 }}><input inputMode="numeric" value={txt(b, 'ordem')} onChange={(e) => set(b.codigo, 'ordem', e.target.value)} /></td>
                <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{p?.image_url ? <img className="cbx-thumb" src={p.image_url} alt="" /> : <span className="cbx-thumb" />}<div><b>{p?.packaging_name || p?.name || '—'}</b><small>{b.codigo}</small></div></div></td>
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
  const L = (r: string) => `${o}/black?r=${encodeURIComponent(r)}`;
  return (
    <>
      <div className="cbx-box">
        <h3>Links gerais</h3>
        <div className="cbx-acts">
          {[['Pré-cadastro', `${o}/black`], ['Página de pedido', `${o}/black/pedido`]].map(([l, u]) => <button key={u} className="btn ghost" onClick={() => copiar(u)}>{ok === u ? 'Copiado' : `Copiar · ${l}`}</button>)}
          <button className="btn ghost" onClick={() => baixarCsv('links-qr-produtos.csv', [['ordem', 'codigo', 'produto', 'link_qr'], ...bps.map((b) => [b.ordem, b.codigo, porCodigo[b.codigo]?.name ?? '', `${o}/black/p/${b.codigo}?live=1`])])}>Baixar links dos QR (CSV)</button>
          <button className="btn ghost" onClick={() => baixarCsv('links-representantes.csv', [['representante', 'clientes', 'inscritos', 'link'], ...reps.map(([r, v]) => [r, v.cli, v.ins, L(r)])])}>Baixar links dos representantes (CSV)</button>
        </div>
        <p className="cbx-hint" style={{ marginTop: 10 }}>Os QR da live apontam para {o}/black/p/&lt;código&gt;?live=1 (a ficha mostra “Visto agora na live”). Se o endereço do Hub mudar (ex.: app.cardosotoys.com.br), gere os QR de novo.</p>
      </div>
      <div className="cbx-box cbx-scroll" style={{ padding: 0 }}>
        <table className="cbx-table">
          <thead><tr><th>Representante</th><th className="num">Clientes</th><th className="num">Inscritos</th><th>Link de pré-cadastro</th><th /></tr></thead>
          <tbody>{reps.map(([r, v]) => <tr key={r}><td><b>{r}</b></td><td className="num">{int(v.cli)}</td><td className="num">{int(v.ins)}</td><td><small style={{ wordBreak: 'break-all' }}>{L(r)}</small></td><td><button className="btn sm" onClick={() => copiar(L(r))}>{ok === L(r) ? 'Copiado' : 'Copiar'}</button></td></tr>)}</tbody>
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
      pedido_minimo: Number(f.pedido_minimo), frete_gratis_sp_rj: Number(f.frete_gratis_sp_rj), desconto_pct: Number(f.desconto_pct),
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
        {campo('Data da live (texto)', 'live_data', 'text', 'Ex.: Quinta-feira, 12/11 · 15h')}
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
