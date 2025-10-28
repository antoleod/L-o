const CACHE_VERSION = 'v3';
const PRECACHE = `leo-precache-${CACHE_VERSION}`;
const RUNTIME = `leo-runtime-${CACHE_VERSION}`;

// Lista de recursos esenciales para el funcionamiento offline inicial.
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/persistence.js',
  './js/firebase-core.js',
  './img/baby.jpg',
  './img/baby1.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(error => {
        console.error('Precaching failed:', error);
      }))
      .then(self.skipWaiting)
  );
});

self.addEventListener('activate', event => {
  const currentCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => !currentCaches.includes(cacheName))
          .map(cacheToDelete => caches.delete(cacheToDelete))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Ignorar peticiones que no son GET o no son HTTP/HTTPS.
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Estrategia Network-First para peticiones de navegación (HTML).
  // Asegura que el usuario siempre obtenga la última versión de la página si hay conexión.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch (error) {
        // Si la red falla, sirve la página principal desde la caché.
        console.log('Network request for navigation failed, serving from cache.', error);
        const cache = await caches.open(PRECACHE);
        return await cache.match('./index.html');
      }
    })());
    return;
  }

  // Estrategia Stale-While-Revalidate para assets principales (CSS, JS).
  // Sirve desde la caché para velocidad, y actualiza en segundo plano.
  if (PRECACHE_URLS.some(url => request.url.endsWith(url.substring(1)))) {
    event.respondWith((async () => {
      const cache = await caches.open(PRECACHE);
      const cachedResponse = await cache.match(request);

      const fetchedResponsePromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(err => {
        console.warn(`Fetch failed for ${request.url}, using cache.`, err);
        // Si la red falla y no hay nada en caché, este error se propagará.
        // Si hay algo en caché, ya lo habremos devuelto.
      });

      return cachedResponse || fetchedResponsePromise;
    })());
    return;
  }

  // Estrategia Cache-First para otros recursos (imágenes de runtime, fuentes, etc.).
  // Si está en caché, se sirve desde ahí. Si no, se pide a la red y se guarda.
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      console.error(`Fetch and cache failed for ${request.url}`, error);
      // Opcional: devolver una imagen o respuesta genérica de fallback.
    }
  })());
});
