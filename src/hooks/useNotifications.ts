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

  useEffect(() => {
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

  return { mentions, recent, loadRecent };
}
