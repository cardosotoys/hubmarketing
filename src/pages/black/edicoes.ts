import { supabase } from '../../lib/supabaseClient';
import type { Aba } from './abas';

/* Edições da Cardoso Black. A edição em andamento usa as tabelas black_*; as encerradas ficam em black_arq_*
 * (coluna edicao), só para leitura. Para arquivar uma edição nova: SQL de arquivo + uma linha aqui. */
export type EdInfo = {
  id: string;            // vai na URL (?ed=1)
  arq: string | null;    // valor da coluna edicao em black_arq_*; null = tabelas da operação
  nome: string;          // "1ª edição · E-commerce"
  curto: string;         // "1ª · E-commerce"
  datas: string;         // linha curta com as datas
  // textos do relatório da diretoria
  sobre: string; geral: string; objetivo: [string, string]; live: string;
};

export const EDICOES: EdInfo[] = [
  {
    id: '2', arq: null, nome: '2ª edição · Varejo', curto: '2ª · Varejo', datas: 'Live 24/11 às 10h · pedidos até 26/11',
    sobre: 'A segunda Black Friday da Cardoso, agora para as lojas físicas da carteira. Uma live de lançamento, uma vitrine exclusiva com preços Black e pedidos direto pelo link, com o representante de cada loja no circuito.',
    geral: 'Segunda Black da Cardoso, feita para o varejo (lojas físicas)',
    objetivo: ['Levar a Black ao varejo', 'Trazer as lojas físicas da carteira para o pedido digital, com condição especial e preço por região.'],
    live: '24/11 às 10h',
  },
  {
    id: '1', arq: 'ecommerce-nov26', nome: '1ª edição · E-commerce', curto: '1ª · E-commerce', datas: 'Live 12/11 às 16h · pedidos até 13/11',
    sobre: 'A primeira Black Friday da Cardoso feita só para lojas que vendem online: e-commerce próprio e marketplaces. Uma live de lançamento, uma vitrine exclusiva com preços Black e pedidos direto pelo link, com o representante de cada loja no circuito.',
    geral: 'Primeira Black da Cardoso feita só para lojas de e-commerce e marketplace',
    objetivo: ['Ativar o canal online', 'Levar a linha Cardoso para mais lojas de e-commerce e marketplace, com condição especial e material pronto para anunciar.'],
    live: '12/11 às 16h',
  },
];

export const edicaoDe = (v: string | null): EdInfo => EDICOES.find((e) => e.id === v) ?? EDICOES[0];

/** abas que fazem sentido numa edição encerrada (só leitura: medição, listas, PDFs e relatório) */
export const ABAS_ARQ: Aba[] = ['resumo', 'inscritos', 'pedidos', 'carrinhos', 'relatorio'];

/** URL de uma aba dentro de uma edição */
export const urlAba = (k: Aba, ed: EdInfo) => {
  const q = new URLSearchParams();
  if (ed.id !== EDICOES[0].id) q.set('ed', ed.id);
  if (k !== 'resumo') q.set('aba', k);
  const s = q.toString();
  return `/cardoso-black${s ? `?${s}` : ''}`;
};

/** select numa tabela da Black, na edição certa */
export function ler(nome: string, cols: string, arq: string | null) {
  const q = supabase.from(arq ? `black_arq_${nome}` : `black_${nome}`).select(cols);
  return arq ? q.eq('edicao', arq) : q;
}

/** relatório de carrinhos da edição */
export const carrinhosRel = (arq: string | null) =>
  arq ? supabase.rpc('black_carrinhos_relatorio_arq', { p_edicao: arq }) : supabase.rpc('black_carrinhos_relatorio');
