/**
 * نظام إدارة البيانات المركزي - النسخة السريعة (Hybrid Cache)
 * يجمع بين سرعة التخزين المحلي وقوة التزامن السحابي
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// إعدادات فايربيس الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyA-raYlvzPz8T7Mnx8bTWA4O8CyHvp7K_0",
  authDomain: "okcomputer-system.firebaseapp.com",
  projectId: "okcomputer-system",
  storageBucket: "okcomputer-system.firebasestorage.app",
  messagingSenderId: "17748146044",
  appId: "1:17748146044:web:e4a2063ac34c6ee27016f9",
  measurementId: "G-CNMCQ04CFD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// متغيرات لتخزين البيانات محلياً
let localSubscribers = [];
let localDebts = [];

const DataManager = {
    // مفاتيح التخزين المؤقت
    CACHE_KEYS: {
        SUBS: 'ok_cache_subs',
        DEBTS: 'ok_cache_debts'
    },

    init() {
        // 1. التحميل الفوري من الذاكرة المحلية (لسرعة العرض)
        this.loadFromCache();

        // 2. الاتصال بالسحابة لجلب التحديثات
        console.log("جاري المزامنة مع السحابة...");
        
        // مزامنة المشتركين
        const subCol = collection(db, "subscribers");
        const q = query(subCol, orderBy("id", "desc"));
        
        onSnapshot(q, (snapshot) => {
            localSubscribers = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id
            }));
            
            // تحديث الكاش المحلي
            localStorage.setItem(this.CACHE_KEYS.SUBS, JSON.stringify(localSubscribers));
            
            // تحديث الواجهة
            this.refreshUI();
        });

        // مزامنة الديون
        const debtCol = collection(db, "debts");
        onSnapshot(debtCol, (snapshot) => {
            localDebts = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
            localStorage.setItem(this.CACHE_KEYS.DEBTS, JSON.stringify(localDebts));
        });
    },

    // دالة لاسترجاع البيانات المخزنة مؤقتاً
    loadFromCache() {
        const cachedSubs = localStorage.getItem(this.CACHE_KEYS.SUBS);
        const cachedDebts = localStorage.getItem(this.CACHE_KEYS.DEBTS);

        if (cachedSubs) {
            localSubscribers = JSON.parse(cachedSubs);
            this.refreshUI();
        }
        if (cachedDebts) {
            localDebts = JSON.parse(cachedDebts);
        }
    },

    // دالة موحدة لتحديث الواجهة في أي صفحة
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

    async addSubscriber(data) {
        // حساب ID محلي سريع
        const maxId = localSubscribers.length > 0 ? Math.max(...localSubscribers.map(s => s.id || 0)) : 0;
        const newId = maxId + 1;
        
        const subscriber = {
            id: newId,
            name: data.name || 'بدون اسم',
            phone: data.phone || '',
            subscribeDate: data.subscribeDate || '',
            expiryDate: data.expiryDate || '',
            status: data.status || 'قيد الانتظار',
            price: parseInt(data.price || 0),
            paymentType: data.paymentType || 'نقد',
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "subscribers"), subscriber);
        } catch (e) {
            alert("مشكلة في الاتصال! تأكد من الإنترنت.");
            console.error(e);
        }
    },

    async updateSubscriber(id, data) {
        const sub = localSubscribers.find(s => s.id === id);
        if (sub && sub.firebaseId) {
            await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
        }
    },

    async deleteSubscriber(id) {
        const sub = localSubscribers.find(s => s.id === id);
        if (sub && sub.firebaseId) {
            await deleteDoc(doc(db, "subscribers", sub.firebaseId));
        }
    },

    getSubscriber(id) {
        return localSubscribers.find(s => s.id === id);
    },

    getSubscribers() {
        return localSubscribers || [];
    },

    // بحث سريع جداً في الذاكرة
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

    getStatistics() {
        const subs = this.getSubscribers();
        return {
            totalSubscribers: subs.length,
            activeSubscribers: subs.filter(s => s.status === 'نشط').length,
            pendingSubscribers: subs.filter(s => s.status === 'قيد الانتظار').length,
            inactiveSubscribers: subs.filter(s => s.status === 'غير نشط').length,
            expiredSubscribers: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < new Date()).length,
            expiringSubscribers: subs.filter(s => {
                if (!s.expiryDate) return false;
                const today = new Date(); today.setHours(0,0,0,0);
                const expiry = new Date(s.expiryDate); expiry.setHours(0,0,0,0);
                const threeDays = new Date(today); threeDays.setDate(threeDays.getDate() + 3);
                return expiry > today && expiry <= threeDays;
            }).length,
            totalRevenue: subs.reduce((sum, s) => sum + (parseInt(s.price) || 0), 0)
        };
    },

    exportToCSV(data, filename) {
        if (!data || !data.length) { alert('لا توجد بيانات'); return; }
        const headers = Object.keys(data[0]).filter(k => k !== 'firebaseId');
        let csv = headers.join(',') + '\n';
        data.forEach(row => {
            csv += headers.map(k => `"${row[k] || ''}"`).join(',') + '\n';
        });
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    }
};

window.DataManager = DataManager;
DataManager.init();
