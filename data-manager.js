/**
 * نظام إدارة البيانات المركزي
 * Data Management System - OKComputer
 */

const DataManager = {
    // مفاتيح التخزين
    KEYS: {
        SUBSCRIBERS: 'okcomputer_subscribers',
        DEBTS: 'okcomputer_debts',
        REPORTS: 'okcomputer_reports'
    },

    // تهيئة البيانات الافتراضية
    init() {
        if (!this.getSubscribers()) {
            localStorage.setItem(this.KEYS.SUBSCRIBERS, JSON.stringify([]));
        }
        if (!this.getDebts()) {
            localStorage.setItem(this.KEYS.DEBTS, JSON.stringify([]));
        }
        if (!this.getReports()) {
            localStorage.setItem(this.KEYS.REPORTS, JSON.stringify([]));
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // المشتركين - Subscribers
    // ═══════════════════════════════════════════════════════════════════

    addSubscriber(data) {
        const subscribers = this.getSubscribers();
        // إصلاح حساب المعرف لتجنب التكرار في حال كانت المصفوفة فارغة أو بها مشاكل
        const newId = subscribers.length > 0 ? Math.max(...subscribers.map(s => s.id || 0)) + 1 : 1;
        
        const subscriber = {
            id: newId,
            name: data.name,
            // تم التأكد من أن الهاتف نص دائماً
            phone: data.phone || '',
            subscribeDate: data.subscribeDate || '',
            expiryDate: data.expiryDate || '',
            status: data.status || 'قيد الانتظار',
            price: data.price || 0,
            paymentType: data.paymentType || 'نقد',
            notes: data.notes || ''
        };

        subscribers.push(subscriber);
        this.saveSubscribers(subscribers);
        return subscriber;
    },

    updateSubscriber(id, data) {
        const subscribers = this.getSubscribers();
        const index = subscribers.findIndex(s => s.id === id);
        
        if (index !== -1) {
            subscribers[index] = { ...subscribers[index], ...data };
            this.saveSubscribers(subscribers);
            return subscribers[index];
        }
        return null;
    },

    deleteSubscriber(id) {
        const subscribers = this.getSubscribers();
        const filtered = subscribers.filter(s => s.id !== id);
        this.saveSubscribers(filtered);
        return true;
    },

    getSubscriber(id) {
        const subscribers = this.getSubscribers();
        return subscribers.find(s => s.id === id);
    },

    getSubscribers() {
        const data = localStorage.getItem(this.KEYS.SUBSCRIBERS);
        try {
            // حماية إضافية: إذا كانت البيانات تالفة نرجع مصفوفة فارغة
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveSubscribers(subscribers) {
        localStorage.setItem(this.KEYS.SUBSCRIBERS, JSON.stringify(subscribers));
    },

    // 🟢 هذه هي الدالة المعدلة جذرياً لمنع المشكلة
    searchSubscribers(query) {
        const subscribers = this.getSubscribers();
        
        // إذا لم يكن هناك نص للبحث، نرجع مصفوفة فارغة
        if (!query) return [];
        
        const q = query.toString().toLowerCase().trim();

        return subscribers.filter(s => {
            // حماية ضد العناصر الفارغة
            if (!s) return false;

            // تحويل القيم إلى نصوص بأمان تام قبل البحث
            // استخدام (|| '') يضمن أننا لا نحاول استدعاء toLowerCase على قيمة غير موجودة
            const name = (s.name || '').toString().toLowerCase();
            const phone = (s.phone || '').toString();
            
            // تم حذف البحث في الإيميل نهائياً
            return name.includes(q) || phone.includes(q);
        });
    },

    filterSubscribers(criteria) {
        let subscribers = this.getSubscribers();

        if (criteria.status) {
            subscribers = subscribers.filter(s => s.status === criteria.status);
        }

        if (criteria.minPrice !== undefined && criteria.maxPrice !== undefined) {
            subscribers = subscribers.filter(s => 
                s.price >= criteria.minPrice && s.price <= criteria.maxPrice
            );
        }

        if (criteria.expiryDateBefore) {
            subscribers = subscribers.filter(s => 
                s.expiryDate && s.expiryDate <= criteria.expiryDateBefore
            );
        }

        return subscribers;
    },

    // ═══════════════════════════════════════════════════════════════════
    // الديون - Debts
    // ═══════════════════════════════════════════════════════════════════

    addDebt(data) {
        const debts = this.getDebts();
        const newId = debts.length > 0 ? Math.max(...debts.map(d => d.id || 0)) + 1 : 1;

        const debt = {
            id: newId,
            subscriberId: data.subscriberId,
            amount: data.amount,
            status: data.status || 'متأخر',
            daysOverdue: data.daysOverdue || 0,
            lastPayment: data.lastPayment || '',
            createdAt: new Date().toISOString()
        };

        debts.push(debt);
        this.saveDebts(debts);
        return debt;
    },

    updateDebt(id, data) {
        const debts = this.getDebts();
        const index = debts.findIndex(d => d.id === id);
        
        if (index !== -1) {
            debts[index] = { ...debts[index], ...data };
            this.saveDebts(debts);
            return debts[index];
        }
        return null;
    },

    deleteDebt(id) {
        const debts = this.getDebts();
        const filtered = debts.filter(d => d.id !== id);
        this.saveDebts(filtered);
        return true;
    },

    getDebts() {
        const data = localStorage.getItem(this.KEYS.DEBTS);
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveDebts(debts) {
        localStorage.setItem(this.KEYS.DEBTS, JSON.stringify(debts));
    },

    // ═══════════════════════════════════════════════════════════════════
    // التقارير - Reports
    // ═══════════════════════════════════════════════════════════════════

    getStatistics() {
        const subscribers = this.getSubscribers();
        const debts = this.getDebts();

        return {
            totalSubscribers: subscribers.length,
            activeSubscribers: subscribers.filter(s => s && s.status === 'نشط').length,
            pendingSubscribers: subscribers.filter(s => s && s.status === 'قيد الانتظار').length,
            inactiveSubscribers: subscribers.filter(s => s && s.status === 'غير نشط').length,
            expiredSubscribers: subscribers.filter(s => s && s.expiryDate && new Date(s.expiryDate) < new Date()).length,
            expiringSubscribers: subscribers.filter(s => {
                if (!s || !s.expiryDate) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiry = new Date(s.expiryDate);
                expiry.setHours(0, 0, 0, 0);
                const threeDaysFromNow = new Date(today);
                threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
                return expiry > today && expiry <= threeDaysFromNow;
            }).length,
            totalDebts: debts.reduce((sum, d) => sum + (d.amount || 0), 0),
            totalDebtsCount: debts.length,
            overdueDebts: debts.filter(d => d && d.status === 'متأخر').length,
            totalRevenue: subscribers.reduce((sum, s) => sum + (s.price || 0), 0)
        };
    },

    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            alert('لا توجد بيانات للتصدير');
            return;
        }

        const headers = Object.keys(data[0]);
        let csv = headers.join(',') + '\n';

        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') 
                    ? `"${value}"` 
                    : (value || '');
            });
            csv += values.join(',') + '\n';
        });

        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        link.download = `${filename || 'data'}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    },

    getReports() {
        const data = localStorage.getItem(this.KEYS.REPORTS);
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveReports(reports) {
        localStorage.setItem(this.KEYS.REPORTS, JSON.stringify(reports));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    DataManager.init();
});
