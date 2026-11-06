// Miss Sensuelle Admin Service Worker
const CACHE_NAME = "ms-admin-v1";
const PRECACHE_URLS = [
  "/admin",
  "/manifest.json",
  "/admin-pwa-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => undefined);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        );
      })
    ])
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  let data = {
    title: "🛍️ Nouvelle Commande Reçue !",
    body: "Une nouvelle commande vient d'arriver sur Miss Sensuelle.",
    icon: "/admin-pwa-icon.png",
    badge: "/admin-pwa-icon.png",
    url: "/admin"
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/admin-pwa-icon.png",
    badge: data.badge || "/admin-pwa-icon.png",
    vibrate: [200, 100, 200, 100, 400],
    tag: data.tag || "ms-order-notification",
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "/admin"
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click -> open or focus /admin
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/admin") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
