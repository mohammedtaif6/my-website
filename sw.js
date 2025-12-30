// Service Worker v27 - High Performance Mode (Stale-While-Revalidate)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const CACHE_VERSION = 'ok-computer-v27.2';
const CACHE_NAME = CACHE_VERSION;

// === Firebase Messaging Setup ===
const firebaseConfig = {
    apiKey: "AIzaSyA-raYlvzPz8T7Mnx8bTWA4O8CyHvp7K_0",
    authDomain: "okcomputer-system.firebaseapp.com",
    projectId: "okcomputer-system",
    storageBucket: "okcomputer-system.firebasestorage.app",
    messagingSenderId: "17748146044",
    appId: "1:17748146044:web:e4a2063ac34c6ee27016f9"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Background Message:', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-192x192.png' // Android badge
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
// =================================


const urlsToCache = [
    './',
    './index.html',
    './subscribers.html',
    './active_subscribers.html',
    './debts.html',
    './payments.html',
    './reports.html',
    './employees.html',
    './expenses.html',
    './expired.html',
    './expiring.html',
    './style.css',
    './style-fab.css',
    './style-modal.css',
    './data-manager.js',
    './auth-system.js',
    './manifest.json',
    './favicon.ico',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// 1. Install & Precache
self.addEventListener('install', (event) => {
    console.log(`📦 SW ${CACHE_VERSION} - Installing & caching core assets...`);
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

// 2. Activate & Cleanup
self.addEventListener('activate', (event) => {
    console.log(`🔄 SW ${CACHE_VERSION} - Activating...`);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Optimized Fetch Strategy: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
    // Skip cross-origin or non-GET requests
    if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                // 1. Return cached response immediately if available (Speed!)
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // 2. Update cache with fresh version in background
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fallback if offline and network fail
                    // If no cache and no network -> user sees error, but skeleton usually loads
                });

                return cachedResponse || fetchPromise;
            });
        })
    );
});

// Listen for messages to clear cache
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
    }
});
