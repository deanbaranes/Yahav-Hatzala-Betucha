self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'התראה ממערכת יהב';
      const body = data.body || 'יש לך עדכון חדש';
      
      event.waitUntil(
        self.registration.showNotification(title, {
          body: body
        })
      );
    } catch (e) {
      console.error('Push parse error:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === event.notification.data && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data);
      }
    })
  );
});

// Empty fetch handler to satisfy Chrome PWA installability criteria
self.addEventListener('fetch', function(event) {
  // Do nothing, let the browser handle requests normally
});
