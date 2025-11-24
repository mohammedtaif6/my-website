/**
 * نظام إدارة البيانات المركزي - Firebase Edition
 * يدعم التزامن اللحظي بين الأجهزة عبر الإنترنت
 */

// 1. استيراد مكتبات فايربيس من السيرفرات مباشرة
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. إعدادات مشروعك (التي أرسلتها لي)
const firebaseConfig = {
  apiKey: "AIzaSyA-raYlvzPz8T7Mnx8bTWA4O8CyHvp7K_0",
  authDomain: "okcomputer-system.firebaseapp.com",
  projectId: "okcomputer-system",
  storageBucket: "okcomputer-system.firebasestorage.app",
  messagingSenderId: "17748146044",
  appId: "1:17748146044:web:e4a2063ac34c6ee27016f9",
  measurementId: "G-CNMCQ04CFD"
};

// 3. تهيئة الاتصال
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// مخزن مؤقت للبيانات (لضمان سرعة العرض وعدم تعليق الصفحة)
let localSubscribers = [];
let localDebts = [];

// تعريف النظام
const DataManager = {
    
    // دالة التهيئة: تبدأ الاستماع الفوري للتغييرات
    init() {
        console.log("جاري الاتصال بقاعدة البيانات السحابية...");
        
        // استماع للمشتركين (أي تغيير في أي جهاز سيصل هنا فوراً)
        const subCol = collection(db, "subscribers");
        const q = query(subCol, orderBy("id", "desc")); // ترتيب تنازلي حسب الرقم
        
        onSnapshot(q, (snapshot) => {
            localSubscribers = snapshot.docs.map(doc => ({
                ...doc.data(),
                firebaseId: doc.id // نحفظ معرف الوثيقة للتعديل والحذف لاحقاً
            }));
            
            console.log("تم تحديث البيانات من السحابة:", localSubscribers.length);
            
            // تحديث الواجهة تلقائياً إذا كانت الدوال موجودة في الصفحة
            if (typeof window.loadSubscribers === 'function') window.loadSubscribers();
            if (typeof window.updateDashboard === 'function') window.updateDashboard();
            if (typeof window.updateStats === 'function') window.updateStats();
        });

        // استماع للديون (اختياري حالياً إذا كنت تستخدمها)
        const debtCol = collection(db, "debts");
        onSnapshot(debtCol, (snapshot) => {
            localDebts = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // إدارة المشتركين (Cloud Functions)
    // ═══════════════════════════════════════════════════════════════════

    async addSubscriber(data) {
        // حساب ID رقمي بسيط للعرض (مثل 1, 2, 3)
        // نستخدم 0 كقيمة افتراضية لتجنب الخطأ في أول مرة
        const maxId = localSubscribers.length > 0 ? Math.max(...localSubscribers.map(s => s.id || 0)) : 0;
        const newId = maxId + 1;
        
        const subscriber = {
            id: newId,
            name: data.name || 'بدون اسم',
            phone: data.phone || '',
            subscribeDate: data.subscribeDate || '',
            expiryDate: data.expiryDate || '',
            status: data.status || 'قيد الانتظار',
            price: data.price || 0,
            paymentType: data.paymentType || 'نقد',
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "subscribers"), subscriber);
            // لا نحتاج لتحديث المصفوفة يدوياً، onSnapshot ستقوم بذلك
        } catch (e) {
            console.error("خطأ في الإضافة:", e);
            alert("فشل الحفظ في قاعدة البيانات. تحقق من الإنترنت.");
        }
    },

    async updateSubscriber(id, data) {
        // نجد المشترك في القائمة المحلية لنحصل على معرفه في فايربيس
        const sub = localSubscribers.find(s => s.id === id);
        if (sub && sub.firebaseId) {
            try {
                const docRef = doc(db, "subscribers", sub.firebaseId);
                await updateDoc(docRef, data);
            } catch (e) {
                console.error("خطأ في التعديل:", e);
            }
        }
    },

    async deleteSubscriber(id) {
        const sub = localSubscribers.find(s => s.id === id);
        if (sub && sub.firebaseId) {
            try {
                await deleteDoc(doc(db, "subscribers", sub.firebaseId));
            } catch (e) {
                console.error("خطأ في الحذف:", e);
            }
        }
    },

    // هذه الدوال تقرأ من النسخة المحلية (سريعة جداً للبحث)
    getSubscriber(id) {
        return localSubscribers.find(s => s.id === id);
    },

    getSubscribers() {
        return localSubscribers;
    },

    searchSubscribers(query) {
        if (!query) return [];
        const q = String(query).toLowerCase().trim();
        return localSubscribers.filter(s => {
            if (!s) return false;
            const name = (s.name || '').toString().toLowerCase();
            const phone = (s.phone || '').toString();
            return name.includes(q) || phone.includes(q);
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // الإحصائيات والتقارير
    // ═══════════════════════════════════════════════════════════════════

    getStatistics() {
        const subscribers = this.getSubscribers();
        
        return {
            totalSubscribers: subscribers.length,
            activeSubscribers: subscribers.filter(s => s && s.status === 'نشط').length,
            pendingSubscribers: subscribers.filter(s => s && s.status === 'قيد الانتظار').length,
            inactiveSubscribers: subscribers.filter(s => s && s.status === 'غير نشط').length,
            expiredSubscribers: subscribers.filter(s => s && s.expiryDate && new Date(s.expiryDate) < new Date()).length,
            // حساب القريب من الانتهاء
            expiringSubscribers: subscribers.filter(s => {
                if (!s || !s.expiryDate) return false;
                const today = new Date(); today.setHours(0,0,0,0);
                const expiry = new Date(s.expiryDate); expiry.setHours(0,0,0,0);
                const threeDays = new Date(today); threeDays.setDate(threeDays.getDate() + 3);
                return expiry > today && expiry <= threeDays;
            }).length,
            totalRevenue: subscribers.reduce((sum, s) => sum + (s.price || 0), 0)
        };
    },

    exportToCSV(data, filename) {
        if (!data || data.length === 0) { alert('لا توجد بيانات'); return; }
        // استبعاد الحقول الداخلية الخاصة بفايربيس
        const headers = Object.keys(data[0]).filter(k => k !== 'firebaseId');
        let csv = headers.join(',') + '\n';
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : (value || '');
            });
            csv += values.join(',') + '\n';
        });
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        link.download = `${filename || 'data'}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    }
};

// 4. جعل DataManager متاحاً لكل ملفات HTML
window.DataManager = DataManager;

// بدء النظام
DataManager.init();
