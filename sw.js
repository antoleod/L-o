const PRECACHE = 'leo-precache-v1';
const RUNTIME = 'leo-runtime-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/firebase_reports.js',
  './js/remote_reports.js',
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
  if(event.request.method !== 'GET'){
    return;
  }

  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(match => match || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached){
        return cached;
      }
      return fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          if(event.request.destination === 'image'){
            return caches.match('./img/baby.jpg');
          }
          return cached || Response.error();
        });
    })
  );
});
