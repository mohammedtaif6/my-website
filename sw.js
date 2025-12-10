<<<<<<< HEAD
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
=======
// Service Worker v2 - Optimized for OK Computer
const CACHE_NAME = 'ok-computer-v2';
const urlsToCache = [
    './',
    './index.html',
    './subscribers.html',
    './debts.html',
    './payments.html',
    './reports.html',
    './expired.html',
    './expiring.html',
    './style.css',
    './data-manager.js'
];

// التثبيت: تخزين الملفات بطريقة آمنة
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 بدء تخزين الملفات...');

            // تخزين كل ملف بشكل منفصل - تجاهل الأخطاء
            return Promise.allSettled(
                urlsToCache.map(url =>
                    cache.add(url).catch(err => {
                        console.log(`⚠️ تعذر تخزين: ${url}`);
                        return null;
                    })
                )
            ).then(() => {
                console.log('✅ تم تخزين الملفات المتاحة');
            });
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
    // تجاهل طلبات Firebase والخطوط الخارجية
    if (event.request.url.includes('firebasestorage') ||
        event.request.url.includes('googleapis') ||
        event.request.url.includes('gstatic')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // حفظ النسخة الجديدة في الكاش
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // في حالة عدم وجود إنترنت، استخدم الكاش
                return caches.match(event.request);
            })
    );
});
>>>>>>> 0864a6a (Fix Expense button logic and update project files)
