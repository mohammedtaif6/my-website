/**
 * نظام إدارة البيانات المركزي - Full Real-time Sync
 * يدعم المزامنة الفورية للمشتركين، المعاملات، والصرفيات بين جميع الأجهزة
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

// === مخازن البيانات المحلية (للعرض السريع) ===
let localData = {
    subscribers: [],
    transactions: [],
    expenses: []
};

let isOnline = navigator.onLine;

// === مراقبة حالة الاتصال ===
window.addEventListener('online', () => { isOnline = true; console.log('🟢 متصل بالإنترنت'); });
window.addEventListener('offline', () => { isOnline = false; console.log('🔴 انقطع الاتصال'); });

const DataManager = {
    init() {
        console.log("🚀 جاري بدء نظام المزامنة الشامل...");
        
        // تحميل بيانات مؤقتة من الكاش لسرعة العرض
        this.loadFromCache('subscribers');
        this.loadFromCache('transactions');
        this.loadFromCache('expenses');
        this.refreshUI();

        // تفعيل المستمعين للبيانات الحية من السيرفر
        this.subscribeToCollection('subscribers');
        this.subscribeToCollection('transactions');
        this.subscribeToCollection('expenses');
    },

    loadFromCache(key) {
        const cached = localStorage.getItem(`cache_${key}`);
        if (cached) localData[key] = JSON.parse(cached);
    },

    /**
     * الاستماع للتغييرات الحية من قاعدة البيانات
     */
    subscribeToCollection(collectionName) {
        if (!isOnline) return;
        
        const q = query(collection(db, collectionName), orderBy("createdAt", "desc")); 
        
        onSnapshot(q, (snapshot) => {
            localData[collectionName] = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id
            }));
            
            // تحديث الكاش المحلي
            localStorage.setItem(`cache_${collectionName}`, JSON.stringify(localData[collectionName]));
            
            console.log(`✨ تحديث ${collectionName}: ${localData[collectionName].length} عنصر`);
            this.refreshUI();
        }, (error) => {
            console.error(`❌ خطأ في مزامنة ${collectionName}:`, error);
        });
    },

    // تحديث أي صفحة مفتوحة حالياً
    refreshUI() {
        if (typeof window.loadSubscribers === 'function') window.loadSubscribers();
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
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
    
    getSubscriber(id) { return localData.subscribers.find(s => s.id === id); },

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
            }
        }
    },

    async deleteSubscriber(id) {
        if(!confirm('هل أنت متأكد من الحذف؟')) return;
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) {
            await deleteDoc(doc(db, "subscribers", sub.firebaseId));
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
        return localData.transactions.filter(t => t.subscriberId === subscriberId);
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
            console.log("تم تسجيل المعاملة سحابياً");
            return transaction;
        } catch (e) {
            console.error("فشل تسجيل المعاملة:", e);
            alert("فشل تسجيل المعاملة. تحقق من الإنترنت.");
        }
    },

    async deleteTransaction(id) {
        const trans = localData.transactions.find(t => t.id === id);
        if (!trans || !trans.firebaseId) return;

        // إرجاع المبلغ للمشترك
        const sub = this.getSubscriber(trans.subscriberId);
        if (sub) {
            const newPrice = (parseInt(sub.price) || 0) + parseInt(trans.amount);
            await this.updateSubscriber(sub.id, { price: newPrice });
        }

        // حذف المعاملة نهائياً
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
        }
    },

    async deleteExpense(id) {
        const exp = localData.expenses.find(e => e.id === id);
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

document.addEventListener('DOMContentLoaded', () => {
    DataManager.init();
});
