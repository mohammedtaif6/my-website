// service-worker.js - V10.0 Force Update
const CACHE_NAME = 'okcomputer-v10.0-FINAL';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './data-manager.js',
  './subscribers.html',
  './debts.html',
  './payments.html',
  './expenses.html',
  './reports.html'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // التثبيت الفوري
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // الشبكة أولاً، ثم الكاش (لضمان التحديث دائماً)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
