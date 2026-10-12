// Retire the old Vue CLI / Workbox worker at its original script URL.
// Keep this file available for users returning with an old registration.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) =>
      Promise.all(clients.map((client) => client.navigate(client.url))),
    ),
  );
});

// No fetch handler: requests use the network and normal HTTP caching.
