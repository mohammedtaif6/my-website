/**
 * نظام إدارة البيانات المركزي - DataManager
 * يدعم: المزامنة الحية، الترحيل للأرشيف، وحذف التقارير
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
    getDocs // تم استيراد هذه الدالة لجلب الأرشيف
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

const DataManager = {
    init() {
        console.log("🚀 جاري الاتصال بـ Firebase...");
        this.subscribeToCollection('subscribers');
        this.subscribeToCollection('transactions');
        this.subscribeToCollection('expenses');
    },

    subscribeToCollection(collectionName) {
        const q = query(collection(db, collectionName), orderBy("createdAt", "desc")); 
        
        onSnapshot(q, (snapshot) => {
            localData[collectionName] = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id
            }));
            
            this.refreshUI();
        }, (error) => {
            console.error(`❌ خطأ في الاتصال بـ Firebase (${collectionName}):`, error);
        });
    },

    refreshUI() {
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
        if (typeof window.loadSubscribers === 'function') window.loadSubscribers();
        if (typeof window.loadDebts === 'function') window.loadDebts();
        if (typeof window.loadPayments === 'function') window.loadPayments();
        if (typeof window.loadExpenses === 'function') window.loadExpenses();
        if (typeof window.loadReports === 'function') window.loadReports(); // تحديث التقارير إذا كانت مفتوحة
    },

    // ==========================================
    // 👥 إدارة المشتركين
    // ==========================================
    getSubscribers() { return localData.subscribers; },
    
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },

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
            alert("فشل الحفظ.");
            return false;
        }
    },

    async updateSubscriber(id, data) {
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) {
            await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
        }
    },

    async deleteSubscriber(id) {
        if(!confirm('تحذير: سيتم حذف المشترك وجميع ديونه وسجلاته نهائياً.\nهل أنت متأكد؟')) return;
        
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) {
            try {
                // حذف المعاملات المرتبطة
                const userTransactions = localData.transactions.filter(t => t.subscriberId == id);
                const deletePromises = userTransactions.map(trans => {
                    if (trans.firebaseId) return deleteDoc(doc(db, "transactions", trans.firebaseId));
                });
                await Promise.all(deletePromises);

                // حذف المشترك
                await deleteDoc(doc(db, "subscribers", sub.firebaseId));
                alert("تم حذف المشترك وكافة بياناته.");
            } catch (e) {
                console.error("فشل الحذف:", e);
            }
        }
    },

    searchSubscribers(query) {
        if (!query) return [];
        const q = String(query).toLowerCase();
        return localData.subscribers.filter(s => 
            (s.name || '').toLowerCase().includes(q) || 
            (s.phone || '').includes(q) ||
            String(s.id).includes(q)
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
        await addDoc(collection(db, "transactions"), transaction);
    },

    async deleteTransaction(id) {
        const trans = localData.transactions.find(t => t.id == id);
        if (!trans || !trans.firebaseId) return;

        const sub = this.getSubscriber(trans.subscriberId);
        if (sub) {
            const newPrice = (parseInt(sub.price) || 0) + parseInt(trans.amount);
            await this.updateSubscriber(sub.id, { price: newPrice });
        }
        await deleteDoc(doc(db, "transactions", trans.firebaseId));
    },

    // ==========================================
    // 📦 نظام الأرشيف والمطابقة (جديد)
    // ==========================================

    async archiveAllTransactions() {
        const allTrans = this.getAllTransactions();
        if (allTrans.length === 0) return alert('لا توجد مبالغ لترحيلها!');

        if (!confirm(`سيتم ترحيل (${allTrans.length}) فاتورة إلى التقارير وتصفير القائمة الحالية.\nهل أنت متأكد من المطابقة؟`)) return;

        console.log("جاري الترحيل...");
        let count = 0;

        for (const trans of allTrans) {
            if (!trans.firebaseId) continue;
            try {
                // 1. نسخ للأرشيف مع تاريخ الترحيل
                await addDoc(collection(db, "archived_transactions"), { 
                    ...trans, 
                    archivedAt: new Date().toISOString() 
                });
                
                // 2. حذف من القائمة النشطة
                await deleteDoc(doc(db, "transactions", trans.firebaseId));
                count++;
            } catch (e) { console.error("فشل ترحيل قيد:", e); }
        }
        alert(`تم ترحيل ${count} معاملة بنجاح وتصفير الصفحة.`);
    },

    async getArchivedTransactions() {
        try {
             // جلب البيانات من مجموعة الأرشيف
             const q = query(collection(db, "archived_transactions"), orderBy("archivedAt", "desc"));
             const snapshot = await getDocs(q);
             return snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
        } catch(e) {
            console.error("خطأ الأرشيف:", e);
            return [];
        }
    },

    async deleteArchivedTransaction(firebaseId) {
        if(!confirm('هل أنت متأكد من حذف هذا السجل من الأرشيف نهائياً؟')) return;
        try {
            await deleteDoc(doc(db, "archived_transactions", firebaseId));
            alert("تم الحذف من التقارير.");
            // إعادة تحميل التقارير
            if (typeof window.loadReports === 'function') window.loadReports();
        } catch (e) {
            console.error("فشل الحذف:", e);
            alert("حدث خطأ.");
        }
    },

    // ==========================================
    // 🧾 الصرفيات والإحصائيات
    // ==========================================

    getExpenses() { return localData.expenses; },

    async addExpense(data) {
        await addDoc(collection(db, "expenses"), {
            ...data,
            id: Date.now(),
            createdAt: new Date().toISOString()
        });
    },

    async deleteExpense(id) {
        const exp = localData.expenses.find(e => e.id == id);
        if (exp && exp.firebaseId) await deleteDoc(doc(db, "expenses", exp.firebaseId));
    },

    getStatistics() {
        const subs = this.getSubscribers();
        const debts = subs.filter(s => s.paymentType === 'أجل').reduce((sum, s) => sum + (parseInt(s.price)||0), 0);
        return {
            totalSubscribers: subs.length,
            activeSubscribers: subs.filter(s => s.status === 'نشط').length,
            debtsTotal: debts
        };
    }
};

window.DataManager = DataManager;
document.addEventListener('DOMContentLoaded', () => DataManager.init());
