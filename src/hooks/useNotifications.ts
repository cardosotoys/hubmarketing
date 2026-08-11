import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Notification } from '../types/database';
import { fetchMyActivity, type MyActivityRow } from '../lib/myActivity';

export type ActivityWithActor = MyActivityRow;
export type NotificationRow = Notification & { actor: { name: string } | null };

// Central de notificações — usada pelo Topbar (desktop) e pelo MobileTopBar (celular). Agora
// persistida no banco (public.notifications): lida/não-lida vale em qualquer aparelho e não some
// depois de X dias. As menções entram por trigger; a "atividade recente" é escopada aos SEUS
// projetos/campanhas (o que os outros mexeram no que é seu) — a movimentação global fica só na Auditoria.
export function useNotifications(profileId: string | undefined) {
  const [recent, setRecent] = useState<MyActivityRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(() => {
    if (!profileId) return;
    supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(name)')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const list = (data as NotificationRow[] | null) ?? [];
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
      });
  }, [profileId]);

  const loadRecent = useCallback(() => {
    if (!profileId) {
      setRecent([]);
      return;
    }
    fetchMyActivity(profileId, 8).then((rows) => setRecent(rows));
  }, [profileId]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    if (!profileId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    supabase.from('notifications').update({ read: true }).eq('user_id', profileId).eq('read', false).then(() => {});
  }, [profileId]);

  useEffect(() => {
    loadNotifications();
    loadRecent();
  }, [loadNotifications, loadRecent]);

  // Tempo real: uma notificação nova (menção) ou atividade aparece sozinha, sem F5.
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        'postgres_changes',
        // '*' (INSERT/UPDATE/DELETE) para o contador do sininho ficar em sincronia quando a leitura
        // é marcada na página de Notificações (ou em outro aparelho), não só em notificação nova.
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profileId}` },
        () => loadNotifications(),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => loadRecent())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, loadNotifications, loadRecent]);

  return { notifications, recent, unreadCount, markRead, markAllRead, loadRecent, reload: loadNotifications };
}
