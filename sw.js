/* =========================================================
   Nexreaper Ledger — service worker (sw.js)

   1. Notifications  (PRD §10 bug #1): showing notifications from the
      service worker is the reliable path on Android/Chrome — it works
      even when the page is backgrounded. Clicking a check-in
      notification focuses the app and tells it to open the check-in
      modal (postMessage {type:'checkin-open'}), or opens
      ?checkin=1 if no window is open (the app reacts on load).
   2. Offline shell: caches the app files + CDN assets (Tailwind,
      Google Fonts) so the app keeps working after the first load
      (PRD §2 / §5). Same-origin is network-first (edits show up),
      CDN is cache-first (offline friendly).
   ========================================================= */

const CACHE_NAME = 'nexreaper-ledger-v2';
const SHELL_URLS = ['./', './index.html', './css/styles.css', './js/app.js', './icons/icon-192.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      return self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Network-first for our own files so updates land; cache is the
    // offline fallback.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()),
          ),
        ),
    );
  } else if (['style', 'script', 'font', 'image'].includes(req.destination)) {
    // Cache-first for CDN assets (Tailwind, Google Fonts).
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => undefined);
            return res;
          }),
      ),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const data = event.notification.data || {};
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clientList.find((c) => 'focus' in c);

      if (client) {
        await client.focus();
        if ('postMessage' in client && data.kind === 'checkin') {
          client.postMessage({ type: 'checkin-open' });
        }
        return;
      }

      const openUrl = new URL('./', self.location.origin);
      if (data.kind === 'checkin') openUrl.searchParams.set('checkin', '1');
      await self.clients.openWindow(openUrl.toString());
    })(),
  );
});

// The page can ask the worker to show a notification directly.
self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'nl-notify') {
    self.registration
      .showNotification(d.title || 'Nexreaper Ledger', {
        body: d.body || '',
        tag: d.tag || undefined,
        icon: 'icons/icon-192.svg',
        data: { kind: d.kind || 'test' },
      })
      .catch(() => undefined);
  }
});
