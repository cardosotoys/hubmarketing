import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ActivityLogEntry, Notification } from '../types/database';

export type ActivityWithActor = ActivityLogEntry & { actor: { name: string } | null };
export type NotificationRow = Notification & { actor: { name: string } | null };

// Central de notificações — usada pelo Topbar (desktop) e pelo MobileTopBar (celular). Agora
// persistida no banco (public.notifications): lida/não-lida vale em qualquer aparelho e não some
// depois de X dias. As menções entram por trigger; a "atividade recente" segue do activity_log.
export function useNotifications(profileId: string | undefined) {
  const [recent, setRecent] = useState<ActivityWithActor[]>([]);
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
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data as ActivityWithActor[] | null) ?? []));
  }, []);

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
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profileId}` },
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
