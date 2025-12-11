/**
 * Auto Refresh System - نظام التحديث التلقائي
 * يتم تضمينه في جميع صفحات النظام
 */

(function () {
    'use strict';

    // === 1. تحديث تلقائي عند العودة للصفحة (Page Visibility API) ===
    let lastVisibilityChange = Date.now();

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            const timeSinceLastChange = Date.now() - lastVisibilityChange;

            // إذا مر أكثر من 30 ثانية، قم بتحديث البيانات
            if (timeSinceLastChange > 30000) {
                console.log('🔄 تحديث البيانات بعد العودة للصفحة');
                refreshPageData();
            }
        }
        lastVisibilityChange = Date.now();
    });

    // === 2. تحديث البيانات عند التنقل بين الصفحات ===
    window.addEventListener('pageshow', function (event) {
        // إذا تم تحميل الصفحة من الكاش (back/forward)
        if (event.persisted) {
            console.log('🔄 تحديث الصفحة المحملة من الكاش');
            refreshPageData();
        }
    });

    // === 3. دالة تحديث البيانات ===
    function refreshPageData() {
        // إذا كان DataManager موجوداً، قم بإعادة تحميل البيانات
        if (typeof DataManager !== 'undefined' && DataManager.subscribers !== undefined) {
            console.log('📊 تحديث البيانات من Firebase...');

            // إعادة رسم الواجهة إذا كانت الدالة موجودة
            if (typeof window.updatePageData === 'function') {
                window.updatePageData();
            } else if (typeof window.renderDashboard === 'function') {
                window.renderDashboard();
            } else if (typeof window.renderActivePage === 'function') {
                window.renderActivePage();
            }
        }
    }

    // === 4. تحديث دوري كل دقيقة (للتأكد من تزامن البيانات) ===
    setInterval(function () {
        if (!document.hidden) {
            refreshPageData();
        }
    }, 60000); // كل دقيقة

    // === 5. إشعار التحديث ===
    function showRefreshToast() {
        if (typeof DataManager !== 'undefined' && DataManager.showToast) {
            DataManager.showToast('تم تحديث البيانات ✅', 'success');
        }
    }

    // === 7. تحديث عند إعادة الاتصال بالإنترنت ===
    window.addEventListener('online', function () {
        console.log('🌐 تم الاتصال بالإنترنت - تحديث البيانات');
        setTimeout(refreshPageData, 1000);
    });

    console.log('✅ Auto Refresh System loaded');
})();
