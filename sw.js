/* =========================================================
   MAVRENT SERVICE WORKER
   V14.5 - PUSH NOTIFICATIONS + OFFLINE SUPPORT
   ========================================================= */

const CACHE_NAME = "mavrent-v14-5";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png"
];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_FILES);
      })
      .catch(function (error) {
        console.error("MavRent cache install error:", error);
      })
  );

  self.skipWaiting();
});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", function (event) {

  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {

        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      })
      .catch(function () {
        return caches.match(event.request)
          .then(function (cachedResponse) {

            if (cachedResponse) {
              return cachedResponse;
            }

            return caches.match("./index.html");
          });
      })
  );
});


/* =========================================================
   PUSH NOTIFICATION
   Works when MavRent is closed/backgrounded.
   ========================================================= */

self.addEventListener("push", function (event) {

  let data = {};

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    try {
      data = {
        body: event.data ? event.data.text() : ""
      };
    } catch (e) {
      data = {};
    }
  }


  const title =
    data.title ||
    "MavRent";

  const body =
    data.body ||
    data.message ||
    "You have a new MavRent notification.";

  const icon =
    data.icon ||
    "./icon-192.png";

  const badge =
    data.badge ||
    "./icon-192.png";

  const url =
    data.url ||
    data.click_action ||
    "./";


  const notificationOptions = {
    body: body,

    icon: icon,

    badge: badge,

    tag:
      data.tag ||
      "mavrent-notification",

    renotify: true,

    requireInteraction:
      data.requireInteraction === true,

    data: {
      url: url
    }
  };


  event.waitUntil(
    self.registration.showNotification(
      title,
      notificationOptions
    )
  );

});


/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
  "notificationclick",
  function (event) {

    event.notification.close();

    const notificationData =
      event.notification.data || {};

    const targetUrl =
      notificationData.url ||
      "./";


    event.waitUntil(

      self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      })

      .then(function (clientList) {

        for (const client of clientList) {

          if (
            "focus" in client &&
            client.url.indexOf(self.location.origin) === 0
          ) {

            return client.focus()
              .then(function (focusedClient) {

                if (
                  "navigate" in focusedClient &&
                  targetUrl
                ) {
                  return focusedClient.navigate(targetUrl);
                }

                return focusedClient;
              });

          }
        }


        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

      })

    );

  }
);


/* =========================================================
   NOTIFICATION CLOSE
   ========================================================= */

self.addEventListener(
  "notificationclose",
  function (event) {

    console.log(
      "MavRent notification closed."
    );

  }
);


/* =========================================================
   MESSAGE
   ========================================================= */

self.addEventListener(
  "message",
  function (event) {

    if (!event.data) {
      return;
    }


    if (event.data.type === "SKIP_WAITING") {

      self.skipWaiting();

    }

  }
);
