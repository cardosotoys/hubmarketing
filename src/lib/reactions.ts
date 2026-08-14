import { supabase } from './supabaseClient';

// Curtidas de comentário — genéricas p/ qualquer superfície do hub (source: 'task' | 'social_plan').
export type ReactionInfo = { count: number; mine: boolean };
export type ReactionMap = Map<string, ReactionInfo>;

export async function fetchReactions(source: string, commentIds: string[], meId?: string | null): Promise<ReactionMap> {
  const map: ReactionMap = new Map();
  if (!commentIds.length) return map;
  const { data } = await supabase
    .from('comment_reactions')
    .select('comment_id, user_id')
    .eq('source', source)
    .in('comment_id', commentIds);
  for (const r of (data as { comment_id: string; user_id: string }[] | null) ?? []) {
    const e = map.get(r.comment_id) ?? { count: 0, mine: false };
    e.count += 1;
    if (meId && r.user_id === meId) e.mine = true;
    map.set(r.comment_id, e);
  }
  return map;
}

export async function toggleReaction(source: string, commentId: string, userId: string, liked: boolean) {
  if (liked) {
    await supabase
      .from('comment_reactions')
      .delete()
      .eq('source', source)
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .eq('emoji', '👍');
  } else {
    await supabase.from('comment_reactions').insert({ source, comment_id: commentId, user_id: userId, emoji: '👍' });
  }
}
