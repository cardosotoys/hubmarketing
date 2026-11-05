import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Shell, { Toast } from './Shell';
import { Ic, Sv } from './Icones';
import {
  brl, cachePublico, driveId, ERRO_LOGIN, gravarCarrinho, lerCarrinho, maskCnpj, midia, useConfig, useFaltam, useSessao,
  type BlackFicha as Ficha, type BlackItem,
} from './api';

/* /black/p/:codigo — a ficha que o QR da live abre.
 * Mostra foto, embalagem, fotos e vídeo liberados no banco de materiais, a ficha técnica do Hub
 * e, para quem entrou com CNPJ e senha (e a Black já abriu), o preço e o botão "Adicionar ao pedido".
 * O carrinho é o mesmo da página de pedido (fica neste aparelho). */

type Midia = { tipo: 'img' | 'video'; src: string; thumb: string; nome: string };

const mm = (v: (number | null)[]) => (v.every((x) => x) ? `${v.map((x) => (Number(x) / 10).toLocaleString('pt-BR')).join(' × ')} cm` : '');
const kg = (v: number | null) => (v ? `${Number(v).toLocaleString('pt-BR')} kg` : '');

export default function BlackFicha() {
  const { codigo = '' } = useParams();
  const { cfg } = useConfig();
  const { token, sessao, carregando, entrar } = useSessao();
  const [f, setF] = useState<Ficha | null | undefined>(undefined);
  const [sel, setSel] = useState(0);
  const [falhou, setFalhou] = useState<Set<string>>(new Set());
  const marcarFalha = (src: string) => { setFalhou((f) => new Set(f).add(src)); setSel(0); };
  const [qtd, setQtd] = useState(1);
  const [toast, setToast] = useState('');
  const [cart, setCart] = useState(lerCarrinho());
  const fecha = useFaltam(cfg?.fecha_em);
  const [params] = useSearchParams();
  const daLive = params.has('live');
  // preços do catálogo, para a barra "Seu pedido" mostrar o total do carrinho inteiro
  const [precos, setPrecos] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!token || !(cfg?.aberto || sessao?.previa)) return;
    supabase.rpc('black_catalogo', { p_token: token }).then(({ data }) => {
      if (Array.isArray(data)) setPrecos(Object.fromEntries((data as BlackItem[]).filter((i) => i.preco_peca != null).map((i) => [i.codigo, i.caixa * (i.preco_peca ?? 0)])));
    });
  }, [token, cfg?.aberto, sessao?.previa]);

  useEffect(() => {
    if (carregando) return;
    supabase.rpc('black_produto', { p_codigo: codigo, p_token: token }).then(({ data }) => setF((data as Ficha) ?? null));
  }, [codigo, token, carregando]);

  const midias = useMemo<Midia[]>(() => {
    if (!f) return [];
    const m: Midia[] = [];
    if (f.imagem) m.push({ tipo: 'img', src: f.imagem, thumb: f.imagem, nome: 'Produto' });
    if (f.embalagem) m.push({ tipo: 'img', src: f.embalagem, thumb: f.embalagem, nome: 'Embalagem' });
    for (const x of f.materiais) {
      const id = driveId(x.link);
      if (x.tipo === 'video' && id) m.push({ tipo: 'video', src: midia(id), thumb: midia(id, true), nome: x.nome });
      else if (x.tipo === 'foto' && (x.cache || id)) {
        const src = x.cache ? cachePublico(x.cache) : midia(id!);
        m.push({ tipo: 'img', src, thumb: x.cache ? src : midia(id!, true), nome: x.nome });
      }
    }
    // vídeo primeiro: é o que mais ajuda quem está assistindo à live
    // foto primeiro (abre na hora); o vídeo vem logo depois, marcado com ▶
    return [...m.filter((x) => x.tipo !== 'video'), ...m.filter((x) => x.tipo === 'video')].filter((x) => !falhou.has(x.src));
  }, [f, falhou]);

  const clock = fecha && fecha.ms > 0 ? { label: 'encerra em', value: fecha.texto } : null;
  if (f === undefined || carregando) return <Shell sub="Ficha do produto" clock={clock}><div className="cb-note"><span className="cb-spin" /> Carregando…</div></Shell>;
  if (f === null) return <Shell sub="Ficha do produto"><div className="cb-card cb-pad cb-narrow cb-res"><h2>Produto não encontrado</h2><p>Este produto não faz parte da Cardoso Black.</p><Link className="cb-btn dk" to="/black/pedido">Ir para a página de pedido</Link></div></Shell>;

  const atual = midias[sel];
  const aberto = !!cfg?.aberto || !!sessao?.previa;
  const noCarrinho = cart[f.codigo] ?? 0;
  const max = f.disponivel ?? 9999;

  function adicionar() {
    if (!f) return;
    const c = lerCarrinho();
    c[f.codigo] = Math.min(max, (c[f.codigo] ?? 0) + qtd);
    gravarCarrinho(c); setCart(c);
    setToast(`${qtd} caixa${qtd > 1 ? 's' : ''} adicionada${qtd > 1 ? 's' : ''} ao pedido`); setQtd(1);
  }

  const t = f.tecnico;
  const spec: [string, string][] = ([
    ['Faixa etária', t.faixa_etaria], ['Material', t.material], ['Cor', t.cor], ['Conteúdo', t.conteudo],
    ['Recursos', [t.mecanismo && 'mecanismo', t.som && 'som', t.luz && 'luz'].filter(Boolean).join(', ')], ['Pilhas', t.pilhas],
    ['Produto', [mm(t.produto_mm), kg(t.produto_kg)].filter(Boolean).join(' · ')],
    ['Embalagem', [mm(t.embalagem_mm), kg(t.embalagem_kg)].filter(Boolean).join(' · ')],
    ['Caixa master', [`${f.caixa} unidades`, mm(t.caixa_mm), kg(t.caixa_kg), t.caixa_obs].filter(Boolean).join(' · ')],
    ['EAN', t.ean], ['Inmetro', t.inmetro],
  ] as [string, string][]).filter(([, v]) => v && String(v).trim());

  return (
    <Shell sub="Ficha do produto · Cardoso Black" clock={clock}>
      <div className="cb-fi">
        <div className="cb-media">
          <div className="cb-stage">
            {!atual ? <span className="cb-hi" style={{ color: 'var(--ink3)' }}>{f.codigo}</span>
              : atual.tipo === 'video' ? <><video key={atual.src} src={atual.src} controls playsInline preload="metadata" poster={atual.thumb} onError={() => marcarFalha(atual.src)} /><span className="vb">Vídeo do produto</span></>
              : <img key={atual.src} src={atual.src} alt={atual.nome} onError={() => marcarFalha(atual.src)} />}
            {atual && <a className="dl" href={atual.src} target="_blank" rel="noreferrer" download aria-label={atual.tipo === 'video' ? 'Baixar este vídeo' : 'Baixar esta imagem'}>{atual.tipo === 'video' ? 'Baixar vídeo' : 'Baixar imagem'}</a>}
          </div>
          {midias.length > 1 && (
            <div className="cb-thumbs">
              {midias.map((m, i) => (
                <button key={m.src} type="button" className={i === sel ? 'on' : ''} onClick={() => setSel(i)} aria-label={m.nome}>
                  {m.tipo === 'video' ? <span className="vt" /> : <img src={m.thumb} alt="" loading="lazy" onError={() => marcarFalha(m.src)} />}{m.tipo === 'video' && <span className="pl">▶</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cb-info">
          <span className="cb-live-chip">● {daLive ? 'Visto agora na live' : 'Cardoso Black'}</span>
          <span className="cd">{f.codigo} · {f.familia}</span>
          <h1>{f.nome}</h1>
          {!sessao ? <LoginCurto entrar={entrar} />
            : !aberto ? <div className="cb-alert">O preço da Black aparece aqui na abertura dos pedidos, durante a live.</div>
            : f.preco_peca == null ? <div className="cb-alert warn">Preço indisponível para a sua região. Fale com o seu representante.</div>
            : (
              <>
                <div className="cb-price"><b>{brl(f.preco_peca)}</b><span>por peça · caixa com {f.caixa} = <strong>{brl(f.preco_peca * f.caixa)}</strong></span></div>
                {f.disponivel === 0 ? <div className="cb-alert err">Produto esgotado na Black.</div> : (
                  <div className="cb-add">
                    <div className="cb-stp">
                      <button type="button" aria-label="Menos" disabled={qtd <= 1} onClick={() => setQtd(qtd - 1)}>−</button>
                      <span className="q">{qtd}<small>caixa{qtd > 1 ? 's' : ''}</small></span>
                      <button type="button" className="p" aria-label="Mais" disabled={noCarrinho + qtd >= max} onClick={() => setQtd(qtd + 1)}>+</button>
                    </div>
                    <button className="cb-btn" type="button" onClick={adicionar} disabled={noCarrinho + qtd > max}>Adicionar ao pedido</button>
                  </div>
                )}
                {noCarrinho > 0 && <div className="cb-alert ok">{noCarrinho} caixa{noCarrinho > 1 ? 's' : ''} deste produto no seu pedido. <Link to="/black/pedido?v=carrinho">Ver carrinho</Link></div>}
              </>
            )}
          {f.descricao && <div className="cb-desc">{f.descricao}</div>}
          {f.diferenciais?.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink2)', fontSize: 14 }}>{f.diferenciais.map((d) => <li key={d}>{d}</li>)}</ul>}
          {spec.length > 0 && (
            <div className="cb-card cb-spec">
              <h4>Ficha técnica</h4>
              <dl>{spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          )}
          <Materiais f={f} midias={midias} />
        </div>
      </div>
      {sessao && aberto && (() => {
        const total = Object.entries(cart).reduce((t, [c, q]) => t + (precos[c] ?? 0) * q, 0);
        const minimo = cfg?.pedido_minimo ?? 2500;
        return (
          <div className="cb-fbar"><div className="cb-wrap">
            <div><small>Seu pedido</small><b>{brl(total)}</b>
              <em className={total >= minimo ? 'ok' : ''}>{total >= minimo ? 'mínimo atingido' : `faltam ${brl(minimo - total)} para o mínimo`}</em></div>
            <Link className="cb-btn dk" to="/black/pedido?v=carrinho">Ver carrinho ›</Link>
          </div></div>
        );
      })()}
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </Shell>
  );
}

function Materiais({ f }: { f: Ficha; midias: Midia[] }) {
  const [copiado, setCopiado] = useState(false);
  const outros = f.materiais.filter((m) => m.tipo === 'kit' || m.tipo === 'documento');
  if (!outros.length && !f.descricao) return null;
  async function copiar() {
    try { await navigator.clipboard.writeText(`${f.nome}\n\n${f.descricao}${f.diferenciais?.length ? `\n\n• ${f.diferenciais.join('\n• ')}` : ''}`); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sem permissão */ }
  }
  return (
    <div className="cb-card cb-mats">
      <h4>Materiais para a sua loja</h4>
      {f.descricao && <button type="button" onClick={copiar}><span className="mi"><Ic n="receipt" /></span><span className="nm">Descrição pronta para o anúncio</span><em>{copiado ? 'Copiada' : 'Copiar'}</em></button>}
      {outros.map((m, i) => { const id = driveId(m.link); return id ? <a key={m.link} href={midia(id)} target="_blank" rel="noreferrer"><span className="mi">{m.tipo === 'kit' ? <Ic n="store" /> : <Sv.db />}</span><span className="nm">{m.tipo === 'kit' ? `Kit para e-commerce${outros.filter((x) => x.tipo === 'kit').length > 1 ? ` ${i + 1}` : ''}` : 'Documento do produto'}</span><em>Baixar</em></a> : null; })}
    </div>
  );
}

function LoginCurto({ entrar }: { entrar: (c: string, s: string) => Promise<string | null> }) {
  const [cnpj, setCnpj] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  async function ir(e: FormEvent) {
    e.preventDefault(); setErro('');
    const r = await entrar(cnpj, senha);
    if (r) setErro(ERRO_LOGIN[r] ?? ERRO_LOGIN.senha);
  }
  return (
    <form className="cb-card cb-pad cb-form" onSubmit={ir}>
      <b>Entre para ver o preço da Black e adicionar ao pedido</b>
      <div className="cb-two">
        <div className="cb-field"><label>CNPJ</label><input inputMode="numeric" autoComplete="username" value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} /></div>
        <div className="cb-field"><label>Senha</label><input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
      </div>
      {erro && <div className="cb-alert err">{erro}</div>}
      <button className="cb-btn" type="submit">Entrar</button>
      <div className="cb-note">Ainda não tem cadastro? <Link to="/black">Faça o pré-cadastro</Link></div>
    </form>
  );
}
