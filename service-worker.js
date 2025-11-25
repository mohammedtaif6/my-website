const CACHE_NAME = 'okcomputer-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/subscribers.html',
  '/debts.html',
  '/payments.html',
  '/expenses.html',
  '/expired.html',
  '/expiring.html',
  '/reports.html',
  '/data-manager.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
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
