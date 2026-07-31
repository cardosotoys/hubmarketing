// Service worker do Cardoso Hub — recebe notificação push com o app fechado/em segundo plano
// (Web Push API) e mantém um cache leve pra abrir offline com os últimos dados vistos. Bump
// CACHE_VERSION quando quiser forçar a limpeza do cache antigo num próximo deploy.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `cardoso-hub-shell-${CACHE_VERSION}`;
const DATA_CACHE = `cardoso-hub-data-${CACHE_VERSION}`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('cardoso-hub-') && key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Cardoso Hub';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Rede primeiro, cache como fallback só quando a rede falha — dado desatualizado é melhor que
// tela em branco, mas nunca "ganha" da rede quando ela está disponível.
async function networkFirst(request, cacheName, fallbackRequest) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackRequest || request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(fallbackRequest || request);
    if (cached) return cached;
    throw new Error('offline sem cache disponível');
  }
}

// Cache primeiro pros estáticos — cada arquivo JS/CSS do build tem hash no nome, então o
// conteúdo nunca muda sob a mesma URL; não tem motivo pra sempre bater na rede antes.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // nunca cacheia escrita — offline, escrita simplesmente falha

  const url = new URL(request.url);

  // Leituras da API do Supabase: cache só serve de fallback pra quando não há rede.
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Navegação (recarregar uma rota da SPA offline): cacheia sempre sob a mesma chave fixa, já que
  // toda rota serve o mesmo index.html (o roteador do React decide a tela depois, no cliente) —
  // sem isso, abrir offline uma rota nunca visitada antes (ex.: link direto) não teria fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, new Request('/index.html')));
    return;
  }

  // Estáticos do próprio Hub (JS/CSS/ícones/manifest).
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});
