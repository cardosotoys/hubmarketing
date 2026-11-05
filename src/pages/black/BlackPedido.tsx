import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Shell, { Toast } from './Shell';
import { Ic, Sv } from './Icones';
import {
  brl, diaMes, ERRO_LOGIN, fmtData, freteTexto, gravarCarrinho, lerCarrinho, maskCnpj, useConfig, useFaltam, useSessao,
  type BlackItem, type BlackPedido as Pedido, type Carrinho,
} from './api';

/* /black/pedido — o único lugar onde o pedido da Black acontece.
 * Entra com CNPJ e senha; antes da abertura mostra a contagem; aberto, monta por caixa;
 * revisa e envia. O banco confere tudo de novo (preço, estoque, mínimo, prazo). */

export default function BlackPedido() {
  const { cfg } = useConfig();
  const { token, sessao, carregando, entrar, sair } = useSessao();
  const abre = useFaltam(cfg?.abre_em);
  const fecha = useFaltam(cfg?.fecha_em);

  const clock = cfg ? (abre && abre.ms > 0 ? { label: 'abre em', value: abre.texto } : fecha && fecha.ms > 0 ? { label: 'encerra em', value: fecha.texto } : { label: 'pedidos', value: 'encerrados' }) : null;

  if (!cfg || carregando) return <Shell sub="Pedidos somente por esta página" clock={clock}><div className="cb-note"><span className="cb-spin" /> Carregando…</div></Shell>;
  if (!sessao) return <Shell sub="Pedidos somente por esta página" clock={clock} wide={false}><Login entrar={entrar} ate={diaMes(cfg.fecha_em)} /></Shell>;

  // prévia da equipe: vitrine liberada antes da abertura e depois do fim, sem enviar pedido
  const previa = !!sessao.previa;
  const antes = !previa && abre !== null && abre.ms > 0;
  const depois = !previa && fecha !== null && fecha.ms <= 0;
  return (
    <Shell sub={`Pedido somente por esta página · caixa fechada · mínimo de ${brl(cfg.pedido_minimo)}`} clock={clock}>
      <div className="cb-who" style={{ margin: '-24px -20px 18px', borderRadius: 0 }}>
        <div className="cb-wrap">
          <span className="cb-av" style={{ background: 'var(--pink)', color: 'var(--red)' }}>{(sessao.fantasia || sessao.razao_social)[0]}</span>
          <b>{sessao.fantasia || sessao.razao_social}</b>
          <span className="tg">{sessao.cidade}/{sessao.uf}</span>
          {sessao.representante && <span className="tg">Rep. {sessao.representante}</span>}
          <button type="button" className="cb-link" onClick={sair}>Sair</button>
        </div>
      </div>
      {previa && <div className="cb-alert warn" style={{ marginBottom: 14 }}><b>Prévia da equipe.</b> Esta é a visão do cliente com a loja de demonstração: preços e carrinho funcionam, mas o pedido não é enviado e nada entra na medição.</div>}
      {antes ? <Espera alvo={cfg.abre_em} sessao={sessao.canal_link} />
        : <Loja token={token} uf={sessao.uf} cidade={sessao.cidade} comprador={sessao.comprador} email={sessao.email}
            celular={sessao.celular} representante={sessao.representante} razao={sessao.razao_social} cnpj={sessao.cnpj}
            minimo={cfg.pedido_minimo} limiteFrete={cfg.frete_gratis_sp_rj} encerrado={depois} />}
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
  token: string; uf: string; cidade: string; comprador: string; email: string; celular: string; representante: string;
  razao: string; cnpj: string; minimo: number; limiteFrete: number; encerrado: boolean;
};

function Loja(p: LojaProps) {
  const [aba, setAba] = useState<'produtos' | 'pedidos'>(p.encerrado ? 'pedidos' : 'produtos');
  const [itens, setItens] = useState<BlackItem[]>([]);
  const [cart, setCart] = useState<Carrinho>(lerCarrinho());
  const [fam, setFam] = useState('Todas');
  const [busca, setBusca] = useState('');
  const [etapa, setEtapa] = useState<'loja' | 'revisao' | 'enviado'>('loja');
  const [toast, setToast] = useState('');
  const [enviado, setEnviado] = useState<{ numero: string; caixas: number; pecas: number; total: number; frete: string } | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const carregar = useCallback(async () => {
    const [c, m] = await Promise.all([
      supabase.rpc('black_catalogo', { p_token: p.token }),
      supabase.rpc('black_meus_pedidos', { p_token: p.token }),
    ]);
    setItens((c.data as BlackItem[]) ?? []);
    setPedidos((m.data as Pedido[]) ?? []);
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
  const linhas = Object.entries(cart).filter(([c, q]) => q > 0 && porCod[c]?.preco_peca != null).map(([c, q]) => ({ it: porCod[c], q }));
  const total = linhas.reduce((s, l) => s + l.q * l.it.caixa * (l.it.preco_peca ?? 0), 0);
  const caixas = linhas.reduce((s, l) => s + l.q, 0);
  const ok = total >= p.minimo;
  const [freteT, freteOk] = freteTexto(p.uf, p.cidade, total, p.limiteFrete);
  const familias = ['Todas', ...new Set(itens.map((i) => i.familia).filter(Boolean))];
  const vis = itens.filter((i) => (fam === 'Todas' || i.familia === fam)
    && (!busca.trim() || `${i.codigo} ${i.nome}`.toLowerCase().includes(busca.trim().toLowerCase())));

  const mudar = (c: string, d: number) => setCart((x) => {
    const it = porCod[c]; const max = it?.disponivel ?? 9999;
    const n = Math.max(0, Math.min(max, (x[c] ?? 0) + d));
    const y = { ...x }; if (n) y[c] = n; else delete y[c]; return y;
  });

  if (etapa === 'enviado' && enviado) {
    return (
      <div className="cb-card cb-pad cb-narrow cb-res">
        <div className="bd" style={{ ['--c' as string]: 'var(--teal)' }}><Ic n="check" /></div>
        <h2>Pedido enviado</h2>
        <div><span className="cb-btn dk sm" style={{ cursor: 'default' }}>{enviado.numero}</span></div>
        <p>{enviado.caixas} caixas · {enviado.pecas.toLocaleString('pt-BR')} peças · <b>{brl(enviado.total)}</b></p>
        <div className="cb-fre">{enviado.frete}</div>
        <div className="cb-tline" style={{ textAlign: 'left', boxShadow: 'inset 0 0 0 1.5px var(--line)' }}>
          <div className="ok"><i>✓</i><div>Pedido enviado<span>número {enviado.numero}, já está com a Cardoso</span></div></div>
          <div className="now"><i>2</i><div>Confirmação<span>{p.representante ? `${p.representante}, seu representante, entra em contato` : 'seu representante entra em contato'}</span></div></div>
          <div><i>3</i><div>Faturamento e entrega<span>pelo fluxo normal da Cardoso</span></div></div>
        </div>
        <div className="cb-row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="cb-btn gh sm" type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
          <button className="cb-btn sm" type="button" onClick={() => { setEtapa('loja'); setAba('produtos'); }}>Fazer outro pedido</button>
        </div>
      </div>
    );
  }

  if (etapa === 'revisao') {
    return <Revisao {...p} linhas={linhas} total={total} caixas={caixas} frete={freteT} freteOk={freteOk}
      voltar={() => setEtapa('loja')}
      onEnviado={(r) => { setEnviado(r); setCart({}); setEtapa('enviado'); carregar(); window.scrollTo(0, 0); }}
      onAjuste={(msg) => { setCart(lerCarrinho()); setToast(msg); setEtapa('loja'); carregar(); }} />;
  }

  return (
    <>
      <div className="cb-tabs" role="tablist">
        <button role="tab" className={aba === 'produtos' ? 'on' : ''} onClick={() => setAba('produtos')} disabled={p.encerrado}>Produtos</button>
        <button role="tab" className={aba === 'pedidos' ? 'on' : ''} onClick={() => setAba('pedidos')}>Meus pedidos{pedidos.length ? ` (${pedidos.length})` : ''}</button>
      </div>
      {p.encerrado && <div className="cb-alert warn" style={{ marginTop: 14 }}>A Cardoso Black terminou. Os pedidos foram aceitos até 15/11, às 23h59.</div>}

      {aba === 'pedidos' ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {pedidos.length === 0 && <div className="cb-card cb-pad cb-note">Nenhum pedido enviado ainda.</div>}
          {pedidos.map((x) => (
            <div key={x.numero} className="cb-card cb-ped">
              <div className="h"><b>{x.numero}</b><span className={`cb-st ${x.status}`}><i />{x.status === 'recebido' ? 'Recebido' : x.status === 'confirmado' ? 'Confirmado' : 'Cancelado'}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 800 }}>{brl(Number(x.total))}</span></div>
              <small style={{ color: 'var(--ink3)' }}>{fmtData(x.criado_em)} · {x.caixas} caixas</small>
              {x.itens?.map((it) => <div key={it.codigo} className="cb-it" style={{ padding: '5px 0' }}><span>{it.nome}<small>{it.caixas} cx × {it.pecas_caixa} pç · {brl(Number(it.preco_peca))}/pç</small></span><b>{brl(Number(it.total))}</b></div>)}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="cb-tools">
            <input className="cb-search" type="search" placeholder="Buscar por nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="cb-chips" style={{ marginBottom: 14 }}>
            {familias.map((f) => <button key={f} type="button" className={f === fam ? 'on' : ''} onClick={() => setFam(f)}>{f}</button>)}
          </div>
          <div className="cb-shop">
            <div className="cb-prods">
              {vis.length === 0 && <div className="cb-note" style={{ gridColumn: '1/-1' }}>Nenhum produto com essa busca.</div>}
              {vis.map((i) => {
                const q = cart[i.codigo] ?? 0; const esg = i.disponivel === 0;
                return (
                  <article key={i.codigo} className={`cb-pc${q ? ' in' : ''}`}>
                    <Link className="im" to={`/black/p/${i.codigo}`}>
                      {i.imagem ? <img src={i.imagem} alt="" loading="lazy" /> : <span className="ph"><Ic n="star" /></span>}
                      {esg && <span className="esg">Esgotado</span>}
                    </Link>
                    <div className="bd">
                      <span className="cd">{i.codigo} · {i.familia}</span>
                      <h3>{i.nome}</h3>
                      {i.preco_peca != null && <div className="pr"><b>{brl(i.preco_peca)}</b><span>por peça</span></div>}
                      <div className="bx">Caixa com {i.caixa}{i.preco_peca != null ? ` · ${brl(i.preco_peca * i.caixa)}` : ''}{i.disponivel != null && !esg ? ` · ${i.disponivel} cx disp.` : ''}</div>
                      <div className="cb-stp">
                        <button type="button" aria-label="Retirar uma caixa" disabled={!q} onClick={() => mudar(i.codigo, -1)}>−</button>
                        <span className="q">{q}<small>caixa{q === 1 ? '' : 's'}</small></span>
                        <button type="button" className="p" aria-label="Adicionar uma caixa" disabled={esg || p.encerrado || (i.disponivel != null && q >= i.disponivel)} onClick={() => mudar(i.codigo, 1)}>+</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <aside className="cb-card cb-cart">
              <div className="ct"><b>Seu pedido</b><span>{caixas} cx</span></div>
              {linhas.length === 0 ? <div className="ce">Escolha as caixas na lista.</div>
                : linhas.map((l) => <div key={l.it.codigo} className="ln"><b>{l.it.nome}</b><b>{brl(l.q * l.it.caixa * (l.it.preco_peca ?? 0))}</b><small>{l.q} cx × {l.it.caixa} pç</small></div>)}
              <Resumo total={total} minimo={p.minimo} ok={ok} frete={freteT} freteOk={freteOk} revisar={() => { setEtapa('revisao'); window.scrollTo(0, 0); }} />
            </aside>
          </div>
          <div className="cb-mbar">
            <div><b>{brl(total)}</b><span>{ok ? `${caixas} caixas · mínimo atingido` : `${caixas} caixas · faltam ${brl(p.minimo - total)}`}</span><div className="cb-bar"><i style={{ width: `${Math.min(100, (total / p.minimo) * 100)}%` }} /></div></div>
            <button className="cb-btn" type="button" disabled={!ok} onClick={() => { setEtapa('revisao'); window.scrollTo(0, 0); }}>Revisar</button>
          </div>
        </>
      )}
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </>
  );
}

function Resumo({ total, minimo, ok, frete, freteOk, revisar }: { total: number; minimo: number; ok: boolean; frete: string; freteOk: boolean; revisar: () => void }) {
  return (
    <div className="cb-sum">
      <div className="cb-tot"><span>Total</span><b>{brl(total)}</b></div>
      <div className="cb-bar"><i style={{ width: `${Math.min(100, (total / minimo) * 100)}%` }} /></div>
      <div className={`cb-hint${ok ? ' ok' : ''}`}>{ok ? 'Pedido mínimo atingido' : `Faltam ${brl(minimo - total)} para o mínimo de ${brl(minimo)}`}</div>
      <div className={`cb-fre${freteOk ? ' ok' : ''}`}>{frete}</div>
      <button className="cb-btn full" type="button" disabled={!ok} onClick={revisar}>Revisar pedido</button>
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
  estoque: `${nome(r.codigo ?? '')}: restam ${r.disponivel ?? 0} caixas. Ajustei a quantidade.`,
  produto: `${nome(r.codigo ?? '')} não está mais disponível. Retirei do pedido.`,
} as Record<string, string>)[r.erro] ?? 'Não consegui enviar agora. Tente de novo.';

function Revisao(p: LojaProps & {
  linhas: { it: BlackItem; q: number }[]; total: number; caixas: number; frete: string; freteOk: boolean;
  voltar: () => void; onEnviado: (r: { numero: string; caixas: number; pecas: number; total: number; frete: string }) => void; onAjuste: (m: string) => void;
}) {
  const [comprador, setComprador] = useState(p.comprador);
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
    const r = data as { erro?: string; codigo?: string; disponivel?: number; minimo?: number; numero: string; caixas: number; pecas: number; total: number; frete: string };
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
  return (
    <div className="cb-rev">
      <div className="cb-card cb-pad">
        <h3 style={{ fontSize: 19, marginBottom: 6 }}>Itens</h3>
        {p.linhas.map((l) => <div key={l.it.codigo} className="cb-it"><span>{l.it.nome}<small>{l.q} cx × {l.it.caixa} pç · {brl(l.it.preco_peca ?? 0)}/pç</small></span><b>{brl(l.q * l.it.caixa * (l.it.preco_peca ?? 0))}</b></div>)}
        <div className="cb-tot" style={{ marginTop: 10 }}><span>Total</span><b>{brl(p.total)}</b></div>
        <div className={`cb-fre${p.freteOk ? ' ok' : ''}`} style={{ marginTop: 8 }}>{p.frete}</div>
      </div>
      <div className="cb-card cb-pad cb-form">
        <h3 style={{ fontSize: 19 }}>Comprador</h3>
        <dl className="cb-kv">
          <dt>Loja</dt><dd>{p.razao}</dd><dt>CNPJ</dt><dd>{maskCnpj(p.cnpj)}</dd>
          <dt>E-mail</dt><dd>{p.email}</dd><dt>WhatsApp</dt><dd>{p.celular}</dd>
          {p.representante && <><dt>Representante</dt><dd>{p.representante}</dd></>}
        </dl>
        <div className="cb-field"><label>Comprador</label><input value={comprador} onChange={(e) => setComprador(e.target.value)} /></div>
        <div className="cb-field"><label>Observação (opcional)</label><textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <label className="cb-check"><input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>Estou de acordo: pedido por caixa fechada, sujeito à confirmação do representante.</span></label>
        {erro && <div className="cb-alert err">{erro}</div>}
        <button className="cb-btn full" type="button" disabled={!aceite || enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
        <button className="cb-btn gh full" type="button" onClick={p.voltar}>Voltar e alterar</button>
      </div>
    </div>
  );
}
