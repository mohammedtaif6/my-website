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

let localData = { subscribers: [], transactions: [], expenses: [], archived: [] };

export const DataManager = {
    init() {
        console.log("جار الاتصال بفايربيس...");
        this.sync('subscribers');
        this.sync('transactions');
        this.sync('expenses');
        this.sync('archived');
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

    async recordTransaction(subscriberId, amount, description, type = 'نقد') {
        await addDoc(collection(db, "transactions"), {
            subscriberId: subscriberId,
            amount: amount,
            description: description,
            type: type,
            id: Date.now(),
            createdAt: new Date().toISOString()
        });
    },

    getSubscriber(id) {
        return localData.subscribers.find(s => s.id == id);
    },

    getDebts() {
        return localData.subscribers.filter(s => s.paymentType === 'أجل' && s.price > 0);
    },

    async deleteTransaction(id) {
        if(!confirm("حذف التسديد؟")) return;
        const trans = localData.transactions.find(t => t.id == id);
        if(trans) await deleteDoc(doc(db, "transactions", trans.firebaseId));
    },

    async deleteExpense(id) {
        if(!confirm("حذف الصرفية؟")) return;
        const exp = localData.expenses.find(e => e.id == id);
        if(exp) await deleteDoc(doc(db, "expenses", exp.firebaseId));
    },

    async archiveDay() {
        if(!confirm("ترحيل المقبوضات اليومية للأرشيف؟")) return;
        // ترحيل جميع التسديدات الموجبة من اليوم
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = localData.transactions.filter(t => 
            t.createdAt.split('T')[0] === today && (t.amount || 0) > 0
        );
        
        if(todayTransactions.length === 0) {
            alert("لا توجد مقبوضات لترحيلها");
            return;
        }
        
        const archiveData = {
            date: today,
            transactions: todayTransactions,
            total: todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
            archivedAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, "archived"), archiveData);
        alert("تم الترحيل بنجاح");
    },

    async getArchivedData() {
        // جلب البيانات المؤرشفة
        if(!localData.archived || localData.archived.length === 0) {
            return [];
        }
        return localData.archived;
    },

    async deleteArchivedTransaction(firebaseId) {
        if(!confirm("حذف هذا السجل المؤرشف؟")) return;
        await deleteDoc(doc(db, "archived", firebaseId));
    },

    // الإحصائيات
    getStats() {
        const subs = localData.subscribers;
        const trans = localData.transactions;

        // الديون = المشتركين من نوع "أجل" فقط
        const debts = subs.filter(s => s.paymentType === 'أجل' && s.price > 0).reduce((sum, s) => sum + (s.price || 0), 0);
        
        // الواردات = فقط المبالغ الموجبة من التسديدات
        const totalReceived = trans.filter(t => (t.amount || 0) > 0).reduce((sum, t) => sum + (t.amount || 0), 0);
        
        // الصرفيات = المبالغ السالبة في transactions فقط (بدون جدول منفصل)
        const totalExpenses = trans.filter(t => (t.amount || 0) < 0).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

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
