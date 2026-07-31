import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const isPushSupported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

// Chave pública VAPID vem em base64url — PushManager.subscribe() exige Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

export async function registerServiceWorker(): Promise<void> {
  if (!isPushSupported) return;
  await navigator.serviceWorker.register('/sw.js');
}

export async function getPushSubscriptionState(): Promise<'unsupported' | 'subscribed' | 'not-subscribed'> {
  if (!isPushSupported) return 'unsupported';
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'not-subscribed';
}

export async function subscribeToPush(profileId: string): Promise<void> {
  if (!isPushSupported || !VAPID_PUBLIC_KEY) {
    throw new Error('Notificações push não suportadas ou não configuradas neste ambiente.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão de notificação negada.');
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const json = subscription.toJSON();
  await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profileId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: 'endpoint' }
  );
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}
