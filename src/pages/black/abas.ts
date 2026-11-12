import type { IconeMarca } from './Icones';

export type Aba = 'resumo' | 'inscritos' | 'pedidos' | 'carrinhos' | 'mensagens' | 'produtos' | 'carteira' | 'links' | 'ajustes';
// menu na ordem do onboarding aprovado (Carteira → Inscritos → Pedidos → Medição) + a operação
export const ABAS: [Aba, string, IconeMarca, 1 | 2][] = [
  ['carteira', 'Carteira', 'store', 1], ['inscritos', 'Inscritos', 'users', 1], ['pedidos', 'Pedidos', 'cart', 1], ['carrinhos', 'Carrinhos', 'receipt', 1], ['mensagens', 'Mensagens da live', 'chat', 1], ['resumo', 'Medição', 'target', 1],
  ['produtos', 'Produtos da Black', 'tag', 2], ['links', 'Links e QR', 'marketing', 2], ['ajustes', 'Ajustes', 'bolt', 2],
];
export const abaValida = (v: string | null): Aba => (ABAS.some((a) => a[0] === v) ? (v as Aba) : 'resumo');

/** prévia da equipe: entra na página de pedido como a loja de demonstração (não envia pedido). Devolve o erro, se houver. */
export async function verComoCliente(): Promise<string> {
  const { supabase } = await import('../../lib/supabaseClient');
  const aba = window.open('about:blank', '_blank');
  const { data, error } = await supabase.rpc('black_previa_entrar');
  const tok = (data as { token?: string } | null)?.token;
  if (error || !tok) {
    aba?.close();
    return error?.message.includes('black_previa_entrar') ? 'Para usar a prévia, rode o SQL 0164 no Supabase.' : `Não consegui abrir a prévia: ${error?.message ?? 'sem resposta'}`;
  }
  try { localStorage.setItem('cb-token', JSON.stringify(tok)); sessionStorage.removeItem('cb-token'); } catch { /* sem armazenamento */ }
  if (aba) aba.location.href = '/black/pedido'; else window.location.href = '/black/pedido';
  return '';
}

/** pedido manual: gera o link que entra na página de pedido como um cliente aprovado (abre em qualquer navegador). */
export async function linkComoCliente(inscrito: string): Promise<{ link?: string; erro?: string }> {
  const { supabase } = await import('../../lib/supabaseClient');
  const { data, error } = await supabase.rpc('black_entrar_como', { p_inscrito: inscrito });
  const r = data as { token?: string; erro?: string } | null;
  if (error || !r?.token) {
    return { erro: error?.message.includes('black_entrar_como') ? 'Para fazer pedido pelo cliente, rode o SQL 0174 no Supabase.' : (r?.erro ?? `Não consegui gerar o link: ${error?.message ?? 'sem resposta'}`) };
  }
  return { link: `${window.location.origin}/black/pedido?entrar=${r.token}` };
}
