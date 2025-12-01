/**
 * DataManager v3.0 - النظام المركزي الذكي
 * يتضمن: مزامنة فايربيس، تصحيح البيانات التلقائي، نظام الأرشيف
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// إعدادات Firebase
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

let localData = { subscribers: [], transactions: [], expenses: [] };

const DataManager = {
    init() {
        console.log("🚀 جاري تهيئة النظام...");
        this.syncCollection('subscribers');
        this.syncCollection('transactions');
        this.syncCollection('expenses');
    },

    syncCollection(colName) {
        const q = query(collection(db, colName), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            localData[colName] = snapshot.docs.map(d => {
                const data = d.data();
                // === التصحيح التلقائي للبيانات ===
                // تأكد أن السعر رقم دائماً
                if (data.price && typeof data.price !== 'number') data.price = parseInt(data.price) || 0;
                if (data.amount && typeof data.amount !== 'number') data.amount = parseInt(data.amount) || 0;
                return { ...data, firebaseId: d.id };
            });
            
            console.log(`✅ تم تحديث ${colName}: ${localData[colName].length}`);
            this.refreshUI();
        });
    },

    refreshUI() {
        // تحديث أي دالة عرض موجودة في الصفحة الحالية
        if (typeof window.renderPage === 'function') window.renderPage();
    },

    // --- العمليات الأساسية ---
    getSubscribers() { return localData.subscribers; },
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },
    getExpenses() { return localData.expenses; },
    getAllTransactions() { return localData.transactions; },

    // البحث الذكي
    searchSubscribers(query) {
        if (!query) return [];
        const q = query.toLowerCase();
        return localData.subscribers.filter(s => 
            (s.name && s.name.toLowerCase().includes(q)) || 
            (s.phone && s.phone.includes(q))
        );
    },

    // --- عمليات الكتابة (CRUD) ---
    async addSubscriber(data) {
        try {
            await addDoc(collection(db, "subscribers"), {
                ...data,
                id: Date.now(), // ID ثابت
                price: parseInt(data.price) || 0, // ضمان الرقم
                createdAt: new Date().toISOString()
            });
            return true;
        } catch(e) { alert("خطأ في الإضافة: " + e.message); }
    },

    async updateSubscriber(id, data) {
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) {
            await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
        }
    },

    async deleteSubscriber(id) {
        if(!confirm("تحذير: سيتم حذف المشترك وجميع سجلاته نهائياً!")) return;
        const sub = this.getSubscriber(id);
        if (!sub) return;

        // حذف الديون والمعاملات المرتبطة أولاً
        const subTrans = localData.transactions.filter(t => t.subscriberId == id);
        for (const t of subTrans) {
            await deleteDoc(doc(db, "transactions", t.firebaseId));
        }
        // حذف المشترك
        await deleteDoc(doc(db, "subscribers", sub.firebaseId));
        alert("تم الحذف بنجاح.");
    },

    // --- المعاملات والديون ---
    async recordTransaction(subscriberId, amount, type = 'جزئي') {
        await addDoc(collection(db, "transactions"), {
            id: Date.now(),
            subscriberId: subscriberId,
            amount: parseInt(amount),
            type: type,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        });
    },

    async deleteTransaction(id) {
        const trans = localData.transactions.find(t => t.id == id);
        if (!trans) return;
        
        // إعادة الدين للمشترك عند حذف الوصل
        const sub = this.getSubscriber(trans.subscriberId);
        if (sub) {
            const newPrice = (sub.price || 0) + (trans.amount || 0);
            await this.updateSubscriber(sub.id, { 
                price: newPrice,
                paymentType: 'أجل' // إعادة تفعيل الدين
            });
        }
        await deleteDoc(doc(db, "transactions", trans.firebaseId));
    },

    // --- الصرفيات ---
    async addExpense(data) {
        await addDoc(collection(db, "expenses"), {
            ...data,
            id: Date.now(),
            amount: parseInt(data.amount),
            createdAt: new Date().toISOString()
        });
    },

    async deleteExpense(id) {
        if(!confirm("حذف الصرفية؟")) return;
        const exp = localData.expenses.find(e => e.id == id);
        if (exp) await deleteDoc(doc(db, "expenses", exp.firebaseId));
    },

    // --- الأرشيف (التقارير) ---
    async archiveDay() {
        const trans = this.getAllTransactions();
        if (trans.length === 0) return alert("لا توجد مبالغ لترحيلها.");
        if (!confirm(`ترحيل ${trans.length} فاتورة للأرشيف وتصفير اليوم؟`)) return;

        let count = 0;
        for (const t of trans) {
            // نسخ للأرشيف
            await addDoc(collection(db, "archived_transactions"), {
                ...t,
                archivedAt: new Date().toISOString()
            });
            // حذف من الحالي
            await deleteDoc(doc(db, "transactions", t.firebaseId));
            count++;
        }
        alert(`تم ترحيل ${count} فاتورة بنجاح.`);
    },

    async getArchivedData() {
        const q = query(collection(db, "archived_transactions"), orderBy("archivedAt", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({...d.data(), firebaseId: d.id}));
    },

    // --- الإحصائيات ---
    getStats() {
        const subs = this.getSubscribers();
        const debts = subs.filter(s => s.paymentType === 'أجل').reduce((sum, s) => sum + (s.price || 0), 0);
        return {
            total: subs.length,
            active: subs.filter(s => s.status === 'نشط').length,
            debts: debts,
            expired: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < new Date()).length
        };
    }
};

window.DataManager = DataManager;
document.addEventListener('DOMContentLoaded', () => DataManager.init());
