/**
 * DataManager v13.0 - Unified Ledger + Archiving + No Alerts + Smart Validation
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === Firebase Configuration (Same as before) ===
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

try { enableIndexedDbPersistence(db).catch(() => { }); } catch (e) { }

let localData = { subscribers: [], transactions: [] };
let isProcessing = false;

// === Custom Notification Helper (Toast) ===
function showToast(message, type = 'success') {
    // Create toast container if not exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 3000; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white; padding: 12px 24px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 600;
        animation: slideUpFade 0.3s ease-out; font-family: 'Cairo', sans-serif;
    `;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS animation for toast
const style = document.createElement('style');
style.innerHTML = `@keyframes slideUpFade { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`;
document.head.appendChild(style);


export const DataManager = {
    init() {
        console.log("System v13.0 Initializing...");
        this.sync('subscribers');
        this.sync('transactions');
    },

    sync(colName) {
        const q = query(collection(db, colName), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            localData[colName] = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
            if (window.updatePageData) window.updatePageData();
        });
    },

    async logTransaction(data) {
        if (isProcessing) return;
        isProcessing = true;
        try {
            const txRecord = {
                id: Date.now(),
                createdAt: new Date().toISOString(),
                isArchived: false, // Default: visible in daily box
                ...data
            };
            await addDoc(collection(db, "transactions"), txRecord);
            // showToast("تم تسجيل العملية بنجاح"); // Optional to reduce noise
        } catch (e) {
            console.error(e);
            showToast("حدث خطأ في التسجيل", "error");
        } finally {
            isProcessing = false;
        }
    },

    // === Subscriber Logic ===

    async addSubscriber(data) {
        const subData = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            name: data.name,
            phone: data.phone,
            price: data.price || 0,
            status: data.status || 'نشط',
            paymentType: data.paymentType || 'نقد',
            expiryDate: data.expiryDate || '',
            note: ''
        };

        const subRef = await addDoc(collection(db, "subscribers"), subData);

        // Transaction Logic
        const initialAmount = data.initialPrice || 0;
        if (subData.paymentType === 'نقد' && initialAmount > 0) {
            await this.logTransaction({
                subscriberId: subData.id,
                amount: parseInt(initialAmount),
                type: 'subscription_cash',
                description: `اشتراك جديد (نقد): ${subData.name}`
            });
            await updateDoc(doc(db, "subscribers", subRef.id), { price: 0 }); // Clear debt if cash
        } else if (subData.paymentType === 'أجل' && initialAmount > 0) {
            await this.logTransaction({
                subscriberId: subData.id,
                amount: parseInt(initialAmount),
                type: 'subscription_debt',
                description: `اشتراك جديد (أجل): ${subData.name}`
            });
        }
        showToast("تم إضافة المشترك بنجاح");
    },

    async renewSubscription(subscriberFirebaseId, subscriberDataId, renewalData) {
        // Prevent Double Activation
        const sub = localData.subscribers.find(s => s.firebaseId === subscriberFirebaseId);
        if (sub && sub.expiryDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const exp = new Date(sub.expiryDate);
            if (exp >= today) {
                // If it looks like a mistake, block it. But sometimes users want to extend early.
                // We will just WARN, but the user asked to "not allow".
                // Let's be strict:
                throw new Error(`المشترك فعال بالفعل وينتهي في ${sub.expiryDate}. لا يمكن التفعيل مرتين.`);
            }
        }

        let newDebt = parseInt(sub.price || 0);

        if (renewalData.type === 'أجل') {
            newDebt += parseInt(renewalData.price);
            await this.logTransaction({
                subscriberId: subscriberDataId,
                amount: parseInt(renewalData.price),
                type: 'subscription_debt', // Just debt record, not cash
                description: `تجديد اشتراك (أجل) - ${renewalData.dateEnd}`
            });
        } else {
            // Cash payment
            await this.logTransaction({
                subscriberId: subscriberDataId,
                amount: parseInt(renewalData.price),
                type: 'subscription_cash',
                description: `تجديد اشتراك (نقد) - ${renewalData.dateEnd}`
            });
        }

        await updateDoc(doc(db, "subscribers", subscriberFirebaseId), {
            status: 'نشط',
            expiryDate: renewalData.dateEnd,
            paymentType: renewalData.type,
            price: newDebt
        });
        showToast("تم تجديد الاشتراك");
    },

    async updateSubscriber(id, data) {
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) {
            await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
            showToast("تم تحديث البيانات");
        }
    },

    async payDebt(subscriberFirebaseId, subscriberDataId, amount) {
        const sub = localData.subscribers.find(s => s.firebaseId === subscriberFirebaseId);
        if (!sub) return;

        const currentDebt = parseInt(sub.price || 0);
        const newDebt = Math.max(0, currentDebt - amount);

        await this.logTransaction({
            subscriberId: subscriberDataId,
            amount: parseInt(amount),
            type: 'debt_payment',
            description: `تسديد دفعة من الدين: ${sub.name}`
        });

        await updateDoc(doc(db, "subscribers", subscriberFirebaseId), {
            price: newDebt,
            paymentType: newDebt === 0 ? 'نقد' : 'أجل'
        });
        showToast("تم تسجيل الدفعة");
    },

    // Expenses are just negative transactions
    async addExpense(amount, description) {
        await this.logTransaction({
            subscriberId: null,
            amount: -Math.abs(amount), // Ensure negative
            type: 'expense',
            description: description
        });
        showToast("تم حفظ الصرفية");
    },

    // Allow manual generic transaction
    async recordTransaction(subscriberId, amount, description, type) {
        await this.logTransaction({
            subscriberId, amount, description, type
        });
        showToast("تم الحفظ");
    },

    // === Archiving & Management ===

    async archiveAllCurrent() {
        // Find all unarchived transactions
        const unarchived = localData.transactions.filter(t => !t.isArchived);
        if (unarchived.length === 0) return showToast("لا توجد بيانات للترحيل", "error");

        if (!confirm("هل أنت متأكد من ترحيل المبالغ الحالية إلى التقارير؟ سيتم تصفير الصندوق اليومي.")) return;

        const batchPromises = unarchived.map(t =>
            updateDoc(doc(db, "transactions", t.firebaseId), { isArchived: true })
        );

        await Promise.all(batchPromises);
        showToast("تم ترحيل البيانات بنجاح ✅");
    },

    async deleteTransaction(id) {
        if (!confirm("حذف السجل نهائياً؟")) return;
        const t = localData.transactions.find(tx => tx.id == id);
        if (t) {
            await deleteDoc(doc(db, "transactions", t.firebaseId));
            showToast("تم الحذف");
        }
    },

    async updateTransaction(id, newData) {
        const t = localData.transactions.find(tx => tx.id == id);
        if (t) {
            await updateDoc(doc(db, "transactions", t.firebaseId), newData);
            showToast("تم تعديل المعاملة");
        }
    },

    async deleteSubscriber(id) {
        if (!confirm("حذف المشترك نهائياً؟")) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) {
            await deleteDoc(doc(db, "subscribers", sub.firebaseId));
            showToast("تم حذف المشترك");
        }
    },

    // === Getters ===

    // For Dashboard Card: Net Balance (Income - Expenses)
    // Should calculate based on ALL TIME or CURRENT DAY? 
    // Usually "Box" means current cash on hand (Unarchived).
    getDailyBalance() {
        const currentTxs = localData.transactions.filter(t => !t.isArchived && t.type !== 'subscription_debt');
        const income = currentTxs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expense = currentTxs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return income - expense;
    },

    getAllTransactions() { return localData.transactions; },
    getSubscribers() { return localData.subscribers; },
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },

    searchSubscribers(queryText) {
        if (!queryText) return localData.subscribers;
        return localData.subscribers.filter(s => s.name && s.name.toLowerCase().includes(queryText.toLowerCase()));
    },

    getStats() {
        const subs = localData.subscribers;
        const txs = localData.transactions; // All history

        // Total Debts from profiles
        const totalDebts = subs.reduce((sum, s) => sum + (parseInt(s.price) || 0), 0);

        // Net Balance (Box) - Unarchived only
        const boxBalance = this.getDailyBalance();

        // Expired Logic
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return {
            totalSubs: subs.length,
            debts: totalDebts,
            boxBalance: boxBalance, // This replaces "Received" & "Expenses" separate stats in dashboard usually
            expired: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < today).length,
            expiring: subs.filter(s => {
                if (!s.expiryDate) return false;
                const d = new Date(s.expiryDate);
                const diffTime = d - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > 0 && diffDays <= 3;
            }).length
        };
    },

    showToast
};
