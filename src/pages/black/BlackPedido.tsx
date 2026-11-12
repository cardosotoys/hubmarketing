import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Shell, { Toast } from './Shell';
import { Ic, Sv } from './Icones';
import Cronometro from './Cronometro';
import Encerrada from './Encerrada';
import {
  brl, descontoPct, diaMes, ERRO_LOGIN, ipiDe, pctTxt, fmtData, freteTexto, ehLimitado, gravarCarrinho, lerCarrinho, sincronizarCarrinho, maskCnpj, useConfig, useFaltam, useSessao,
  type BlackConfig, type BlackItem, type BlackPedido as Pedido, type BlackSessao, type Carrinho,
} from './api';

/* /black/pedido — a loja da Cardoso Black, no formato de um checkout:
 *   Produtos       vitrine por família, com o resumo do carrinho ao lado
 *   Carrinho       itens, quantidades, remover, total, mínimo e frete (?v=carrinho)
 *   Finalizar      etapas Carrinho → Dados e entrega → Confirmação
 *   Meus pedidos   pedidos enviados, com o andamento de cada um
 *   Minha conta    dados da loja, live, canal e representante
 * O banco confere tudo de novo no envio (preço, estoque, mínimo, prazo). */

type View = 'produtos' | 'carrinho' | 'finalizar' | 'pedidos' | 'conta';
const VIEWS: View[] = ['produtos', 'carrinho', 'finalizar', 'pedidos', 'conta'];

export default function BlackPedido() {
  const { cfg } = useConfig();
  const { token, sessao, carregando, entrar, sair } = useSessao();
  const abre = useFaltam(cfg?.abre_em);
  const fecha = useFaltam(cfg?.fecha_em);
  const [params] = useSearchParams();

  const clock = cfg ? (abre && abre.ms > 0 ? { label: 'abre em', value: abre.texto } : fecha && fecha.ms > 0 ? { label: 'encerra em', value: fecha.texto } : { label: 'pedidos', value: 'encerrados' }) : null;

  if (!cfg || carregando) return <Shell sub="Pedidos somente por esta página" clock={clock}><div className="cb-note"><span className="cb-spin" /> Carregando…</div></Shell>;
  // antes da live: só a contagem regressiva (sem login, sem produtos). A prévia da equipe passa direto.
  if (abre && abre.ms > 0 && !sessao?.previa) return <Shell sub="Cardoso Black · exclusivo para lojas de e-commerce" clock={clock} wide={false}><Cronometro alvo={cfg.abre_em} canal={sessao?.canal_link || cfg?.canal_link} cadastro={!sessao} /></Shell>;
  // depois do fechamento (fecha_em, ajustável): o link fecha. Quem está logado ainda vê os próprios pedidos.
  const fechou = fecha !== null && fecha.ms <= 0 && !sessao?.previa;
  if (fechou && !sessao) return <Shell sub="Cardoso Black" clock={clock} wide={false}><Encerrada fim={cfg.fecha_em} /></Shell>;
  if (!sessao) return <Shell sub="Pedidos somente por esta página" clock={clock} wide={false}><Login entrar={entrar} ate={diaMes(cfg.fecha_em)} /></Shell>;

  // prévia da equipe: vitrine liberada antes da abertura e depois do fim, sem enviar pedido
  const previa = !!sessao.previa;
  const antes = !previa && abre !== null && abre.ms > 0;
  const depois = !previa && fecha !== null && fecha.ms <= 0;
  return (
    <Shell sub={`Pedido somente por esta página · caixa fechada · mínimo de ${brl(cfg.pedido_minimo)}`} clock={clock}>
      {depois && params.get('v') !== 'pedidos' && params.get('v') !== 'conta' ? <Encerrada fim={cfg.fecha_em} logado /> : <Loja token={token} sessao={sessao} cfg={cfg} antes={antes} encerrado={depois} previa={previa} sair={sair} />}
    </Shell>
  );
}

function Login({ entrar, ate }: { entrar: (c: string, s: string, manter?: boolean) => Promise<string | null>; ate: string }) {
  const [cnpj, setCnpj] = useState('');
  const [senha, setSenha] = useState('');
  const [manter, setManter] = useState(true);
  const [esqueci, setEsqueci] = useState(false);
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);
  async function ir(e: FormEvent) {
    e.preventDefault(); setErro(''); setIndo(true);
    const r = await entrar(cnpj, senha, manter);
    setIndo(false);
    if (r) setErro(ERRO_LOGIN[r] ?? ERRO_LOGIN.senha);
  }
  return (
    <form className="cb-card cb-form" onSubmit={ir} style={{ overflow: 'hidden' }}>
      <div style={{ background: 'var(--red)', color: '#fff', padding: '18px 20px' }}>
        <h2 style={{ fontSize: 22 }}>Entre com o seu CNPJ</h2>
        <p style={{ margin: '4px 0 0', opacity: .92, fontSize: 14 }}>Somente para lojas com pré-cadastro aprovado.</p>
      </div>
      <div className="cb-form" style={{ padding: '18px 20px 20px' }}>
        <div className="cb-field"><label htmlFor="cb-lc">CNPJ da loja</label>
          <input id="cb-lc" inputMode="numeric" autoComplete="username" placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} /></div>
        <div className="cb-field"><label htmlFor="cb-ls">Senha</label>
          <input id="cb-ls" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        <label className="cb-check"><input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} /><span>Manter conectado neste aparelho até {ate}</span></label>
        {erro && <div className="cb-alert err">{erro}</div>}
        <button className="cb-btn full" type="submit" disabled={indo || cnpj.replace(/\D/g, '').length !== 14 || !senha}>{indo ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="cb-link" style={{ justifySelf: 'start' }} onClick={() => setEsqueci(!esqueci)}>Esqueci minha senha</button>
        {esqueci && <div className="cb-alert">Peça ao seu representante um link para criar uma nova senha. Ele gera o link na hora.</div>}
        <div className="cb-note">Ainda não tem cadastro? <Link to="/black">Faça o pré-cadastro</Link></div>
      </div>
    </form>
  );
}

function Espera({ alvo, sessao: canal }: { alvo: string; sessao: string }) {
  const f = useFaltam(alvo);
  return (
    <div className="cb-card cb-pad cb-narrow cb-res">
      <div className="bd" style={{ ['--c' as string]: 'var(--navy)' }}><Ic n="calendar" /></div>
      <h2>Os pedidos abrem na live</h2>
      <p>A lista de produtos e os preços da Cardoso Black aparecem aqui na abertura, em {fmtData(alvo).replace(', ', ', às ')}.</p>
      {f && <div className="cb-cnt"><div><b>{f.d}</b><small>dias</small></div><div><b>{String(f.h).padStart(2, '0')}</b><small>horas</small></div><div><b>{String(f.m).padStart(2, '0')}</b><small>min</small></div></div>}
      {canal && <a className="cb-wab" href={canal} target="_blank" rel="noreferrer"><Sv.wa />Acompanhar pelo canal Cardoso Black</a>}
      <div className="cb-note">Você já está conectado neste aparelho.</div>
    </div>
  );
}

type LojaProps = {
  token: string; sessao: BlackSessao; cfg: BlackConfig; antes: boolean; encerrado: boolean; previa: boolean; sair: () => void;
};
type Enviado = { numero: string; caixas: number; pecas: number; total: number; ipi?: number; total_com_ipi?: number; frete: string };
type Linha = { it: BlackItem; q: number };

function Loja(p: LojaProps) {
  const { sessao, cfg } = p;
  const [params, setParams] = useSearchParams();
  const vParam = params.get('v') as View | null;
  const view: View = vParam && VIEWS.includes(vParam) ? vParam : p.encerrado ? 'pedidos' : 'produtos';
  const ir = useCallback((v: View) => {
    setParams(v === 'produtos' ? {} : { v }); window.scrollTo(0, 0);
  }, [setParams]);

  const [itens, setItens] = useState<BlackItem[]>([]);
  const [cart, setCart] = useState<Carrinho>(lerCarrinho());
  const [fam, setFam] = useState('Todas');
  const [ordem, setOrdem] = useState<Ordem>('live');
  const [lic, setLic] = useState('');
  const [descMin, setDescMin] = useState(0);
  const [soEstoque, setSoEstoque] = useState(false);
  const [soCarrinho, setSoCarrinho] = useState(false);
  const [busca, setBusca] = useState('');
  const [toast, setToast] = useState('');
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const carregar = useCallback(async () => {
    const [c, m] = await Promise.all([
      supabase.rpc('black_catalogo', { p_token: p.token }),
      supabase.rpc('black_meus_pedidos', { p_token: p.token }),
    ]);
    setItens(Array.isArray(c.data) ? (c.data as BlackItem[]) : []);
    setPedidos(Array.isArray(m.data) ? (m.data as Pedido[]) : []);
  }, [p.token]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { gravarCarrinho(cart); }, [cart]);
  // a ficha do QR grava no mesmo carrinho: ao voltar para esta aba, relê
  useEffect(() => {
    const f = () => setCart(lerCarrinho());
    window.addEventListener('focus', f);
    return () => window.removeEventListener('focus', f);
  }, []);

  const porCod = useMemo(() => Object.fromEntries(itens.map((i) => [i.codigo, i])), [itens]);
  const linhas: Linha[] = Object.entries(cart).filter(([c, q]) => q > 0 && porCod[c]?.preco_peca != null).map(([c, q]) => ({ it: porCod[c], q }));
  const total = linhas.reduce((s, l) => s + l.q * l.it.caixa * (l.it.preco_peca ?? 0), 0);
  const caixas = linhas.reduce((s, l) => s + l.q, 0);
  const pecas = linhas.reduce((s, l) => s + l.q * l.it.caixa, 0);
  const ok = total >= cfg.pedido_minimo;
  const [freteT, freteOk] = freteTexto(sessao.uf, sessao.cidade);
  // Totokinha Clássica (0300 e 0301): juntas, no máximo limite_pct do valor do pedido
  const limPct = Number(cfg.limite_pct ?? 10);
  const valLim = linhas.filter((l) => ehLimitado(l.it.codigo, cfg)).reduce((s, l) => s + l.q * l.it.caixa * (l.it.preco_peca ?? 0), 0);
  const limOk = valLim <= total * limPct / 100 + 0.005;
  const limMsg = limOk ? '' : `Totokinha Clássica (0300 e 0301): juntas, até ${pctTxt(limPct)} do pedido. Hoje estão em ${brl(valLim)} de ${brl(total * limPct / 100)} permitidos: retire caixas ou acrescente outros produtos.`;
  const familias = ['Todas', ...new Set(itens.map((i) => i.familia).filter(Boolean))];
  const q = busca.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filtrados = itens.filter((i) => (!q || `${i.codigo} ${i.nome} ${i.familia}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q))
    && (!lic || licencaDe(i) === lic)
    && (!descMin || descontoPct(i.preco_peca ?? 0, i.preco_tabela) >= descMin)
    && (!soEstoque || i.disponivel !== 0)
    && (!soCarrinho || (cart[i.codigo] ?? 0) > 0));
  const porFam = (f: string) => filtrados.filter((i) => f === 'Todas' || i.familia === f).length;
  const vis = ordenar(filtrados.filter((i) => fam === 'Todas' || i.familia === fam), ordem);
  const licencas = [...new Set(itens.map(licencaDe).filter(Boolean))] as string[];
  const temFiltro = !!(q || lic || descMin || soEstoque || soCarrinho || fam !== 'Todas' || ordem !== 'live');
  const limpar = () => { setBusca(''); setLic(''); setDescMin(0); setSoEstoque(false); setSoCarrinho(false); setFam('Todas'); setOrdem('live'); };

  const mudar = (c: string, d: number) => setCart((x) => {
    const it = porCod[c]; const max = it?.disponivel ?? 9999;
    const n = Math.max(0, Math.min(max, (x[c] ?? 0) + d));
    const y = { ...x }; if (n) y[c] = n; else delete y[c]; return y;
  });
  const remover = (c: string) => setCart((x) => { const y = { ...x }; delete y[c]; return y; });
  const podeComprar = !p.antes && !p.encerrado;
  const resumo = { total, caixas, pecas, minimo: cfg.pedido_minimo, ok: ok && limOk, frete: freteT, freteOk, ipiPct: Number(cfg.ipi_pct ?? 6.5), aviso: limMsg };

  // o carrinho também fica no servidor: a caixa colocada sai do estoque de todos; ao remover, volta.
  // Se alguém pegou antes, o servidor devolve menos e o carrinho se ajusta.
  const enviadoRef = useRef(JSON.stringify({}));
  const sincronizar = useCallback(async (c: Carrinho, forcar = false) => {
    const j = JSON.stringify(c);
    if (!forcar && j === enviadoRef.current) return;
    enviadoRef.current = j;
    const r = await sincronizarCarrinho(p.token, c);
    if (!r || !r.ajustes.length) return;
    setCart((x) => { const y = { ...x }; r.ajustes.forEach((a) => { if (a.aceito) y[a.codigo] = a.aceito; else delete y[a.codigo]; }); return y; });
    const a = r.ajustes[0]; const n = porCodRef.current[a.codigo]?.nome ?? a.codigo;
    setToast(a.aceito ? `${n}: só ${a.aceito} caixa${a.aceito > 1 ? 's' : ''} disponíve${a.aceito > 1 ? 'is' : 'l'} agora. Ajustei seu carrinho.` : `${n} esgotou agora há pouco. Retirei do seu carrinho.`);
    carregar();
  }, [p.token, carregar]);
  const porCodRef = useRef(porCod); porCodRef.current = porCod;
  useEffect(() => {
    if (!podeComprar || p.previa) return;
    const t = setTimeout(() => sincronizar(cart), 350);
    return () => clearTimeout(t);
  }, [cart, podeComprar, p.previa, sincronizar]);
  // a cada minuto e meio: renova a reserva do carrinho e atualiza o disponível (o que os outros pegaram)
  useEffect(() => {
    if (!podeComprar || p.previa) return;
    const t = setInterval(() => { const c = lerCarrinho(); if (Object.keys(c).length) sincronizar(c, true); carregar(); }, 90000);
    return () => clearInterval(t);
  }, [podeComprar, p.previa, sincronizar, carregar]);

  return (
    <>
      <nav className="cb-snav" aria-label="Loja">
        <div className="cb-snav-l">
          <span className="cb-av" style={{ background: 'var(--pink)', color: 'var(--red)' }}>{(sessao.fantasia || sessao.razao_social)[0]}</span>
          <div className="who"><b>{sessao.fantasia || sessao.razao_social}</b><small>{sessao.cidade}/{sessao.uf}{sessao.representante ? ` · Rep. ${sessao.representante}` : ''}</small></div>
        </div>
        <div className="cb-snav-r">
          <button type="button" className={view === 'produtos' ? 'on' : ''} aria-label="Produtos" onClick={() => ir('produtos')}><Ic n="store" /><span>Produtos</span></button>
          <button type="button" className={view === 'pedidos' ? 'on' : ''} aria-label="Meus pedidos" onClick={() => ir('pedidos')}><Ic n="receipt" /><span>Meus pedidos{pedidos.length ? ` (${pedidos.length})` : ''}</span></button>
          <button type="button" className={view === 'conta' ? 'on' : ''} aria-label="Minha conta" onClick={() => ir('conta')}><Ic n="users" /><span>Minha conta</span></button>
          <button type="button" className={`cart${view === 'carrinho' || view === 'finalizar' ? ' on' : ''}`} onClick={() => ir('carrinho')} aria-label={`Carrinho, ${caixas} caixas`}>
            <Ic n="cart" /><span className="n">{caixas}</span><span className="v">{brl(total)}</span>
          </button>
        </div>
      </nav>

      {p.previa && <div className="cb-alert warn" style={{ marginBottom: 14 }}><b>Prévia da equipe.</b> Esta é a visão do cliente com a loja de demonstração: preços e carrinho funcionam, mas o pedido não é enviado e nada entra na medição.</div>}
      {p.encerrado && <div className="cb-alert warn" style={{ marginBottom: 14 }}>A Cardoso Black terminou. Os pedidos foram aceitos até {fmtData(cfg.fecha_em).replace(', ', ' às ')}.</div>}

      {view === 'produtos' && (p.antes ? <Espera alvo={cfg.abre_em} sessao={sessao.canal_link} /> : (
        <>
          <div className="cb-tools">
            <input className="cb-search" type="search" placeholder="Buscar por nome, código ou personagem" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <label className="cb-sel"><span>Ordenar</span>
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
                <option value="live">Ordem da live</option><option value="desconto">Maior desconto</option>
                <option value="menor">Menor preço por peça</option><option value="maior">Maior preço por peça</option>
                <option value="caixa">Menor valor da caixa</option><option value="nome">Nome (A–Z)</option>
              </select></label>
          </div>
          <div className="cb-filtros">
            <label className="cb-sel"><span>Personagem</span>
              <select value={lic} onChange={(e) => setLic(e.target.value)}><option value="">Todos</option>{licencas.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
            <label className="cb-sel"><span>Desconto</span>
              <select value={descMin} onChange={(e) => setDescMin(Number(e.target.value))}><option value={0}>Todos</option><option value={30}>30%+</option><option value={40}>40%+</option><option value={50}>50%+</option></select></label>
            <button type="button" className={`cb-tg${soEstoque ? ' on' : ''}`} onClick={() => setSoEstoque((v) => !v)}>Só com estoque</button>
            <button type="button" className={`cb-tg${soCarrinho ? ' on' : ''}`} onClick={() => setSoCarrinho((v) => !v)}>No meu carrinho{caixas ? ` (${linhas.length})` : ''}</button>
            <span className="cb-cnt-txt">{vis.length} de {itens.length} produtos</span>
            {temFiltro && <button type="button" className="cb-link" onClick={limpar}>Limpar filtros</button>}
          </div>
          <div className="cb-chips" style={{ marginBottom: 14 }}>
            {familias.map((f) => { const n = porFam(f); return <button key={f} type="button" className={f === fam ? 'on' : ''} disabled={!n && f !== fam} onClick={() => setFam(f)}>{f} <small>{n}</small></button>; })}
          </div>
          <div className="cb-shop">
            <div className="cb-prods">
              {vis.length === 0 && <div className="cb-note" style={{ gridColumn: '1/-1' }}>{itens.length ? <>Nenhum produto com esses filtros. <button type="button" className="cb-link" onClick={limpar}>Limpar filtros</button></> : <><span className="cb-spin" /> Carregando produtos…</>}</div>}
              {vis.map((i) => {
                const q = cart[i.codigo] ?? 0; const esg = i.disponivel === 0;
                return (
                  <article key={i.codigo} className={`cb-pc${q ? ' in' : ''}`}>
                    <Link className="im" to={`/black/p/${i.codigo}`}>
                      {i.imagem ? <img src={i.imagem} alt="" loading="lazy" /> : <span className="ph"><Ic n="star" /></span>}
                      {esg && <span className="esg">Esgotado</span>}
                      <span className="vf">Ver ficha</span>
                    </Link>
                    <div className="bd">
                      <span className="cd">{i.codigo} · {i.familia}</span>
                      <h3>{i.nome}</h3>
                      {i.preco_peca != null && <div className="pr">{descontoPct(i.preco_peca, i.preco_tabela) > 0 && <div className="de"><s>{brl(i.preco_tabela!)}</s><em>−{descontoPct(i.preco_peca, i.preco_tabela)}%</em></div>}<b>{brl(i.preco_peca)}</b><span>por peça · líquido</span></div>}
                      <div className="bx">Caixa com {i.caixa}{i.preco_peca != null ? ` · ${brl(i.preco_peca * i.caixa)}` : ''}{i.disponivel != null && !esg ? ` · ${i.disponivel} cx disp.` : ''}</div>
                      <Stepper q={q} menos={() => mudar(i.codigo, -1)} mais={() => mudar(i.codigo, 1)} maisOff={esg || !podeComprar || (i.disponivel != null && q >= i.disponivel)} />
                    </div>
                  </article>
                );
              })}
            </div>
            <aside className="cb-card cb-cart">
              <div className="ct"><b>Seu carrinho</b><span>{caixas} cx</span></div>
              {linhas.length === 0 ? <div className="ce">Escolha as caixas na lista.</div>
                : linhas.map((l) => <div key={l.it.codigo} className="ln"><b>{l.it.nome}</b><b>{brl(l.q * l.it.caixa * (l.it.preco_peca ?? 0))}</b><small>{l.q} cx × {l.it.caixa} pç</small></div>)}
              <Resumo {...resumo} botao="Ir para o carrinho" acao={() => ir('carrinho')} desligado={!linhas.length} />
            </aside>
          </div>
          <div className="cb-mbar">
            <div><b>{brl(total)}</b><span>{ok ? `${caixas} caixas · sem IPI · mínimo atingido` : `${caixas} caixas · faltam ${brl(cfg.pedido_minimo - total)}`}</span><div className="cb-bar"><i style={{ width: `${Math.min(100, (total / cfg.pedido_minimo) * 100)}%` }} /></div></div>
            <button className="cb-btn" type="button" disabled={!linhas.length} onClick={() => ir('carrinho')}><Ic n="cart" />Carrinho</button>
          </div>
        </>
      ))}

      {view === 'carrinho' && (
        <>
          <Etapas atual={1} />
          {linhas.length === 0 ? (
            <div className="cb-card cb-pad cb-narrow cb-res">
              <div className="bd" style={{ ['--c' as string]: 'var(--navy)' }}><Ic n="cart" /></div>
              <h2>Seu carrinho está vazio</h2>
              <p>Escolha os produtos por caixa fechada na lista ou pela ficha do QR durante a live.</p>
              <button className="cb-btn" type="button" onClick={() => ir('produtos')}>Ver produtos</button>
            </div>
          ) : (
            <div className="cb-co">
              <div className="cb-card cb-cl">
                <div className="hd"><h3>Carrinho</h3><span>{caixas} caixa{caixas > 1 ? 's' : ''} · {pecas.toLocaleString('pt-BR')} peças</span></div>
                {linhas.map((l) => (
                  <div key={l.it.codigo} className="row">
                    <Link className="im" to={`/black/p/${l.it.codigo}`}>{l.it.imagem ? <img src={l.it.imagem} alt="" /> : <Ic n="star" />}</Link>
                    <div className="nf">
                      <span className="cd">{l.it.codigo} · {l.it.familia}</span>
                      <b>{l.it.nome}</b>
                      <small>{brl(l.it.preco_peca ?? 0)}/peça · caixa com {l.it.caixa} = {brl((l.it.preco_peca ?? 0) * l.it.caixa)}</small>
                      <button type="button" className="cb-link rm" onClick={() => remover(l.it.codigo)}>Remover</button>
                    </div>
                    <Stepper q={l.q} menos={() => mudar(l.it.codigo, -1)} mais={() => mudar(l.it.codigo, 1)} maisOff={!podeComprar || (l.it.disponivel != null && l.q >= l.it.disponivel)} />
                    <b className="st">{brl(l.q * l.it.caixa * (l.it.preco_peca ?? 0))}</b>
                  </div>
                ))}
                <div className="ft"><button type="button" className="cb-link" onClick={() => ir('produtos')}>‹ Continuar escolhendo</button></div>
                <Condicoes cfg={cfg} />
              </div>
              <aside className="cb-card cb-cart fixo">
                <div className="ct"><b>Resumo</b><span>{caixas} cx</span></div>
                <Resumo {...resumo} botao="Continuar" acao={() => ir('finalizar')} desligado={!ok || !podeComprar} />
              </aside>
            </div>
          )}
        </>
      )}

      {view === 'finalizar' && (enviado ? (
        <>
          <Etapas atual={3} />
          <Confirmacao enviado={enviado} representante={sessao.representante} outro={() => { setEnviado(null); ir('produtos'); }} pedidos={() => { setEnviado(null); ir('pedidos'); }} />
        </>
      ) : linhas.length === 0 ? (
        <div className="cb-card cb-pad cb-narrow cb-res"><h2>Seu carrinho está vazio</h2><button className="cb-btn" type="button" onClick={() => ir('produtos')}>Ver produtos</button></div>
      ) : (
        <>
          <Etapas atual={2} />
          <Finalizar token={p.token} sessao={sessao} linhas={linhas} {...resumo}
            voltar={() => ir('carrinho')}
            onEnviado={(r) => { setEnviado(r); setCart({}); carregar(); window.scrollTo(0, 0); }}
            onAjuste={(msg) => { setCart(lerCarrinho()); setToast(msg); ir('carrinho'); carregar(); }} />
        </>
      ))}

      {view === 'pedidos' && <MeusPedidos pedidos={pedidos} representante={sessao.representante} comprar={podeComprar ? () => ir('produtos') : null} />}

      {view === 'conta' && <MinhaConta sessao={sessao} cfg={cfg} sair={p.sair} />}

      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </>
  );
}

function Stepper({ q, menos, mais, maisOff }: { q: number; menos: () => void; mais: () => void; maisOff: boolean }) {
  return (
    <div className="cb-stp">
      <button type="button" aria-label="Retirar uma caixa" disabled={!q} onClick={menos}>−</button>
      <span className="q">{q}<small>caixa{q === 1 ? '' : 's'}</small></span>
      <button type="button" className="p" aria-label="Adicionar uma caixa" disabled={maisOff} onClick={mais}>+</button>
    </div>
  );
}

function Etapas({ atual }: { atual: 1 | 2 | 3 }) {
  const E = ['Carrinho', 'Dados e entrega', 'Confirmação'];
  return (
    <ol className="cb-etapas">
      {E.map((e, i) => <li key={e} className={i + 1 < atual ? 'ok' : i + 1 === atual ? 'on' : ''}><i>{i + 1 < atual ? '✓' : i + 1}</i><span>{e}</span></li>)}
    </ol>
  );
}

type ResumoProps = { total: number; caixas: number; pecas: number; minimo: number; ok: boolean; frete: string; freteOk: boolean; ipiPct: number; aviso?: string };
/** produtos (preço líquido) + IPI sobre o pedido inteiro = total. O mínimo e o frete grátis olham só os produtos. */
function Totais({ total, ipiPct }: { total: number; ipiPct: number }) {
  const ipi = ipiDe(total, ipiPct);
  return (
    <>
      <div className="cb-sl"><span>Produtos <small>(preços líquidos)</small></span><b>{brl(total)}</b></div>
      <div className="cb-sl"><span>IPI ({pctTxt(ipiPct)})</span><b>{brl(ipi)}</b></div>
      <div className="cb-tot"><span>Total do pedido</span><b>{brl(total + ipi)}</b></div>
    </>
  );
}
function Resumo({ total, minimo, frete, freteOk, pecas, ipiPct, aviso, botao, acao, desligado }: ResumoProps & { botao: string; acao: () => void; desligado: boolean }) {
  return (
    <div className="cb-sum">
      {pecas > 0 && <div className="cb-sl"><span>Peças</span><b>{pecas.toLocaleString('pt-BR')}</b></div>}
      <Totais total={total} ipiPct={ipiPct} />
      <div className="cb-bar"><i style={{ width: `${Math.min(100, (total / minimo) * 100)}%` }} /></div>
      <div className={`cb-hint${total >= minimo ? ' ok' : ''}`}>{total >= minimo ? 'Pedido mínimo atingido' : `Faltam ${brl(minimo - total)} em produtos para o mínimo de ${brl(minimo)}`}</div>
      {aviso && <div className="cb-alert err" style={{ margin: '8px 0 0', fontSize: 13 }}>{aviso}</div>}
      <div className={`cb-fre${freteOk ? ' ok' : ''}`}>{frete}</div>
      <button className="cb-btn full" type="button" disabled={desligado} onClick={acao}>{botao}</button>
    </div>
  );
}

const ERRO_PEDIDO = (r: { erro: string; codigo?: string; disponivel?: number; minimo?: number }, nome: (c: string) => string) => ({
  sessao: 'Sua sessão terminou. Entre de novo com CNPJ e senha.',
  nao_abriu: 'Os pedidos ainda não abriram.',
  encerrado: 'Os pedidos da Cardoso Black foram encerrados.',
  vazio: 'O pedido está vazio.',
  previa: 'Prévia da equipe: o pedido não é enviado. Na Black, o cliente recebe aqui o número do pedido e o resumo.',
  minimo: `O pedido não chegou ao mínimo de ${brl(Number(r.minimo ?? 0))}.`,
  limite: 'Totokinha Clássica (0300 e 0301): juntas, podem ser no máximo 10% do valor do pedido. Ajuste o carrinho.',
  estoque: `${nome(r.codigo ?? '')}: restam ${r.disponivel ?? 0} caixas. Ajustei a quantidade.`,
  produto: `${nome(r.codigo ?? '')} não está mais disponível. Retirei do pedido.`,
} as Record<string, string>)[r.erro] ?? 'Não consegui enviar agora. Tente de novo.';

function Finalizar(p: ResumoProps & {
  token: string; sessao: BlackSessao; linhas: Linha[];
  voltar: () => void; onEnviado: (r: Enviado) => void; onAjuste: (m: string) => void;
}) {
  const [comprador, setComprador] = useState(p.sessao.comprador);
  const [obs, setObs] = useState('');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  async function enviar() {
    setEnviando(true); setErro('');
    const { data, error } = await supabase.rpc('black_pedido_enviar', {
      p_token: p.token, p_itens: p.linhas.map((l) => ({ codigo: l.it.codigo, caixas: l.q })), p_obs: obs, p_comprador: comprador,
    });
    setEnviando(false);
    if (error || !data) { setErro('Não consegui enviar agora. Tente de novo.'); return; }
    const r = data as { erro?: string; codigo?: string; disponivel?: number; minimo?: number } & Enviado;
    if (r.erro) {
      const nome = (c: string) => p.linhas.find((l) => l.it.codigo === c)?.it.nome ?? c;
      const msg = ERRO_PEDIDO(r as { erro: string }, nome);
      if (r.erro === 'estoque' || r.erro === 'produto') {
        const c = lerCarrinho();
        if (r.erro === 'produto' || !r.disponivel) delete c[r.codigo ?? '']; else c[r.codigo ?? ''] = r.disponivel;
        gravarCarrinho(c); p.onAjuste(msg); return;
      }
      setErro(msg); return;
    }
    p.onEnviado(r);
  }
  const s = p.sessao;
  return (
    <div className="cb-co">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="cb-card cb-pad cb-form">
          <h3 style={{ fontSize: 19 }}>Dados do comprador</h3>
          <dl className="cb-kv">
            <dt>Loja</dt><dd>{s.razao_social}</dd><dt>CNPJ</dt><dd>{maskCnpj(s.cnpj)}</dd>
            <dt>E-mail</dt><dd>{s.email}</dd><dt>WhatsApp</dt><dd>{s.celular}</dd>
            {s.representante && <><dt>Representante</dt><dd>{s.representante}</dd></>}
          </dl>
          <div className="cb-field"><label>Comprador</label><input value={comprador} onChange={(e) => setComprador(e.target.value)} /></div>
        </div>
        <div className="cb-card cb-pad cb-form">
          <h3 style={{ fontSize: 19 }}>Entrega</h3>
          <div className="cb-buy" style={{ boxShadow: 'inset 0 0 0 1.5px var(--line)' }}><span className="ic"><Ic n="rocket" /></span><span><b>{s.cidade}/{s.uf}</b> · endereço do cadastro da loja na Cardoso<br />{p.frete}</span></div>
          <div className="cb-field"><label>Observação (opcional)</label><textarea rows={3} placeholder="Ex.: horário de recebimento, informação para o representante" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
      </div>
      <aside className="cb-card cb-cart fixo">
        <div className="ct"><b>Seu pedido</b><span>{p.caixas} cx</span></div>
        {p.linhas.map((l) => <div key={l.it.codigo} className="ln"><b>{l.it.nome}</b><b>{brl(l.q * l.it.caixa * (l.it.preco_peca ?? 0))}</b><small>{l.q} cx × {l.it.caixa} pç · {brl(l.it.preco_peca ?? 0)}/pç</small></div>)}
        <div className="cb-sum">
          <Totais total={p.total} ipiPct={p.ipiPct} />
          <div className={`cb-fre${p.freteOk ? ' ok' : ''}`}>{p.frete}</div>
          <label className="cb-check"><input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span>Estou de acordo: pedido por caixa fechada, sujeito à confirmação do representante.</span></label>
          {erro && <div className="cb-alert err">{erro}</div>}
          <button className="cb-btn full" type="button" disabled={!aceite || enviando || !p.ok} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
          <button className="cb-btn gh full" type="button" onClick={p.voltar}>Voltar ao carrinho</button>
        </div>
      </aside>
    </div>
  );
}

function Confirmacao({ enviado, representante, outro, pedidos }: { enviado: Enviado; representante: string; outro: () => void; pedidos: () => void }) {
  return (
    <div className="cb-card cb-pad cb-narrow cb-res">
      <div className="bd" style={{ ['--c' as string]: 'var(--teal)' }}><Ic n="check" /></div>
      <h2>Pedido enviado</h2>
      <div><span className="cb-btn dk sm" style={{ cursor: 'default' }}>{enviado.numero}</span></div>
      <p>{enviado.caixas} caixas · {enviado.pecas.toLocaleString('pt-BR')} peças · <b>{brl(Number(enviado.total_com_ipi ?? enviado.total))}</b>{enviado.ipi ? <small style={{ display: 'block' }}>{brl(enviado.total)} em produtos + {brl(Number(enviado.ipi))} de IPI</small> : null}</p>
      <div className="cb-fre">{enviado.frete}</div>
      <Andamento status="recebido" representante={representante} />
      <div className="cb-row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="cb-btn gh sm" type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
        <button className="cb-btn gh sm" type="button" onClick={pedidos}>Meus pedidos</button>
        <button className="cb-btn sm" type="button" onClick={outro}>Fazer outro pedido</button>
      </div>
    </div>
  );
}

function Andamento({ status, representante }: { status: string; representante: string }) {
  if (status === 'cancelado') return <div className="cb-alert err" style={{ textAlign: 'left' }}>Pedido cancelado. Fale com {representante || 'o seu representante'} para mais informações.</div>;
  const conf = status === 'confirmado';
  return (
    <div className="cb-tline" style={{ textAlign: 'left', boxShadow: 'inset 0 0 0 1.5px var(--line)' }}>
      <div className="ok"><i>✓</i><div>Pedido enviado<span>já está com a Cardoso</span></div></div>
      <div className={conf ? 'ok' : 'now'}><i>{conf ? '✓' : 2}</i><div>{conf ? 'Confirmado' : 'Aguardando confirmação'}<span>{representante ? `${representante}, seu representante` : 'seu representante'}{conf ? ' confirmou o pedido' : ' entra em contato'}</span></div></div>
      <div className={conf ? 'now' : ''}><i>3</i><div>Faturamento e entrega<span>pelo fluxo normal da Cardoso</span></div></div>
    </div>
  );
}

function MeusPedidos({ pedidos, representante, comprar }: { pedidos: Pedido[]; representante: string; comprar: (() => void) | null }) {
  const [aberto, setAberto] = useState<string | null>(pedidos[0]?.numero ?? null);
  if (!pedidos.length) return (
    <div className="cb-card cb-pad cb-narrow cb-res">
      <div className="bd" style={{ ['--c' as string]: 'var(--navy)' }}><Ic n="receipt" /></div>
      <h2>Nenhum pedido ainda</h2>
      <p>Os pedidos enviados aparecem aqui, com o andamento de cada um.</p>
      {comprar && <button className="cb-btn" type="button" onClick={comprar}>Ver produtos</button>}
    </div>
  );
  const ST: Record<string, string> = { recebido: 'Aguardando confirmação', confirmado: 'Confirmado', cancelado: 'Cancelado' };
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 820, margin: '0 auto' }}>
      <h2 className="cb-h2">Meus pedidos</h2>
      {pedidos.map((x) => {
        const on = aberto === x.numero;
        return (
          <div key={x.numero} className="cb-card cb-ped">
            <button type="button" className="h" onClick={() => setAberto(on ? null : x.numero)} aria-expanded={on}>
              <b>{x.numero}</b><span className={`cb-st ${x.status}`}><i />{ST[x.status] ?? x.status}</span>
              <small>{fmtData(x.criado_em)} · {x.caixas} caixas</small>
              <span className="tt">{brl(Number(x.total_com_ipi ?? x.total))}</span><span className="ch">{on ? '−' : '+'}</span>
            </button>
            {on && (
              <div style={{ display: 'grid', gap: 10 }}>
                {x.itens?.map((it) => <div key={it.codigo} className="cb-it"><span>{it.nome}<small>{it.caixas} cx × {it.pecas_caixa} pç · {brl(Number(it.preco_peca))}/pç</small></span><b>{brl(Number(it.total))}</b></div>)}
                {Number(x.ipi) > 0 && <div className="cb-it"><span>IPI sobre o pedido</span><b>{brl(Number(x.ipi))}</b></div>}
                <Andamento status={x.status} representante={representante} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MinhaConta({ sessao: s, cfg, sair }: { sessao: BlackSessao; cfg: BlackConfig; sair: () => void }) {
  return (
    <div className="cb-co" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="cb-card cb-pad cb-form">
        <h3 style={{ fontSize: 19 }}>Minha conta</h3>
        <dl className="cb-kv">
          <dt>Loja</dt><dd>{s.fantasia || s.razao_social}</dd>
          <dt>Razão social</dt><dd>{s.razao_social}</dd>
          <dt>CNPJ</dt><dd>{maskCnpj(s.cnpj)}</dd>
          <dt>Cidade/UF</dt><dd>{s.cidade}/{s.uf}</dd>
          <dt>Comprador</dt><dd>{s.comprador}</dd>
          <dt>E-mail</dt><dd>{s.email}</dd>
          <dt>WhatsApp</dt><dd>{s.celular}</dd>
        </dl>
        <div className="cb-alert">Para alterar algum dado ou criar uma nova senha, fale com {s.representante ? <b>{s.representante}</b> : 'o seu representante'}.</div>
        <button className="cb-btn gh" type="button" onClick={sair}>Sair desta conta</button>
      </div>
      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <div className="cb-lvc">
          <div className="dt"><b>{new Date(cfg.abre_em).toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' })}</b><small>{new Date(cfg.abre_em).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '').toUpperCase()}</small></div>
          <div className="l1">Live da Cardoso Black</div>
          <div className="l2">{cfg.live_data}</div>
          <div className="l3"><span>Pedidos até {fmtData(cfg.fecha_em)}</span></div>
        </div>
        {s.live_link && <a className="cb-btn dk full" href={s.live_link} target="_blank" rel="noreferrer"><Ic n="laptop" />Entrar na live</a>}
        {s.canal_link && <a className="cb-wab" href={s.canal_link} target="_blank" rel="noreferrer"><Sv.wa />Canal Cardoso Black no WhatsApp</a>}
        <div className="cb-buy"><span className="ic"><Ic n="coins" /></span><span><b>Condições:</b> pagamento antecipado · preços líquidos, com IPI de {pctTxt(Number(cfg.ipi_pct ?? 6.5))} somado no fechamento · caixa fechada · mínimo de {brl(cfg.pedido_minimo)} em produtos · frete grátis para a cidade de São Paulo · Totokinha Clássica (0300 e 0301) até {pctTxt(Number(cfg.limite_pct ?? 10))} do pedido · pedidos até {fmtData(cfg.fecha_em).replace(', ', ' às ')}.</span></div>
      </div>
    </div>
  );
}

/** condições comerciais da Black, no carrinho */
function Condicoes({ cfg }: { cfg: BlackConfig }) {
  const L: [string, string][] = [
    ['Pagamento', 'Antecipado'],
    ['Pedido mínimo', `${brl(cfg.pedido_minimo)} em produtos, por caixa fechada`],
    ['Frete', 'Grátis para a cidade de São Paulo'],
    ['IPI', `${pctTxt(Number(cfg.ipi_pct ?? 6.5))} somado no fechamento, sobre o pedido`],
    ['Totokinha Clássica (0300 e 0301)', `Juntas, até ${pctTxt(Number(cfg.limite_pct ?? 10))} do valor do pedido`],
    ['Pedidos até', fmtData(cfg.fecha_em).replace(', ', ' às ')],
  ];
  return (
    <div className="cb-cond">
      <b>Condições comerciais</b>
      <dl>{L.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}

/* ordenação e filtros da vitrine */
type Ordem = 'live' | 'desconto' | 'menor' | 'maior' | 'caixa' | 'nome';
function ordenar(l: BlackItem[], o: Ordem): BlackItem[] {
  const pr = (i: BlackItem) => i.preco_peca ?? 0;
  const c = [...l];
  if (o === 'desconto') c.sort((a, b) => descontoPct(pr(b), b.preco_tabela) - descontoPct(pr(a), a.preco_tabela) || a.ordem - b.ordem);
  else if (o === 'menor') c.sort((a, b) => pr(a) - pr(b) || a.ordem - b.ordem);
  else if (o === 'maior') c.sort((a, b) => pr(b) - pr(a) || a.ordem - b.ordem);
  else if (o === 'caixa') c.sort((a, b) => pr(a) * a.caixa - pr(b) * b.caixa || a.ordem - b.ordem);
  else if (o === 'nome') c.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  else c.sort((a, b) => a.ordem - b.ordem);
  return c;
}
const LICENCAS: [string, RegExp][] = [
  ['Pocoyo', /pocoyo|elly|loula|\bpato\b|nina|fred|sonequita/],
  ['Disney', /disney|mickey|minnie|ariel|stitch|buzz|woody|toy story/],
  ['Smurfs', /smurf/],
  ['Galinha Pintadinha', /galinha/],
  ['Show da Luna', /luna/],
  ['DC (Warner)', /batman|flash|mulher maravilha|batwheels|redbird/],
];
function licencaDe(i: BlackItem): string {
  const t = `${i.nome} ${i.familia}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return LICENCAS.find(([, r]) => r.test(t))?.[0] ?? '';
}
