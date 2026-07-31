import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ActivityLogEntry, TaskComment } from '../types/database';

export type ActivityWithActor = ActivityLogEntry & { actor: { name: string } | null };
export type MentionRow = TaskComment & { author: { name: string } | null; task: { title: string } | null };

// Dados do painel de notificações — usado pelo Topbar (desktop) e pelo MobileTopBar (celular),
// pra não duplicar a mesma query de menções/atividade em dois lugares.
export function useNotifications(profileId: string | undefined) {
  const [recent, setRecent] = useState<ActivityWithActor[]>([]);
  const [mentions, setMentions] = useState<MentionRow[]>([]);

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

  const loadRecent = useCallback(() => {
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data as ActivityWithActor[] | null) ?? []));
  }, []);

  useEffect(() => {
    loadMentions();
  }, [loadMentions]);

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
        if (mentionedIds.includes(profileId)) loadMentions();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        loadRecent();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, loadMentions, loadRecent]);

  return { mentions, recent, loadRecent };
}
