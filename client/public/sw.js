// Miss Sensuelle Admin Service Worker v3 (Web Push + Authentic Sounds)
const CACHE_NAME = "ms-admin-v3";
const PRECACHE_URLS = [
  "/admin",
  "/manifest.json",
  "/admin-pwa-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/sounds/shopify-chaching.mp3",
  "/sounds/cash-register-vintage.mp3",
  "/sounds/alert-urgent.wav",
  "/sounds/victory-delivered.wav"
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

// Handle push notifications in background / sleep mode
self.addEventListener("push", (event) => {
  let data = {
    title: "🛍️ Nouvelle Commande Reçue ! 💰",
    body: "Une nouvelle commande vient d'arriver sur Miss Sensuelle.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    url: "/admin",
    type: "new_order"
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

  // Set distinct vibration pattern based on urgency
  let vibratePattern = [120, 50, 220, 40, 180]; // Shopify cha-ching pattern
  let requireInteraction = false;

  if (data.type === "urgent_alert") {
    vibratePattern = [280, 90, 280, 90, 450]; // Siren pulse
    requireInteraction = true;
  } else if (data.type === "victory") {
    vibratePattern = [150, 80, 150, 80, 300]; // Victory pulse
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-192x192.png",
    vibrate: vibratePattern,
    tag: data.tag || `ms-${data.type || "notif"}-${Date.now()}`,
    renotify: true,
    requireInteraction,
    data: {
      url: data.url || "/admin",
      type: data.type,
      sound: data.data?.sound || (data.type === "urgent_alert" ? "/sounds/alert-urgent.wav" : data.type === "victory" ? "/sounds/victory-delivered.wav" : "/sounds/shopify-chaching.mp3")
    }
  };

  // Broadcast to all open client windows to trigger audio playback if available
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({
        type: "PUSH_NOTIFICATION_RECEIVED",
        payload: data
      });
    }
  });

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
          client.postMessage({
            type: "NOTIFICATION_CLICKED",
            data: event.notification.data
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
