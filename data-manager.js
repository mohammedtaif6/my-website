/**
 * نظام إدارة البيانات المركزي - Pure Firebase Sync
 * تم إلغاء LocalStorage للبيانات لضمان دقة المعلومات من السيرفر
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
    orderBy
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === المتغيرات المحلية (تعمل كمرآة لقاعدة البيانات الحية) ===
let localData = {
    subscribers: [],
    transactions: [],
    expenses: []
};

// مؤشر حالة التحميل
let isDataLoaded = false;

const DataManager = {
    init() {
        console.log("🚀 جاري الاتصال بـ Firebase...");
        
        // البدء بالاستماع المباشر للتغييرات
        this.subscribeToCollection('subscribers');
        this.subscribeToCollection('transactions');
        this.subscribeToCollection('expenses');
    },

    /**
     * الاستماع للتغييرات الحية من قاعدة البيانات
     * أي تغيير في السيرفر سينعكس فوراً هنا ويحدث الواجهة
     */
    subscribeToCollection(collectionName) {
        const q = query(collection(db, collectionName), orderBy("createdAt", "desc")); 
        
        onSnapshot(q, (snapshot) => {
            // تحديث البيانات في الذاكرة فقط
            localData[collectionName] = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id
            }));
            
            console.log(`☁️ تم جلب ${collectionName} من Firebase: ${localData[collectionName].length} سجل`);
            
            // تحديث الواجهة فور وصول البيانات
            isDataLoaded = true;
            this.refreshUI();
        }, (error) => {
            console.error(`❌ خطأ في الاتصال بـ Firebase (${collectionName}):`, error);
            alert("تنبيه: هناك مشكلة في الاتصال بقاعدة البيانات. تأكد من الإنترنت.");
        });
    },

    // تحديث أي صفحة مفتوحة حالياً
    refreshUI() {
        // نتحقق من وجود الدوال في الصفحة الحالية ونستدعيها
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
        if (typeof window.loadSubscribers === 'function') window.loadSubscribers();
        if (typeof window.loadDebts === 'function') window.loadDebts();
        if (typeof window.loadPayments === 'function') window.loadPayments();
        if (typeof window.loadExpenses === 'function') window.loadExpenses();
        if (typeof window.loadExpiredSubscribers === 'function') window.loadExpiredSubscribers();
        if (typeof window.loadExpiringSubscribers === 'function') window.loadExpiringSubscribers();
    },

    // ==========================================
    // 👥 إدارة المشتركين (Subscribers)
    // ==========================================
    
    getSubscribers() { return localData.subscribers; },
    
    getSubscriber(id) { 
        // البحث باستخدام ID الرقمي
        return localData.subscribers.find(s => s.id == id); 
    },

    async addSubscriber(data) {
        const newId = Date.now(); 
        const subscriber = {
            ...data,
            id: newId,
            price: parseInt(data.price || 0),
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "subscribers"), subscriber);
            return true;
        } catch (e) {
            console.error("فشل الإضافة:", e);
            alert("فشل الحفظ. تأكد من الاتصال بالإنترنت.");
            return false;
        }
    },

    async updateSubscriber(id, data) {
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) {
            try {
                await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
            } catch (e) {
                console.error("فشل التحديث:", e);
                alert("حدث خطأ أثناء التحديث.");
            }
        } else {
            console.error("لم يتم العثور على المشترك للتحديث أو لا يوجد firebaseId");
        }
    },

    async deleteSubscriber(id) {
        if(!confirm('هل أنت متأكد من الحذف النهائي من قاعدة البيانات؟')) return;
        
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) {
            try {
                await deleteDoc(doc(db, "subscribers", sub.firebaseId));
            } catch (e) {
                console.error("فشل الحذف:", e);
                alert("حدث خطأ أثناء الحذف.");
            }
        }
    },

    searchSubscribers(query) {
        if (!query) return [];
        const q = String(query).toLowerCase();
        return localData.subscribers.filter(s => 
            (s.name || '').toLowerCase().includes(q) || 
            (s.phone || '').includes(q)
        );
    },

    // ==========================================
    // 💰 إدارة المعاملات (Transactions)
    // ==========================================

    getAllTransactions() { return localData.transactions; },

    getSubscriberTransactions(subscriberId) {
        return localData.transactions.filter(t => t.subscriberId == subscriberId);
    },

    async recordTransaction(subscriberId, amount, type = 'جزئي', details = {}) {
        const transaction = {
            id: Date.now(),
            transactionNumber: localData.transactions.length + 1,
            subscriberId: subscriberId,
            amount: parseInt(amount),
            type: type,
            date: new Date().toISOString().split('T')[0],
            details: details,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "transactions"), transaction);
            return transaction;
        } catch (e) {
            console.error("فشل تسجيل المعاملة:", e);
            alert("فشل تسجيل المعاملة.");
        }
    },

    async deleteTransaction(id) {
        const trans = localData.transactions.find(t => t.id == id);
        if (!trans || !trans.firebaseId) return;

        // إرجاع المبلغ للمشترك (تعديل الدين عكسياً)
        const sub = this.getSubscriber(trans.subscriberId);
        if (sub) {
            const newPrice = (parseInt(sub.price) || 0) + parseInt(trans.amount);
            // إعادة الحالة إلى 'قيد الانتظار' أو إبقائها 'نشط' حسب الحاجة، هنا نحدث السعر فقط
            await this.updateSubscriber(sub.id, { price: newPrice });
        }

        await deleteDoc(doc(db, "transactions", trans.firebaseId));
    },

    // ==========================================
    // 🧾 إدارة الصرفيات (Expenses)
    // ==========================================

    getExpenses() { return localData.expenses; },

    async addExpense(data) {
        const expense = {
            id: Date.now(),
            description: data.description,
            amount: parseInt(data.amount),
            date: data.date,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "expenses"), expense);
        } catch (e) {
            console.error("خطأ في حفظ الصرفية:", e);
            alert("فشل حفظ الصرفية.");
        }
    },

    async deleteExpense(id) {
        const exp = localData.expenses.find(e => e.id == id);
        if (exp && exp.firebaseId) {
            await deleteDoc(doc(db, "expenses", exp.firebaseId));
        }
    },

    // ==========================================
    // 📊 الإحصائيات العامة
    // ==========================================
    
    getStatistics() {
        const subs = this.getSubscribers();
        const today = new Date();
        today.setHours(0,0,0,0);

        const debts = subs.filter(s => s.paymentType === 'أجل' && s.price > 0)
                          .reduce((sum, s) => sum + (parseInt(s.price)||0), 0);

        return {
            totalSubscribers: subs.length,
            activeSubscribers: subs.filter(s => s.status === 'نشط').length,
            pendingSubscribers: subs.filter(s => s.status === 'قيد الانتظار').length,
            expiredSubscribers: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < today).length,
            expiringSubscribers: subs.filter(s => {
                if(!s.expiryDate) return false;
                const d = new Date(s.expiryDate);
                const diff = (d - today) / (1000*60*60*24);
                return diff >= 0 && diff <= 3;
            }).length,
            debtsTotal: debts
        };
    },

    exportToCSV(data, filename) {
        if (!data || !data.length) return alert('لا توجد بيانات للتصدير');
        // استبعاد الحقول الداخلية
        const headers = Object.keys(data[0]).filter(k => k !== 'firebaseId' && k !== 'details');
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

document.addEventListener('DOMContentLoaded', () => {
    DataManager.init();
});
