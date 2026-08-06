import { Link } from 'react-router-dom';
import type { ActivityWithActor, NotificationRow } from '../hooks/useNotifications';

const trunc = (s: string, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
};

export default function NotificationsPanel({
  notifications,
  recent,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: {
  notifications: NotificationRow[];
  recent: ActivityWithActor[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="notif-panel" style={{ width: 'min(420px, 92vw)' }}>
      {notifications.length > 0 && (
        <>
          <div className="head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              Notificações
              {unread.length > 0 && (
                <span
                  style={{ marginLeft: 6, background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}
                >
                  {unread.length}
                </span>
              )}
            </span>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontSize: 11, padding: 0 }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          {notifications.map((n) => {
            const unreadItem = !n.read;
            return (
              <Link
                className="item"
                key={n.id}
                to={n.task_id ? `/demandas?task=${n.task_id}&focus=comments` : '/demandas'}
                onClick={() => {
                  onMarkRead(n.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  background: unreadItem ? 'var(--accent-dim)' : undefined,
                  fontWeight: unreadItem ? 600 : 400,
                  opacity: unreadItem ? 1 : 0.62,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    marginTop: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: unreadItem ? 'var(--accent)' : 'transparent',
                    border: unreadItem ? 'none' : '1px solid var(--border)',
                  }}
                />
                <span style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  <span style={{ display: 'block' }}>
                    <b>{n.actor?.name ?? 'Alguém'}</b> te marcou em “{trunc(n.title || 'uma demanda', 42)}”
                  </span>
                  {n.body && (
                    <span style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 400, marginTop: 2 }}>
                      {trunc(n.body, 90)}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </>
      )}
      <div className="head">Atividade recente</div>
      {recent.length === 0 && <div className="item">Nada por aqui ainda.</div>}
      {recent.map((r) => {
        const content = (
          <>
            <b>{r.actor?.name ?? 'Alguém'}</b> {r.action_text}
            {r.detail ? ` — ${r.detail}` : ''}
          </>
        );
        if (r.task_id) {
          return (
            <Link className="item" key={r.id} to={`/demandas?task=${r.task_id}`} onClick={onClose}>
              {content}
            </Link>
          );
        }
        if (r.project_id) {
          return (
            <Link className="item" key={r.id} to={`/projetos/${r.project_id}`} onClick={onClose}>
              {content}
            </Link>
          );
        }
        return (
          <div className="item" key={r.id}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
