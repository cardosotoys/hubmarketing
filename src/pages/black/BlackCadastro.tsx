import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Shell from './Shell';
import { diaBadge, diaMes as diaMesCurto, diaSemana, digitos, hora, maskCnpj, maskFone, periodoPedidos, useConfig } from './api';
import { Ic, Sv } from './Icones';

/* /black?r=<representante> — pré-cadastro da Cardoso Black.
 * 1) CNPJ → a função black-cadastro consulta a Receita e a carteira e mostra a empresa.
 * 2) Comprador, contato, onde a loja vende (com link), senha e aceite LGPD.
 * 3) Resultado: aprovado (acesso ao canal e à live) ou em análise. */

type Empresa = { razao: string; fantasia: string; cidade: string; uf: string; ativa: boolean };
type Consulta = { empresa: Empresa | null; carteira: { representante: string } | null; receita_fora?: boolean };
type Resultado = { status: 'aprovado' | 'analise'; fantasia: string; representante: string; canal_link: string; live_data: string; live_link: string };

const CANAIS: [string, string, string][] = [
  ['site', 'Loja própria (site)', 'www.sualoja.com.br'],
  ['ml', 'Mercado Livre', 'link da loja ou nome do vendedor'],
  ['amz', 'Amazon', 'link da loja ou nome do vendedor'],
  ['shp', 'Shopee', 'link da loja ou nome da loja'],
  ['mgl', 'Magalu', 'link da loja ou nome da loja'],
  ['out', 'Outro', 'qual canal e o link'],
];
const ERROS: Record<string, string> = {
  cnpj_invalido: 'Este CNPJ não é válido. Confira os 14 números.',
  cnpj_nao_encontrado: 'Este CNPJ não foi encontrado na Receita Federal.',
  inscricoes_encerradas: 'As inscrições para a Cardoso Black estão encerradas.',
  senha_curta: 'A senha precisa ter pelo menos 6 caracteres.',
  banco: 'Não consegui salvar agora. Tente de novo em instantes.',
  interno: 'Não consegui salvar agora. Tente de novo em instantes.',
};

export default function BlackCadastro() {
  const [params] = useSearchParams();
  const rep = (params.get('r') ?? '').slice(0, 60);
  const { cfg } = useConfig();
  const [cnpj, setCnpj] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [manual, setManual] = useState({ razao: '', cidade: '', uf: '' });
  const [comprador, setComprador] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [canais, setCanais] = useState<Record<string, string>>({});
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [ver, setVer] = useState(false);
  const [lgpd, setLgpd] = useState(false);
  const [erros, setErros] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [jaInscrito, setJaInscrito] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);

  const encerrado = cfg ? new Date(cfg.agora) > new Date(cfg.inscricoes_ate) : false;

  async function consultar() {
    setAviso(''); setJaInscrito(null);
    if (digitos(cnpj).length !== 14) { setErros({ cnpj: true }); return; }
    setErros({}); setConsultando(true);
    const { data, error } = await supabase.functions.invoke('black-cadastro', { body: { acao: 'consulta', cnpj: digitos(cnpj) } });
    setConsultando(false);
    if (error || !data) { setAviso('Não consegui consultar agora. Tente de novo em instantes.'); return; }
    if (data.erro === 'ja_inscrito') { setJaInscrito(data.status); return; }
    if (data.erro) { setAviso(ERROS[data.erro] ?? 'Não consegui consultar este CNPJ.'); return; }
    setConsulta(data as Consulta);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const E: Record<string, boolean> = {};
    if (comprador.trim().length < 3) E.comprador = true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) E.email = true;
    if (digitos(celular).length < 10) E.celular = true;
    if (!Object.keys(canais).length) E.canais = true;
    Object.entries(canais).forEach(([k, v]) => { if (!v.trim()) E[`l_${k}`] = true; });
    if (senha.length < 6) E.senha = true; else if (senha !== senha2) E.senha2 = true;
    if (!lgpd) E.lgpd = true;
    if (consulta?.receita_fora) {
      if (manual.razao.trim().length < 3) E.razao = true;
      if (manual.uf.trim().length !== 2) E.uf = true;
    }
    setErros(E);
    if (Object.keys(E).length) { setAviso('Confira os campos destacados.'); return; }
    setAviso(''); setEnviando(true);
    const { data, error } = await supabase.functions.invoke('black-cadastro', {
      body: { acao: 'inscrever', cnpj: digitos(cnpj), comprador, email, celular, canais, senha, lgpd, rep, ...manual },
    });
    setEnviando(false);
    if (error || !data) { setAviso('Não consegui enviar agora. Tente de novo em instantes.'); return; }
    if (data.erro === 'ja_inscrito') { setJaInscrito(data.status); return; }
    if (data.erro === 'campos') { setErros(Object.fromEntries((data.campos as string[]).map((c) => [c === 'canais' ? 'canais' : c, true]))); setAviso('Confira os campos destacados.'); return; }
    if (data.erro) { setAviso(ERROS[data.erro] ?? 'Não consegui concluir o cadastro.'); return; }
    setRes(data as Resultado);
    window.scrollTo(0, 0);
  }

  const fld = (k: string) => `cb-field${erros[k] ? ' bad' : ''}`;
  const emp = consulta?.empresa;

  if (res) {
    const ok = res.status === 'aprovado';
    const nome = res.fantasia || emp?.razao || 'Sua loja';
    return (
      <Shell sub="Pré-cadastro · exclusivo para lojas de e-commerce" wide={false} faixa={false}>
        <div className="cb-rs">
          <div className="hdr">
            <div className="bd" style={{ ['--c' as string]: ok ? 'var(--teal)' : 'var(--gold)', color: ok ? '#fff' : 'var(--navy)' }}>{ok ? <Ic n="check" /> : <Sv.hg />}</div>
            <span className="cb-chip" style={ok ? { ['--c' as string]: 'var(--mint)', ['--fg' as string]: 'var(--teal)' } : { ['--c' as string]: '#FFF4E0', ['--fg' as string]: '#8a5d00' }}>{ok ? 'Cadastro aprovado' : 'Em análise'}</span>
            <h2>{ok ? nome : 'Cadastro recebido'}</h2>
            <p>{ok
              ? `${emp?.razao && emp.razao !== nome ? emp.razao : nome} está confirmada na Cardoso Black. Acesse o canal para receber o link da live.`
              : `Estamos conferindo os dados de ${nome}. Assim que o cadastro for aprovado, você recebe o acesso ao canal.`}</p>
          </div>
          {ok ? (
            <>
              {res.canal_link && <a className="cb-wab" href={res.canal_link} target="_blank" rel="noreferrer"><Sv.wa />Acessar o canal Cardoso Black</a>}
              <div className="cb-lvc">
                <div className="dt"><b>{cfg ? diaBadge(cfg.abre_em).dia : '12'}</b><small>{cfg ? diaBadge(cfg.abre_em).mes : 'NOV'}</small></div>
                <div className="l1">Live · {cfg ? diaSemana(cfg.abre_em) : 'quinta-feira'}</div>
                <div className="l2">Produtos, condições e pedido ao vivo</div>
                <div className="l3"><span>{cfg ? `Às ${hora(cfg.abre_em)}` : 'Às 15h'}</span><span>Link enviado no canal</span></div>
              </div>
              <div className="cb-buy"><span className="ic"><Ic n="cart" /></span><span><b>Pedidos {periodoPedidos(cfg)},</b> somente pelo link de pedido. Entre com este CNPJ e a senha criada.</span></div>
              <Link className="cb-btn gh" to="/black/pedido">Ir para a página de pedido</Link>
            </>
          ) : (
            <div className="cb-tline">
              <div className="ok"><i>✓</i><div>Cadastro recebido<span>agora</span></div></div>
              <div className="now"><i>2</i><div>Conferência pela equipe comercial<span>{res.representante ? `${res.representante}, seu representante, acompanha` : 'seu representante acompanha'}</span></div></div>
              <div><i>3</i><div>Acesso ao canal da Cardoso Black<span>com o convite para a live de {cfg ? diaMesCurto(cfg.abre_em) : '12/11'}</span></div></div>
            </div>
          )}
          {res.representante && <div className="cb-buy"><span className="ic" style={{ background: 'var(--mint)', color: 'var(--teal)' }}><Sv.mail /></span><span>Dúvidas: fale com <b>{res.representante}</b>, seu representante.</span></div>}
        </div>
      </Shell>
    );
  }

  return (
    <Shell sub="Pré-cadastro · exclusivo para lojas de e-commerce">
      <div className="cb-grid2">
        <div>
          <div className="cb-hi">Participe da live e do período de pedidos da Cardoso Black</div>
          <div className="cb-card cb-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
            <div className="cb-ev"><span className="n"><Ic n="laptop" /></span><div><b>Live · {cfg?.live_data ?? 'Quinta-feira, 12/11 · 15h'}</b><span>produtos, condições e pedido ao vivo</span></div></div>
            <div className="cb-ev"><span className="n"><Ic n="cart" /></span><div><b>Pedidos {periodoPedidos(cfg)}</b><span>somente pelo link · caixa fechada · mínimo de R$ {(cfg?.pedido_minimo ?? 2500).toLocaleString('pt-BR')}</span></div></div>
            <div className="cb-ev"><span className="n"><Ic n="chat" /></span><div><b>Canal no WhatsApp</b><span>link da live e avisos, sem grupo</span></div></div>
          </div>
        </div>

        <form className="cb-card cb-pad cb-form" onSubmit={enviar} noValidate>
          {rep && <div className="cb-rep"><span className="cb-av">{rep[0]?.toUpperCase()}</span><span>Convite de <b>{rep}</b>, representante Cardoso</span></div>}
          {encerrado && <div className="cb-alert err">As inscrições para a Cardoso Black estão encerradas.</div>}

          <div className={`cb-step${emp || consulta ? ' ok' : ''}`}><i>{emp || consulta ? '✓' : '1'}</i>Empresa</div>
          {!consulta ? (
            <>
              <div className={fld('cnpj')}>
                <label htmlFor="cb-cnpj">CNPJ da loja</label>
                <div className="cb-row">
                  <input id="cb-cnpj" inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00" value={cnpj}
                    onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); consultar(); } }} />
                  <button type="button" className="cb-btn dk" onClick={consultar} disabled={consultando || encerrado}>Continuar</button>
                </div>
                {erros.cnpj && <div className="er">Digite os 14 números do CNPJ.</div>}
              </div>
              {consultando && <div className="cb-note"><span className="cb-spin" /> Consultando o CNPJ…</div>}
              {jaInscrito && (
                <div className="cb-alert warn">
                  Este CNPJ já tem pré-cadastro{jaInscrito === 'aprovado' ? ' aprovado' : jaInscrito === 'analise' ? ' em análise' : ''}.{' '}
                  {jaInscrito === 'aprovado' ? <Link to="/black/pedido">Entrar com CNPJ e senha</Link> : 'Fale com o seu representante.'}
                </div>
              )}
            </>
          ) : emp ? (
            <div className="cb-cmp" style={{ ['--c' as string]: consulta.carteira ? 'var(--teal)' : '#B9790B', ['--b' as string]: consulta.carteira ? '#F2FAFA' : '#FFFAF0' }}>
              <div className="h"><span className="ic">{consulta.carteira ? <Ic n="check" /> : <Sv.info />}</span>{consulta.carteira ? 'Empresa encontrada na carteira Cardoso' : 'Empresa não localizada na carteira de clientes'}
                <button type="button" className="cb-link" onClick={() => { setConsulta(null); setErros({}); }}>Alterar CNPJ</button></div>
              <dl>
                <div className="w"><dt><Sv.lock />Razão social</dt><dd>{emp.razao}</dd></div>
                {emp.fantasia && <div><dt><Sv.lock />Nome fantasia</dt><dd>{emp.fantasia}</dd></div>}
                <div><dt><Sv.lock />Cidade/UF</dt><dd>{emp.cidade}/{emp.uf}</dd></div>
                {(consulta.carteira?.representante || rep) && <div className="w"><dt><Sv.lock />Representante</dt><dd>{consulta.carteira?.representante || rep}</dd></div>}
              </dl>
              {!consulta.carteira && <div style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>Você pode concluir o cadastro. Ele será analisado pela equipe comercial.</div>}
            </div>
          ) : (
            <>
              <div className="cb-alert warn">A consulta à Receita está indisponível agora. Informe os dados da empresa; o cadastro será conferido pela equipe comercial.</div>
              <div className={fld('razao')}><label>Razão social</label><input value={manual.razao} onChange={(e) => setManual({ ...manual, razao: e.target.value })} /></div>
              <div className="cb-two">
                <div className="cb-field"><label>Cidade</label><input value={manual.cidade} onChange={(e) => setManual({ ...manual, cidade: e.target.value })} /></div>
                <div className={fld('uf')}><label>UF</label><input maxLength={2} value={manual.uf} onChange={(e) => setManual({ ...manual, uf: e.target.value.toUpperCase() })} /></div>
              </div>
            </>
          )}

          {consulta && (
            <>
              <div className="cb-step"><i>2</i>Comprador</div>
              <div className={fld('comprador')}><label htmlFor="cb-comp">Nome do comprador</label>
                <input id="cb-comp" autoComplete="name" placeholder="Quem fará o pedido" value={comprador} onChange={(e) => setComprador(e.target.value)} />
                {erros.comprador && <div className="er">Informe o nome.</div>}</div>
              <div className="cb-two">
                <div className={fld('email')}><label htmlFor="cb-mail">E-mail</label>
                  <input id="cb-mail" type="email" autoComplete="email" placeholder="compras@sualoja.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {erros.email && <div className="er">E-mail inválido.</div>}</div>
                <div className={fld('celular')}><label htmlFor="cb-cel">Celular com WhatsApp</label>
                  <input id="cb-cel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={celular} onChange={(e) => setCelular(maskFone(e.target.value))} />
                  {erros.celular && <div className="er">Celular com DDD.</div>}</div>
              </div>

              <div className="cb-step"><i>3</i>Onde sua loja vende</div>
              <div className={`cb-chips${erros.canais ? ' bad' : ''}`}>
                {CANAIS.map(([k, l]) => (
                  <button key={k} type="button" className={k in canais ? 'on' : ''} aria-pressed={k in canais}
                    onClick={() => setCanais((c) => { const n = { ...c }; if (k in n) delete n[k]; else n[k] = ''; return n; })}>{l}</button>
                ))}
              </div>
              {erros.canais && <div className="cb-field"><div className="er">Selecione pelo menos um canal.</div></div>}
              {CANAIS.filter(([k]) => k in canais).map(([k, l, ph]) => (
                <div key={k} className={fld(`l_${k}`)}><label>{l}</label>
                  <input placeholder={ph} value={canais[k]} onChange={(e) => setCanais({ ...canais, [k]: e.target.value })} />
                  {erros[`l_${k}`] && <div className="er">Informe o link ou o nome da loja.</div>}</div>
              ))}

              <div className="cb-step"><i>4</i>Senha de acesso</div>
              <div className="cb-two">
                <div className={fld('senha')}><label htmlFor="cb-pw">Crie uma senha</label>
                  <div className="cb-eye"><input id="cb-pw" type={ver ? 'text' : 'password'} autoComplete="new-password" placeholder="mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
                    <button type="button" onClick={() => setVer(!ver)}>{ver ? 'ocultar' : 'mostrar'}</button></div>
                  {erros.senha && <div className="er">Use pelo menos 6 caracteres.</div>}</div>
                <div className={fld('senha2')}><label htmlFor="cb-pw2">Repita a senha</label>
                  <input id="cb-pw2" type={ver ? 'text' : 'password'} autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
                  {erros.senha2 && <div className="er">As senhas não conferem.</div>}</div>
              </div>
              <div className="cb-note" style={{ justifyContent: 'flex-start' }}>Você usará o CNPJ e esta senha para entrar no pedido e na ficha dos produtos durante a live.</div>
              <label className={`cb-check${erros.lgpd ? ' bad' : ''}`}>
                <input type="checkbox" checked={lgpd} onChange={(e) => setLgpd(e.target.checked)} />
                <span>Autorizo a Cardoso Toys a utilizar estes dados para contato sobre a Cardoso Black, conforme a LGPD.</span>
              </label>
              <button className="cb-btn full" type="submit" disabled={enviando || encerrado}>{enviando ? 'Enviando…' : 'Enviar pré-cadastro'}</button>
            </>
          )}
          {aviso && <div className="cb-alert err">{aviso}</div>}
          <div className="cb-note"><Sv.lock />Dados utilizados somente pela Cardoso Toys</div>
        </form>
      </div>
    </Shell>
  );
}
