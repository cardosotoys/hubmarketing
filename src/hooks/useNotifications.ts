import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ActivityLogEntry, TaskComment } from '../types/database';

export type ActivityWithActor = ActivityLogEntry & { actor: { name: string } | null };
export type MentionRow = TaskComment & { author: { name: string } | null; task: { title: string } | null };

const SEEN_KEY_PREFIX = 'notif-seen-at:';
const EPOCH = '1970-01-01T00:00:00.000Z';

// Dados do painel de notificações — usado pelo Topbar (desktop) e pelo MobileTopBar (celular),
// pra não duplicar a mesma query de menções/atividade em dois lugares.
export function useNotifications(profileId: string | undefined) {
  const [recent, setRecent] = useState<ActivityWithActor[]>([]);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const seenKey = profileId ? `${SEEN_KEY_PREFIX}${profileId}` : null;

  const loadMentions = useCallback(() => {
    if (!profileId) return;
    supabase
      .from('task_comments')
      .select('*, author:profiles(name), task:tasks(title)')
      .contains('mentioned_ids', [profileId])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setMentions((data as MentionRow[] | null) ?? []));
  }, [profileId]);

  // Contagem separada da lista de exibição (que só traz as 5 últimas) — sem isso, quem acumula
  // mais de 5 menções sem abrir o sino veria sempre "5" em vez da quantidade real.
  const loadUnreadCount = useCallback(() => {
    if (!profileId || !seenKey) return;
    const lastSeen = localStorage.getItem(seenKey) ?? EPOCH;
    supabase
      .from('task_comments')
      .select('id', { count: 'exact', head: true })
      .contains('mentioned_ids', [profileId])
      .gt('created_at', lastSeen)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [profileId, seenKey]);

  const loadRecent = useCallback(() => {
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data as ActivityWithActor[] | null) ?? []));
  }, []);

  // Chamado quando o sino é aberto — some com a bolinha na hora (não espera round-trip) e marca
  // "visto até agora" pra guardar de verdade (sobrevive a fechar e reabrir o painel).
  const markSeen = useCallback(() => {
    if (!seenKey) return;
    localStorage.setItem(seenKey, new Date().toISOString());
    setUnreadCount(0);
  }, [seenKey]);

  useEffect(() => {
    loadMentions();
    loadUnreadCount();
  }, [loadMentions, loadUnreadCount]);

  // Tempo real: sem isso, o sino só atualizava ao abrir o painel ou dar F5 — uma menção ou
  // atividade nova de outra pessoa nunca aparecia sozinha. Reconsulta em vez de tentar montar a
  // linha (com autor/tarefa já unidos) a partir do payload cru do Realtime, que só traz a tabela
  // base — mais simples e sempre consistente com o que a tela mostraria num F5.
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments' }, (payload) => {
        const mentionedIds = (payload.new as { mentioned_ids?: string[] }).mentioned_ids ?? [];
        if (mentionedIds.includes(profileId)) {
          loadMentions();
          loadUnreadCount();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        loadRecent();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, loadMentions, loadRecent, loadUnreadCount]);

  return { mentions, recent, unreadCount, loadRecent, markSeen };
}
