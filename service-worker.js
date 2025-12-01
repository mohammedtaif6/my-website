const CACHE_NAME = 'okcomputer-v4.0-GOLDEN'; // رقم إصدار جديد
const urlsToCache = [
  './',
  './index.html',
  './subscribers.html',
  './debts.html',
  './payments.html',
  './expenses.html',
  './reports.html',
  './style.css',
  './data-manager.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // التفعيل الفوري
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // الشبكة أولاً دائماً لضمان البيانات الطازجة
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
