// PIXICO Barber — Service Worker (v1)
// Estratégia conservadora: cache estáticos, network-first para dinâmicos

const CACHE_NAME = 'pixico-v1';

// Assets estáticos para cache-first
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// Padrões que NUNCA devem ser cacheados
const NO_CACHE_PATTERNS = [
  /supabase/,           // API Supabase
  /\.supabase\./,       // Supabase domains
  /\/auth\//,           // Auth endpoints
  /\/rest\/v1\//,       // Supabase REST
  /\/storage\//,        // Supabase Storage
  /\/realtime\//,       // Supabase Realtime
];

// Install: pre-cachear assets estáticos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: limpar caches antigos + tomar controle imediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignorar requests não-GET (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') return;

  // 2. Nunca cachear APIs / dados dinâmicos / Supabase
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(url.href))) return;

  // 3. Nunca cachear requests com Authorization header
  if (request.headers.get('Authorization')) return;

  // 4. Navegação SPA: network-first com fallback para index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 5. Fontes Google: cache-first (raramente mudam)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 6. Assets estáticos do app (JS, CSS, imagens locais): stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          // Só cachear respostas válidas
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});
