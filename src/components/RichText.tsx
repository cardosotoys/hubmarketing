// Texto com URLs → links clicáveis; URLs de imagem → miniatura.
// Usado nos comentários (demandas e arquivo Monday) e nas colunas do Monday.
export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url) || /\/storage\/v1\/object\/public\/monday-assets\//.test(url);
}

export default function RichText({ text }: { text: string }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s)"]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^https?:\/\//.test(p)) return <span key={i}>{p}</span>;
        if (isImageUrl(p)) {
          return (
            <a key={i} href={p} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
              <img src={p} alt="anexo" style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, display: 'block', margin: '4px 0', border: '1px solid var(--border)' }} />
            </a>
          );
        }
        return (
          <a key={i} href={p} target="_blank" rel="noreferrer">
            {p}
          </a>
        );
      })}
    </>
  );
}
