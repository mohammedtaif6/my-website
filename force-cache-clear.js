// Force Cache Clear v25.0 - Mobile Optimized
// هذا الملف يضمن مسح الكاش على الهاتف المحمول

(function () {
    'use strict';

    const CURRENT_VERSION = '25.0';
    const VERSION_KEY = 'app_version';

    // التحقق من الإصدار
    function checkVersion() {
        const storedVersion = localStorage.getItem(VERSION_KEY);

        if (storedVersion !== CURRENT_VERSION) {
            console.log(`🔄 Version change detected: ${storedVersion} → ${CURRENT_VERSION}`);
            return true; // يحتاج تحديث
        }

        return false; // نفس الإصدار
    }

    // مسح الكاش بالقوة
    async function forceClearCache() {
        try {
            console.log('🧹 Force clearing cache...');

            // 1. مسح جميع الكاش
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => {
                    console.log('🗑️ Deleting:', name);
                    return caches.delete(name);
                }));
            }

            // 2. إلغاء Service Workers القديمة
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                    console.log('❌ SW unregistered');
                }
            }

            // 3. مسح sessionStorage
            sessionStorage.clear();

            // 4. تحديث رقم الإصدار
            localStorage.setItem(VERSION_KEY, CURRENT_VERSION);

            console.log('✅ Cache cleared successfully');
            return true;

        } catch (error) {
            console.error('❌ Error clearing cache:', error);
            // حتى لو فشل، حدث الإصدار
            localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
            return false;
        }
    }

    // منع الكاش في الطلبات
    function preventBrowserCache() {
        // إضافة timestamp لجميع طلبات الموارد
        if (window.performance && window.performance.navigation.type === 1) {
            // الصفحة تم إعادة تحميلها
            console.log('🔄 Page reloaded');
        }

        // منع الكاش في fetch
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
            if (args[0] && typeof args[0] === 'string') {
                // إضافة timestamp للطلبات المحلية فقط
                if (!args[0].includes('http') || args[0].includes(window.location.hostname)) {
                    const separator = args[0].includes('?') ? '&' : '?';
                    args[0] = `${args[0]}${separator}_t=${Date.now()}`;
                }
            }
            return originalFetch.apply(this, args);
        };
    }

    // التشغيل عند تحميل الصفحة
    async function init() {
        console.log('🚀 Force Cache Clear v25.0 initialized');

        // منع الكاش في المتصفح
        preventBrowserCache();

        // التحقق من الإصدار
        if (checkVersion()) {
            console.log('⚠️ New version detected, clearing cache...');
            await forceClearCache();

            // إعادة تحميل الصفحة مرة واحدة فقط
            if (!sessionStorage.getItem('cache_cleared')) {
                sessionStorage.setItem('cache_cleared', 'true');
                console.log('🔄 Reloading page with fresh cache...');
                window.location.reload(true);
            }
        }
    }

    // تشغيل فوري
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // تصدير للاستخدام الخارجي
    window.ForceCacheClear = {
        version: CURRENT_VERSION,
        clearCache: forceClearCache,
        checkVersion: checkVersion
    };

})();
