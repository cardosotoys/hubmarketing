// Placeholder para os módulos criados vazios (estrutura pronta, conteúdo em etapa futura).
export default function EmptyModule({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <div className="page-sub">{hint ?? 'Módulo em preparação.'}</div>
      <div
        style={{
          textAlign: 'center',
          padding: '64px 16px',
          color: 'var(--text-faint)',
          border: '1px dashed var(--border)',
          borderRadius: 12,
          marginTop: 16,
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>🚧</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Em breve</div>
        <p style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
          Esta área já faz parte da estrutura do hub. O conteúdo será implementado numa próxima etapa.
        </p>
      </div>
    </div>
  );
}
