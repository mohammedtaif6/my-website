/**
 * نظام إدارة البيانات المركزي - Firebase Integration
 * اتصال سلس وسريع مع معالجة ذكية للأخطاء والتخزين المحلي
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === إعدادات Firebase ===
const firebaseConfig = {
    apiKey: "AIzaSyA-raYlvzPz8T7Mnx8bTWA4O8CyHvp7K_0",
    authDomain: "okcomputer-system.firebaseapp.com",
    projectId: "okcomputer-system",
    storageBucket: "okcomputer-system.firebasestorage.app",
    messagingSenderId: "17748146044",
    appId: "1:17748146044:web:e4a2063ac34c6ee27016f9"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === متغيرات عامة ===
let localSubscribers = [];
let isOnline = navigator.onLine;
let syncInProgress = false;

// === معالج الاتصال ===
window.addEventListener('online', () => {
    isOnline = true;
    console.log('✓ الاتصال استعاد - جاري المزامنة...');
    DataManager.syncWithFirebase();
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('⚠ انقطع الاتصال - العمل بالبيانات المحلية');
});

// === مدير البيانات ===
const DataManager = {
    CACHE_KEYS: {
        SUBS: 'ok_cache_subs',
        LAST_SYNC: 'ok_last_sync'
    },

    /**
     * تهيئة النظام عند التحميل
     */
    async init() {
        console.log("🔄 جاري تهيئة نظام إدارة البيانات...");
        
        // 1. تحميل البيانات من التخزين المحلي فوراً
        this.loadFromCache();
        this.refreshUI();
        
        // 2. مزامنة مع Firebase إذا كان الاتصال متاح
        if (isOnline) {
            await this.syncWithFirebase();
        }
    },

    /**
     * تحميل البيانات من التخزين المحلي
     */
    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEYS.SUBS);
            if (cached) {
                localSubscribers = JSON.parse(cached);
                console.log(`✓ تم تحميل ${localSubscribers.length} مشترك من الكاش المحلي`);
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل الكاش:', error);
            localSubscribers = [];
        }
    },

    /**
     * حفظ البيانات في التخزين المحلي
     */
    saveToCache() {
        try {
            localStorage.setItem(this.CACHE_KEYS.SUBS, JSON.stringify(localSubscribers));
            localStorage.setItem(this.CACHE_KEYS.LAST_SYNC, new Date().toISOString());
        } catch (error) {
            console.error('❌ خطأ في حفظ الكاش:', error);
        }
    },

    /**
     * مزامنة ثنائية الاتجاه مع Firebase
     */
    async syncWithFirebase() {
        if (syncInProgress || !isOnline) return;
        syncInProgress = true;

        try {
            // استدعاء البيانات الحالية من Firebase
            const q = query(collection(db, "subscribers"), orderBy("id", "desc"));
            const snapshot = await getDocs(q);
            
            const firebaseData = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id
            }));

            // تحديث البيانات المحلية
            localSubscribers = firebaseData.length > 0 ? firebaseData : localSubscribers;
            this.saveToCache();
            
            console.log(`✓ تم مزامنة ${localSubscribers.length} مشترك من Firebase`);
            this.refreshUI();

        } catch (error) {
            console.error('❌ خطأ في المزامنة:', error.message);
        } finally {
            syncInProgress = false;
        }
    },

    /**
     * الاستماع للتغييرات الحية من Firebase
     */
    listenForChanges() {
        if (!isOnline) return;

        try {
            const q = query(collection(db, "subscribers"), orderBy("id", "desc"));
            
            onSnapshot(q, (snapshot) => {
                localSubscribers = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    firebaseId: doc.id
                }));
                
                this.saveToCache();
                this.refreshUI();
                
            }, (error) => {
                console.error('❌ خطأ في الاستماع للتغييرات:', error.message);
            });

        } catch (error) {
            console.error('❌ فشل إعداد المستمع:', error);
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

    // === عمليات المشتركين ===

    /**
     * إضافة مشترك جديد
     */
    async addSubscriber(data) {
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

        // إضافة محلياً
        localSubscribers.push(subscriber);
        this.saveToCache();
        this.refreshUI();

        // إضافة في Firebase بشكل غير متزامن
        if (isOnline) {
            try {
                const docRef = await addDoc(collection(db, "subscribers"), subscriber);
                subscriber.firebaseId = docRef.id;
                this.saveToCache();
                console.log('✓ تم إضافة المشترك في Firebase');
            } catch (error) {
                console.error('⚠ تم الحفظ محلياً لكن فشل الاتصال بـ Firebase:', error.message);
            }
        }
    },

    /**
     * تحديث مشترك
     */
    async updateSubscriber(id, data) {
        const sub = localSubscribers.find(s => s.id === id);
        if (!sub) return;

        // تحديث محلي فوري
        Object.assign(sub, data);
        this.saveToCache();
        this.refreshUI();

        // تحديث في Firebase بشكل غير متزامن
        if (isOnline && sub.firebaseId) {
            try {
                await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
                console.log('✓ تم تحديث المشترك في Firebase');
            } catch (error) {
                console.error('⚠ تم التحديث محلياً لكن فشل في Firebase:', error.message);
            }
        }
    },

    /**
     * حذف مشترك
     */
    async deleteSubscriber(id) {
        const sub = localSubscribers.find(s => s.id === id);
        if (!sub) return;

        // حذف محلي فوري
        localSubscribers = localSubscribers.filter(s => s.id !== id);
        this.saveToCache();
        this.refreshUI();

        // حذف من Firebase بشكل غير متزامن
        if (isOnline && sub.firebaseId) {
            try {
                await deleteDoc(doc(db, "subscribers", sub.firebaseId));
                console.log('✓ تم حذف المشترك من Firebase');
            } catch (error) {
                console.error('⚠ تم الحذف محلياً لكن فشل في Firebase:', error.message);
            }
        }
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
     * البحث السريع
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

    // === الإحصائيات والتقارير ===

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

// === تصدير مدير البيانات ===
window.DataManager = DataManager;

// === التهيئة عند تحميل الصفحة ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        DataManager.init();
        DataManager.listenForChanges();
    });
} else {
    DataManager.init();
    DataManager.listenForChanges();
}

