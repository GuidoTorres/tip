const CACHE_NAME = "tipme-shell-v1";
const SHELL = ["/", "/offline", "/icons/icon-192.png", "/icons/badge-96.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(event.request)) || (await caches.match("/offline"))));
});

self.addEventListener("push", (event) => {
  let payload = { title: "TipMe", body: "Tienes una nueva notificación.", url: "/dashboard", tag: "tipme" };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  event.waitUntil((async () => {
    if (self.registration.setAppBadge) {
      try { await self.registration.setAppBadge(); } catch {}
    }
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/badge-96.png",
      tag: payload.tag,
      data: { url: payload.url || "/dashboard" },
      renotify: false,
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});

