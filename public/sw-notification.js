// Service Worker Notification Click & Push Handler for Mobile and Desktop
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const txId = event.notification.data && event.notification.data.txId;
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and tell it to open the transaction
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (txId) {
            client.postMessage({
              type: 'OPEN_BACKCHARGE_DETAIL',
              txId: txId
            });
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one with the target URL
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Optional background push event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Sistem Backcharge';
    const options = {
      body: data.body || 'Ada update data Backcharge terbaru.',
      icon: data.icon || 'https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q',
      badge: data.badge || 'https://lh3.googleusercontent.com/d/1YdVze2aNGvUIe5J1Ig2_J0MUPGrs2U_q',
      vibrate: [250, 100, 250],
      data: data.data || {},
      tag: data.tag || 'backcharge-alert'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('Failed to show push notification:', e);
  }
});
