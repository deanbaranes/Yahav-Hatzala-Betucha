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
      const url = data.url || '/';
      
      event.waitUntil(
        self.registration.showNotification(title, {
          body: body,
          data: url
        })
      );
    } catch (e) {
      console.error('Push parse error:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data || '/', self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there's already a window/tab open with the app
      let targetClient = null;
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        // If exact URL is already open, just focus
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
        targetClient = client; // Store any available window
      }
      
      // If a window is open but not on the exact URL, focus and navigate it
      if (targetClient && 'navigate' in targetClient) {
        targetClient.focus();
        return targetClient.navigate(urlToOpen);
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Empty fetch handler to satisfy Chrome PWA installability criteria
self.addEventListener('fetch', function(event) {
  // Do nothing, let the browser handle requests normally
});
