// Atlas browser notifications (27 October 2026). This worker only shows pushes and opens Atlas on a tap:
// it has no fetch handler, caches nothing and never changes how pages load. Registered by app/push-toggle.tsx
// only after the customer turns notifications on.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { message = { title: 'Atlas', body: event.data ? event.data.text() : '' }; }
  const url = typeof message.url === 'string' && message.url.startsWith('/') ? message.url : '/notifications';
  event.waitUntil(self.registration.showNotification(message.title || 'Atlas', {
    body: message.body || '',
    tag: message.tag,
    icon: message.icon || '/icon-192.png',
    badge: '/icon-192.png',
    lang: 'ru',
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data && event.notification.data.url || '/notifications', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    // An open Atlas tab goes to the order; otherwise a new one opens there.
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) return client.navigate(target).then((page) => (page || client).focus());
    }
    return self.clients.openWindow(target);
  }));
});
