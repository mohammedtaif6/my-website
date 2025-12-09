/**
 * DataManager v12.0 - Unified Ledger System (النظام المالي الموحد)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Offline Persistence
try { enableIndexedDbPersistence(db).catch(e => console.log("Persistence warning:", e.code)); } catch (e) { }

let localData = { subscribers: [], transactions: [], expenses: [], archived: [] };
let isProcessing = false;

export const DataManager = {
    init() {
        console.log("جار الاتصال بفايربيس (النظام الموحد)...");
        this.sync('subscribers');
        this.sync('transactions'); // هذا هو الجدول الأساسي الآن لكل شيء
        this.sync('archived');
    },

    sync(colName) {
        // ترتيب عكسي للوقت (الأحدث أولاً)
        const q = query(collection(db, colName), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            localData[colName] = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));
            if (window.updatePageData) window.updatePageData();
        });
    },

    // ==========================================
    //  Unified Transaction System (نظام المعاملات الموحد)
    // ==========================================

    // هذه الدالة هي القلب المحرك لكل العمليات المالية
    // type: 'subscription_cash' | 'subscription_debt' | 'payment' | 'expense' | 'manual_income'
    async logTransaction(data) {
        if (isProcessing) return;
        isProcessing = true;

        try {
            const txRecord = {
                id: Date.now(),
                createdAt: new Date().toISOString(),
                ...data
                // data must include: subscriberId (optional), amount, type, description
            };

            await addDoc(collection(db, "transactions"), txRecord);
            console.log("Transaction Logged:", txRecord);
        } catch (e) {
            console.error(e);
            alert("خطأ في تسجيل المعاملة: " + e.message);
        } finally {
            isProcessing = false;
        }
    },

    // ==========================================
    //  Subscribers Management
    // ==========================================

    async addSubscriber(data) {
        // إضافة مشترك جديد
        // data.initialStatus: 'cash' or 'debt'
        // data.initialPrice: amount

        const subData = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            name: data.name,
            phone: data.phone,
            price: data.price || 0, // هذا حقل "الديون الحالية" المتراكمة
            status: data.status || 'نشط',
            paymentType: data.paymentType || 'نقد',
            expiryDate: data.expiryDate || '',
            note: ''
        };

        // 1. إنشاء المشترك
        const subRef = await addDoc(collection(db, "subscribers"), subData);

        // 2. تسجيل المعاملة المالية المرتبطة بالإضافة (إذا وجد)
        // إذا كان الاشتراك نقد -> معاملة قبض (Cash Flow +)
        // إذا كان الاشتراك أجل -> معاملة دين (Debt Record, No Cash Flow)

        if (subData.paymentType === 'نقد' && subData.price > 0) {
            // نقد: استلمنا فلوس، والمشترك عليه 0 دين (في البروفايل سعر الاشتراك لا يعتبر دين اذا دفع، لكن هنا سنفترض price هو قيمة الاشتراك)
            // لحظة، المنطق المعتاد: price في البروفايل = كم يطلب النظام من المشترك.
            // اذا دفع نقد، الـ price في البروفايل يجب ان يكون 0 (صافي).

            const initialAmount = data.initialPrice || 0;
            if (initialAmount > 0) {
                await this.logTransaction({
                    subscriberId: subData.id,
                    amount: parseInt(initialAmount), // المبلغ المقبوض
                    type: 'subscription_cash',
                    description: `اشتراك جديد (نقد): ${subData.name}`
                });
            }

            // تحديث المشترك ليكون دينه 0 لأنه دفع
            await updateDoc(doc(db, "subscribers", subRef.id), { price: 0 });

        } else if (subData.paymentType === 'أجل') {
            // أجل: لم نستلم فلوس، والمشترك عليه دين
            // الـ price في البروفايل يبقى كما هو (مطلوب منه هذا المبلغ)

            const initialAmount = data.initialPrice || 0;
            if (initialAmount > 0) {
                await this.logTransaction({
                    subscriberId: subData.id,
                    amount: parseInt(initialAmount), // قيمة الدين
                    type: 'subscription_debt', // نوع خاص للديون
                    description: `اشتراك جديد (أجل): ${subData.name}`
                });
            }
        }
    },

    // تفعيل / تجديد اشتراك (التعديل الجذري)
    async renewSubscription(subscriberFirebaseId, subscriberDataId, renewalData) {
        // renewalData: { price: 35000, type: 'نقد'/'أجل', months: 1 ... }

        const sub = localData.subscribers.find(s => s.firebaseId === subscriberFirebaseId);
        if (!sub) return;

        let newDebt = parseInt(sub.price || 0); // الدين القديم

        if (renewalData.type === 'أجل') {
            // إضافة الدين الجديد للقديم
            newDebt += parseInt(renewalData.price);

            await this.logTransaction({
                subscriberId: subscriberDataId,
                amount: parseInt(renewalData.price),
                type: 'subscription_debt',
                description: `تجديد اشتراك (أجل) - ${renewalData.dateEnd}`
            });
        } else {
            // نقد: الدفع فوري، لا يزيد الدين، ونسجل مقبوضات
            await this.logTransaction({
                subscriberId: subscriberDataId,
                amount: parseInt(renewalData.price),
                type: 'subscription_cash',
                description: `تجديد اشتراك (نقد) - ${renewalData.dateEnd}`
            });
        }

        // تحديث بيانات المشترك
        await updateDoc(doc(db, "subscribers", subscriberFirebaseId), {
            status: 'نشط',
            expiryDate: renewalData.dateEnd,
            paymentType: renewalData.type,
            price: newDebt // تحديث إجمالي الديون
        });
    },

    // تحديث بيانات عادي
    async updateSubscriber(id, data) {
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
    },

    // تسديد دين (دفعة من حساب)
    async payDebt(subscriberFirebaseId, subscriberDataId, amount) {
        const sub = localData.subscribers.find(s => s.firebaseId === subscriberFirebaseId);
        if (!sub) return;

        const currentDebt = parseInt(sub.price || 0);
        const newDebt = Math.max(0, currentDebt - amount);

        // 1. تسجيل المعاملة (مقبوضات)
        await this.logTransaction({
            subscriberId: subscriberDataId,
            amount: parseInt(amount),
            type: 'debt_payment',
            description: `تسديد دفعة من الدين: ${sub.name}`
        });

        // 2. تحديث رصيد المشترك
        await updateDoc(doc(db, "subscribers", subscriberFirebaseId), {
            price: newDebt,
            paymentType: newDebt === 0 ? 'نقد' : 'أجل' // تحويل لنقد اذا صفر الحساب
        });
    },

    // تسجيل معاملة مالية عامة (للتوافق مع الكود القديم)
    async recordTransaction(subscriberId, amount, description, type = 'نقد') {
        const isExpense = amount < 0;
        await this.logTransaction({
            subscriberId: subscriberId,
            amount: amount,
            type: isExpense ? 'expense' : (type || 'payment'),
            description: description
        });
    },

    // إضافة صرفية (خارجية أو مرتبطة)
    async addExpense(amount, description) {
        await this.logTransaction({
            subscriberId: null, // لا يوجد مشترك محدد
            amount: -Math.abs(amount), // بالسالب لأنها صرفيات
            type: 'expense',
            description: description
        });
    },

    // ==========================================
    //  Getters & Helpers
    // ==========================================

    getSubscribers() { return localData.subscribers; },

    // جلب كشف حساب مشترك معين (كل حركاته)
    getSubscriberHistory(subscriberId) {
        return localData.transactions.filter(t => t.subscriberId == subscriberId);
    },

    // جلب الصندوق (حركة الكاش فقط)
    // نستثني 'subscription_debt' لأنها مجرد قيد دين وليست كاش
    getCashFlow() {
        return localData.transactions.filter(t => t.type !== 'subscription_debt');
    },

    getAllTransactions() { return localData.transactions; },

    searchSubscribers(queryText) {
        if (!queryText) return localData.subscribers;
        return localData.subscribers.filter(s => s.name && s.name.toLowerCase().includes(queryText.toLowerCase()));
    },

    getSubscriber(id) {
        return localData.subscribers.find(s => s.id == id);
    },

    // الإحصائيات (محدثة لتعمل مع النظام الموحد)
    getStats() {
        const subs = localData.subscribers;
        const txs = localData.transactions;

        // 1. إجمالي الديون (من بروفايلات المشتركين لأنها تراكمية)
        const totalDebts = subs.reduce((sum, s) => sum + (parseInt(s.price) || 0), 0);

        // 2. إجمالي الواردات (الكاش فقط)
        // أي معاملة موجبة وليست دين
        const cashIn = txs
            .filter(t => t.amount > 0 && t.type !== 'subscription_debt')
            .reduce((sum, t) => sum + t.amount, 0);

        // 3. إجمالي المصروفات
        const cashOut = txs
            .filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        return {
            totalSubs: subs.length,
            debts: totalDebts,
            received: cashIn,
            expenses: cashOut,
            expired: subs.filter(s => s.expiryDate && new Date(s.expiryDate) < new Date()).length,
            expiring: subs.filter(s => {
                if (!s.expiryDate) return false;
                const days = Math.ceil((new Date(s.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                return days > 0 && days <= 3;
            }).length
        };
    },

    // للحذف وأدوات الأدمن
    async deleteSubscriber(id) {
        if (!confirm("تحذير: حذف المشترك سيؤدي لحذف سجله لكن المعاملات المالية ستبقى للأرشيف. موافق؟")) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) await deleteDoc(doc(db, "subscribers", sub.firebaseId));
    },

    async deleteTransaction(id) {
        if (!confirm("حذف هذه المعاملة المالية؟ سيؤثر ذلك على الحسابات!")) return;
        const t = localData.transactions.find(tx => tx.id == id);
        if (t) await deleteDoc(doc(db, "transactions", t.firebaseId));
    },

    async archiveDay() {
        if (!confirm("ترحيل كل المقبوضات الحالية للأرشيف وتصفير الصندوق الظاهري؟")) return;
        // في هذا النظام، الترحيل مجرد علامة (Tag) أو نقل لمجموعة أخرى
        // للتبسيط: سنقوم فقط بتنبيه المستخدم أن البيانات محفوظة
        alert("البيانات محفوظة تلقائياً في السجل الدائم. يمكنك الفلترة بالتاريخ في التقارير.");
    }
};
