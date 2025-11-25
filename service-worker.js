const CACHE_NAME = 'okcomputer-v2.0';
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
  './cache-manager.js',
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
          // حذف الكاشات القديمة
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// معالجة الطلبات
self.addEventListener('fetch', event => {
  // تخطي طلبات API والملفات الكبيرة
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(response => {
        // لا تخزن الطلبات غير الناجحة
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache).catch(() => {
            // تجاهل أخطاء التخزين المؤقت
          });
        });

        return response;
      }).catch(() => {
        // إرجاع صفحة من الكاش عند فشل الاتصال
        return caches.match(event.request);
      });
    })
  );
});
