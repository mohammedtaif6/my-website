/**
 * DataManager v31.1 - مع نظام الباقات السحابي المتقدم ودعم التنبيهات
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDoc, onSnapshot, query, orderBy, limit, getDocs, where, persistentLocalCache, persistentMultipleTabManager, setDoc, increment, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { telegramBot } from './telegram-bot.js?v=19.2';

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

let localData = { subscribers: [], transactions: [], archived_transactions: [], employees: [], settings: [], settings_processed: {}, accounts: [] };
let isProcessing = false;

// Custom Alert Modal Function
function showToast(message, type = 'success', customTitle = '') {
    // Model 1: Floating Toast
    let container = document.getElementById('toast-container-m1');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container-m1';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-m1 ${type}`;

    let icon = 'fa-check-circle';
    let title = customTitle || 'تم بنجاح';
    if (type === 'error') {
        icon = 'fa-times-circle';
        title = customTitle || 'تنبيه !';
    } else if (type === 'info') {
        icon = 'fa-info-circle';
        title = customTitle || 'معلومة';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        title = customTitle || 'تنبيه';
    }

    toast.innerHTML = `
        <div class="toast-m1-icon"><i class="fas ${icon}"></i></div>
        <div class="toast-m1-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function showConfirmModal(title, message, isConfirm = true) {
    // Model 2: iOS Style Alert
    return new Promise((resolve) => {
        let overlay = document.getElementById('modal-overlay-m2');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay-m2';
            overlay.innerHTML = `
                <div class="alert-m2" id="alert-box-m2">
                    <div class="alert-m2-content">
                        <i id="m2-icon" class="fas fa-exclamation-triangle"></i>
                        <h3 id="m2-title"></h3>
                        <p id="m2-msg"></p>
                    </div>
                    <div class="alert-m2-actions" id="m2-actions"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        const overlayEl = document.getElementById('modal-overlay-m2');
        const box = document.getElementById('alert-box-m2');
        const titleEl = document.getElementById('m2-title');
        const msgEl = document.getElementById('m2-msg');
        const iconEl = document.getElementById('m2-icon');
        const actionsEl = document.getElementById('m2-actions');

        titleEl.innerText = title;
        msgEl.innerText = message;
        box.className = 'alert-m2';

        const closeM2 = () => {
            overlayEl.classList.remove('show');
            setTimeout(() => overlayEl.style.display = 'none', 300);
        };

        if (isConfirm) {
            box.classList.add('warning');
            iconEl.className = 'fas fa-exclamation-triangle';
            actionsEl.innerHTML = `
                <button class="alert-m2-btn" id="sas-m2-no">إلغاء</button>
                <button class="alert-m2-btn danger" id="sas-m2-yes">نعم، تأكيد</button>
            `;
            setTimeout(() => {
                document.getElementById('sas-m2-no').onclick = () => { closeM2(); resolve(false); };
                document.getElementById('sas-m2-yes').onclick = () => { closeM2(); resolve(true); };
            }, 0);
        } else {
            box.classList.add('error');
            iconEl.className = 'fas fa-ban';
            actionsEl.innerHTML = `
                <button class="alert-m2-btn" id="sas-m2-ok">حسناً</button>
            `;
            setTimeout(() => {
                document.getElementById('sas-m2-ok').onclick = () => { closeM2(); resolve(true); };
            }, 0);
        }

        overlayEl.style.display = 'flex';
        setTimeout(() => overlayEl.classList.add('show'), 10);
    });
}

function showSystemAlert(message, type = 'info') {
    // Model 3: Cyberpunk / Modern Dark
    let toast = document.getElementById('toast-top-m3');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-top-m3';
        toast.innerHTML = `
            <div class="m3-glow"></div>
            <i id="m3-icon" class="fas fa-info-circle"></i>
            <span id="m3-text"></span>
        `;
        document.body.appendChild(toast);
    }

    toast.className = type;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-times-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';

    document.getElementById('m3-icon').className = `fas ${icon}`;
    document.getElementById('m3-text').innerText = message;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

export const DataManager = {
    showToast: showToast,
    showConfirmModal: showConfirmModal,
    showSystemAlert: showSystemAlert,
    db: db,
    get subscribers() { return localData.subscribers || []; },
    get transactions() { return localData.transactions || []; },
    get employees() { return localData.employees || []; },
    get accounts() { return localData.accounts || []; },

    dataChangeListeners: [],
    dataChangeTimeout: null,
    cache: {
        dailyBalance: null,
        subscribersMap: new Map()
    },

    onDataChange(callback) {
        if (typeof callback === 'function') {
            this.dataChangeListeners.push(callback);
        }
    },

    triggerDataChange() {
        if (this.dataChangeTimeout) clearTimeout(this.dataChangeTimeout);
        this.dataChangeTimeout = setTimeout(() => {
            this.cache.dailyBalance = null; // Invalidate cache
            this.dataChangeListeners.forEach(cb => cb());
        }, 100);
    },

    init() {
        if (this.systemInitialized) return;
        this.systemInitialized = true;

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
            telegramBot.initFirebase(db).then(() => {
                telegramBot.startBackgroundPolling();
            }).catch(err => console.warn('Telegram init failed:', err));
        }
    },

    monitorConnection() {
        window.addEventListener('online', () => showSystemAlert('تم الاتصال بالإنترنت', 'success'));
        window.addEventListener('offline', () => showSystemAlert('الإنترنت منقطع - تعمل محلياً', 'error'));
    },

    sync(colName) {
        if (!localData[colName]) localData[colName] = [];
        const q = query(collection(db, colName));
        let isFirstSnapshot = true;

        onSnapshot(q, (snapshot) => {
            let hasChanges = false;

            snapshot.docChanges().forEach((change) => {
                const docData = { ...change.doc.data(), firebaseId: change.doc.id };
                const index = localData[colName].findIndex(d => d.firebaseId === change.doc.id);

                if (change.type === "added") {
                    if (index === -1) {
                        localData[colName].push(docData);
                        hasChanges = true;
                    }
                } else if (change.type === "modified") {
                    if (index !== -1) {
                        localData[colName][index] = docData;
                        hasChanges = true;
                    }
                } else if (change.type === "removed") {
                    if (index !== -1) {
                        localData[colName].splice(index, 1);
                        hasChanges = true;
                    }
                }
            });

            // Trigger on first snapshot regardless, or if there are actual changes
            if (!hasChanges && !isFirstSnapshot) return;
            isFirstSnapshot = false;

            if (colName === 'settings') {
                const newSettings = (localData.settings || []).reduce((acc, curr) => ({ ...acc, ...curr }), {});
                const currentStr = localStorage.getItem('sas_settings');
                const newStr = JSON.stringify(newSettings);

                localData.settings_processed = newSettings;
                if (currentStr !== newStr) {
                    localStorage.setItem('sas_settings', newStr);
                    if (window.AuthSystem && window.AuthSystem.applyUIConfigs) window.AuthSystem.applyUIConfigs(newSettings);
                    if (window.loadSettings) window.loadSettings();

                    const pkgs = newSettings.packages || [];
                    if (pkgs.length === 0 || !pkgs.some(p => p.id === 'pkg_private')) {
                        this.bootstrapPackages();
                    }
                }
            } else {
                if (colName !== 'accounts') {
                    localData[colName].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                }

                if (colName === 'subscribers') {
                    if (this.cache) this.cache.subscribersMap = new Map(localData.subscribers.map(s => [s.id, s]));
                }

                if (colName === 'transactions') {
                    if (window.generateReport) window.generateReport();
                    localData.transactions
                        .filter(tx => tx.type === 'topup_request' && tx.status === 'approved' && !tx.processedBySystem)
                        .forEach(tx => this.finalizeApprovedTopUp(tx));
                }

                // تحديث الواجهة فوراً عند وصول أي بيانات جديدة
                if (window.renderPage) window.renderPage();
                if (window.updatePageData) window.updatePageData();
                if (colName === 'employees' && window.renderEmployees) window.renderEmployees();
            }

            this.triggerDataChange();
        }, (error) => {
            console.error(`❌ Sync [${colName}] error:`, error);
        });
    },

    async bootstrapPackages() {
        const defaults = [
            { id: 'pkg_norm', name: 'نورمال (Normal)', costPrice: 22000, salePrice: 35000 },
            { id: 'pkg_super', name: 'سوبر (Super)', costPrice: 24000, salePrice: 40000 },
            { id: 'pkg_gold', name: 'جولد (Gold)', costPrice: 28000, salePrice: 50000 },
            { id: 'pkg_ajel', name: 'الاجل (0-0)', costPrice: 0, salePrice: 0 },
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

    async updateTransaction(id, newData) {
        let tx = localData.transactions.find(t => t.id == id || t.firebaseId === id);
        let col = "transactions";

        if (!tx) {
            tx = (localData.archived_transactions || []).find(t => t.id == id || t.firebaseId === id);
            col = "archived_transactions";
        }

        if (tx) {
            // ✅ إذا تغير المبلغ، نحتاج تعديل التأثير المالي
            if (newData.amount !== undefined && newData.amount !== tx.amount) {
                const diff = newData.amount - tx.amount;

                if (tx.type === 'debt_payment' && tx.subscriberId) {
                    // تعديل دين المشترك: إذا زاد التسديد، يقل الدين
                    const sub = localData.subscribers.find(s => s.id == tx.subscriberId);
                    if (sub) {
                        const currentDebt = parseInt(sub.price || 0);
                        // التسديد هنا موجب. إذا زاد التسديد (diff > 0)، ينقص الدين.
                        await updateDoc(doc(db, "subscribers", sub.firebaseId), {
                            price: Math.max(0, currentDebt - diff)
                        });
                    }
                } else if (tx.type === 'system_topup_expense' || (tx.type === 'topup_request' && tx.status === 'approved')) {
                    // تعديل رصيد النظام: المبالغ هنا سالبة عادة (صرف لشراء رصيد)
                    // لكن رصيد النظام يزيد بقيمة التعبئة.
                    // إذا كان tx.amount = -50000 والجديد -60000، الفرق -10000. يعني الرصيد لازم يزيد بـ 10000 إضافية.
                    const amountDiff = Math.abs(newData.amount) - Math.abs(tx.amount);
                    await updateDoc(doc(db, "accounts", "system"), {
                        balance: increment(amountDiff)
                    });
                }
            }
            await updateDoc(doc(db, col, tx.firebaseId), newData);
        }
    },

    async addSubscriber(data) {
        const subData = { id: Date.now(), createdAt: new Date().toISOString(), ...data };

        // ✅ إلزامي: كل مشترك يجب أن يكون لديه باقة - الافتراضية نورمال
        const packageId = data.packageId || 'pkg_norm';
        const packages = this.getSystemSettings().packages || [];
        const pkg = packages.find(p => p.id === packageId) || packages[0];

        if (!pkg) {
            showToast('❌ لا توجد باقات في النظام! يرجى إعداد الباقات أولاً', 'error');
            throw new Error("No packages configured");
        }

        subData.packageId = pkg.id;
        subData.packageName = pkg.name;

        // استقطاع من رصيد النظام فقط إذا كان هناك تفعيل (تاريخ انتهاء)
        if (data.expiryDate && pkg.costPrice > 0) {
            const result = await this.deductFromVirtualBalance(pkg.costPrice, `تفعيل باقة ${pkg.name} للمشترك ${data.name}`);
            subData.takenFromDebt = result.takenFromDebt;
        }

        const subRef = await addDoc(collection(db, "subscribers"), subData);

        if (data.initialPrice > 0 || (pkg.costPrice === 0 && data.initialPrice === 0)) {
            await this.logTransaction({
                subscriberId: subData.id, amount: parseInt(data.initialPrice || 0),
                type: data.paymentType === 'نقد' ? 'subscription_cash' : 'subscription_debt',
                description: `اشتراك جديد: ${subData.name} (${pkg.name})`,
                costPrice: pkg.costPrice,
                takenFromDebt: subData.takenFromDebt || false
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

        // ✅ إلزامي: استخدام باقة المشترك المثبتة أو الباقة المختارة
        const packageId = renewalData.packageId || sub.packageId || 'pkg_norm';
        const packages = this.getSystemSettings().packages || [];
        const pkg = packages.find(p => p.id === packageId) || packages[0];

        if (!pkg) {
            showToast('❌ لا توجد باقات في النظام!', 'error');
            throw new Error("No packages configured");
        }

        updateObj.packageId = pkg.id;
        updateObj.packageName = pkg.name;

        if (pkg.costPrice > 0) {
            const result = await this.deductFromVirtualBalance(pkg.costPrice, `تجديد باقة ${pkg.name} للمشترك ${sub.name}`);
            updateObj.takenFromDebt = result.takenFromDebt;
        }

        await this.logTransaction({
            subscriberId: subscriberDataId, amount: parseInt(renewalData.price),
            type: renewalData.type === 'نقد' ? 'subscription_cash' : 'subscription_debt',
            description: `تجديد: ${sub.name} (${pkg.name})`,
            costPrice: pkg.costPrice,
            takenFromDebt: updateObj.takenFromDebt || false
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

    async discountDebt(fid, did, amount) {
        const sub = localData.subscribers.find(s => s.id == did || s.firebaseId === fid);
        if (!sub) return;

        const discountAmt = parseInt(amount);
        const currentDebt = parseInt(sub.price) || 0;
        const newDebt = Math.max(0, currentDebt - discountAmt);

        // سجل العملية كخصم (Amount = 0 لكي لا يؤثر على ميزانية الصندوق النقدية)
        await this.logTransaction({
            subscriberId: did,
            amount: 0,
            type: 'debt_discount',
            description: `إعفاء/خصم من الدين: ${sub.name} (خصم: ${discountAmt.toLocaleString()})`
        });

        await updateDoc(doc(db, "subscribers", fid), {
            price: newDebt,
            paymentType: newDebt === 0 ? 'نقد' : 'أجل'
        });

        showToast(`✅ تم خصم ${discountAmt.toLocaleString()} من دين المشترك بنجاح`);
    },

    async addExpense(amount, description) {
        await this.logTransaction({ subscriberId: null, amount: -Math.abs(amount), type: 'expense', description });
        telegramBot.notifyExpense(description, Math.abs(amount));
        showToast("تم حفظ الصرفية");
    },

    async archiveAllCurrent() {
        const toArchive = localData.transactions.filter(t => t.type !== 'topup_request' || t.status !== 'pending');
        if (toArchive.length === 0) return showToast("لا يوجد عمليات قابلة للترحيل حالياً", "info");
        const isConfirmed = await showConfirmModal('ترحيل أرشيف', `سيتم ترحيل ${toArchive.length} عملية. هل أنت متأكد؟ (الطلبات المعلقة لن تُرحل)`);
        if (!isConfirmed) return;

        try {
            const batch = writeBatch(db);
            for (const t of toArchive) {
                const { firebaseId, ...archData } = t;
                const newDocRef = doc(collection(db, "archived_transactions"));
                batch.set(newDocRef, { ...archData, isArchived: true, archivedAt: new Date().toISOString() });
                batch.delete(doc(db, "transactions", firebaseId));
            }
            await batch.commit();
            showToast("تم الترحيل للأرشيف بنجاح ✅");
        } catch (e) {
            console.error("Archive Error:", e);
            showToast("فشل الترحيل: " + e.message, "error");
        }
    },

    async deleteTransaction(id) {
        let t = localData.transactions.find(tx => tx.id == id || tx.firebaseId === id);
        let col = "transactions";

        if (!t) {
            t = (localData.archived_transactions || []).find(tx => tx.id == id || tx.firebaseId === id);
            col = "archived_transactions";
        }

        if (t) {
            // 1. استرجاع التأثير المالي للعملية قبل حذفها
            if (t.type === 'debt_payment' && t.subscriberId) {
                // استرجاع الدين للمشترك
                const sub = localData.subscribers.find(s => s.id == t.subscriberId);
                if (sub) {
                    const currentDebt = parseInt(sub.price || 0);
                    const amountToRestore = Math.abs(t.amount); // مبلغ التسديد
                    await updateDoc(doc(db, "subscribers", sub.firebaseId), {
                        price: currentDebt + amountToRestore,
                        paymentType: 'أجل'
                    });
                    showToast(`تم استرجاع مبلغ التسديد (${amountToRestore.toLocaleString()}) لدين المشترك`);
                }
            } else if (t.type === 'system_topup_expense' || (t.type === 'topup_request' && t.status === 'approved' && t.processedBySystem)) {
                const currentBal = this.getSystemBalance();
                const storedAmount = Math.abs(t.amount);
                const newBal = Math.max(0, currentBal - storedAmount);
                await setDoc(doc(db, "accounts", "system"), { balance: newBal, lastUpdated: new Date().toISOString() }, { merge: true });
                showToast(`تم استرجاع مبلغ التعبئة (${storedAmount.toLocaleString()}) من رصيد النظام`);
            } else if (t.costPrice && t.costPrice > 0) {
                if (t.takenFromDebt) {
                    const currentDebt = this.getProviderDebt();
                    const newDebt = Math.max(0, currentDebt - t.costPrice);
                    await setDoc(doc(db, "accounts", "system"), { providerDebt: newDebt, lastUpdated: new Date().toISOString() }, { merge: true });
                    showToast(`تم استرجاع تكلفة الباقة (${t.costPrice.toLocaleString()}) من رصيد الذمة`);
                } else {
                    const currentBal = this.getSystemBalance();
                    const newBal = currentBal + t.costPrice;
                    await setDoc(doc(db, "accounts", "system"), { balance: newBal, lastUpdated: new Date().toISOString() }, { merge: true });
                    showToast(`تم استرجاع تكلفة الباقة (${t.costPrice.toLocaleString()}) إلى رصيد النظام`);
                }
            }

            // 2. حذف العملية فعلياً
            await deleteDoc(doc(db, col, t.firebaseId));
        }
    },

    async deleteSubscriber(id) {
        const isConfirmed = await showConfirmModal('حذف مشترك', 'هل أنت متأكد من حذف المشترك نهائياً؟');
        if (!isConfirmed) return;
        const sub = localData.subscribers.find(s => s.id == id);
        if (sub) await deleteDoc(doc(db, "subscribers", sub.firebaseId));
    },

    getSystemSettings() { return localData.settings_processed || {}; },
    getSubscribers() { return localData.subscribers; },
    getSubscriber(id) { return localData.subscribers.find(s => s.id == id); },
    getAllTransactions() { return localData.transactions || []; },
    getArchivedTransactions() { return localData.archived_transactions || []; },

    getDailyBalance() {
        if (this.cache.dailyBalance !== null) return this.cache.dailyBalance;

        const balance = (localData.transactions || [])
            .filter(t => {
                if (t.isArchived) return false;
                if (t.type === 'subscription_debt') return false;
                if (t.type === 'system_balance_adjustment' || t.type === 'provider_debt_adjustment' || t.type === 'debt_adjustment' || t.type === 'debt_discount') return false;
                if (t.type && t.type.includes('topup_request') && t.status !== 'approved') return false;
                return true;
            })
            .reduce((a, b) => a + (b.amount || 0), 0);

        this.cache.dailyBalance = balance;
        return balance;
    },

    getSystemBalance() {
        const sysAcc = (localData.accounts || []).find(a => a.firebaseId === 'system');
        return sysAcc ? (sysAcc.balance || 0) : 0;
    },

    getProviderDebt() {
        const sysAcc = (localData.accounts || []).find(a => a.firebaseId === 'system');
        return sysAcc ? (sysAcc.providerDebt || 0) : 0;
    },

    async setSystemBalance(amount) {
        try {
            const oldBal = this.getSystemBalance();
            const newVal = parseFloat(amount);
            const diff = newVal - oldBal;

            await setDoc(doc(db, "accounts", "system"), {
                balance: newVal,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            await this.logTransaction({
                type: 'system_balance_adjustment',
                amount: 0,
                virtualAmount: diff,
                description: `تعديل رصيد النظام يدوياً: ${newVal.toLocaleString()} (فرق: ${diff.toLocaleString()})`
            });

            return true;
        } catch (e) {
            console.error("Set balance error:", e);
            return false;
        }
    },

    async updateDebt(firebaseId, newAmount) {
        try {
            const subRef = doc(db, "subscribers", firebaseId);
            const subDoc = await getDoc(subRef);
            if (!subDoc.exists()) throw new Error("المشترك غير موجود");

            const oldDebt = parseInt(subDoc.data().price || 0);

            await updateDoc(subRef, {
                price: newAmount,
                paymentType: newAmount > 0 ? 'أجل' : 'نقد'
            });

            // تسجيل التعديل في السجل (اختياري لكن مفيد)
            await this.logTransaction({
                type: 'debt_adjustment',
                subscriberId: subDoc.data().id,
                amount: 0, // لا يؤثر على الصندوق النقدي
                description: `تعديل يدوي للدين: من ${oldDebt.toLocaleString()} إلى ${newAmount.toLocaleString()}`
            });

            showToast("تم تعديل مبلغ الدين بنجاح");
            return true;
        } catch (e) {
            console.error("Update debt error:", e);
            throw e;
        }
    },

    async setProviderDebt(amount) {
        try {
            const oldDebt = this.getProviderDebt();
            const newVal = parseFloat(amount);
            const diff = newVal - oldDebt;

            await setDoc(doc(db, "accounts", "system"), {
                providerDebt: newVal,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            await this.logTransaction({
                type: 'provider_debt_adjustment',
                amount: 0,
                costPrice: diff,
                takenFromDebt: true,
                description: `تعديل رصيد الذمة يدوياً: ${newVal.toLocaleString()} (فرق: ${diff.toLocaleString()})`
            });

            return true;
        } catch (e) {
            console.error("Set debt error:", e);
            return false;
        }
    },

    async deductFromVirtualBalance(amount, reason = "استقطاع رصيد") {
        if (amount <= 0) return { takenFromDebt: false };

        const currentBal = this.getSystemBalance();
        const currentDebt = this.getProviderDebt();

        // ✅ نظام الذمة الذكي: إذا الرصيد ما يكفي، حول الباقي للذمة
        if (currentBal >= amount) {
            const newBal = currentBal - amount;
            await setDoc(doc(db, "accounts", "system"), { balance: newBal, lastUpdated: new Date().toISOString() }, { merge: true });
            return { takenFromDebt: false };
        } else {
            // الرصيد صفر أو غير كافي -> أضف للذمة
            // الخيار 1: استهلاك ما تبقى من الرصيد والباقي ذمة (معقد برمجياً في الحسابات)
            // الخيار 2: إذا الرصيد ما يكفي، حول كامل التكلفة للذمة (أبسط وأوضح للمستخدم)
            const newDebt = currentDebt + amount;
            await setDoc(doc(db, "accounts", "system"), { providerDebt: newDebt, lastUpdated: new Date().toISOString() }, { merge: true });
            showToast(`⚠️ الرصيد غير كافي. تم تحويل ${amount.toLocaleString()} IQD إلى حساب الذمة`, 'info');
            return { takenFromDebt: true };
        }
    },


    async topUpVirtualBalance(amount) {
        // Create a PENDING request
        const docRef = await addDoc(collection(db, "transactions"), {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            subscriberId: null,
            amount: -Math.abs(amount),
            type: 'topup_request',
            status: 'pending',
            description: "طلب تعبئة رصيد النظام"
        });

        // Notify Telegram
        if (telegramBot && telegramBot.notifyTopUpRequest) {
            await telegramBot.notifyTopUpRequest(Math.abs(amount), docRef.id);
        }


        // Wait for decision (Blocking via Local Data Sync)
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                const updatedTx = localData.transactions.find(tx => tx.firebaseId === docRef.id);
                if (updatedTx) {
                    if (updatedTx.status === 'approved' || updatedTx.processedBySystem) {
                        clearInterval(interval);
                        resolve('approved');
                    } else if (updatedTx.status === 'rejected') {
                        clearInterval(interval);
                        reject(new Error("Request Rejected"));
                    }
                } else if (Date.now() - startTime > 5000) {
                    // Transaction is missing after it was definitely created! 
                    // This happens when it's rejected and deleted immediately.
                    clearInterval(interval);
                    reject(new Error("Request Rejected"));
                }

                if (Date.now() - startTime > 120000) { // 2 mins timeout
                    clearInterval(interval);
                    reject(new Error("Request Timed Out"));
                }
            }, 2000);
        });
    },

    async approveTopUp(docId) {
        try {
            const txRef = doc(db, "transactions", docId);
            const txSnap = await getDoc(txRef);

            if (!txSnap.exists()) return showToast('طلب التعبئة غير موجود', 'error');
            const data = txSnap.data();

            if (data.status !== 'pending') return showToast('تم تنفيذ أو رفض هذا الطلب مسبقاً', 'error');

            const amount = Math.abs(data.amount); // stored as negative

            // 1. Mark as completed and PROCESSED immediately to prevent double-addition from background sync
            await updateDoc(txRef, {
                status: 'approved',
                type: 'system_topup_expense',
                processedBySystem: true,
                approvedAt: new Date().toISOString(),
                finalizedAt: new Date().toISOString()
            });

            // 2. Add to System Balance atomically
            await updateDoc(doc(db, "accounts", "system"), {
                balance: increment(amount),
                lastUpdated: new Date().toISOString()
            });

            showToast(`✅ تمت الموافقة وإضافة ${amount.toLocaleString('en-US')} للرصيد بنجاح`);
            return true;
        } catch (e) {
            console.error("Approval Error:", e);
            showToast("فشلت عملية الموافقة", 'error');
            return false;
        }
    },

    async finalizeApprovedTopUp(tx) {
        // Double check flag locally first
        if (tx.processedBySystem) return;

        try {
            // Use runTransaction to ensure only ONE client processes this atomic increment
            await runTransaction(db, async (transaction) => {
                const txRef = doc(db, "transactions", tx.firebaseId);
                const txDoc = await transaction.get(txRef);

                if (!txDoc.exists()) return;
                const txData = txDoc.data();

                // If already processed by someone else, bail
                if (txData.processedBySystem) return;

                const amount = Math.abs(txData.amount);

                // 1. Mark as processed & change type to finalize
                transaction.update(txRef, {
                    processedBySystem: true,
                    type: 'system_topup_expense',
                    finalizedAt: new Date().toISOString()
                });

                // 2. Perform atomic increment on system balance
                const accRef = doc(db, "accounts", "system");
                transaction.update(accRef, {
                    balance: increment(amount),
                    lastUpdated: new Date().toISOString()
                });
            });

            console.log(`✅ Atomic system finalization successful`);
        } catch (e) {
            console.error("Atomic Finalization Error:", e);
        }
    },

    async rejectTopUp(docId) {
        try {
            const txRef = doc(db, "transactions", docId);
            await updateDoc(txRef, {
                status: 'rejected',
                type: 'topup_request_rejected',
                rejectedAt: new Date().toISOString()
            });

            showToast("⛔ تم رفض طلب التعبئة");

            // Delete after 500ms to clear from list
            setTimeout(async () => {
                try {
                    await deleteDoc(txRef);
                } catch (e) { }
            }, 500);

            return true;
        } catch (e) { return false; }
    },

    async handleTopUpAction(docId, action) {
        let success = false;
        if (action === 'approve_topup') success = await this.approveTopUp(docId);
        if (action === 'reject_topup') success = await this.rejectTopUp(docId);

        // Clean URL after action
        if (success) {
            setTimeout(() => {
                window.history.replaceState({}, document.title, window.location.pathname);
                window.renderDashboard(); // Refresh UI
            }, 2000);
        }
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
        if (emp && await showConfirmModal('حذف موظف', 'هل أنت متأكد من حذف الموظف؟')) {
            await deleteDoc(doc(db, "employees", emp.firebaseId));
        }
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
        if (bal.net > 0 && await showConfirmModal('صرف راتب', `صرف راتب ${emp.name} بمبلغ ${bal.net.toLocaleString('en-US')}؟`)) {
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
        const todayStr = new Date().toISOString().split('T')[0];

        const soon = new Date();
        soon.setDate(soon.getDate() + 3);
        const soonStr = soon.toISOString().split('T')[0];

        return {
            totalSubs: subs.length,
            debts: subs.reduce((sum, s) => sum + (parseInt(s.price) || 0), 0),
            boxBalance: this.getDailyBalance(),
            expired: subs.filter(s => s.expiryDate && s.expiryDate < todayStr).length,
            expiring: subs.filter(s => s.expiryDate && s.expiryDate >= todayStr && s.expiryDate <= soonStr).length
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
