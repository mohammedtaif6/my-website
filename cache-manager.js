/**
 * نظام تحديث الكاش التلقائي
 * يضمن تحميل أحدث إصدار من الملفات دائماً
 */

// === الإصدار الحالي للتطبيق ===
const APP_VERSION = '2.0.0';
const CACHE_VERSION = `cache_v${APP_VERSION}`;

// === حذف الكاش القديم وتحديثه ===
if ('caches' in window) {
    caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
            // حذف جميع الكاشات القديمة
            if (cacheName !== CACHE_VERSION && cacheName.startsWith('cache_v')) {
                console.log(`🗑️ حذف الكاش القديم: ${cacheName}`);
                caches.delete(cacheName);
            }
        });
    });
}

// === منع تخزين ملفات CSS و JS في الكاش المحلي ===
document.addEventListener('DOMContentLoaded', () => {
    // إضافة version parameter إلى جميع روابط CSS
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.includes('?v=') && !href.includes('://')) {
            link.setAttribute('href', `${href}?v=${APP_VERSION}`);
            console.log(`✓ تحديث CSS: ${href}`);
        }
    });

    // إضافة version parameter إلى جميع src الـ script المحلية
    document.querySelectorAll('script[src]').forEach(script => {
        const src = script.getAttribute('src');
        if (src && !src.includes('?v=') && !src.includes('://') && !src.includes('cdn')) {
            script.setAttribute('src', `${src}?v=${APP_VERSION}`);
            console.log(`✓ تحديث JS: ${src}`);
        }
    });
});

// === إظهار نسخة التطبيق ===
console.log(`%c OKComputer v${APP_VERSION}`, 'color: #1e40af; font-size: 16px; font-weight: bold;');
console.log(`%c النسخة المحملة الآن تطبيق لوحة التحكم - آخر تحديث`, 'color: #10b981; font-size: 12px;');

// === تنظيف localStorage من البيانات المتكررة ===
function cleanupLocalStorage() {
    const keys = Object.keys(localStorage);
    
    // قائمة المفاتيح المسموحة
    const allowedKeys = [
        'ok_cache_subs',
        'ok_cache_debts',
        'ok_last_sync',
        'partial_payments',
        'expenses',
        'transactions'
    ];

    keys.forEach(key => {
        if (!allowedKeys.includes(key) && !key.startsWith('firebase')) {
            console.log(`🗑️ حذف localStorage key: ${key}`);
            localStorage.removeItem(key);
        }
    });
}

// تنظيف عند التحميل الأول
if (!localStorage.getItem('_cleanup_done')) {
    cleanupLocalStorage();
    localStorage.setItem('_cleanup_done', 'true');
}

// === دالة لإعادة تحميل الصفحة بدون كاش ===
function hardRefresh() {
    console.log('🔄 إعادة تحميل بدون كاش...');
    // Ctrl+Shift+R بديل برمجي
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SKIP_WAITING'
        });
    }
    
    // حذف بيانات الكاش
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
            });
        });
    }
    
    // إعادة تحميل
    window.location.href = window.location.href.split('?')[0] + '?nocache=' + Date.now();
}

// تعريض الدالة عالمياً
window.hardRefresh = hardRefresh;

// === التحقق من التحديثات كل دقيقة ===
setInterval(() => {
    fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-store'
    }).then(response => {
        const serverVersion = response.headers.get('X-App-Version');
        if (serverVersion && serverVersion !== APP_VERSION) {
            console.warn('⚠️ توفر نسخة جديدة من التطبيق!');
            // يمكن إظهار إشعار للمستخدم هنا
        }
    }).catch(() => {
        // عدم الاتصال بالإنترنت
    });
}, 60000); // كل دقيقة

// === معالج لزر القائمة (إذا وجد) ===
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+Delete = تنظيف الكاش
    if (e.ctrlKey && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        hardRefresh();
    }
    
    // F5 مع Ctrl = تحديث بدون كاش
    if (e.ctrlKey && e.key === 'F5') {
        e.preventDefault();
        hardRefresh();
    }
});

console.log('💡 نصيحة: اضغط Ctrl+Shift+Delete لتحديث بدون كاش');
