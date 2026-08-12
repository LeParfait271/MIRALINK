const CACHE = 'miralink-shell-1.7.0-ui12';
const ASSETS = [
  './', './index.html', './styles.css', './src/app.js', './src/protocol.js',
  './src/storage.js', './src/i18n.js', './src/dualsense.js', './src/input-mapping.js', './src/emergency-mode.js', './src/hid-transport.js',
  './src/compatibility.js', './src/diagnostics.js', './src/action-guard.js', './src/session-recorder.js',
  './src/health-analysis.js', './manifest.webmanifest', './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
