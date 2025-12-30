/**
 * DataManager v15.0 - مع دعم Telegram Bot
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit, getDocs, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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



let localData = { subscribers: [], transactions: [], employees: [], maintenances: [] };
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
    db: db, // تصدير قاعدة البيانات للاستخدام الخارجي (مثل صفحة الإعدادات)

    init() {
        console.log("========================================");
        console.log("🚀 System v20.1 - Clean Console Edition");
        console.log("========================================");


        this.sync('subscribers');
        this.sync('transactions');
        this.sync('employees'); // مزامنة الموظفين

        this.sync('maintenances'); // مزامنة الصيانات
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

        // بدء نظام الحضور التلقائي للموظفين
        setTimeout(() => {
            this.startAttendanceTracking();
        }, 3000); // تأخير 3 ثواني للتأكد من تحميل كل شيء
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

    // حساب رصيد الموظف الحالي
    calculateEmployeeBalance(empId) {
        const emp = this.getEmployee(empId);
        if (!emp || !emp.dailySalary) return 0;

        const start = new Date(emp.startDate || emp.createdAt);
        const now = new Date();

        // حساب عدد الأيام (الفرق بالملي ثانية / ملي ثانية اليوم)
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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

    // === إدارة الصيانات ===
    getMaintenances() { return localData.maintenances || []; },

    async addMaintenance(data) {
        const maintenance = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            status: 'completed',
            rewardPaid: false,
            ...data
        };

        try {
            await addDoc(collection(db, "maintenances"), maintenance);

            // إرسال واتساب للمشترك
            if (data.sendWhatsApp && data.subscriberPhone) {
                this.sendMaintenanceWhatsApp(data);
            }


            // إشعار Telegram
            try {
                if (typeof telegramBot !== 'undefined' && telegramBot) {
                    telegramBot.notifyMaintenance(data);
                }
            } catch (err) {
                console.warn('Telegram notification failed:', err);
            }

            showToast(`تم تسجيل الصيانة لـ ${data.subscriberName}`);
        } catch (e) {
            console.error(e);
            showToast("خطأ في حفظ الصيانة", "error");
        }
    },

    sendMaintenanceWhatsApp(data) {
        if (!data.subscriberPhone) return;

        let phone = data.subscriberPhone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = phone.substring(1);
        if (!phone.startsWith('964')) phone = '964' + phone;

        const costText = data.cost > 0 ?
            `• التكلفة: ${data.cost.toLocaleString()} د.ع ${data.paymentType === 'مدفوع نقداً' ? '✅ (مدفوع)' : ''}` :
            `• مجاني ✅`;

        const msg = `مرحباً ${data.subscriberName} 👋

تم إجراء صيانة لخدمتك بواسطة: ${data.employeeName}

📋 التفاصيل:
• نوع الصيانة: ${data.type}
${data.parts ? `• القطع المستبدلة: ${data.parts}` : ''}
${costText}

شكراً لثقتكم بنا 💙
OK Computer`;

        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    },

    async payMaintenanceReward(maintenanceId, amount) {
        const maint = localData.maintenances.find(m => m.id == maintenanceId);
        if (!maint || maint.rewardPaid) return;

        const emp = this.getEmployee(maint.employeeId);
        if (!emp) return;

        // 1. إضافة المكافأة لحساب الموظف
        const currentRewards = parseFloat(emp.rewards || 0);
        await updateDoc(doc(db, "employees", emp.firebaseId), {
            rewards: currentRewards + parseFloat(amount)
        });

        // 2. تسجيل الصرفية من الصندوق
        await this.addExpense(amount, `مكافأة صيانة: ${emp.name} - ${maint.subscriberName}`);

        // 3. تحديث حالة الصيانة
        const maintDoc = localData.maintenances.find(m => m.id == maintenanceId);
        if (maintDoc) {
            await updateDoc(doc(db, "maintenances", maintDoc.firebaseId), {
                rewardPaid: true,
                rewardAmount: amount,
                rewardDate: new Date().toISOString()
            });
        }

        showToast(`تم صرف مكافأة ${amount.toLocaleString()} د.ع لـ ${emp.name}`);
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

    // ========================================
    // نظام الحضور التلقائي
    // ========================================

    async getAttendanceSettings() {
        try {
            const settingsDoc = await getDocs(query(collection(db, "settings"), limit(1)));
            if (!settingsDoc.empty) {
                return settingsDoc.docs[0].data().attendance;
            }
            return null;
        } catch (e) {
            console.error('Error loading attendance settings:', e);
            return null;
        }
    },

    async saveAttendanceSettings(settings) {
        try {
            const settingsRef = collection(db, "settings");
            const existing = await getDocs(query(settingsRef, limit(1)));

            if (existing.empty) {
                await addDoc(settingsRef, { attendance: settings });
            } else {
                await updateDoc(doc(db, "settings", existing.docs[0].id), { attendance: settings });
            }

            showToast('✅ تم حفظ إعدادات الحضور بنجاح');
        } catch (e) {
            console.error('Error saving attendance settings:', e);
            showToast('❌ فشل حفظ الإعدادات', 'error');
        }
    },

    // حساب المسافة بين نقطتين (بالمتر) - Haversine Formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // نصف قطر الأرض بالمتر
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // المسافة بالمتر
    },

    // فحص ما إذا كان الموظف ضمن نطاق المحل
    async checkAttendance() {
        if (!AuthSystem.currentUser || AuthSystem.currentUser.type !== 'employee') {
            return; // النظام فقط للموظفين
        }

        const settings = await this.getAttendanceSettings();
        if (!settings || !settings.shopLat || !settings.shopLng) {
            return; // الإعدادات غير مكتملة
        }

        // التحقق من الوقت
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // بالدقائق
        const [startH, startM] = settings.startTime.split(':').map(Number);
        const [endH, endM] = settings.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentTime < startMinutes || currentTime > endMinutes) {
            return; // خارج أوقات الدوام
        }

        // الحصول على الموقع الحالي
        if (!navigator.geolocation) {
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const distance = this.calculateDistance(
                    position.coords.latitude,
                    position.coords.longitude,
                    settings.shopLat,
                    settings.shopLng
                );

                const employeeId = AuthSystem.currentUser.id;
                const today = new Date().toISOString().split('T')[0];

                if (distance <= settings.radius) {
                    this.updateAttendanceUI('success', Math.round(distance), true);
                    // داخل النطاق

                    // التحقق من الحاجة لتسجيل 'ping' (تحديث التواجد)
                    // نمنع التكرار المفرط: نسجل ping كل 5 دقائق كحد أدنى
                    const lastPingKey = `lastPing_${employeeId}_${today}`;
                    const lastPingStr = localStorage.getItem(lastPingKey);
                    const lastPingTime = lastPingStr ? new Date(lastPingStr).getTime() : 0;
                    const nowTs = new Date().getTime();

                    // إذا كان آخر سجل ليس دخولاً، نسجل دخول
                    const lastRecordKey = `lastAttendance_${employeeId}_${today}`;
                    const lastRecordType = localStorage.getItem(lastRecordKey);

                    if (lastRecordType !== 'in' && lastRecordType !== 'ping') {
                        await this.recordAttendance(employeeId, today, 'in', {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            distance: Math.round(distance)
                        });
                    } else {
                        // هو مسجل دخول، هل مرت 5 دقائق؟
                        if (nowTs - lastPingTime > 5 * 60 * 1000) {
                            await this.recordAttendance(employeeId, today, 'ping', {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                distance: Math.round(distance)
                            });
                            localStorage.setItem(lastPingKey, new Date().toISOString());
                        }
                    }
                } else {
                    this.updateAttendanceUI('success', Math.round(distance), false);
                    // خارج النطاق - تسجيل الخروج
                    await this.recordAttendance(employeeId, today, 'out', {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        distance: Math.round(distance)
                    });
                }
            },
            (error) => {
                console.error('GPS Check Error:', error);
                this.updateAttendanceUI('gps_error', 0, false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    },

    // Helper to update UI
    updateAttendanceUI(status, distance, isInside) {
        const card = document.getElementById('attendance-status-card');
        const text = document.getElementById('attendance-status-text');
        const distEl = document.getElementById('attendance-status-distance');
        const icon = document.getElementById('attendance-status-icon');
        const distText = document.getElementById('attendance-distance');

        if (card) {
            card.style.display = 'block';

            if (status === 'gps_error') {
                text.innerText = 'تعذر تحديد الموقع';
                if (distText) distText.innerText = 'يرجى تفعيل GPS';
                return;
            }

            if (isInside) {
                card.querySelector('div').style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                text.innerText = 'تم تسجيل الحضور ✅';
                if (icon) icon.innerHTML = '<i class="fas fa-check-circle"></i>';
            } else {
                card.querySelector('div').style.background = 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
                text.innerText = 'خارج الموقع المتوقع ❌';
                if (icon) icon.innerHTML = '<i class="fas fa-times-circle"></i>';
            }
            if (distText) distText.innerText = `المسافة: ${distance} متر`;
        }
    },

    async recordAttendance(employeeId, date, type, location) {
        try {
            // منع التسجيل المتكرر للحالات الثابتة (in/out)
            // نسمح بـ ping والتبديل بين in/out/ping
            const lastRecordKey = `lastAttendance_${employeeId}_${date}`;
            const lastRecord = localStorage.getItem(lastRecordKey);

            // إذا كان النوع "ping"، نسمح به دائماً (لأننا تحكمنا بالتوقيت في دالة checkAttendance)
            // إذا كان "in" أو "out"، نمنع التكرار المتتابع لنفس النوع
            if (type !== 'ping' && lastRecord === type) {
                return;
            }

            const attendanceRef = collection(db, "attendance");
            const timestamp = new Date().toISOString();

            await addDoc(attendanceRef, {
                employeeId,
                date,
                type, // 'in' or 'out'
                timestamp,
                location
            });

            // حفظ آخر حالة
            localStorage.setItem(lastRecordKey, type);

            console.log(`📍 Attendance recorded: ${type} at ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            console.error('Error recording attendance:', e);
        }
    },

    async getTodayAttendance() {
        try {
            const today = new Date().toISOString().split('T')[0];
            console.log('📅 Fetching attendance for:', today);

            const attendanceRef = collection(db, "attendance");
            const q = query(attendanceRef);
            const snapshot = await getDocs(q);

            const records = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.date === today) {
                    records.push(data);
                }
            });

            console.log(`✅ Found ${records.length} attendance records for today`);
            return records;
        } catch (e) {
            console.error('❌ Error fetching attendance:', e);
            console.error('Error details:', e.message);
            return [];
        }
    },

    // دالة ذكية لحساب الساعات مع دعم نظام النبضات (Ping)
    calculateWorkHours(records, timeoutMinutes = 15) {
        // 1. ترتيب السجلات زمنياً لضمان الدقة
        const sortedRecords = records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let totalMinutes = 0;
        let sessionStart = null;
        let lastActivity = null;
        const now = new Date();

        for (const record of sortedRecords) {
            const time = new Date(record.timestamp);

            if (record.type === 'in') {
                // بداية جلسة جديدة إذا لم تكن هناك جلسة مفتوحة
                if (!sessionStart) {
                    sessionStart = time;
                }
                lastActivity = time;
            }
            else if (record.type === 'ping') {
                // تحديث آخر نشاط للجلسة الحالية
                if (sessionStart) {
                    lastActivity = time;
                }
            }
            else if (record.type === 'out') {
                if (sessionStart) {
                    // إغلاق الجلسة واحتساب الوقت
                    // نستخدم وقت الخروج، أو آخر نشاط إذا كان الفرق كبيراً جداً (حالة شاذة)
                    const end = time;
                    const diff = (end - sessionStart) / 1000 / 60;
                    totalMinutes += diff;

                    sessionStart = null;
                    lastActivity = null;
                }
            }
        }

        // معالجة الجلسة المفتوحة (ما زال الموظف حاضراً)
        let isActive = false;
        let inactiveMinutes = 0;

        if (sessionStart && lastActivity) {
            const timeSinceLastActivity = (now - lastActivity) / 1000 / 60;

            if (timeSinceLastActivity <= timeoutMinutes) {
                // الموظف نشط حالياً
                // نحسب الوقت من البداية حتى الآن
                const diff = (now - sessionStart) / 1000 / 60;
                totalMinutes += diff; // نضيف المدة الحالية للمجموع (بشكل مؤقت للعرض)
                // *ملاحظة: في المرة القادمة عندما يرسل ping، سيتم إعادة الحساب بناءً على الـ Ping الجديد
                // لتجنب التكرار في العرض، نحن هنا نحسب "إلى أي مدى وصل الان"، لكن في التخزين الفعلي نعتمد على الـ Pings

                // لكن انتظر، إذا حسبنا (now - start) هنا، وفي الدورة القادمة حسبنا (now_later - start).. النتيجة صحيحة تراكمياً.
                // المشكلة فقط لو جمعنا الـ diff مرتين. المتغير totalMinutes يُحسب من الصفر في كل استدعاء للدالة. لذا هذا صحيح.

                isActive = true;
            } else {
                // الموظف خامل (تجاوز مهلة الانقطاع)
                // نحسب الوقت فقط حتى آخر نشاط معروف (Ping او In)
                const validDuration = (lastActivity - sessionStart) / 1000 / 60;
                totalMinutes += validDuration; // نحسب فقط الفترة المؤكدة

                isActive = false;
                inactiveMinutes = Math.floor(timeSinceLastActivity);
            }
        } else if (lastActivity) {
            // حالة نادرة: انتهت الجلسة بـ Out، ولكن نريد معرفة وقت الانقطاع منذ آخر خروج؟ لا، هذا غير مهم للراتب.
            inactiveMinutes = Math.floor((now - lastActivity) / 1000 / 60);
        }

        return {
            hours: totalMinutes / 60,
            isActive: isActive,
            lastActivity: lastActivity ? lastActivity.toISOString() : null,
            inactiveMinutes: inactiveMinutes
        };
    },

    // بدء المراقبة التلقائية للحضور - نظام ذكي ومتطور
    startAttendanceTracking() {
        if (!AuthSystem.currentUser || AuthSystem.currentUser.type !== 'employee') {
            return;
        }

        console.log('🚀 Starting smart attendance tracking for:', AuthSystem.currentUser.name);

        // UI Reset
        if (document.getElementById('attendance-status-card')) {
            document.getElementById('attendance-status-card').style.display = 'block';
            document.getElementById('attendance-status-text').innerHTML = '<i class="fas fa-satellite-dish fa-spin"></i> جاري البحث عن الموقع...';
            document.getElementById('attendance-status-icon').innerHTML = '<i class="fas fa-crosshairs fa-spin"></i>';
        }

        // فحص فوري عند فتح الصفحة
        this.checkAttendance();

        // مراقبة مستمرة للموقع (يكتشف التغيير فوراً!)
        if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    // تم تحديث الموقع - فحص الحضور فوراً
                    const settings = await this.getAttendanceSettings();
                    if (!settings || !settings.shopLat || !settings.shopLng) {
                        return;
                    }

                    // التحقق من الوقت
                    const now = new Date();
                    const currentTime = now.getHours() * 60 + now.getMinutes();
                    const [startH, startM] = settings.startTime.split(':').map(Number);
                    const [endH, endM] = settings.endTime.split(':').map(Number);
                    const startMinutes = startH * 60 + startM;
                    const endMinutes = endH * 60 + endM;

                    if (currentTime < startMinutes || currentTime > endMinutes) {
                        return; // خارج أوقات الدوام
                    }

                    const distance = this.calculateDistance(
                        position.coords.latitude,
                        position.coords.longitude,
                        settings.shopLat,
                        settings.shopLng
                    );

                    const employeeId = AuthSystem.currentUser.id;
                    const today = new Date().toISOString().split('T')[0];

                    if (distance <= settings.radius) {
                        this.updateAttendanceUI('success', Math.round(distance), true);
                        // داخل النطاق

                        // منطق الـ Ping للحفاظ على الجلسة نشطة
                        const lastPingKey = `lastPing_${employeeId}_${today}`;
                        const lastPingStr = localStorage.getItem(lastPingKey);
                        const lastPingTime = lastPingStr ? new Date(lastPingStr).getTime() : 0;
                        const nowTs = new Date().getTime();

                        // التحقق من الحالة السابقة
                        const lastRecordKey = `lastAttendance_${employeeId}_${today}`;
                        const lastRecordType = localStorage.getItem(lastRecordKey);

                        if (lastRecordType !== 'in' && lastRecordType !== 'ping') {
                            // تسجيل دخول جديد
                            await this.recordAttendance(employeeId, today, 'in', {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                distance: Math.round(distance)
                            });
                            console.log(`✅ Inside zone: ${Math.round(distance)}m (New Session)`);
                        } else if (nowTs - lastPingTime > 5 * 60 * 1000) {
                            // إرسال نبضة "أنا هنا" كل 5 دقائق
                            await this.recordAttendance(employeeId, today, 'ping', {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                distance: Math.round(distance)
                            });
                            localStorage.setItem(lastPingKey, new Date().toISOString());
                            console.log(`📡 Heartbeat sent: ${Math.round(distance)}m`);
                        }
                    } else {
                        this.updateAttendanceUI('success', Math.round(distance), false);
                        // خارج النطاق - تسجيل الخروج
                        await this.recordAttendance(employeeId, today, 'out', {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            distance: Math.round(distance)
                        });
                        console.log(`⏸️ Outside zone: ${Math.round(distance)}m`);
                    }
                },
                (error) => {
                    console.error('GPS monitoring error:', error);
                    this.updateAttendanceUI('gps_error', 0, false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                }
            );

            // حفظ الـ watchId لإمكانية إيقافه لاحقاً
            window.attendanceWatchId = watchId;
            console.log('✅ Continuous GPS monitoring active');
        }

        // فحص احتياطي كل دقيقة
        setInterval(() => {
            this.checkAttendance();
        }, 60000);

        console.log('✅ Attendance tracking started');
    },

    showToast
};

