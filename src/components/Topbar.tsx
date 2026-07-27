import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { ActivityLogEntry } from '../types/database';

type ActivityWithActor = ActivityLogEntry & { actor: { name: string } | null };

export default function Topbar({ breadcrumb }: { breadcrumb: string }) {
  const { profile } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [recent, setRecent] = useState<ActivityWithActor[]>([]);

  useEffect(() => {
    if (!showNotif) return;
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data as ActivityWithActor[] | null) ?? []));
  }, [showNotif]);

  return (
    <div className="topbar">
      <div className="breadcrumb">
        <b>{breadcrumb}</b>
      </div>
      <div className="search-bar" title="Busca global — chega numa próxima fase">
        <span>⌕</span>
        <span>Pesquisar projetos, produtos, pessoas…</span>
        <kbd>⌘K</kbd>
      </div>
      <div className="topbar-right">
        <Link className="icon-btn" to="/demandas">
          ☰
        </Link>
        <div className="icon-btn" onClick={() => setShowNotif((s) => !s)}>
          🔔
          <span className="pip"></span>
        </div>
        <Link className="user-chip" to="/perfil">
          <div className="avatar">{profile?.avatar_initials ?? '··'}</div>
          <span>{profile?.name ?? '…'}</span>
        </Link>
      </div>

      {showNotif && (
        <div className="notif-panel">
          <div className="head">Atividade recente</div>
          {recent.length === 0 && <div className="item">Nada por aqui ainda.</div>}
          {recent.map((r) => (
            <div className="item" key={r.id}>
              <b>{r.actor?.name ?? 'Alguém'}</b> {r.action_text}
              {r.detail ? ` — ${r.detail}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
