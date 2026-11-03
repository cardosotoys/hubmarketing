import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { useThumbs } from '../lib/thumbs';
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
/* Nome curto da tabela para caber na coluna (o nome inteiro fica no title). */
const curto = (nome: string) => {
  const n = nome.toLowerCase();
  if (n.includes('nordeste')) return 'N, NE e CO';
  if (n.includes('simples')) return 'SP Simples';
  if (n.includes('rpa')) return 'SP RPA';
  if (n.includes('sul')) return 'Sul e Sudeste';
  return nome.length > 16 ? nome.slice(0, 15) + '…' : nome;
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
  const [marcas, setMarcas] = useState<{ id: string; label: string; color: string }[]>([]);
  const [pausas, setPausas] = useState<ProductSalePause[]>([]);
  const [tabelaId, setTabelaId] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Linha | null>(null);
  const [pausando, setPausando] = useState<Linha | null>(null);
  const [celula, setCelula] = useState<{ codigo: string; tid: string; valor: string } | null>(null);   // preço sendo editado na própria célula
  const thumb = useThumbs();

  const carregar = useCallback(async () => {
    const [t, i, p, pa, mk] = await Promise.all([
      supabase.from('price_tables').select('*').is('vigente_ate', null).order('nome'),
      supabase.from('price_table_items').select('*'),
      supabase.from('products').select('*').order('code'),
      supabase.from('product_sale_pauses').select('*'),
      supabase.from('brands').select('id, label, color'),
    ]);
    setMarcas((mk.data as { id: string; label: string; color: string }[]) ?? []);
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

  // todas as tabelas lado a lado: uma linha por produto, uma coluna por região
  const precoDe = new Map<string, Map<string, PriceTableItem>>();
  for (const i of itens) {
    if (!precoDe.has(i.codigo)) precoDe.set(i.codigo, new Map());
    precoDe.get(i.codigo)!.set(i.price_table_id, i);
  }
  const grupos = (() => {
    const m = new Map<string, Linha[]>();
    for (const l of linhas) {
      const g = l.produto ? (l.produto.line || 'Sem linha') : 'Sem produto no catálogo';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(l);
    }
    return [...m.entries()];
  })();
  const salvarCelula = async () => {
    if (!celula) return;
    const num = Number(celula.valor.replace(/\./g, '').replace(',', '.'));
    const item = precoDe.get(celula.codigo)?.get(celula.tid);
    if (!item || !Number.isFinite(num) || num <= 0) { setCelula(null); return; }
    if (num !== item.preco) await salvarPreco({ ...item, produto: null, pausa: null }, num);
    setCelula(null);
  };

  const marcaDe = (id?: string | null) => marcas.find((m) => m.id === id);

  return (
    <div className="page tp-page tc-page">
      {/* faixa escura (Azul Universo): título, busca e a região escolhida */}
      <header className="tc-hero">
        <div className="tc-hero-t">
          <h1>Tabela de Preços</h1>
          <p>Atacado por região e regime. Não aparece para o lojista na vitrine.</p>
        </div>
        <label className="tc-search">
          <span aria-hidden>⌕</span>
          <input placeholder="Buscar produto ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')}>×</button>}
        </label>
        <div className="tc-regs" role="tablist" aria-label="Região">
          {tabelas.map((t) => (
            <button type="button" role="tab" key={t.id} aria-selected={t.id === tabelaId} onClick={() => setTabelaId(t.id)} title={t.nome}>{curto(t.nome)}</button>
          ))}
        </div>
        {tabela && (
          <p className="tc-hero-info">
            {curto(tabela.nome)} atende {tabela.ufs.join(', ') || 'nenhum estado'}
            {tabela.simples === true && ' · só Simples'}{tabela.simples === false && ' · fora do Simples'}
            {' · '}vigente desde {brDate(tabela.vigente_desde)}
          </p>
        )}
      </header>

      {erro && <div className="alert error" role="status">{erro}</div>}

      <div className="tc-bar">
        <div className="tp-filtros" role="tablist" aria-label="Filtro">
          <button type="button" role="tab" aria-selected={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos <b>{resumo.itens}</b></button>
          <button type="button" role="tab" aria-selected={filtro === 'pausados'} onClick={() => setFiltro('pausados')}>Pausados <b>{resumo.pausados}</b></button>
          <button type="button" role="tab" aria-selected={filtro === 'sem_produto'} onClick={() => setFiltro('sem_produto')}>Sem produto <b>{resumo.semProduto}</b></button>
        </div>
        {resumo.semPreco > 0 && <span className="tc-aviso"><b>{resumo.semPreco}</b> produtos do catálogo ainda sem preço nesta região</span>}
      </div>

      {grupos.map(([g, ls]) => (
        <section key={g} className="tc-group">
          <h2>{g}<span>{ls.length} {ls.length === 1 ? 'produto' : 'produtos'}</span></h2>
          <div className="tc-grid">
            {ls.map((l) => {
              const precos = precoDe.get(l.codigo);
              const foto = l.produto?.image_url ? thumb(l.produto.image_url) : '';
              const mk = marcaDe(l.produto?.brand_id);
              const ed = celula && celula.codigo === l.codigo && celula.tid === tabelaId;
              const outras = tabelas.filter((t) => t.id !== tabelaId);
              return (
                <article key={l.codigo} className={`tc-card ${l.pausa ? 'paused' : ''}`} style={{ ['--bc' as string]: mk?.color ?? '#0a2530' }}>
                  <div className="tc-photo">
                    {foto ? <img src={foto} alt="" loading="lazy" decoding="async" /> : <span className="tc-nofoto">sem foto</span>}
                    <span className="tc-code">{l.codigo}</span>
                    {l.pausa && <span className="tc-paused">Pausado{l.pausa.ate ? ` até ${brDate(l.pausa.ate)}` : ''}</span>}
                    <button type="button" className="tc-pause" onClick={() => (l.pausa ? voltarAVender(l) : setPausando(l))}>{l.pausa ? 'Voltar a vender' : 'Pausar'}</button>
                  </div>
                  <div className="tc-body">
                    <span className="tc-brand"><i />{mk?.label ?? 'Fora do catálogo'}{l.qtd_caixa ? ` · caixa com ${l.qtd_caixa}` : ''}</span>
                    <b className="tc-name">{l.produto?.name ?? l.descricao}</b>
                    <div className="tc-price">
                      {ed ? (
                        <input autoFocus inputMode="decimal" value={celula.valor} aria-label="Preço unitário"
                          onChange={(e) => setCelula({ ...celula, valor: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') void salvarCelula(); if (e.key === 'Escape') setCelula(null); }}
                          onBlur={() => void salvarCelula()} />
                      ) : (
                        <button type="button" className="tc-tag" title="Clique para mudar o preço" onClick={() => setCelula({ codigo: l.codigo, tid: tabelaId, valor: String(l.preco).replace('.', ',') })}>
                          {moeda(l.preco)}
                        </button>
                      )}
                      {l.qtd_caixa ? <span className="tc-box">{moeda(l.preco * l.qtd_caixa)}<small>a caixa</small></span> : null}
                    </div>
                    <div className="tc-others">
                      {outras.map((t) => {
                        const it = precos?.get(t.id);
                        return (
                          <button type="button" key={t.id} title={`${t.nome}: ver e editar`} onClick={() => setTabelaId(t.id)}>
                            <small>{curto(t.nome)}</small><b>{it ? moeda(it.preco) : '—'}</b>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

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
