const CACHE_NAME = 'familab3d-cache-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.svg'
];

// Instalación del Service Worker: Guardar recursos en la caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cachando recursos principales');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación del Service Worker: Limpieza de cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción de peticiones (Estrategia: Cache-First con actualización de caché en segundo plano)
self.addEventListener('fetch', event => {
  // Solo procesar peticiones locales del mismo origen
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Devolver recurso cacheado inmediatamente
            // Pero hacer una petición de red en segundo plano para actualizar la caché
            fetch(event.request)
              .then(networkResponse => {
                if (networkResponse.status === 200) {
                  caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
                }
              })
              .catch(err => console.log('[Service Worker] Falló fetch en segundo plano (probablemente offline)'));
            
            return cachedResponse;
          }
          
          // Si no está en caché, ir a la red
          return fetch(event.request);
        })
    );
  }
});
