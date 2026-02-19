/**
 * DataManager v31.1 - مع نظام الباقات السحابي المتقدم ودعم التنبيهات
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit, getDocs, where, persistentLocalCache, persistentMultipleTabManager, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
const auth = getAuth(app);

let localData = { subscribers: [], transactions: [], archived_transactions: [], employees: [], settings: {}, accounts: [] };
let isProcessing = false;

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
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
    showToast: showToast,
    db: db,
    get subscribers() { return localData.subscribers || []; },
    get transactions() { return localData.transactions || []; },
    get employees() { return localData.employees || []; },
    get accounts() { return localData.accounts || []; },

    init() {
        console.log("🚀 SAS System Initializing...");
        this.sync('subscribers');
        this.sync('transactions');
        // this.sync('archived_transactions'); // Disabled for performance - load only in reports if needed
        this.sync('employees');
        this.sync('settings');
        this.sync('accounts');
        this.monitorConnection();

        signInAnonymously(auth).catch(err => console.warn('Auth Error:', err));

        if (typeof telegramBot !== 'undefined' && telegramBot) {
            telegramBot.initFirebase(db).catch(err => console.warn('Telegram init failed:', err));
        }
    },

    monitorConnection() {
        window.addEventListener('online', () => showToast('تم الاتصال بالإنترنت', 'success'));
        window.addEventListener('offline', () => showToast('الإنترنت منقطع - تعمل محلياً', 'error'));
    },

    sync(colName) {
        if (!localData[colName]) localData[colName] = [];
        const q = query(collection(db, colName));

        onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(d => ({ ...d.data(), firebaseId: d.id }));

            if (colName === 'settings') {
                const newSettings = data.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                const currentStr = JSON.stringify(localData.settings || {});
                const newStr = JSON.stringify(newSettings);

                if (currentStr !== newStr) {
                    localData.settings = newSettings;
                    localStorage.setItem('sas_settings', JSON.stringify(newSettings));
                    if (window.AuthSystem && window.AuthSystem.applyUIConfigs) window.AuthSystem.applyUIConfigs(newSettings);
                    if (window.loadSettings) window.loadSettings();

                    if (!newSettings.packages || newSettings.packages.length === 0) {
                        this.bootstrapPackages();
                    }
                }
            } else {
                localData[colName] = data;
                // ترتيب محلي
                if (colName !== 'settings') {
                    localData[colName].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                }

                if (colName === 'subscribers') {
                    if (window.renderPage) window.renderPage();
                    if (window.updatePageData) window.updatePageData();
                }
                if (colName === 'employees' && window.renderEmployees) window.renderEmployees();
                if (colName === 'transactions' && window.generateReport) window.generateReport();
            }
        }, (error) => {
            console.error(`❌ Sync [${colName}] error:`, error);
        });
    },

    async bootstrapPackages() {
        const defaults = [
            { id: 'pkg_norm', name: 'نورمال (Normal)', costPrice: 22000, salePrice: 0 },
            { id: 'pkg_super', name: 'سوبر (Super)', costPrice: 24000, salePrice: 0 },
            { id: 'pkg_gold', name: 'جولد (Gold)', costPrice: 28000, salePrice: 0 },
            { id: 'pkg_private', name: 'خاصة (Private)', costPrice: 2000, salePrice: 0 }
        ];
        try {
            await setDoc(doc(db, "settings", "global"), { packages: defaults }, { merge: true });
        } catch (e) {
            console.error("❌ Bootstrap failed:", e);
        }
    },

    async logTransaction(data) {
        if (isProcessing) return;
        isProcessing = true;
        try {
            await addDoc(collection(db, "transactions"), { id: Date.now(), createdAt: new Date().toISOString(), isArchived: false, ...data });
        } finally { isProcessing = false; }
    },

    async addSubscriber(data) {
        const subData = { id: Date.now(), createdAt: new Date().toISOString(), ...data };
        if (data.packageId) {
            const pkg = (this.getSystemSettings().packages || []).find(p => p.id === data.packageId);
            if (pkg) {
                if (this.getSystemBalance() < pkg.costPrice) {
                    showToast(`❌ رصيد التفعيلات غير كافي! (${this.getSystemBalance().toLocaleString()})`, 'error');
                    throw new Error("Insufficient Balance");
                }
                subData.packageId = data.packageId;
                subData.packageName = pkg.name;
                await this.deductFromVirtualBalance(pkg.costPrice, `تفعيل باقة ${pkg.name} للمشترك ${data.name}`);
            }
        } else {
            subData.packageName = 'تفعيل يدوي';
        }

        const subRef = await addDoc(collection(db, "subscribers"), subData);

        if (data.initialPrice > 0) {
            await this.logTransaction({
                subscriberId: subData.id, amount: parseInt(data.initialPrice),
                type: data.paymentType === 'نقد' ? 'subscription_cash' : 'subscription_debt',
                description: `اشتراك جديد: ${subData.name}`
            });
            if (data.paymentType === 'نقد') await updateDoc(doc(db, "subscribers", subRef.id), { price: 0 });

            telegramBot.notifyNewActivation(subData.name, parseInt(data.initialPrice), data.paymentType, data.expiryDate || 'غير محدد');
        }
        showToast("تمت الإضافة بنجاح");
    },

    async renewSubscription(subscriberFirebaseId, subscriberDataId, renewalData) {
        const sub = localData.subscribers.find(s => s.firebaseId === subscriberFirebaseId);
        let newDebt = parseInt(sub.price || 0);
        if (renewalData.type === 'أجل') newDebt += parseInt(renewalData.price);

        const updateObj = { status: 'نشط', expiryDate: renewalData.dateEnd, paymentType: renewalData.type, price: newDebt, expiryWarningSent: false };

        if (renewalData.packageId) {
            const pkg = (this.getSystemSettings().packages || []).find(p => p.id === renewalData.packageId);
            if (pkg) {
                if (this.getSystemBalance() < pkg.costPrice) {
                    showToast(`❌ رصيد التفعيلات غير كافي! (${this.getSystemBalance().toLocaleString()})`, 'error');
                    throw new Error("Insufficient Balance");
                }
                updateObj.packageId = renewalData.packageId;
                updateObj.packageName = pkg.name;
                await this.deductFromVirtualBalance(pkg.costPrice, `تجديد باقة ${pkg.name} للمشترك ${sub.name}`);
            }
        } else {
            updateObj.packageName = 'تفعيل يدوي';
        }

        await this.logTransaction({
            subscriberId: subscriberDataId, amount: parseInt(renewalData.price),
            type: renewalData.type === 'نقد' ? 'subscription_cash' : 'subscription_debt',
            description: `تجديد: ${sub.name}`
        });

        await updateDoc(doc(db, "subscribers", subscriberFirebaseId), updateObj);

        telegramBot.notifyRenewal(sub.name, parseInt(renewalData.price), renewalData.type, renewalData.dateEnd);
        showToast("تم التجديد بنجاح");
    },

    async updateSubscriber(id, data) {
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) await updateDoc(doc(db, "subscribers", sub.firebaseId), data);
    },

    async payDebt(fid, did, amount) {
        const sub = localData.subscribers.find(s => s.firebaseId === fid);
        const newDebt = Math.max(0, (parseInt(sub.price) || 0) - amount);

        await this.logTransaction({ subscriberId: did, amount: parseInt(amount), type: 'debt_payment', description: `تسديد دين: ${sub.name}` });
        await updateDoc(doc(db, "subscribers", fid), { price: newDebt, paymentType: newDebt === 0 ? 'نقد' : 'أجل' });

        telegramBot.notifyDebtPaid(sub.name, parseInt(amount), newDebt);
        showToast("تم التسديد");
    },

    async addExpense(amount, description) {
        await this.logTransaction({ subscriberId: null, amount: -Math.abs(amount), type: 'expense', description });
        telegramBot.notifyExpense(description, Math.abs(amount));
        showToast("تم حفظ الصرفية");
    },

    async archiveAllCurrent() {
        const unarchived = localData.transactions;
        if (unarchived.length === 0) return showToast("لا يوجد شيء لترحيله", "error");
        if (!confirm(`هل أنت متأكد من ترحيل ${unarchived.length} سجل إلى الأرشيف؟`)) return;

        try {
            for (const t of unarchived) {
                await addDoc(collection(db, "archived_transactions"), { ...t, isArchived: true, archivedAt: new Date().toISOString() });
                await deleteDoc(doc(db, "transactions", t.firebaseId));
            }
            showToast("تم الترحيل للأرشيف بنجاح ✅");
        } catch (e) {
            showToast("فشل الترحيل: " + e.message, "error");
        }
    },

    async deleteTransaction(id) {
        if (!confirm("حذف السجل؟ إذا كان تعبئة تفعيل سيتم خصمه من الرصيد.")) return;
        const t = localData.transactions.find(tx => tx.id == id);
        if (t) {
            // Check if this is a top-up transaction to reverse it
            if (t.type === 'system_topup_expense') {
                const currentBal = this.getSystemBalance();
                // The amount was negative in the transaction (expense), but here we want the absolute value added to the system balance
                // Wait, topUpVirtualBalance adds to system balance AND adds a negative expense to drawer.
                // If we delete the expense (negative from drawer), we are essentially putting money back in the drawer (undoing the expense).
                // But the user ALSO wants the money removed from the system balance (undoing the top-up).

                // logic: User deletes the log "Top Up 100k".
                // Action: Remove 100k from system balance.
                const storedAmount = Math.abs(t.amount);
                const newBal = Math.max(0, currentBal - storedAmount);
                await setDoc(doc(db, "accounts", "system"), { balance: newBal, lastUpdated: new Date().toISOString() }, { merge: true });
                showToast(`تم استرجاع مبلغ التعبئة (${storedAmount}) من رصيد النظام`);
            }
            await deleteDoc(doc(db, "transactions", t.firebaseId));
        }
    },

    async deleteSubscriber(id) {
        if (!confirm("حذف المشترك نهائياً؟")) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) await deleteDoc(doc(db, "subscribers", sub.firebaseId));
    },

    getSystemSettings() { return localData.settings || {}; },
    getSubscribers() { return localData.subscribers; },
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },
    getAllTransactions() { return localData.transactions || []; },
    getArchivedTransactions() { return localData.archived_transactions || []; },

    getDailyBalance() {
        return localData.transactions.filter(t => !t.isArchived && t.type !== 'subscription_debt').reduce((a, b) => a + b.amount, 0);
    },

    getSystemBalance() {
        const sysAcc = (localData.accounts || []).find(a => a.firebaseId === 'system');
        return sysAcc ? (sysAcc.balance || 0) : 0;
    },

    async deductFromVirtualBalance(amount, reason = "استقطاع رصيد") {
        const currentBal = this.getSystemBalance();
        const newBal = currentBal - amount;
        await setDoc(doc(db, "accounts", "system"), { balance: newBal, lastUpdated: new Date().toISOString() }, { merge: true });
    },


    async topUpVirtualBalance(amount) {
        // We use a special type 'system_topup_expense' to identify this specific kind of expense
        await this.logTransaction({ subscriberId: null, amount: -Math.abs(amount), type: 'system_topup_expense', description: "تعبئة رصيد النظام" });
        telegramBot.notifyExpense("تعبئة رصيد النظام", Math.abs(amount));

        const currentBal = this.getSystemBalance();
        const newBal = currentBal + amount;
        await setDoc(doc(db, "accounts", "system"), { balance: newBal, lastUpdated: new Date().toISOString(), type: 'system_funds' }, { merge: true });
        showToast(`✅ تم إضافة ${amount.toLocaleString()} د.ع للرصيد`);
    },

    // --- إدارة الموظفين ---
    getEmployees() { return localData.employees || []; },
    getEmployee(id) { return (localData.employees || []).find(e => e.id == id); },
    async addEmployee(data) {
        await addDoc(collection(db, "employees"), { id: Date.now(), createdAt: new Date().toISOString(), startDate: new Date().toISOString().split('T')[0], advances: 0, ...data });
    },
    async updateEmployee(id, newData) {
        const emp = this.getEmployee(id);
        if (emp) await updateDoc(doc(db, "employees", emp.firebaseId), newData);
    },
    async deleteEmployee(id) {
        const emp = this.getEmployee(id);
        if (emp && confirm("حذف الموظف؟")) await deleteDoc(doc(db, "employees", emp.firebaseId));
    },
    async addAdvance(empId, amount, note) {
        const emp = this.getEmployee(empId);
        if (!emp) return;
        await this.addExpense(amount, `سلفة موظف: ${emp.name} - ${note}`);
        const currentAdvances = parseFloat(emp.advances || 0);
        await updateDoc(doc(db, "employees", emp.firebaseId), { advances: currentAdvances + parseFloat(amount) });
    },
    async paySalary(empId) {
        const emp = this.getEmployee(empId);
        const bal = this.calculateEmployeeBalance(empId);
        if (bal.net > 0 && confirm(`صرف راتب ${emp.name} بمبلغ ${bal.net.toLocaleString()}؟`)) {
            await this.addExpense(bal.net, `راتب موظف: ${emp.name}`);
            await updateDoc(doc(db, "employees", emp.firebaseId), { startDate: new Date().toISOString().split('T')[0], advances: 0 });
        }
    },
    calculateEmployeeBalance(empId) {
        const emp = this.getEmployee(empId);
        if (!emp || !emp.dailySalary) return { earned: 0, net: 0, advances: 0, days: 0 };
        const start = new Date(emp.startDate || emp.createdAt);
        const now = new Date();
        let diffDays = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
        if (now.getHours() < 18) diffDays = Math.max(0, diffDays - 1);
        const earned = diffDays * parseFloat(emp.dailySalary);
        const advances = parseFloat(emp.advances || 0);
        return { earned, net: earned - advances, advances, days: diffDays };
    },
    getStats() {
        const subs = localData.subscribers;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return {
            totalSubs: subs.length,
            debts: subs.reduce((sum, s) => sum + (parseInt(s.price) || 0), 0),
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
    async saveSystemSetting(key, value) {
        const settingsRef = doc(db, "settings", "global");
        await setDoc(settingsRef, { [key]: value }, { merge: true });
    },
    async saveAllSystemSettings(settingsObject) {
        const settingsRef = doc(db, "settings", "global");
        await setDoc(settingsRef, settingsObject, { merge: true });
        showToast('✅ تم حفظ جميع الإعدادات سحابياً');
    },
    searchSubscribers(q) {
        if (!q) return localData.subscribers;
        return localData.subscribers.filter(s => s.name?.toLowerCase().includes(q.toLowerCase()) || s.phone?.includes(q));
    }
};
