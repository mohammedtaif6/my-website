/**
 * DataManager v6.0 - النسخة النهائية
 * المميزات: نظام إشعارات Toast، حساب دقيق للصندوق، ربط فوري بفايربيس
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

// === نظام الإشعارات (Toasts) ===
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const DataManager = {
    init() {
        console.log("🚀 النظام يعمل...");
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
            // تحديث الواجهة فور وصول البيانات
            this.refreshUI();
        }, (error) => {
            console.error("خطأ في المزامنة:", error);
            showToast("فشل الاتصال بالسيرفر", "error");
        });
    },

    refreshUI() {
        // توحيد دالة العرض لكل الصفحات
        if (typeof window.renderPage === 'function') window.renderPage();
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
    },

    // --- القراءات ---
    getSubscribers() { return localData.subscribers; },
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },
    getExpenses() { return localData.expenses; },
    getAllTransactions() { return localData.transactions; },

    searchSubscribers(query) {
        if (!query || query.trim() === '') return localData.subscribers;
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
            showToast("تمت إضافة المشترك بنجاح");
        } catch(e) { showToast("خطأ: " + e.message, "error"); }
    },

    async updateSubscriber(id, data) {
        const sub = this.getSubscriber(id);
        if (sub && sub.firebaseId) {
            await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
            showToast("تم تحديث البيانات");
        }
    },

    async deleteSubscriber(id) {
        if(!confirm("هل أنت متأكد من حذف المشترك؟")) return;
        const sub = this.getSubscriber(id);
        if (sub) {
            // حذف من فايربيس
            const trans = localData.transactions.filter(t => t.subscriberId == id);
            for(let t of trans) await deleteDoc(doc(db, "transactions", t.firebaseId));
            await deleteDoc(doc(db, "subscribers", sub.firebaseId));
            showToast("تم الحذف بنجاح");
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
        showToast("تم تسجيل الدفعة");
    },

    async deleteTransaction(id) {
        const trans = localData.transactions.find(t => t.id == id);
        if (!trans) return;
        
        // إرجاع الدين للمشترك قبل الحذف
        const sub = this.getSubscriber(trans.subscriberId);
        if (sub) {
            await this.updateSubscriber(sub.id, { 
                price: (sub.price || 0) + (trans.amount || 0),
                paymentType: 'أجل'
            });
        }
        
        // حذف نهائي من فايربيس
        await deleteDoc(doc(db, "transactions", trans.firebaseId));
        showToast("تم حذف الفاتورة وإرجاع المبلغ");
    },

    async addExpense(data) {
        await addDoc(collection(db, "expenses"), {
            ...data,
            id: Date.now(),
            amount: parseInt(data.amount),
            createdAt: new Date().toISOString()
        });
        showToast("تم إضافة الصرفية");
    },

    async deleteExpense(id) {
        if(!confirm("حذف هذه الصرفية؟")) return;
        const exp = localData.expenses.find(e => e.id == id);
        if (exp) {
            await deleteDoc(doc(db, "expenses", exp.firebaseId));
            showToast("تم حذف الصرفية");
        }
    },

    // --- الأرشيف ---
    async archiveDay() {
        const trans = this.getAllTransactions();
        if (trans.length === 0) return showToast("لا توجد مبالغ للترحيل", "info");
        if (!confirm(`ترحيل ${trans.length} وصل؟`)) return;
        
        for (let t of trans) {
            await addDoc(collection(db, "archived_transactions"), { ...t, archivedAt: new Date().toISOString() });
            await deleteDoc(doc(db, "transactions", t.firebaseId));
        }
        showToast("تم ترحيل البيانات وتصفير الصندوق");
    },

    async getArchivedData() {
        const snap = await getDocs(query(collection(db, "archived_transactions"), orderBy("archivedAt", "desc")));
        return snap.docs.map(d => ({...d.data(), firebaseId: d.id}));
    },

    async deleteArchivedTransaction(firebaseId) {
        if(!confirm("حذف من الأرشيف نهائياً؟")) return;
        await deleteDoc(doc(db, "archived_transactions", firebaseId));
        showToast("تم الحذف من الأرشيف");
        if (typeof window.loadReports === 'function') window.loadReports();
    },

    // --- الإحصائيات (الحسابات الصحيحة) ---
    getStats() {
        const subs = this.getSubscribers();
        const trans = this.getAllTransactions();
        const exps = this.getExpenses();
        const today = new Date();

        // 1. الديون (أجل + مبلغ > 0)
        const debts = subs.filter(s => s.paymentType === 'أجل').reduce((sum, s) => sum + (s.price || 0), 0);
        
        // 2. الواردات (اشتراكات نقدية + تسديد ديون)
        const cashSubs = subs.filter(s => s.paymentType === 'نقد').reduce((sum, s) => sum + (s.price || 0), 0);
        const transTotal = trans.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalIncome = cashSubs + transTotal;

        // 3. المصروفات
        const totalExpenses = exps.reduce((sum, e) => sum + (e.amount || 0), 0);

        // 4. الصافي في الصندوق (هذا الرقم المهم)
        // إذا أردت عرضه في كرت "الواردات" ليعكس الصافي، استخدم netCash
        const netCash = totalIncome - totalExpenses;

        const expired = subs.filter(s => s.expiryDate && new Date(s.expiryDate) < today).length;
        const expiring = subs.filter(s => {
            if(!s.expiryDate) return false;
            const diff = (new Date(s.expiryDate) - today) / (1000*60*60*24);
            return diff >= 0 && diff <= 3;
        }).length;

        return {
            totalSubs: subs.length,
            active: subs.filter(s => s.status === 'نشط').length,
            debts: debts,
            received: netCash, // الآن هذا الرقم يعرض الصافي (بعد خصم المصاريف)
            expenses: totalExpenses,
            expired: expired,
            expiring: expiring
        };
    }
};

window.DataManager = DataManager;
document.addEventListener('DOMContentLoaded', () => DataManager.init());
