import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';
import type { Notification } from '../types/database';

type Row = Notification & { actor: { name: string } | null };
const trunc = (s: string, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
};

export default function Notificacoes() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<'todas' | 'nao_lidas'>('todas');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(name)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(300);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // tempo real: nova notificação entra sozinha
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel(`notif-page-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile?.id, load]);

  async function markRead(id: string, read = true) {
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
    await supabase.from('notifications').update({ read }).eq('id', id);
  }
  async function markAllRead() {
    if (!profile?.id) return;
    setRows((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
  }
  async function del(id: string) {
    setRows((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  }
  function open(n: Row) {
    if (!n.read) markRead(n.id);
    if (n.task_id) navigate(`/demandas?task=${n.task_id}&focus=comments`);
    else if (n.project_id) navigate(`/projetos/${n.project_id}`);
  }

  const unread = rows.filter((n) => !n.read).length;
  const visible = filter === 'nao_lidas' ? rows.filter((n) => !n.read) : rows;

  return (
    <div className="page">
      <h1 className="page-title">Notificações</h1>
      <div className="page-sub">
        Central de notificações — menções, prazos e aprovações. Todos os tipos ativos. Clique numa notificação para
        abrir a demanda.
      </div>

      <div className="section-head">
        <h2>
          {rows.length} no total{unread > 0 ? ` · ${unread} não lidas` : ''}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="group-toggle">
            {(
              [
                ['todas', 'Todas'],
                ['nao_lidas', 'Não lidas'],
              ] as ['todas' | 'nao_lidas', string][]
            ).map(([key, label]) => (
              <div key={key} className={`filter-chip${filter === key ? ' active' : ''}`} onClick={() => setFilter(key)}>
                {label}
              </div>
            ))}
          </div>
          {unread > 0 && (
            <button className="btn ghost sm" onClick={markAllRead}>
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState icon="🔔" title={filter === 'nao_lidas' ? 'Nenhuma não lida' : 'Nenhuma notificação'} hint="Quando você for mencionado ou tiver aprovações/prazos, aparece aqui." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((n) => (
            <div
              key={n.id}
              className="panel"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                background: n.read ? undefined : 'var(--accent-dim)',
              }}
              onClick={() => open(n)}
            >
              <span
                aria-hidden
                style={{
                  marginTop: 5,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: n.read ? 'transparent' : 'var(--accent)',
                  border: n.read ? '1px solid var(--border)' : 'none',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: n.read ? 400 : 600, overflowWrap: 'anywhere' }}>
                  <b>{n.actor?.name ?? 'Alguém'}</b> te marcou em “{trunc(n.title || 'uma demanda', 60)}”
                </div>
                {n.body && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2, overflowWrap: 'anywhere' }}>{trunc(n.body, 160)}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
                  {new Date(n.created_at).toLocaleString('pt-BR')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                {!n.read && (
                  <button className="btn ghost sm" title="Marcar como lida" onClick={() => markRead(n.id)}>
                    ✓
                  </button>
                )}
                {n.read && (
                  <button className="btn ghost sm" title="Marcar como não lida" onClick={() => markRead(n.id, false)}>
                    ○
                  </button>
                )}
                <button className="btn ghost sm" style={{ color: 'var(--red)' }} title="Excluir" onClick={() => del(n.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
