/**
 * DataManager v15.0 - مع دعم Telegram Bot
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit, getDocs, where, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { telegramBot } from './telegram-bot.js?v=19.1';

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

const auth = getAuth(app);

console.log('✅ Firebase مُهيأ بالتخزين المحلي المتقدم - جاهز للعمل!');



let localData = { subscribers: [], transactions: [], employees: [] };
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
    showToast: showToast, // تصدير دالة التنبيهات
    db: db, // تصدير قاعدة البيانات للاستخدام الخارجي (مثل صفحة الإعدادات)

    init() {
        console.log("========================================");
        console.log("🚀 System v20.1 - Clean Console Edition");
        console.log("========================================");


        this.sync('subscribers');
        this.sync('transactions');
        this.sync('employees'); // مزامنة الموظفين


        this.monitorConnection();

        // تسجيل الدخول المجهول (لحل مشاكل Security Rules)
        signInAnonymously(auth)
            .then(() => {
                console.log('✅ Signed in anonymously');
            })
            .catch((error) => {
                if (error.code === 'auth/configuration-not-found') {
                    console.warn('⚠️ تنبيه: خدمة "Anonymous Auth" غير مفعلة في لوحة تحكم Firebase.');
                } else {
                    console.warn('⚠️ Auth Error (may cause permission issues):', error);
                }
            });

        // تهيئة Telegram Bot مع Firebase (إذا كان موجوداً)
        try {
            if (typeof telegramBot !== 'undefined' && telegramBot) {
                telegramBot.initFirebase(db).then(() => {
                    console.log('✅ Telegram Bot initialized with Firebase');
                }).catch(err => {
                    console.warn('⚠️ Telegram Bot init failed (non-critical):', err);
                });
            }
        } catch (err) {
            console.warn('⚠️ Telegram Bot not available (non-critical):', err);
        }


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

    // === المزامنة مع الفايربيس ===
    sync(colName) {
        // تهيئة المصفوفة لضمان عدم حدوث خطأ عند القراءة
        if (!localData[colName]) localData[colName] = [];

        // Limit queries to 150 items to improve performance
        // Limit queries: Transactions 100, Subscribers & others 1000 (Optimized for speed)
        const limitCount = colName === 'transactions' ? 100 : 1000;
        const q = query(collection(db, colName), orderBy("createdAt", "desc"), limit(limitCount));

        onSnapshot(q,
            (snapshot) => {
                // استبدال البيانات المحلية بالبيانات "الحقيقية" من السيرفر
                localData[colName] = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));

                console.log(`📊 Firebase Sync [${colName}]: ${localData[colName].length} records loaded.`);

                // إذا كانت البيانات خاصة بالموظفين، نقوم بإشعار الصفحة للتحديث
                if (colName === 'employees') {
                    // محاولة تحديث واجهة الموظفين إذا كانت مفتوحة
                    if (window.renderEmployees) window.renderEmployees();
                }
            },
            (error) => {
                console.error(`❌ Firebase Error (${colName}):`, error);

                // لا نعرض رسائل خطأ للموظفين - فقط نسجلها في الكونسول
                if (error.code === 'permission-denied') {
                    console.warn(`⚠️ لا توجد صلاحية للوصول لـ: ${colName}`);
                    // لا نعرض Toast - فقط نسجل في الكونسول
                } else {
                    console.warn('⚠️ خطأ في الاتصال بقاعدة البيانات');
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
        } catch (e) {
            console.error('❌ Transaction Error:', e);
            // لا نعرض رسالة خطأ للمستخدم - فقط نسجل في الكونسول
        }
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

            // إشعار Telegram
            telegramBot.notifyNewActivation(
                subData.name,
                parseInt(initialAmount),
                data.paymentType,
                data.expiryDate || 'غير محدد'
            );
        }
        showToast("تمت الإضافة بنجاح");
    },

    async renewSubscription(subscriberFirebaseId, subscriberDataId, renewalData) {
        const sub = localData.subscribers.find(s => s.firebaseId === subscriberFirebaseId);

        let newDebt = parseInt(sub.price || 0);
        if (renewalData.type === 'أجل') newDebt += parseInt(renewalData.price);

        await this.logTransaction({
            subscriberId: subscriberDataId,
            amount: parseInt(renewalData.price),
            type: renewalData.type === 'نقد' ? 'subscription_cash' : 'subscription_debt',
            description: `تجديد (${renewalData.type}) - ${renewalData.dateEnd}`
        });

        await updateDoc(doc(db, "subscribers", subscriberFirebaseId), {
            status: 'نشط',
            expiryDate: renewalData.dateEnd,
            paymentType: renewalData.type,
            price: newDebt,
            expiryWarningSent: false // Reset warning flag on renewal
        });

        // إشعار Telegram
        telegramBot.notifyRenewal(
            sub.name,
            parseInt(renewalData.price),
            renewalData.type,
            renewalData.dateEnd
        );

        showToast("تم التجديد بنجاح");
    },

    async updateSubscriber(id, data) {
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) { await updateDoc(doc(db, "subscribers", sub.firebaseId), data); showToast("تم الحفظ"); }
    },

    async markExpiryWarningSent(id) {
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) {
            await updateDoc(doc(db, "subscribers", sub.firebaseId), { expiryWarningSent: true });
        }
    },

    async payDebt(fid, did, amount) {
        const sub = localData.subscribers.find(s => s.firebaseId === fid);
        const newDebt = Math.max(0, (parseInt(sub.price) || 0) - amount);

        await this.logTransaction({
            subscriberId: did, amount: parseInt(amount), type: 'debt_payment',
            description: `تسديد دين من ${sub.name}`
        });

        await updateDoc(doc(db, "subscribers", fid), { price: newDebt, paymentType: newDebt === 0 ? 'نقد' : 'أجل' });

        // إشعار Telegram
        telegramBot.notifyDebtPaid(
            sub.name,
            parseInt(amount),
            newDebt
        );

        showToast("تم التسديد");
    },

    async addExpense(amount, description) {
        await this.logTransaction({ subscriberId: null, amount: -Math.abs(amount), type: 'expense', description });

        // إشعار Telegram
        telegramBot.notifyExpense(description, Math.abs(amount));

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
    get subscribers() { return localData.subscribers; }, // إضافة getter للوصول المباشر
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },
    searchSubscribers(q) {
        if (!q) return localData.subscribers;
        return localData.subscribers.filter(s => s.name?.toLowerCase().includes(q.toLowerCase()) || s.phone?.includes(q));
    },

    // --- إدارة الموظفين والرواتب ---
    getEmployees() { return localData.employees || []; },

    getEmployee(id) { return (localData.employees || []).find(e => e.id == id); },

    async addEmployee(data) {
        // نحدد تاريخ التعيين لليوم بشكل افتراضي لبدء حساب الراتب
        const emp = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            startDate: new Date().toISOString().split('T')[0], // تاريخ بدء الحساب
            advances: 0, // مجموع السلف
            ...data
        };

        try {
            // نرسل البيانات للسيرفر فقط، وننتظر عودتها عبر الـ Sync
            await addDoc(collection(db, "employees"), emp);
            showToast("تم إرسال بيانات الموظف للسيرفر...");
        } catch (e) {
            console.error("Error adding employee:", e);
            showToast("فشل الحفظ في قاعدة البيانات: " + e.message, "error");
        }
    },

    async updateEmployee(id, newData) {
        const emp = this.getEmployee(id);
        if (emp) {
            await updateDoc(doc(db, "employees", emp.firebaseId), newData);
            showToast("تم تحديث بيانات الموظف");
        }
    },

    async deleteEmployee(id) {
        if (!confirm("هل أنت متأكد من حذف الموظف؟")) return;
        const emp = this.getEmployee(id);
        if (emp) {
            await deleteDoc(doc(db, "employees", emp.firebaseId));
            showToast("تم حذف الموظف");
        }
    },

    // تسجيل سلفة (خصم من الراتب)
    async addAdvance(empId, amount, note) {
        const emp = this.getEmployee(empId);
        if (!emp) return;

        // 1. تسجيلها كصرفية عامة في النظام
        await this.addExpense(amount, `سلفة موظف: ${emp.name} - ${note}`);

        // 2. تحديث مجموع السلف للموظف
        const currentAdvances = parseFloat(emp.advances || 0);
        await updateDoc(doc(db, "employees", emp.firebaseId), {
            advances: currentAdvances + parseFloat(amount)
        });
    },

    // صرف راتب الموظف (يصفر الرصيد ويسجل صرفية)
    async paySalary(empId) {
        const emp = this.getEmployee(empId);
        if (!emp) return;

        const balance = this.calculateEmployeeBalance(empId);

        if (balance.net <= 0) {
            showToast('لا يوجد راتب مستحق للصرف', 'error');
            return;
        }

        if (!confirm(`هل تريد صرف راتب ${emp.name}؟\nالمبلغ: ${balance.net.toLocaleString()} د.ع`)) {
            return;
        }

        // 1. تسجيل الصرفية من الصندوق
        await this.addExpense(balance.net, `راتب موظف: ${emp.name}`);

        // 2. تصفير الرصيد (نعيد ضبط تاريخ البداية لليوم ونصفر السلف)
        await updateDoc(doc(db, "employees", emp.firebaseId), {
            startDate: new Date().toISOString().split('T')[0],
            advances: 0
        });

        showToast(`تم صرف راتب ${emp.name} بنجاح`);
    },

    // تصفير العدادات وترحيل الحساب (طلب المستخدم)
    async archiveAndReset(empId) {
        const emp = this.getEmployee(empId);
        if (!emp) return;

        const balance = this.calculateEmployeeBalance(empId);

        // التحقق من أن المبلغ يستحق التصفير (ممكن يكون سالب أو موجب)
        if (balance.net === 0 && balance.advances === 0) {
            showToast('لا توجد مبالغ أو سلف لتصفيرها', 'warning');
            return;
        }

        if (!confirm(`هل أنت متأكد من تصفير العدادات وترحيل الحساب للموظف ${emp.name}؟\nسيتم تسجيل صافي المبلغ (${balance.net.toLocaleString()}) في الصندوق.`)) {
            return;
        }

        // 1. تسجيل العملية في الصندوق (سواء صرف أو قبض حسب الإشارة)
        // إذا كان الصافي موجب (له راتب) -> صرفية
        // إذا كان الصافي سالب (مطلوب) -> مقبوضات (نظرياً، أو يتم ترحيلها كدين مسدد)
        // سنعتبرها صرفية بنفس القيمة (موجبة أو سالبة) لضبط الصندوق
        await this.addExpense(balance.net, `تصفية حساب موظف: ${emp.name}`);

        // 2. تصفير العدادات
        await updateDoc(doc(db, "employees", emp.firebaseId), {
            startDate: new Date().toISOString().split('T')[0],
            advances: 0
        });

        showToast(`تم تصفير عدادات ${emp.name} وترحيل الحساب بنجاح`);
    },

    // حساب رصيد الموظف الحالي
    calculateEmployeeBalance(empId) {
        const emp = this.getEmployee(empId);
        // ندعم dailySalary (حسب الهيكلة القديمة والجديدة)
        // الراتب المخزن هو "اليومي" (الأسبوعي / 7)
        if (!emp || !emp.dailySalary) return 0;

        const start = new Date(emp.startDate || emp.createdAt);
        const now = new Date();

        // حساب عدد الأيام (الفرق بالملي ثانية / ملي ثانية اليوم)
        const diffTime = Math.abs(now - start);
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // --- تعديل (طلب المستخدم): الدوام من 6 مساءً (18:00) ---
        // إذا كان الوقت الحالي قبل الساعة 18:00، لا نحسب "اليوم الحالي" ضمن الأيام المستحقة
        // هذا يعني أن الراتب "ينزل" أو يُضاف لحساب الموظف عند حلول الساعة 6 مساءً
        if (now.getHours() < 18) {
            diffDays = Math.max(0, diffDays - 1);
        }

        // الراتب المستحق = الأيام * الراتب اليومي
        const totalEarned = diffDays * parseFloat(emp.dailySalary);

        // الراتب الصافي = المستحق - السلف
        const netBalance = totalEarned - (parseFloat(emp.advances) || 0);

        return {
            days: diffDays,
            earned: totalEarned,
            advances: (parseFloat(emp.advances) || 0),
            net: netBalance
        };
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



    // إعطاء مكافأة مباشرة للموظف
    async giveBonus(empId, amount, reason = 'مكافأة') {
        const emp = this.getEmployee(empId);
        if (!emp) return;

        const bonusAmount = parseFloat(amount);
        if (bonusAmount <= 0) return;

        // 1. إضافة المكافأة لسجل الموظف
        const currentRewards = parseFloat(emp.rewards || 0);
        await updateDoc(doc(db, "employees", emp.firebaseId), {
            rewards: currentRewards + bonusAmount
        });

        // 2. تسجيل الصرفية من الصندوق
        await this.addExpense(bonusAmount, `مكافأة: ${emp.name} - ${reason}`);

        showToast(`🎁 تم صرف مكافأة ${bonusAmount.toLocaleString()} د.ع لـ ${emp.name}`);
    },


};

