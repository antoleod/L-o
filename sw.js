const PRECACHE = 'leo-precache-v1';
const RUNTIME = 'leo-runtime-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js', // Assuming this is the correct sync script
  './js/firebase_reports.js', // Assuming this is the correct sync script
  './img/baby.jpg',
  './img/baby1.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== PRECACHE && key !== RUNTIME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Solo interceptar peticiones HTTP/HTTPS. Ignorar otras (ej. chrome-extension://)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Estrategia Network-first para peticiones de navegación (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          // Solo cachear respuestas válidas
          if (response && response.status === 200) {
            caches.open(RUNTIME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Si la red falla, servir index.html desde el caché
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Estrategia Cache-first para otros assets (CSS, JS, Imágenes)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then(response => {
        // Solo cachear respuestas válidas y de nuestro propio origen.
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(RUNTIME).then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      }).catch(() => {
        // If both cache and network fail for an image, return a fallback image.
        if (event.request.destination === 'image') {
          return caches.match('./img/baby.jpg');
        }
      });
    })
  );
});
