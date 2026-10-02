// PIXICO: offline is informational; private data and API requests are never cached.
const CACHE_NAME = 'pixico-static-v2';
const STATIC_ASSETS = ['/offline.html', '/offline.css', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
});
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pixico-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
        return;
    }
    if (!url.pathname.startsWith('/assets/') && !STATIC_ASSETS.includes(url.pathname)) return;
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(async response => {
        if (response.ok && response.type === 'basic') {
            const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone());
        }
        return response;
    }).catch(() => new Response('Offline', { status: 503 }))));
});
