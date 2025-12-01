/**
 * DataManager v11.0 - Stable Connection
 * تم تفعيل Long Polling لحل مشاكل الاتصال (Error 400)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, initializeFirestore, CACHE_SIZE_UNLIMITED 
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

// === التعديل الجذري: إجبار النظام على استخدام Long Polling لضمان الاتصال ===
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true, // حل مشكلة 400 Bad Request
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

let localData = { subscribers: [], transactions: [], expenses: [] };

export const DataManager = {
    init() {
        console.log("🚀 جار الاتصال بفايربيس (وضع الاستقرار)...");
        this.sync('subscribers');
        this.sync('transactions');
        this.sync('expenses');
    },

    sync(colName) {
        // نستخدم try-catch لمنع توقف النظام بالكامل عند حدوث خطأ
        try {
            const q = query(collection(db, colName), orderBy("createdAt", "desc"));
            onSnapshot(q, (snapshot) => {
                localData[colName] = snapshot.docs.map(d => {
                    const data = d.data();
                    // تصحيح الأرقام لضمان عدم ظهور NaN
                    if (data.price) data.price = Number(data.price) || 0;
                    if (data.amount) data.amount = Number(data.amount) || 0;
                    return { ...data, firebaseId: d.id };
                });
                
                // تحديث الواجهة إذا كانت الدالة موجودة
                if(window.updateDashboard) window.updateDashboard();
                if(window.renderPage) window.renderPage();
                
            }, (error) => {
                console.error(`خطأ في مزامنة ${colName}:`, error);
                // محاولة إعادة الاتصال بعد 5 ثواني
                setTimeout(() => this.sync(colName), 5000);
            });
        } catch (e) {
            console.error("خطأ غير متوقع:", e);
        }
    },

    // --- قراءة البيانات ---
    getSubscribers() { return localData.subscribers; },
    getExpenses() { return localData.expenses; },
    getAllTransactions() { return localData.transactions; },

    searchSubscribers(query) {
        if(!query) return localData.subscribers;
        return localData.subscribers.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    },

    // --- العمليات ---
    async addSubscriber(data) {
        await addDoc(collection(db, "subscribers"), {
            ...data, id: Date.now(), createdAt: new Date().toISOString()
        });
    },

    async updateSubscriber(id, data) {
        const sub = localData.subscribers.find(s => s.id == id);
        if(sub) await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
    },

    async deleteSubscriber(id) {
        if(!confirm("حذف المشترك نهائياً؟")) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if(sub) {
            // حذف الديون المرتبطة
            const trans = localData.transactions.filter(t => t.subscriberId == id);
            for (let t of trans) await deleteDoc(doc(db, "transactions", t.firebaseId));
            await deleteDoc(doc(db, "subscribers", sub.firebaseId));
        }
    },

    async recordTransaction(subscriberId, amount, type = 'جزئي') {
        await addDoc(collection(db, "transactions"), {
            id: Date.now(), subscriberId, amount: Number(amount), type,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        });
    },

    async addExpense(data) {
        await addDoc(collection(db, "expenses"), {
            ...data, id: Date.now(), createdAt: new Date().toISOString()
        });
    },

    async deleteExpense(id) {
        if(!confirm("حذف الصرفية؟")) return;
        const exp = localData.expenses.find(e => e.id == id);
        if(exp) await deleteDoc(doc(db, "expenses", exp.firebaseId));
    },

    // --- الإحصائيات الدقيقة ---
    getStats() {
        const subs = localData.subscribers;
        const trans = localData.transactions;
        const exps = localData.expenses;
        const today = new Date();

        // الديون: المشتركين "أجل" ومبلغهم > 0
        const debts = subs.filter(s => s.paymentType === 'أجل' && s.price > 0)
                          .reduce((sum, s) => sum + (s.price || 0), 0);
        
        // الواردات: (اشتراكات نقد) + (مبالغ واصلة في المعاملات)
        const cashIncome = subs.filter(s => s.paymentType === 'نقد').reduce((sum, s) => sum + (s.price || 0), 0);
        const transIncome = trans.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalReceived = cashIncome + transIncome;

        const totalExpenses = exps.reduce((sum, e) => sum + (e.amount || 0), 0);

        // المنتهية: تاريخ الانتهاء أصغر من اليوم
        const expired = subs.filter(s => s.expiryDate && new Date(s.expiryDate) < today).length;
        
        // قريباً: خلال 3 أيام
        const expiring = subs.filter(s => {
            if(!s.expiryDate) return false;
            const diff = (new Date(s.expiryDate) - today) / (1000*60*60*24);
            return diff >= 0 && diff <= 3;
        }).length;

        return {
            totalSubs: subs.length,
            debts: debts,
            received: totalReceived,
            expenses: totalExpenses,
            expired: expired,
            expiring: expiring
        };
    }
};
