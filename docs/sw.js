// Password-protected builds must never retain briefing pages in an offline cache.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  const legacy = keys.filter(key => ['learning-wave-v1', 'ai-insight-daily-v1'].includes(key));
  await Promise.all(legacy.map(key => caches.delete(key)));
  await self.clients.claim();
  // Old cached HTML has no controllerchange handler. Replace that page once.
  if (legacy.length) {
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.allSettled(windows.filter(client => client.url.startsWith(self.registration.scope)).map(client => client.navigate(client.url)));
  }
})()));
self.addEventListener('fetch', event => event.respondWith(fetch(event.request, { cache: 'no-store' })));
