// Service Worker v25 - Force Cache Clear on Mobile
const CACHE_VERSION = 'ok-computer-v25.0';
const CACHE_NAME = CACHE_VERSION;

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
    console.log('📦 SW v25.0 - Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                urlsToCache.map(url =>
                    cache.add(url).catch(err => {
                        console.log(`⚠️ تعذر تخزين: ${url}`);
                        return null;
                    })
                )
            ).then(() => {
                console.log('✅ SW v25.0 - Files cached');
            });
        })
    );
    // Force immediate activation
    self.skipWaiting();
});

// التفعيل: حذف الكاش القديم بقوة
self.addEventListener('activate', (event) => {
    console.log('🔄 SW v25.0 - Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete ALL old caches
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ SW v25.0 - Old caches deleted');
            // Force take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// استراتيجية: Network First (Always fetch fresh on mobile)
self.addEventListener('fetch', (event) => {
    // تجاهل طلبات Firebase والخطوط الخارجية
    if (event.request.url.includes('firebasestorage') ||
        event.request.url.includes('googleapis') ||
        event.request.url.includes('gstatic') ||
        event.request.url.includes('cdnjs')) {
        return;
    }

    event.respondWith(
        // Always try network first
        fetch(event.request, {
            cache: 'no-cache', // Force fresh fetch
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        })
            .then((response) => {
                // Save fresh copy to cache
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Only use cache if network fails
                return caches.match(event.request);
            })
    );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('✅ All caches cleared by client request');
            })
        );
    }
});
