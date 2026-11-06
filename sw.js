// Forge service worker: makes Forge installable and opens instantly from the home screen.
// Always tries the network first, so you get the latest version; falls back to the last copy if offline.
const CACHE = 'forge-shell-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || new URL(req.url).pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('/', copy)); return r; }).catch(() => caches.match('/')));
  }
});
