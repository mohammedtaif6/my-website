/**
 * نظام إدارة البيانات المركزي
 * تخزين محلي آمن وموثوق مع واجهة موحدة
 */

// تهيئة التخزين المحلي
let localSubscribers = [];

const DataManager = {
    // مفاتيح التخزين المؤقت
    CACHE_KEYS: {
        SUBS: 'ok_cache_subs',
        DEBTS: 'ok_cache_debts'
    },

    /**
     * تهيئة مدير البيانات
     */
    init() {
        // تحميل البيانات من الذاكرة المحلية
        this.loadFromCache();
        console.log("✓ تم تحميل نظام إدارة البيانات");
    },

    /**
     * تحميل البيانات من التخزين المحلي
     */
    loadFromCache() {
        try {
            const cachedSubs = localStorage.getItem(this.CACHE_KEYS.SUBS);
            if (cachedSubs) {
                localSubscribers = JSON.parse(cachedSubs);
            }
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            localSubscribers = [];
        }
    },

    /**
     * حفظ البيانات في التخزين المحلي
     */
    saveToCache() {
        try {
            localStorage.setItem(this.CACHE_KEYS.SUBS, JSON.stringify(localSubscribers));
            this.refreshUI();
        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
        }
    },

    /**
     * تحديث واجهة المستخدم
     */
    refreshUI() {
        if (typeof window.loadSubscribers === 'function') window.loadSubscribers();
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
        if (typeof window.updateStats === 'function') window.updateStats();
        if (typeof window.loadDebts === 'function') window.loadDebts();
        if (typeof window.loadPayments === 'function') window.loadPayments();
        if (typeof window.loadExpiredSubscribers === 'function') window.loadExpiredSubscribers();
        if (typeof window.loadExpiringSubscribers === 'function') window.loadExpiringSubscribers();
    },

    // --- عمليات المشتركين ---

    /**
     * إضافة مشترك جديد
     */
    addSubscriber(data) {
        const maxId = localSubscribers.length > 0 ? Math.max(...localSubscribers.map(s => s.id || 0)) : 0;
        const newId = maxId + 1;
        
        const subscriber = {
            id: newId,
            name: data.name || 'بدون اسم',
            phone: data.phone || '',
            subscribeDate: data.subscribeDate || new Date().toISOString().split('T')[0],
            expiryDate: data.expiryDate || '',
            status: data.status || 'قيد الانتظار',
            price: parseInt(data.price || 0),
            paymentType: data.paymentType || 'نقد',
            lastPaymentDate: data.lastPaymentDate || null,
            originalPrice: data.originalPrice || 0,
            partialPayments: data.partialPayments || 0,
            createdAt: new Date().toISOString()
        };

        localSubscribers.push(subscriber);
        this.saveToCache();
    },

    /**
     * تحديث بيانات مشترك
     */
    updateSubscriber(id, data) {
        const sub = localSubscribers.find(s => s.id === id);
        if (sub) {
            Object.assign(sub, data);
            this.saveToCache();
        }
    },

    /**
     * حذف مشترك
     */
    deleteSubscriber(id) {
        localSubscribers = localSubscribers.filter(s => s.id !== id);
        this.saveToCache();
    },

    /**
     * الحصول على مشترك واحد
     */
    getSubscriber(id) {
        return localSubscribers.find(s => s.id === id);
    },

    /**
     * الحصول على قائمة جميع المشتركين
     */
    getSubscribers() {
        return localSubscribers || [];
    },

    /**
     * البحث السريع عن المشتركين
     */
    searchSubscribers(query) {
        if (!query) return [];
        const q = String(query).toLowerCase().trim();
        return localSubscribers.filter(s => {
            if (!s) return false;
            const name = (s.name || '').toString().toLowerCase();
            const phone = (s.phone || '').toString();
            return name.includes(q) || phone.includes(q);
        });
    },

    // --- الإحصائيات والتقارير ---

    /**
     * الحصول على الإحصائيات
     */
    getStatistics() {
        const subs = this.getSubscribers();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return {
            totalSubscribers: subs.length,
            activeSubscribers: subs.filter(s => s.status === 'نشط').length,
            pendingSubscribers: subs.filter(s => s.status === 'قيد الانتظار').length,
            inactiveSubscribers: subs.filter(s => s.status === 'غير نشط').length,
            expiredSubscribers: subs.filter(s => {
                if (!s.expiryDate) return false;
                const expiry = new Date(s.expiryDate);
                expiry.setHours(0, 0, 0, 0);
                return expiry < today;
            }).length,
            expiringSubscribers: subs.filter(s => {
                if (!s.expiryDate) return false;
                const expiry = new Date(s.expiryDate);
                expiry.setHours(0, 0, 0, 0);
                const threeDaysFromNow = new Date(today);
                threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
                return expiry > today && expiry <= threeDaysFromNow;
            }).length,
            totalRevenue: subs.reduce((sum, s) => sum + (parseInt(s.price) || 0), 0)
        };
    },

    /**
     * تصدير البيانات إلى CSV
     */
    exportToCSV(data, filename) {
        if (!data || !data.length) {
            console.warn('لا توجد بيانات للتصدير');
            return;
        }

        const headers = Object.keys(data[0]).filter(k => !k.startsWith('_') && k !== 'firebaseId');
        let csv = headers.join(',') + '\n';
        
        data.forEach(row => {
            csv += headers.map(k => {
                const value = row[k] || '';
                // معالجة النصوص التي تحتوي على فواصل
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return `"${value}"`;
            }).join(',') + '\n';
        });

        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    }
};

// تصدير مدير البيانات للاستخدام العام
window.DataManager = DataManager;

// التهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    DataManager.init();
});

