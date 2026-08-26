const CACHE_NAME = "nexreaper-ledger-shell-v1";
const SHELL_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    caches.match("/index.html").then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("/"));
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = new URL("/", self.location.origin);
  url.searchParams.set("checkin", "1");

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = clientList.find((entry) => "focus" in entry);

      if (client && "focus" in client) {
        await client.focus();
        client.postMessage({
          type: "notification-click",
          payload: event.notification.data ?? {},
        });
        return;
      }

      await self.clients.openWindow(url.toString());
    })(),
  );
});
