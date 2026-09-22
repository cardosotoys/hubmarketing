import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import type { PriceTable, PriceTableItem, Product, ProductSalePause } from '../types/database';

/* Tabela de Preços — a área que alimenta o pré-pedido do comercial.
 *
 * Preço de atacado muda por região e por regime tributário: são quatro tabelas
 * vigentes ao mesmo tempo, e o mesmo produto custa diferente em cada uma. Isso
 * vivia em PDF, fora do sistema, então ninguém montava pré-pedido sem abrir o
 * arquivo.
 *
 * O módulo é restrito (grantOnly): nem diretoria vê sem liberação nominal em
 * Configurações. E o preço nunca chega à vitrine — o lojista continua
 * escolhendo produto sem ver valor, que é como a Cardoso vende. */

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const brDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

type Linha = PriceTableItem & {
  produto: Product | null;   // null = preço sem produto no catálogo
  pausa: ProductSalePause | null;
};

type Filtro = 'todos' | 'sem_produto' | 'pausados';

export default function TabelaPrecos() {
  const { profile } = useAuth();
  const [tabelas, setTabelas] = useState<PriceTable[]>([]);
  const [itens, setItens] = useState<PriceTableItem[]>([]);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [pausas, setPausas] = useState<ProductSalePause[]>([]);
  const [tabelaId, setTabelaId] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Linha | null>(null);
  const [pausando, setPausando] = useState<Linha | null>(null);

  const carregar = useCallback(async () => {
    const [t, i, p, pa] = await Promise.all([
      supabase.from('price_tables').select('*').is('vigente_ate', null).order('nome'),
      supabase.from('price_table_items').select('*'),
      supabase.from('products').select('*').order('code'),
      supabase.from('product_sale_pauses').select('*'),
    ]);
    const erroDeAlgum = t.error || i.error || p.error || pa.error;
    if (erroDeAlgum) setErro(erroDeAlgum.message);
    const tt = (t.data as PriceTable[]) ?? [];
    setTabelas(tt);
    setItens((i.data as PriceTableItem[]) ?? []);
    setProdutos((p.data as Product[]) ?? []);
    setPausas((pa.data as ProductSalePause[]) ?? []);
    setTabelaId((atual) => atual || tt[0]?.id || '');
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const porCodigo = useMemo(() => {
    const m: Record<string, Product> = {};
    for (const p of produtos) m[p.code] = p;
    return m;
  }, [produtos]);

  /* Uma pausa sem tabela vale para todas; com tabela, só para aquela. E só
   * conta se a data de hoje estiver dentro da janela — pausa vencida some
   * sozinha, sem ninguém precisar lembrar de reativar. */
  const pausaDe = useCallback((codigo: string): ProductSalePause | null => {
    const hoje = hojeISO();
    return pausas.find((x) =>
      x.codigo === codigo
      && (x.price_table_id === null || x.price_table_id === tabelaId)
      && x.desde <= hoje
      && (x.ate === null || x.ate >= hoje)) ?? null;
  }, [pausas, tabelaId]);

  const linhas = useMemo<Linha[]>(() => {
    const s = busca.trim().toLowerCase();
    return itens
      .filter((i) => i.price_table_id === tabelaId)
      .map((i) => ({ ...i, produto: porCodigo[i.codigo] ?? null, pausa: pausaDe(i.codigo) }))
      .filter((l) => {
        if (filtro === 'sem_produto' && l.produto) return false;
        if (filtro === 'pausados' && !l.pausa) return false;
        if (s && !`${l.codigo} ${l.descricao} ${l.produto?.name ?? ''}`.toLowerCase().includes(s)) return false;
        return true;
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [itens, tabelaId, porCodigo, pausaDe, busca, filtro]);

  const tabela = tabelas.find((t) => t.id === tabelaId) ?? null;

  const resumo = useMemo(() => {
    const daTabela = itens.filter((i) => i.price_table_id === tabelaId);
    const comCodigo = new Set(daTabela.map((i) => i.codigo));
    return {
      itens: daTabela.length,
      semProduto: daTabela.filter((i) => !porCodigo[i.codigo]).length,
      semPreco: produtos.filter((p) => !comCodigo.has(p.code)).length,
      pausados: daTabela.filter((i) => pausaDe(i.codigo)).length,
    };
  }, [itens, tabelaId, porCodigo, produtos, pausaDe]);

  async function salvarPreco(linha: Linha, preco: number) {
    const { error } = await supabase.from('price_table_items')
      .update({ preco }).eq('price_table_id', linha.price_table_id).eq('codigo', linha.codigo);
    setErro(error ? `Não consegui salvar o preço: ${error.message}` : '');
    if (!error) { setEditando(null); await carregar(); }
  }

  async function criarPausa(linha: Linha, tudo: boolean, ate: string, motivo: string) {
    const { error } = await supabase.from('product_sale_pauses').insert({
      codigo: linha.codigo,
      price_table_id: tudo ? null : tabelaId,
      ate: ate || null,
      motivo,
      criado_por: profile?.id ?? null,
    });
    setErro(error ? `Não consegui pausar: ${error.message}` : '');
    if (!error) { setPausando(null); await carregar(); }
  }

  async function voltarAVender(linha: Linha) {
    if (!linha.pausa) return;
    const { error } = await supabase.from('product_sale_pauses').delete().eq('id', linha.pausa.id);
    setErro(error ? `Não consegui reativar: ${error.message}` : '');
    if (!error) await carregar();
  }

  if (carregando) return <Loading />;

  if (tabelas.length === 0) {
    return (
      <div className="page">
        <div className="rm-head">
          <div>
            <h1 className="page-title">Tabela de Preços</h1>
            <div className="page-sub">Nenhuma tabela vigente.</div>
          </div>
        </div>
        <EmptyState title="Sem tabela de preço" hint="Nenhuma tabela está vigente no momento." />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="rm-head">
        <div>
          <h1 className="page-title">Tabela de Preços</h1>
          <div className="page-sub">
            Preço de atacado por região e regime. Não aparece para o lojista na vitrine.
          </div>
        </div>
      </div>

      {erro && <div className="alert error" role="status">{erro}</div>}

      <div className="responsive-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {tabelas.map((t) => (
          <button
            key={t.id}
            className={`btn${t.id === tabelaId ? ' primary' : ''}`}
            onClick={() => setTabelaId(t.id)}
          >
            {t.nome}
          </button>
        ))}
      </div>

      {tabela && (
        <div className="rm-kpis" style={{ marginBottom: 12 }}>
          <div className="rm-kpi"><b>{resumo.itens}</b><span>itens com preço</span></div>
          <div className="rm-kpi"><b>{resumo.pausados}</b><span>pausados</span></div>
          <div className="rm-kpi"><b>{resumo.semProduto}</b><span>sem produto no catálogo</span></div>
          <div className="rm-kpi"><b>{resumo.semPreco}</b><span>produtos sem preço</span></div>
        </div>
      )}

      {tabela && (
        <p className="page-sub" style={{ marginBottom: 12 }}>
          Atende <b>{tabela.ufs.join(', ') || 'nenhum estado'}</b>
          {tabela.simples === true && ' · só optantes do Simples'}
          {tabela.simples === false && ' · só quem não é do Simples'}
          {' · '}vigente desde {brDate(tabela.vigente_desde)}
          {tabela.origem && ` · de ${tabela.origem}`}
        </p>
      )}

      <div className="responsive-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          placeholder="Buscar por código ou nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} style={{ width: 'auto' }}>
          <option value="todos">Todos os itens</option>
          <option value="pausados">Só pausados</option>
          <option value="sem_produto">Só sem produto no catálogo</option>
        </select>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th><th>Produto</th><th>Preço</th><th>Por caixa</th>
              <th>Caixa fechada</th><th>Situação</th><th />
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, 400).map((l) => (
              <tr key={l.codigo} style={l.pausa ? { opacity: 0.55 } : undefined}>
                <td className="mono">{l.codigo}</td>
                <td>
                  {l.produto?.name ?? l.descricao}
                  {!l.produto && <span className="pill warn" style={{ marginLeft: 8 }}>sem produto</span>}
                </td>
                <td className="mono">{moeda(l.preco)}</td>
                <td className="mono">{l.qtd_caixa ?? '—'}</td>
                <td className="mono">{l.qtd_caixa ? moeda(l.preco * l.qtd_caixa) : '—'}</td>
                <td>
                  {l.pausa
                    ? <>pausado{l.pausa.ate ? ` até ${brDate(l.pausa.ate)}` : ' sem previsão'}
                        {l.pausa.price_table_id === null ? ' (todas)' : ' (esta tabela)'}</>
                    : 'à venda'}
                </td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setEditando(l)}>preço</button>
                  {l.pausa
                    ? <button className="btn ghost sm" onClick={() => voltarAVender(l)}>voltar a vender</button>
                    : <button className="btn ghost sm" onClick={() => setPausando(l)}>pausar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {linhas.length > 400 && (
        <p className="page-sub">Mostrando os 400 primeiros de {linhas.length}. Use a busca para achar o resto.</p>
      )}
      {linhas.length === 0 && <EmptyState title="Nada aqui" hint="Nenhum item com esse filtro." />}

      {editando && <ModalPreco linha={editando} onFechar={() => setEditando(null)} onSalvar={salvarPreco} />}
      {pausando && <ModalPausa linha={pausando} tabela={tabela} onFechar={() => setPausando(null)} onSalvar={criarPausa} />}
    </div>
  );
}

function ModalPreco({ linha, onFechar, onSalvar }: {
  linha: Linha; onFechar: () => void; onSalvar: (l: Linha, preco: number) => void;
}) {
  const [valor, setValor] = useState(String(linha.preco).replace('.', ','));
  const num = Number(valor.replace(/\./g, '').replace(',', '.'));
  const valido = Number.isFinite(num) && num > 0;
  return (
    <Modal title={`${linha.codigo} — ${linha.produto?.name ?? linha.descricao}`} onClose={onFechar}>
      <div className="form-field">
        <label htmlFor="tp-preco">Preço unitário</label>
        <input id="tp-preco" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus inputMode="decimal" />
      </div>
      {linha.qtd_caixa && valido && (
        <p className="page-sub">
          Caixa com {linha.qtd_caixa} = <b>{moeda(num * linha.qtd_caixa)}</b>
        </p>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onFechar}>Cancelar</button>
        <button className="btn primary" disabled={!valido} onClick={() => onSalvar(linha, num)}>Salvar preço</button>
      </div>
    </Modal>
  );
}

function ModalPausa({ linha, tabela, onFechar, onSalvar }: {
  linha: Linha;
  tabela: PriceTable | null;
  onFechar: () => void;
  onSalvar: (l: Linha, tudo: boolean, ate: string, motivo: string) => void;
}) {
  const [tudo, setTudo] = useState(true);
  const [ate, setAte] = useState('');
  const [motivo, setMotivo] = useState('');
  return (
    <Modal title={`Pausar ${linha.codigo} — ${linha.produto?.name ?? linha.descricao}`} onClose={onFechar}>
      <p className="page-sub">
        Enquanto estiver pausado, o produto não entra em pré-pedido. O preço fica guardado:
        vencida a pausa, ele volta a vender sozinho.
      </p>
      <div className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input id="tp-tudo" type="checkbox" checked={tudo} onChange={(e) => setTudo(e.target.checked)} style={{ width: 'auto' }} />
        <label htmlFor="tp-tudo" style={{ margin: 0 }}>
          Pausar em todas as tabelas{tabela ? ` — desmarcado, pausa só em ${tabela.nome}` : ''}
        </label>
      </div>
      <div className="form-field">
        <label htmlFor="tp-ate">Até quando (em branco = sem previsão)</label>
        <input id="tp-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="tp-motivo">Motivo</label>
        <input id="tp-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: sem estoque até a próxima produção" />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onFechar}>Cancelar</button>
        <button className="btn primary" onClick={() => onSalvar(linha, tudo, ate, motivo)}>Pausar venda</button>
      </div>
    </Modal>
  );
}
