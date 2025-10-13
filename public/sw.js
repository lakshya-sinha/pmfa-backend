self.addEventListener('push', function(event) {
  console.log('[sw] Push event received');
  
  let data = {};
  try {
    data = event.data.json();
    console.log('[sw] Push data:', data);
  } catch(e) {
    console.warn('[sw] Push event had no JSON data:', e);
    data = { title: 'Notification', body: event.data ? event.data.text() : 'No content' };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    data: { url: data.url || '/' },
    icon: '/icon-192.png',
    tag: 'playmaker-notification', // Replace duplicate notifications
    renotify: true, // Show each time even with same tag
    requireInteraction: true // Don't auto-hide
  };

  console.log('[sw] Showing notification:', { title, options });

  event.waitUntil(
    (async () => {
      try {
        // Guard: only show notification if permission was granted
        if (Notification.permission === 'granted') {
          const notification = await self.registration.showNotification(title, options);
          console.log('[sw] Notification shown successfully');
          return notification;
        } else {
          console.warn('[sw] Notification permission not granted:', Notification.permission);
        }
      } catch (err) {
        console.error('[sw] Error showing notification:', err);
      }
    })()
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then( windowClients => {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});