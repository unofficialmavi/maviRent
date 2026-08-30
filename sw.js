```javascript
/* =========================================================
   MAVRENT SERVICE WORKER
   V14.2 STABLE
   ========================================================= */

const CACHE_NAME = "mavrent-v14-2";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => {

        return cache.addAll(APP_FILES);

      })

      .catch(error => {

        console.error(
          "MavRent cache installation error:",
          error
        );

      })

  );

  self.skipWaiting();

});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()

      .then(cacheNames => {

        return Promise.all(

          cacheNames

            .filter(name => {

              return (
                name.startsWith("mavrent-") &&
                name !== CACHE_NAME
              );

            })

            .map(name => {

              return caches.delete(name);

            })

        );

      })

      .then(() => {

        return self.clients.claim();

      })

  );

});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", event => {

  const request = event.request;

  /* Only handle GET requests */

  if (request.method !== "GET") {
    return;
  }

  /*
     IMPORTANT:
     Supabase, APIs and external services should go
     directly to the internet.

     The service worker mainly protects the MavRent
     application shell.
  */

  const url = new URL(request.url);

  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("jsdelivr.net") ||
    url.hostname !== self.location.hostname
  ) {

    return;

  }


  event.respondWith(

    fetch(request)

      .then(response => {

        /*
           Save successful application responses
           in the cache.
        */

        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {

          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {

              cache.put(request, copy);

            });

        }

        return response;

      })

      .catch(() => {

        /*
           If internet is unavailable,
           use the cached version.
        */

        return caches.match(request)

          .then(cachedResponse => {

            if (cachedResponse) {

              return cachedResponse;

            }

            /*
               For navigation requests, return
               the cached index.html.
            */

            if (request.mode === "navigate") {

              return caches.match("./index.html");

            }

            return new Response(
              "MavRent is currently offline.",
              {
                status: 503,
                headers: {
                  "Content-Type":
                    "text/plain; charset=utf-8"
                }
              }
            );

          });

      })

  );

});


/* =========================================================
   MESSAGE
   ========================================================= */

self.addEventListener("message", event => {

  if (!event.data) {
    return;
  }

  if (event.data.type === "SKIP_WAITING") {

    self.skipWaiting();

  }

});


/* =========================================================
   PUSH NOTIFICATIONS
   ========================================================= */

self.addEventListener("push", event => {

  let data = {};

  try {

    data = event.data
      ? event.data.json()
      : {};

  } catch (error) {

    data = {
      title: "MavRent",
      body: event.data
        ? event.data.text()
        : "You have a new notification."
    };

  }


  const title =
    data.title ||
    "MavRent";

  const options = {

    body:
      data.body ||
      "You have a new MavRent notification.",

    icon:
      data.icon ||
      "./icon-192.png",

    badge:
      data.badge ||
      "./icon-192.png",

    tag:
      data.tag ||
      "mavrent-notification",

    renotify: true,

    requireInteraction:
      Boolean(data.requireInteraction),

    data: {

      url:
        data.url ||
        "./"

    }

  };


  event.waitUntil(

    self.registration.showNotification(
      title,
      options
    )

  );

});


/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();

    const targetUrl =
      event.notification.data &&
      event.notification.data.url
        ? event.notification.data.url
        : "./";


    event.waitUntil(

      clients.matchAll({
        type: "window",
        includeUncontrolled: true
      })

      .then(clientList => {

        /*
           If MavRent is already open,
           focus it instead of opening another copy.
        */

        for (const client of clientList) {

          if (
            "focus" in client &&
            client.url.includes(
              self.location.origin
            )
          ) {

            return client.focus();

          }

        }


        /*
           Otherwise open MavRent.
        */

        if (clients.openWindow) {

          return clients.openWindow(
            new URL(
              targetUrl,
              self.location.origin
            ).href
          );

        }

      })

    );

  }
);
```
