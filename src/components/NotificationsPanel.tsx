import { Link } from 'react-router-dom';
import type { ActivityWithActor, MentionRow } from '../hooks/useNotifications';

const trunc = (s: string, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
};

export default function NotificationsPanel({
  mentions,
  recent,
  readIds,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: {
  mentions: MentionRow[];
  recent: ActivityWithActor[];
  readIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: (ids: string[]) => void;
  onClose: () => void;
}) {
  const unreadMentions = mentions.filter((m) => !readIds.has(m.id));

  return (
    <div className="notif-panel" style={{ width: 'min(420px, 92vw)' }}>
      {mentions.length > 0 && (
        <>
          <div className="head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              Menções pra você
              {unreadMentions.length > 0 && (
                <span
                  style={{ marginLeft: 6, background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}
                >
                  {unreadMentions.length}
                </span>
              )}
            </span>
            {unreadMentions.length > 0 && (
              <button
                type="button"
                onClick={() => onMarkAllRead(mentions.map((m) => m.id))}
                style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontSize: 11, padding: 0 }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          {mentions.map((m) => {
            const unread = !readIds.has(m.id);
            return (
              <Link
                className="item"
                key={m.id}
                to={`/demandas?task=${m.task_id}&focus=comments`}
                onClick={() => {
                  onMarkRead(m.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  background: unread ? 'var(--accent-dim)' : undefined,
                  fontWeight: unread ? 600 : 400,
                  opacity: unread ? 1 : 0.62,
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
                    background: unread ? 'var(--accent)' : 'transparent',
                    border: unread ? 'none' : '1px solid var(--border)',
                  }}
                />
                <span style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  <span style={{ display: 'block' }}>
                    <b>{m.author?.name ?? 'Alguém'}</b> te marcou em “{trunc(m.task?.title ?? 'uma demanda', 42)}”
                  </span>
                  {m.body && (
                    <span style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 400, marginTop: 2 }}>
                      {trunc(m.body, 90)}
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
