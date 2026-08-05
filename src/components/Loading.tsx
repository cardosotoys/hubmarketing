// Indicador de carregamento padrão do hub — texto consistente em todas as telas.
export default function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="page-sub" style={{ padding: '12px 0', color: 'var(--text-faint)' }}>
      {label}
    </div>
  );
}
