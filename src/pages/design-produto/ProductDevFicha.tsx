import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { normalizeUrl } from '../../lib/url';
import Modal from '../../components/Modal';
import { useProductDevWorkspace } from '../../context/ProductDevWorkspaceContext';
import {
  PRODUCT_DEV_DOC_KINDS,
  type Product,
  type ProductDevDocKind,
  type ProductDevDocument,
} from '../../types/database';

export default function ProductDevFicha() {
  const { profile } = useAuth();
  const { item, product, reload } = useProductDevWorkspace();
  const [concept, setConcept] = useState(item.concept);
  const [licenseNotes, setLicenseNotes] = useState(item.license_notes);
  const [savingText, setSavingText] = useState(false);
  const [docs, setDocs] = useState<ProductDevDocument[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [showDoc, setShowDoc] = useState(false);

  async function loadDocs() {
    const { data } = await supabase.from('product_dev_documents').select('*').eq('item_id', item.id).order('created_at', { ascending: false });
    setDocs((data as ProductDevDocument[]) ?? []);
  }

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function saveText() {
    setSavingText(true);
    await supabase
      .from('product_dev_items')
      .update({ concept, license_notes: licenseNotes, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    await logActivity({ actorId: profile?.id ?? '', actionText: 'Ficha do produto atualizada', productDevItemId: item.id });
    setSavingText(false);
    reload();
  }

  async function unlinkProduct() {
    await supabase.from('product_dev_items').update({ product_id: null }).eq('id', item.id);
    reload();
  }

  async function removeDoc(id: string) {
    await supabase.from('product_dev_documents').delete().eq('id', id);
    loadDocs();
  }

  return (
    <div>
      <div className="section-head">
        <h2>Ficha & Requisitos (PRD)</h2>
        <button className="btn sm" disabled={savingText} onClick={saveText}>
          {savingText ? 'Salvando…' : 'Salvar ficha'}
        </button>
      </div>

      <div className="panel">
        <h4>Conceito (1 página)</h4>
        <div className="form-field">
          <textarea
            rows={4}
            placeholder="Oportunidade, problema/desejo que o brinquedo atende, público-alvo, posicionamento…"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </div>
      </div>

      <div className="panel">
        <h4>Requisitos & especificação</h4>
        <div className="field-row">
          <span className="k">Faixa etária</span>
          <span>{item.age_range || '—'} <span style={{ color: 'var(--text-faint)' }}>· determina normas de segurança e tamanho de peças</span></span>
        </div>
        <div className="field-row">
          <span className="k">Material</span>
          <span>{item.material || '—'} <span style={{ color: 'var(--text-faint)' }}>· afeta custo, encolhimento e segurança</span></span>
        </div>
        <div className="field-row">
          <span className="k">Meta de preço</span>
          <span>{item.target_price != null ? item.target_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span>
        </div>
        <div className="field-row">
          <span className="k">Meta de volume</span>
          <span>{item.target_volume ? item.target_volume.toLocaleString('pt-BR') + ' un.' : '—'}</span>
        </div>
        <div className="page-sub" style={{ marginTop: 6 }}>
          Edite faixa etária, material, metas e licenciamento pelo botão <strong>✎ Editar</strong> no topo do produto.
        </div>
      </div>

      <div className="panel">
        <h4>Licenciamento</h4>
        <div className="field-row">
          <span className="k">Licenciado</span>
          <span>{item.licensed ? 'Sim — personagem/marca de terceiro' : 'Não — personagem próprio'}</span>
        </div>
        <div className="form-field">
          <label htmlFor="lic-notes">Observações de licenciamento</label>
          <textarea id="lic-notes" rows={2} value={licenseNotes} onChange={(e) => setLicenseNotes(e.target.value)} />
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Vínculo ao Banco de Produtos</h4>
          {product ? (
            <button className="btn ghost sm" onClick={unlinkProduct}>
              Desvincular
            </button>
          ) : (
            <button className="btn sm" onClick={() => setShowLink(true)}>
              Vincular SKU
            </button>
          )}
        </div>
        {product ? (
          <div className="field-row" style={{ marginTop: 8 }}>
            <span className="k">SKU</span>
            <span>
              {product.code} — {product.name}
            </span>
          </div>
        ) : (
          <div className="page-sub" style={{ marginTop: 8 }}>
            Sem vínculo. Um SKU novo pode ainda não existir no catálogo — vincule quando for cadastrado.
          </div>
        )}
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Documentos & links</h4>
          <button className="btn sm" onClick={() => setShowDoc(true)}>
            + Documento
          </button>
        </div>
        {docs.length === 0 ? (
          <div className="page-sub" style={{ marginTop: 8 }}>
            Anexe PRD, modelo 3D (CAD), laudos de laboratório, guia de embalagem…
          </div>
        ) : (
          docs.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="tag" style={{ background: 'var(--surface-2)', fontSize: 10 }}>
                {PRODUCT_DEV_DOC_KINDS.find((k) => k.key === d.kind)?.label ?? d.kind}
              </span>
              <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
                {d.name}
              </a>
              <button className="btn ghost sm" onClick={() => removeDoc(d.id)} title="Excluir">
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {showLink && (
        <LinkProductModal
          itemId={item.id}
          onClose={() => setShowLink(false)}
          onSaved={() => {
            setShowLink(false);
            reload();
          }}
        />
      )}
      {showDoc && (
        <NewDocModal
          itemId={item.id}
          actorId={profile?.id ?? ''}
          onClose={() => setShowDoc(false)}
          onSaved={() => {
            setShowDoc(false);
            loadDocs();
          }}
        />
      )}
    </div>
  );
}

function LinkProductModal({ itemId, onClose, onSaved }: { itemId: string; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, code, name')
        .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
        .limit(20);
      setResults((data as Product[]) ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function pick(p: Product) {
    await supabase.from('product_dev_items').update({ product_id: p.id }).eq('id', itemId);
    onSaved();
  }

  return (
    <Modal title="Vincular SKU do catálogo" onClose={onClose}>
      <div className="form-field">
        <label htmlFor="lp-q">Buscar por nome ou código</label>
        <input id="lp-q" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex.: caminhão, 1234…" />
      </div>
      {loading && <div className="page-sub">Buscando…</div>}
      {results.map((p) => (
        <div
          key={p.id}
          className="filter-chip"
          style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}
          onClick={() => pick(p)}
        >
          <strong>{p.code}</strong> — {p.name}
        </div>
      ))}
      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="page-sub">Nenhum produto encontrado.</div>
      )}
    </Modal>
  );
}

function NewDocModal({
  itemId,
  actorId,
  onClose,
  onSaved,
}: {
  itemId: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<ProductDevDocKind>('prd');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    await supabase.from('product_dev_documents').insert({
      item_id: itemId,
      kind,
      name: name.trim(),
      url: normalizeUrl(url),
      added_by: actorId,
    });
    onSaved();
  }

  return (
    <Modal title="Novo documento / link" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="d-kind">Tipo</label>
          <select id="d-kind" value={kind} onChange={(e) => setKind(e.target.value as ProductDevDocKind)}>
            {PRODUCT_DEV_DOC_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="d-name">Nome</label>
          <input id="d-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="d-url">Link (Drive, etc.)</label>
          <input id="d-url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Adicionar
          </button>
        </div>
      </form>
    </Modal>
  );
}
