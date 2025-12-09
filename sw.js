// Service Worker for Offline Support & Speed
const CACHE_NAME = 'ok-computer-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/subscribers.html',
    '/debts.html',
    '/payments.html',
    '/reports.html',
    '/expired.html',
    '/expiring.html',
    '/style.css',
    '/data-manager.js'
];

// التثبيت: تخزين الملفات في الكاش
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 تم تخزين الملفات محلياً');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// التفعيل: حذف الكاش القديم
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ حذف الكاش القديم:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// استراتيجية: Network First مع Fallback للكاش
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // حفظ النسخة الجديدة في الكاش
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // في حالة عدم وجود إنترنت، استخدم الكاش
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    // إذا لم يكن في الكاش، أرجع صفحة خطأ بسيطة
                    return new Response('النظام يعمل بدون إنترنت حالياً', {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                });
            })
    );
});
