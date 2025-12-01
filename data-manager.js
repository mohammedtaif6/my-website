/**
 * DataManager v5.0 - النسخة المصححة
 * تم إصلاح خطأ اختفاء المشتركين في البداية
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
        console.log("🚀 النظام يعمل... جاري المزامنة");
        this.syncCollection('subscribers');
        this.syncCollection('transactions');
        this.syncCollection('expenses');
    },

    syncCollection(colName) {
        const q = query(collection(db, colName), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            localData[colName] = snapshot.docs.map(d => {
                const data = d.data();
                // تصحيح الأرقام لضمان عمل الحسابات
                if (data.price) data.price = parseInt(data.price) || 0;
                if (data.amount) data.amount = parseInt(data.amount) || 0;
                return { ...data, firebaseId: d.id };
            });
            this.refreshUI();
        });
    },

    refreshUI() {
        if (typeof window.renderPage === 'function') window.renderPage();
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
        if (typeof window.loadReports === 'function') window.loadReports();
    },

    // --- القراءات ---
    getSubscribers() { return localData.subscribers; },
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },
    getExpenses() { return localData.expenses; },
    getAllTransactions() { return localData.transactions; },

    // === التصحيح هنا: إظهار الكل إذا كان البحث فارغاً ===
    searchSubscribers(query) {
        if (!query || query.trim() === '') {
            return localData.subscribers; // إرجاع الجميع
        }
        const q = query.toLowerCase();
        return localData.subscribers.filter(s => 
            (s.name && s.name.toLowerCase().includes(q)) || 
            (s.phone && s.phone.includes(q))
        );
    },

    // --- العمليات ---
    async addSubscriber(data) {
        try {
            await addDoc(collection(db, "subscribers"), {
                ...data,
                id: Date.now(),
                price: parseInt(data.price) || 0,
                createdAt: new Date().toISOString()
            });
        } catch(e) { alert("خطأ: " + e.message); }
    },

    async updateSubscriber(id, data) {
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
    },

    async deleteSubscriber(id) {
        if(!confirm("حذف المشترك نهائياً؟")) return;
        const sub = this.getSubscriber(id);
        if (sub) {
            const trans = localData.transactions.filter(t => t.subscriberId == id);
            for(let t of trans) await deleteDoc(doc(db, "transactions", t.firebaseId));
            await deleteDoc(doc(db, "subscribers", sub.firebaseId));
        }
    },

    async recordTransaction(subscriberId, amount, type = 'جزئي') {
        await addDoc(collection(db, "transactions"), {
            id: Date.now(),
            subscriberId,
            amount: parseInt(amount),
            type,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        });
    },

    async deleteTransaction(id) {
        const trans = localData.transactions.find(t => t.id == id);
        if (!trans) return;
        const sub = this.getSubscriber(trans.subscriberId);
        if (sub) {
            await this.updateSubscriber(sub.id, { 
                price: (sub.price || 0) + (trans.amount || 0),
                paymentType: 'أجل'
            });
        }
        await deleteDoc(doc(db, "transactions", trans.firebaseId));
    },

    async addExpense(data) {
        await addDoc(collection(db, "expenses"), {
            ...data,
            id: Date.now(),
            amount: parseInt(data.amount),
            createdAt: new Date().toISOString()
        });
    },

    async deleteExpense(id) {
        const exp = localData.expenses.find(e => e.id == id);
        if (exp) await deleteDoc(doc(db, "expenses", exp.firebaseId));
    },

    // --- الأرشيف (التقارير) ---
    async archiveDay() {
        const trans = this.getAllTransactions();
        if (trans.length === 0) return alert("لا يوجد مبالغ للترحيل");
        if (!confirm(`ترحيل ${trans.length} وصل؟`)) return;
        
        for (let t of trans) {
            await addDoc(collection(db, "archived_transactions"), { ...t, archivedAt: new Date().toISOString() });
            await deleteDoc(doc(db, "transactions", t.firebaseId));
        }
        alert("تم الترحيل.");
    },

    async getArchivedData() {
        const snap = await getDocs(query(collection(db, "archived_transactions"), orderBy("archivedAt", "desc")));
        return snap.docs.map(d => ({...d.data(), firebaseId: d.id}));
    },

    async deleteArchivedTransaction(firebaseId) {
        if(!confirm("حذف هذا السجل من الأرشيف؟")) return;
        await deleteDoc(doc(db, "archived_transactions", firebaseId));
        if (typeof window.loadReports === 'function') window.loadReports();
    },

    // --- الإحصائيات ---
    getStats() {
        const subs = this.getSubscribers();
        const trans = this.getAllTransactions();
        const exps = this.getExpenses();
        
        const debts = subs.filter(s => s.paymentType === 'أجل').reduce((sum, s) => sum + (s.price || 0), 0);
        const cashSubs = subs.filter(s => s.paymentType === 'نقد').reduce((sum, s) => sum + (s.price || 0), 0);
        const transTotal = trans.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalReceived = cashSubs + transTotal;
        const totalExpenses = exps.reduce((sum, e) => sum + (e.amount || 0), 0);

        return {
            totalSubs: subs.length,
            active: subs.filter(s => s.status === 'نشط').length,
            debts: debts,
            received: totalReceived,
            expenses: totalExpenses,
            expired: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < new Date()).length,
            expiring: subs.filter(s => {
                if(!s.expiryDate) return false;
                const diff = (new Date(s.expiryDate) - new Date()) / (1000*60*60*24);
                return diff >= 0 && diff <= 3;
            }).length
        };
    }
};

window.DataManager = DataManager;
document.addEventListener('DOMContentLoaded', () => DataManager.init());
