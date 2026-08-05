export type ProductHoverData = {
  code: string;
  name: string;
  product: string; // url da imagem do produto
  packaging: string; // url da imagem da embalagem
  x: number;
  y: number;
} | null;

// Pop-up flutuante com a(s) imagem(ns) do produto, seguindo o cursor. Controlado pelo pai
// (que rastreia o mouse) — usado nas listas de Produtos, Demandas e Embalagens.
export default function ProductImageHover({ data }: { data: ProductHoverData }) {
  if (!data || (!data.product && !data.packaging)) return null;
  const imgs = [
    { url: data.product, cap: '📦 Produto' },
    { url: data.packaging, cap: '🎁 Embalagem' },
  ].filter((i) => i.url);
  return (
    <div
      style={{
        position: 'fixed',
        left: Math.min(data.x + 20, window.innerWidth - 300),
        top: Math.min(data.y + 20, window.innerHeight - 320),
        zIndex: 1000,
        pointerEvents: 'none',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        width: imgs.length > 1 ? 280 : 180,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace' }}>{data.code}</span> — {data.name}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {imgs.map((i) => (
          <figure key={i.cap} style={{ margin: 0, flex: 1 }}>
            <img
              src={i.url}
              alt={i.cap}
              style={{ width: '100%', height: 150, objectFit: 'contain', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <figcaption style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 4 }}>{i.cap}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
