// Service Worker — Event page PWA (cache-first for offline)
var CACHE = 'event-v1';
var URLS = [
    '/event.html',
    '/favicon.svg',
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@300;400;500&display=swap',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
    'https://res.cloudinary.com/dniurvpzd/image/upload/v1769084034/Clarisse_Surin_image_hero_jm89nm.webp'
];

self.addEventListener('install', function(e) {
    e.waitUntil(caches.open(CACHE).then(function(cache) { return cache.addAll(URLS); }));
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
    e.respondWith(
        caches.match(e.request).then(function(r) { return r || fetch(e.request); })
    );
});
