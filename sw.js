const PRECACHE = 'leo-precache-v2';
const RUNTIME = 'leo-runtime-v2';

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
  // Esto fuerza al SW a tomar control inmediato de la página.
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== PRECACHE && key !== RUNTIME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim()) // Tomar control de las páginas abiertas.
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

  // Estrategia Network-first para los assets (JS, CSS, etc.)
  // Intenta obtener de la red primero para tener siempre el código más reciente.
  // Si la red falla, recurre a la caché para que la app funcione offline.
  event.respondWith(
    caches.open(RUNTIME).then(cache => {
      return fetch(event.request)
        .then(networkResponse => {
          // Si la petición a la red es exitosa, la guardamos en caché y la devolvemos.
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Si la red falla, intentamos servir desde la caché.
          return cache.match(event.request);
        });
    })
  );
});
