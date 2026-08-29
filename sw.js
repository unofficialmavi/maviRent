const CACHE_NAME = "MavRent-v17";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

/* =====================================================
   INSTALL
===================================================== */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

/* =====================================================
   FETCH
===================================================== */

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});

/* =====================================================
   PUSH NOTIFICATION
===================================================== */

self.addEventListener("push", event => {
  let data = {
    title: "MavRent Alert",
    body: "You have a new property or rent update.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    url: "./"
  };

  try {
    if (event.data) {
      data = {
        ...data,
        ...event.data.json()
      };
    }
  } catch (error) {
    console.warn("MavRent push data error:", error);
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "./icon-192.png",
      badge: data.badge || "./icon-192.png",
      tag: data.tag || "mavrent-rent-reminder",
      data: {
        url: data.url || "./"
      },
      vibrate: [200, 100, 200],
      requireInteraction: true
    })
  );
});

/* =====================================================
   NOTIFICATION CLICK
===================================================== */

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
