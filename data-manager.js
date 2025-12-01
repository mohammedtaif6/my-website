/**
 * DataManager v10.0 - القلب النابض
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

export const DataManager = {
    init() {
        console.log("جار الاتصال بفايربيس...");
        this.sync('subscribers');
        this.sync('transactions');
        this.sync('expenses');
    },

    sync(colName) {
        const q = query(collection(db, colName), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            localData[colName] = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
            if(window.updatePageData) window.updatePageData();
        });
    },

    // قراءة البيانات
    getSubscribers() { return localData.subscribers; },
    getExpenses() { return localData.expenses; },
    getAllTransactions() { return localData.transactions; },

    searchSubscribers(query) {
        if(!query) return localData.subscribers;
        return localData.subscribers.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    },

    // العمليات
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
        if(!confirm("حذف؟")) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if(sub) await deleteDoc(doc(db, "subscribers", sub.firebaseId));
    },

    async addExpense(data) {
        await addDoc(collection(db, "expenses"), {
            ...data, id: Date.now(), createdAt: new Date().toISOString()
        });
    },

    // الإحصائيات
    getStats() {
        const subs = localData.subscribers;
        const trans = localData.transactions;
        const exps = localData.expenses;

        const debts = subs.filter(s => s.paymentType === 'أجل').reduce((sum, s) => sum + (s.price || 0), 0);
        
        // الواردات = (الاشتراكات النقدية) + (تسديد الديون)
        const cashIncome = subs.filter(s => s.paymentType === 'نقد').reduce((sum, s) => sum + (s.price || 0), 0);
        const transIncome = trans.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalReceived = cashIncome + transIncome;

        const totalExpenses = exps.reduce((sum, e) => sum + (e.amount || 0), 0);

        return {
            totalSubs: subs.length,
            debts: debts,
            received: totalReceived,
            expenses: totalExpenses,
            expired: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < new Date()).length,
            expiring: 0 // يمكن حسابها لاحقاً
        };
    }
};
