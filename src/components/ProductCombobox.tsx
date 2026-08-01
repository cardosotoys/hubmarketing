import { useMemo, useState } from 'react';
import type { Product } from '../types/database';

// Combobox digitável de produto/SKU: digita para filtrar OU rola a lista — as duas formas.
export default function ProductCombobox({
  products,
  value,
  onChange,
  autoOpen,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  autoOpen?: boolean;
}) {
  const selected = products.find((p) => p.id === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(Boolean(autoOpen));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? products.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      : products;
    return base.slice(0, 40);
  }, [products, query]);

  if (selected && !open) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span className="pill" style={{ flex: 1, background: 'var(--surface-2)' }}>
          {selected.code} — {selected.name}
        </span>
        <button type="button" className="btn ghost sm" onClick={() => { setOpen(true); setQuery(''); }}>
          Trocar
        </button>
        <button type="button" className="btn ghost sm" onClick={() => onChange('')} title="Remover vínculo">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="combobox">
      <input
        autoFocus={open}
        placeholder="Digite código ou nome do SKU, ou role a lista…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="combobox-results">
          <div className="opt" style={{ color: 'var(--text-faint)' }} onClick={() => { onChange(''); setOpen(false); }}>
            Sem produto vinculado
          </div>
          {results.map((p) => (
            <div
              key={p.id}
              className="opt"
              onClick={() => {
                onChange(p.id);
                setOpen(false);
                setQuery('');
              }}
            >
              <strong>{p.code}</strong> — {p.name}
            </div>
          ))}
          {results.length === 0 && <div className="opt" style={{ color: 'var(--text-faint)' }}>Nenhum produto encontrado.</div>}
        </div>
      )}
    </div>
  );
}
