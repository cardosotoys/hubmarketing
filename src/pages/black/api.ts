import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

/* Cardoso Black — tudo o que as páginas públicas usam para falar com o banco.
 * O lojista não tem login do Supabase: ele entra com CNPJ e senha e recebe um token de sessão
 * (black_sessoes), guardado neste aparelho até o fim da Black. */

/* Endereços das funções no Supabase. Criadas pelo painel, receberam endereços automáticos:
 * black-cadastro → smooth-endpoint, black-midia → dynamic-worker (o nome no painel é só rótulo). */
export const FN_CADASTRO = 'smooth-endpoint';
export const FN_MIDIA = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-worker`;

export type BlackConfig = {
  inscricoes_ate: string; abre_em: string; fecha_em: string; pedido_minimo: number; frete_gratis_sp_rj: number;
  live_data: string; agora: string; aberto: boolean; encerrado: boolean;
};
export type BlackSessao = {
  cnpj: string; razao_social: string; fantasia: string; cidade: string; uf: string; representante: string;
  comprador: string; email: string; celular: string; canal_link: string; live_link: string; previa?: boolean;
};
export type BlackItem = {
  codigo: string; ordem: number; nome: string; familia: string; caixa: number; preco_peca: number | null;
  disponivel: number | null; imagem: string; embalagem: string;
};
export type BlackMaterial = { tipo: 'foto' | 'video' | 'kit' | 'documento'; nome: string; link: string; cache: string };
export type BlackFicha = BlackItem & {
  descricao: string; diferenciais: string[];
  tecnico: {
    faixa_etaria: string; ean: string; inmetro: string; material: string; cor: string; categoria: string; conteudo: string;
    mecanismo: boolean; som: boolean; luz: boolean; pilhas: string;
    produto_mm: (number | null)[]; produto_kg: number | null; embalagem_mm: (number | null)[]; embalagem_kg: number | null;
    caixa_mm: (number | null)[]; caixa_kg: number | null; caixa_obs: string;
  };
  materiais: BlackMaterial[];
};
export type BlackPedido = {
  numero: string; criado_em: string; caixas: number; total: number; status: string;
  itens: { codigo: string; nome: string; caixas: number; pecas_caixa: number; preco_peca: number; total: number }[];
};

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const digitos = (v: string) => v.replace(/\D/g, '');
export const maskCnpj = (v: string) => digitos(v).slice(0, 14)
  .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
  .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
export const maskFone = (v: string) => {
  const d = digitos(v).slice(0, 11);
  if (d.length < 3) return d;
  if (d.length < 8) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};
export const driveId = (url: string) =>
  url.match(/\/d\/([\w-]{20,})/)?.[1] ?? url.match(/[?&]id=([\w-]{20,})/)?.[1] ?? url.match(/^([\w-]{25,})$/)?.[1] ?? null;
export const midia = (id: string, modo: boolean | 'miniatura' | 'exibir' | 'preparar' = false) =>
  `${FN_MIDIA}?id=${encodeURIComponent(id)}${modo ? `&modo=${modo === true ? 'miniatura' : modo}` : ''}`;
/** cópia no Storage público (CDN): o = original, i = imagem 1600 px, t = miniatura 400 px. A black-midia cria na 1ª visita. */
export const midiaRapida = (k: 'o' | 'i' | 't', id: string) => `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/black-midia/${k}/${id}`;
export const cachePublico = (path: string) => supabase.storage.from('library-cache').getPublicUrl(path).data.publicUrl;

/* localStorage pode não existir (modo privado, navegador embutido do WhatsApp): tudo em try/catch */
const ls = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};
/* "manter conectado": guarda no aparelho (localStorage); sem isso, só nesta aba (sessionStorage) */
const ss = {
  get() { try { return sessionStorage.getItem('cb-token') ?? ''; } catch { return ''; } },
  set(v: string) { try { if (v) sessionStorage.setItem('cb-token', v); else sessionStorage.removeItem('cb-token'); } catch { /* sem armazenamento */ } },
};
export const tokenGuardado = () => ls.get<string>('cb-token', '') || ss.get();
export const guardarToken = (t: string, manter = true) => {
  if (!t) { ls.del('cb-token'); ss.set(''); return; }
  if (manter) { ls.set('cb-token', t); ss.set(''); } else { ls.del('cb-token'); ss.set(t); }
};
export type Carrinho = Record<string, number>;
export const lerCarrinho = () => ls.get<Carrinho>('cb-carrinho', {});
export const gravarCarrinho = (c: Carrinho) => ls.set('cb-carrinho', c);

export function useConfig() {
  const [cfg, setCfg] = useState<BlackConfig | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    supabase.rpc('black_config_publica').then(({ data, error }) => { if (error) setErro(true); else setCfg(data as BlackConfig); });
  }, []);
  return { cfg, erro };
}

/* sessão do lojista: lê o token guardado e confere no banco */
export function useSessao() {
  const [token, setTok] = useState(tokenGuardado());
  const [sessao, setSessao] = useState<BlackSessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let vivo = true;
    if (!token) { setSessao(null); setCarregando(false); return; }
    setCarregando(true);
    supabase.rpc('black_sessao', { p_token: token }).then(({ data }) => {
      if (!vivo) return;
      if (!data) { guardarToken(''); setTok(''); setSessao(null); } else setSessao(data as BlackSessao);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [token]);
  const entrar = useCallback(async (cnpj: string, senha: string, manter = true): Promise<string | null> => {
    const { data, error } = await supabase.rpc('black_login', { p_cnpj: digitos(cnpj), p_senha: senha });
    if (error) return 'rede';
    const r = data as { token?: string; erro?: string };
    if (r.erro || !r.token) return r.erro ?? 'senha';
    guardarToken(r.token, manter); setTok(r.token);
    return null;
  }, []);
  const sair = useCallback(async () => {
    if (token) await supabase.rpc('black_sair', { p_token: token });
    guardarToken(''); setTok(''); setSessao(null);
  }, [token]);
  return { token, sessao, carregando, entrar, sair };
}

export const ERRO_LOGIN: Record<string, string> = {
  nao_inscrito: 'Este CNPJ ainda não fez o pré-cadastro da Cardoso Black.',
  senha: 'CNPJ ou senha não conferem.',
  em_analise: 'Seu cadastro ainda está em análise. Assim que for aprovado, você recebe o aviso.',
  recusado: 'Este cadastro não foi aprovado para a Cardoso Black. Fale com o seu representante.',
  rede: 'Não consegui conectar agora. Tente de novo em instantes.',
};

const TZ = 'America/Sao_Paulo';
export const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const diaMes = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ });
export const hora = (iso: string) => {
  const [h, m] = new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
};
export const diaBadge = (iso: string) => {
  const d = new Date(iso);
  return { dia: d.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: TZ }), mes: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: TZ }).replace('.', '').toUpperCase() };
};
export const diaSemana = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: TZ }).replace('-feira', '-feira');
/* "de 12/11, às 15h, a 15/11, até 23h59" — sempre a partir dos Ajustes do Hub */
export const periodoPedidos = (c: { abre_em: string; fecha_em: string } | null | undefined) =>
  c ? `de ${diaMes(c.abre_em)}, às ${hora(c.abre_em)}, a ${diaMes(c.fecha_em)}, até ${hora(c.fecha_em)}` : 'de 12/11, às 15h, a 15/11, até 23h59';

/* contagem regressiva até uma data, atualizada a cada 30 s */
export function useFaltam(alvo: string | undefined) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
  if (!alvo) return null;
  const ms = new Date(alvo).getTime() - agora;
  if (ms <= 0) return { ms: 0, d: 0, h: 0, m: 0, texto: 'encerrado' };
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return { ms, d, h, m, texto: d > 0 ? `${d}d ${h}h ${String(m).padStart(2, '0')}min` : `${h}h ${String(m).padStart(2, '0')}min` };
}

/* mesma regra do banco (black_frete), só para mostrar antes de enviar */
export function freteTexto(uf: string, cidade: string, total: number, limite: number): [string, boolean] {
  const norm = cidade.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const lim = limite.toLocaleString('pt-BR');
  if (uf === 'SP' && norm === 'SAO PAULO') return ['Frete grátis para SP capital', true];
  if (uf === 'SP' || uf === 'RJ') return total >= limite ? [`Frete grátis: pedido acima de R$ ${lim}`, true] : [`Frete grátis a partir de R$ ${lim} · faltam ${brl(limite - total)}`, false];
  return ['Transportadora, frete por conta da loja', false];
}
