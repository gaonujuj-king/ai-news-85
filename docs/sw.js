// Password-protected builds must never retain briefing pages in an offline cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => ['learning-wave-v1', 'ai-insight-daily-v1'].includes(key)).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => event.respondWith(fetch(event.request)));
