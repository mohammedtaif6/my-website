const CACHE_NAME = 'okcomputer-v1.0.1';
const urlsToCache = [
  './',
  './index.html',
  './subscribers.html',
  './debts.html',
  './payments.html',
  './expenses.html',
  './expired.html',
  './expiring.html',
  './reports.html',
  './data-manager.js',
  './manifest.json'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        // تجاهل أخطاء التخزين المؤقت
      });
    })
  );
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// معالجة الطلبات - استراتيجية Network First للملفات الديناميكية
self.addEventListener('fetch', event => {
  // تخطي طلبات API والملفات الكبيرة
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // للملفات HTML - استخدم Network First
  if (event.request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  } else {
    // للموارد الأخرى - استخدم Cache First
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache).catch(() => {});
          });

          return response;
        }).catch(() => {
          return caches.match(event.request);
        });
      })
    );
  }
});
