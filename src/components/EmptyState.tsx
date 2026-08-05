// Estado vazio padrão do hub — mesma cara em todas as listas. Opcionalmente com um CTA.
export default function EmptyState({
  icon = '📭',
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-faint)' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ color: 'var(--text-dim)', fontSize: 15, fontWeight: 600, marginBottom: hint ? 6 : 14 }}>{title}</div>
      {hint && (
        <div style={{ fontSize: 13, marginBottom: 16, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
      {action && (
        <button className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
