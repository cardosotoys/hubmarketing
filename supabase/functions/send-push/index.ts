// Cardoso Marketing Hub — envio de notificação push (Web Push API)
//
// Chamada pelo trigger `notify_push_on_mention` (migration 0035) sempre que alguém é mencionado
// num comentário de tarefa — o mesmo mecanismo de pg_net→Edge Function já usado pelo mpm-sync,
// só que disparado por um INSERT em vez de um agendamento cron. Escopo deliberadamente restrito
// a menções (não a toda `activity_log`): push é pra avisar "alguém te chamou" com o app fechado,
// não pra replicar o feed de atividade da equipe inteira como notificação do sistema.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@cardosotoys.com.br';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PushBody {
  mentioned_ids: string[];
  comment_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { mentioned_ids: mentionedIds, comment_id: commentId } = (await req.json()) as PushBody;

  if (!mentionedIds?.length) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no mentioned_ids' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: comment } = await supabase
    .from('task_comments')
    .select('body, author:profiles(name), task:tasks(title)')
    .eq('id', commentId)
    .maybeSingle<{ body: string; author: { name: string } | null; task: { title: string } | null }>();

  const authorName = comment?.author?.name ?? 'Alguém';
  const taskTitle = comment?.task?.title ?? 'uma tarefa';
  const title = `${authorName} mencionou você`;
  const body = comment?.body ? `${taskTitle}: ${comment.body.slice(0, 120)}` : taskTitle;

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('profile_id', mentionedIds);

  const payload = JSON.stringify({ title, body, url: '/demandas' });
  let sent = 0;
  const expiredIds: string[] = [];

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  }

  return new Response(JSON.stringify({ ok: true, sent, pruned: expiredIds.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
