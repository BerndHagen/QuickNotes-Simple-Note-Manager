const CACHE_NAME = 'quicknotes-v2';
const STATIC_ASSETS = [
  '/QuickNotes-Simple-Note-Manager/',
  '/QuickNotes-Simple-Note-Manager/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (!event.request.url.startsWith(self.location.origin)) return;

  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Ensure text-based responses have proper UTF-8 charset
        const contentType = response.headers.get('content-type') || '';
        const isTextType = contentType.match(/^(text\/|application\/javascript|application\/json)/);
        
        let responseToCache = response;
        if (isTextType && !contentType.includes('charset')) {
          const headers = new Headers(response.headers);
          headers.set('content-type', contentType + '; charset=utf-8');
          responseToCache = new Response(response.clone().body, {
            status: response.status,
            statusText: response.statusText,
            headers: headers
          });
        }
        
        const responseClone = responseToCache.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return responseToCache;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          if (event.request.mode === 'navigate') {
            return caches.match('/QuickNotes-Simple-Note-Manager/');
          }
          
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

/**
 * Handles background sync for notes when the app comes back online.
 * The actual sync logic is managed by the main application thread.
 */
async function syncNotes() {
  // Background sync is handled by the main app via the store's syncWithBackend()
}
