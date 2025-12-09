/**
 * DataManager v14.3 - Fixed Firebase Initialization
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA-raYlvzPz8T7Mnx8bTWA4O8CyHvp7K_0",
    authDomain: "okcomputer-system.firebaseapp.com",
    projectId: "okcomputer-system",
    storageBucket: "okcomputer-system.firebasestorage.app",
    messagingSenderId: "17748146044",
    appId: "1:17748146044:web:e4a2063ac34c6ee27016f9"
};

const app = initializeApp(firebaseConfig);

// الطريقة الصحيحة: استخدام initializeFirestore مع localCache
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

console.log('✅ Firebase مُهيأ بالتخزين المحلي المتقدم - جاهز للعمل!');

let localData = { subscribers: [], transactions: [] };
let isProcessing = false;

// === Toast Logic ===
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container); // Relies on CSS for styling
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = type === 'error' ? `<i class="fas fa-exclamation-circle"></i> ${message}` : `<i class="fas fa-check-circle"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export const DataManager = {
    init() {
        console.log("========================================");
        console.log("🚀 System v14.3 - Multi-User Support");
        console.log("========================================");
        this.sync('subscribers');
        this.sync('transactions');
        this.monitorConnection();
    },

    // مراقبة حالة الاتصال بـ Firebase
    monitorConnection() {
        // استماع لأي أخطاء في الاتصال
        window.addEventListener('online', () => {
            console.log('✅ الإنترنت متصل - البيانات ستتزامن الآن');
            showToast('تم الاتصال بالإنترنت', 'success');
        });

        window.addEventListener('offline', () => {
            console.log('❌ الإنترنت منقطع - النظام يعمل من التخزين المحلي');
            showToast('الإنترنت منقطع - تعمل من البيانات المحلية', 'error');
        });

        // فحص الاتصال الأولي
        if (!navigator.onLine) {
            console.warn('⚠️ لا يوجد اتصال بالإنترنت');
        }
    },

    sync(colName) {
        const q = query(collection(db, colName), orderBy("createdAt", "desc"));

        onSnapshot(q,
            (snapshot) => {
                const prevCount = localData[colName].length;
                localData[colName] = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
                const newCount = localData[colName].length;

                console.log(`📊 ${colName}: ${newCount} سجل (${snapshot.docChanges().length} تغيير)`);

                // عرض رسالة عند استلام بيانات جديدة
                if (snapshot.docChanges().length > 0 && prevCount > 0) {
                    const changes = snapshot.docChanges();
                    changes.forEach(change => {
                        if (change.type === 'added' && prevCount > 0) {
                            console.log('✨ سجل جديد تمت إضافته من مستخدم آخر');
                        }
                    });
                }

                if (window.updatePageData) window.updatePageData();
            },
            (error) => {
                console.error(`❌ خطأ في مزامنة ${colName}:`, error);
                if (error.code === 'permission-denied') {
                    showToast('خطأ: ليس لديك صلاحية الوصول! تحقق من قواعد Firebase', 'error');
                    console.error('==================================================');
                    console.error('⚠️ مشكلة صلاحيات Firebase!');
                    console.error('الحل: افتح ملف FIREBASE-RULES-FIX.txt');
                    console.error('==================================================');
                } else {
                    showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
                }
            }
        );
    },

    async logTransaction(data) {
        if (isProcessing) return; isProcessing = true;
        try {
            await addDoc(collection(db, "transactions"), {
                id: Date.now(),
                createdAt: new Date().toISOString(),
                isArchived: false,
                ...data
            });
        } catch (e) { console.error(e); showToast("خطأ أمني", "error"); }
        finally { isProcessing = false; }
    },

    // WhatsApp Helper
    sendWhatsApp(sub, amount, type, endDate) {
        if (!sub.phone) return;
        // Clean phone number (Iraq format)
        let phone = sub.phone.replace(/\D/g, ''); // Remove non-digits
        if (phone.startsWith('0')) phone = phone.substring(1);
        if (!phone.startsWith('964')) phone = '964' + phone;

        const msg = `مرحباً ${sub.name}،
تم ${type === 'تجديد' ? 'تجديد اشتراكك' : 'تفعيل اشتراكك'} بنجاح.
المبلغ: ${amount.toLocaleString()} د.ع
تاريخ الانتهاء: ${endDate}
شكراً لثقتكم بنا - OK Computer`;

        // Encode and open
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    },

    async addSubscriber(data) {
        // Prevent dupes? (Maybe later)
        const subData = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            ...data
        };
        const subRef = await addDoc(collection(db, "subscribers"), subData);

        const initialAmount = data.initialPrice || 0;
        if (initialAmount > 0) {
            await this.logTransaction({
                subscriberId: subData.id,
                amount: parseInt(initialAmount),
                type: data.paymentType === 'نقد' ? 'subscription_cash' : 'subscription_debt',
                description: `اشتراك جديد (${data.paymentType}): ${subData.name}`
            });
            if (data.paymentType === 'نقد') await updateDoc(doc(db, "subscribers", subRef.id), { price: 0 });
        }
        showToast("تمت الإضافة بنجاح");
    },

    async renewSubscription(subscriberFirebaseId, subscriberDataId, renewalData) {
        const sub = localData.subscribers.find(s => s.firebaseId === subscriberFirebaseId);

        // Strict Double Activation Check
        if (sub && sub.expiryDate) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const exp = new Date(sub.expiryDate);
            if (exp > today) { throw new Error(`الاشتراك فعال وينتهي في ${sub.expiryDate}`); }
        }

        let newDebt = parseInt(sub.price || 0);
        if (renewalData.type === 'أجل') newDebt += parseInt(renewalData.price);

        await this.logTransaction({
            subscriberId: subscriberDataId,
            amount: parseInt(renewalData.price),
            type: renewalData.type === 'نقد' ? 'subscription_cash' : 'subscription_debt',
            description: `تجديد (${renewalData.type}) - ${renewalData.dateEnd}`
        });

        await updateDoc(doc(db, "subscribers", subscriberFirebaseId), {
            status: 'نشط', expiryDate: renewalData.dateEnd, paymentType: renewalData.type, price: newDebt
        });
        showToast("تم التجديد بنجاح");
    },

    async updateSubscriber(id, data) {
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) { await updateDoc(doc(db, "subscribers", sub.firebaseId), data); showToast("تم الحفظ"); }
    },

    async payDebt(fid, did, amount) {
        const sub = localData.subscribers.find(s => s.firebaseId === fid);
        const newDebt = Math.max(0, (parseInt(sub.price) || 0) - amount);

        await this.logTransaction({
            subscriberId: did, amount: parseInt(amount), type: 'debt_payment',
            description: `تسديد دين من ${sub.name}`
        });

        await updateDoc(doc(db, "subscribers", fid), { price: newDebt, paymentType: newDebt === 0 ? 'نقد' : 'أجل' });
        showToast("تم التسديد");
    },

    async addExpense(amount, description) {
        await this.logTransaction({ subscriberId: null, amount: -Math.abs(amount), type: 'expense', description });
        showToast("تم حفظ الصرفية");
    },

    async recordTransaction(sid, amt, desc, type) {
        await this.logTransaction({ subscriberId: sid, amount: amt, description: desc, type });
        showToast("تم الحفظ");
    },

    async archiveAllCurrent() {
        const unarchived = localData.transactions.filter(t => !t.isArchived);
        if (unarchived.length === 0) return showToast("لا يوجد شيء لترحيله", "error");

        if (!confirm("ترحيل كل السجلات لليوم؟")) return;

        const batch = unarchived.map(t => updateDoc(doc(db, "transactions", t.firebaseId), { isArchived: true }));
        await Promise.all(batch);
        showToast("تم الترحيل بنجاح");
    },

    async deleteTransaction(id) {
        if (!confirm("حذف؟")) return;
        const t = localData.transactions.find(tx => tx.id == id);
        if (t) { await deleteDoc(doc(db, "transactions", t.firebaseId)); showToast("تم الحذف"); }
    },

    async updateTransaction(id, newData) {
        const t = localData.transactions.find(tx => tx.id == id);
        if (t) { await updateDoc(doc(db, "transactions", t.firebaseId), newData); showToast("تم التعديل"); }
    },

    async deleteSubscriber(id) {
        if (!confirm("حذف المشترك نهائياً؟")) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) { await deleteDoc(doc(db, "subscribers", sub.firebaseId)); showToast("تم الحذف"); }
    },

    getDailyBalance() {
        const txs = localData.transactions.filter(t => !t.isArchived && t.type !== 'subscription_debt');
        const inc = txs.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);
        const exp = txs.filter(t => t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
        return inc - exp;
    },

    getAllTransactions() { return localData.transactions; },
    getSubscribers() { return localData.subscribers; },
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },
    searchSubscribers(q) {
        if (!q) return localData.subscribers;
        return localData.subscribers.filter(s => s.name?.toLowerCase().includes(q.toLowerCase()) || s.phone?.includes(q));
    },

    getStats() {
        const subs = localData.subscribers;
        const totalDebts = subs.reduce((sum, s) => sum + (parseInt(s.price) || 0), 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);

        return {
            totalSubs: subs.length,
            debts: totalDebts,
            boxBalance: this.getDailyBalance(),
            expired: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < today).length,
            expiring: subs.filter(s => {
                if (!s.expiryDate) return false;
                const d = new Date(s.expiryDate);
                const diffTime = d - today;
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return days > 0 && days <= 3;
            }).length
        };
    },

    showToast
};
