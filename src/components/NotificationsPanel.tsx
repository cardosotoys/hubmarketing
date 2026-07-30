import { Link } from 'react-router-dom';
import type { ActivityWithActor, MentionRow } from '../hooks/useNotifications';

export default function NotificationsPanel({
  mentions,
  recent,
  onClose,
}: {
  mentions: MentionRow[];
  recent: ActivityWithActor[];
  onClose: () => void;
}) {
  return (
    <div className="notif-panel">
      {mentions.length > 0 && (
        <>
          <div className="head">Menções pra você</div>
          {mentions.map((m) => (
            <Link className="item" key={m.id} to={`/demandas?task=${m.task_id}&focus=comments`} onClick={onClose}>
              <b>{m.author?.name ?? 'Alguém'}</b> te marcou em "{m.task?.title ?? 'uma demanda'}": {m.body}
            </Link>
          ))}
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
