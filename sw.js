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
  // Ignore non-GET requests and requests to other origins (like chrome-extension://)
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(match => {
            // For navigation, if network fails, serve index.html from cache.
            if (event.request.mode === 'navigate') {
              return match || caches.match('./index.html');
            }
            return match;
          });
        })
    );
    return;
  }

  // For other assets (CSS, JS, Images), use a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        return caches.open(RUNTIME).then(cache => {
          // Cache the new resource and return it
          cache.put(event.request, response.clone());
          return response;
        });
      }).catch(() => {
        // If both cache and network fail for an image, return a fallback image.
        if (event.request.destination === 'image') {
          return caches.match('./img/baby.jpg');
        }
      });
    })
  );
});
