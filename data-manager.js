/**
 * DataManager v11.0 - Core Engine - Optimized
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// محاولة تفعيل الكاش (Offline Support)
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
        } else if (err.code == 'unimplemented') {
            console.log('The current browser does not support all of the features required to enable persistence');
        }
    });
} catch(e) { console.log("Persistence not supported"); }

let localData = { subscribers: [], transactions: [], expenses: [], archived: [] };
let isProcessing = false; // قفل لمنع التكرار

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
            // تحديث البيانات المحلية فقط عند وصول بيانات جديدة من السيرفر
            const newData = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
            
            // مقارنة بسيطة لتجنب التحديثات غير الضرورية للواجهة
            if (JSON.stringify(localData[colName]) !== JSON.stringify(newData)) {
                localData[colName] = newData;
                if(window.updatePageData) window.updatePageData();
            }
        });
    },

    // قراءة البيانات
    getSubscribers() { return localData.subscribers; },
    getExpenses() { return localData.expenses; },
    getAllTransactions() { return localData.transactions; },

    searchSubscribers(queryText) {
        if(!queryText) return localData.subscribers;
        return localData.subscribers.filter(s => s.name && s.name.toLowerCase().includes(queryText.toLowerCase()));
    },

    // العمليات بآلية منع التكرار
    async safeExecute(operation) {
        if (isProcessing) return; // إذا كان هناك عملية جارية، تجاهل الطلب
        isProcessing = true;
        try {
            await operation();
        } catch (error) {
            console.error("Error executing operation:", error);
            alert("حدث خطأ أثناء العملية: " + error.message);
        } finally {
            isProcessing = false;
        }
    },

    async addSubscriber(data) {
        await this.safeExecute(async () => {
            // التحقق من عدم وجود المشترك بنفس الاسم مسبقاً لتجنب التكرار
            const exist = localData.subscribers.find(s => s.name === data.name);
            if(exist && !confirm("يوجد مشترك بهذا الاسم بالفعل، هل تريد إضافته مرة أخرى؟")) return;

            await addDoc(collection(db, "subscribers"), {
                ...data, id: Date.now(), createdAt: new Date().toISOString()
            });
        });
    },

    async updateSubscriber(id, data) {
        await this.safeExecute(async () => {
            const sub = localData.subscribers.find(s => s.id == id);
            if(sub) await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
        });
    },

    async deleteSubscriber(id) {
        // الحذف لا يحتاج لقفل صارم مثل الإضافة، لكن لا بأس به
        if(!confirm("حذف؟")) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if(sub) await deleteDoc(doc(db, "subscribers", sub.firebaseId));
    },

    async addExpense(data) {
        await this.safeExecute(async () => {
            await addDoc(collection(db, "expenses"), {
                ...data, id: Date.now(), createdAt: new Date().toISOString()
            });
        });
    },

    // تسجيل معاملة مالية
    async recordTransaction(subscriberId, amount, description, type = 'نقد') {
        const transData = {
            subscriberId: subscriberId,
            amount: amount,
            description: description,
            type: type,
            id: Date.now(),
            createdAt: new Date().toISOString()
        };
        
        // هنا لا نستخدم safeExecute الخارجية لأن هذه الدالة غالباً تُستدعى من دوال أخرى محمية
        // ولكن إذا تم استدعاؤها مباشرة، يجب أن نضمن عدم التكرار.
        // سنضيف تأخير بسيط عشوائي لتقليل احتمال التصادم إذا استدعينا الدالة مرتين بسرعة
        
        await addDoc(collection(db, "transactions"), transData);
    },

    getSubscriber(id) {
        return localData.subscribers.find(s => s.id == id);
    },

    getDebts() {
        return localData.subscribers.filter(s => s.paymentType === 'أجل' && s.price > 0);
    },

    async deleteTransaction(id) {
        if(!confirm("حذف السجل المالي؟")) return;
        const trans = localData.transactions.find(t => t.id == id);
        if(trans) await deleteDoc(doc(db, "transactions", trans.firebaseId));
    },

    async deleteExpense(id) {
        if(!confirm("حذف الصرفية؟")) return;
        const exp = localData.expenses.find(e => e.id == id);
        if(exp) await deleteDoc(doc(db, "expenses", exp.firebaseId));
    },

    // الإحصائيات المحسنة
    getStats() {
        const subs = localData.subscribers;
        const trans = localData.transactions;

        // الديون: هي مجموع المبالغ المتبقية في ذمة المشتركين الذين نوع دفعهم "أجل"
        const debts = subs
            .filter(s => s.paymentType === 'أجل' && s.price > 0)
            .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
        
        // الواردات: مجموع كل المعاملات الموجبة
        const totalReceived = trans
            .filter(t => (t.amount || 0) > 0)
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        
        // الصرفيات: مجموع كل المعاملات السالبة (القيمة المطلقة)
        const totalExpenses = trans
            .filter(t => (t.amount || 0) < 0)
            .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        return {
            totalSubs: subs.length,
            debts: debts,
            received: totalReceived,
            expenses: totalExpenses,
            expired: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < new Date()).length,
            // المشتركين الذين سينتهي اشتراكهم خلال 3 أيام
            expiring: subs.filter(s => {
                const exp = new Date(s.expiryDate);
                const now = new Date();
                const diffTime = exp - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                return diffDays > 0 && diffDays <= 3;
            }).length
        };
    }
};
