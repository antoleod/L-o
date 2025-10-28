const PRECACHE = 'leo-precache-v1';
const RUNTIME = 'leo-runtime-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js', // Assuming this is the correct sync script
  './js/persistence.js',
  './js/firebase-core.js',
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

  // Estrategia Stale-While-Revalidate para assets principales (CSS, JS)
  // Sirve desde la caché para velocidad, pero actualiza en segundo plano.
  event.respondWith(
    caches.open(RUNTIME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Si la respuesta es válida, la guardamos en caché para la próxima vez.
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Si la red falla y no hay nada en caché, podría devolverse un fallback.
          if (event.request.destination === 'image') {
            return caches.match('./img/baby.jpg');
          }
        });

        // Devuelve la respuesta de la caché inmediatamente si existe, si no, espera a la red.
        return cachedResponse || fetchPromise;
      })
    })
  );
});
