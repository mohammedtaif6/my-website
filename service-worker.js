// service-worker.js - وضع التنظيف (لا تخزين مؤقت)
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // حذف أي كاش قديم فوراً
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => caches.delete(key)));
        })
    );
});

// السماح للشبكة بالعمل بحرية
self.addEventListener('fetch', (event) => {
    return;
});
