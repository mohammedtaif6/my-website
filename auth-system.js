// AuthSystem v2.0 - نظام صلاحيات بسيط وقوي
const AuthSystem = {
    // التحقق من الجلسة الحالية
    checkSession() {
        if (window.location.href.includes('login.html')) return;

        const session = localStorage.getItem('ok_session');
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        const user = JSON.parse(session);
        this.currentUser = user; // حفظ المستخدم في الذاكرة

        // تطبيق الحماية على الصفحة الحالية
        this.enforceProtection(user);

        // تحديث واجهة المستخدم (إخفاء العناصر)
        this.updateUI(user);
    },

    // تسجيل الدخول
    login(phone, password) {
        // 1. التحقق من المدير
        const adminPhone = localStorage.getItem('admin_phone') || '07700000000';
        const adminPass = localStorage.getItem('admin_password') || 'admin123';

        if (phone === adminPhone && password === adminPass) {
            this.saveSession({ type: 'admin', name: 'المدير' });
            return true;
        }

        // 2. التحقق من الموظفين
        if (typeof DataManager !== 'undefined') {
            const employees = DataManager.getEmployees();
            const emp = employees.find(e => e.phone === phone && e.password === password);
            if (emp) {
                this.saveSession({
                    type: 'employee',
                    name: emp.name,
                    id: emp.id,
                    permissions: emp.permissions || {}
                });
                return true;
            }
        }

        return false;
    },

    // حفظ الجلسة
    saveSession(user) {
        localStorage.setItem('ok_session', JSON.stringify(user));
        this.currentUser = user;
    },

    // تسجيل الخروج
    logout() {
        localStorage.removeItem('ok_session');
        window.location.href = 'login.html';
    },

    // تطبيق الحماية (Redirect)
    enforceProtection(user) {
        if (user.type === 'admin') return; // المدير يدخل في كل مكان

        const page = window.location.pathname.split('/').pop();
        if (!page || page === 'index.html') return; // الصفحة الرئيسية مسموحة للكل

        // خريطة الصلاحيات
        const protections = {
            'subscribers.html': 'subscribers',
            'debts.html': 'debts',
            'payments.html': 'payments',
            'reports.html': 'reports',
            'expenses.html': 'expenses',
            'employees.html': 'admin_only', // صفحة الموظفين للمدير فقط
            'telegram-settings.html': 'admin_only'
        };

        const required = protections[page];
        if (!required) return; // صفحة عامة

        // فحص الصلاحية
        if (required === 'admin_only') {
            alert('🚫 هذه الصفحة للمدير فقط!');
            window.location.href = 'index.html';
            return;
        }

        if (!user.permissions[required]) {
            alert('🚫 ليس لديك صلاحية لدخول هذه الصفحة!');
            window.location.href = 'index.html';
        }
    },

    // تحديث الواجهة (إخفاء الأزرار والروابط)
    updateUI(user) {
        // دالة التنفيذ الفعلي
        const executeUpdate = () => {
            // عرض اسم المستخدم
            const nameEl = document.getElementById('user-name-display');
            if (nameEl) nameEl.innerText = user.name;

            if (user.type === 'admin') return; // المدير يشوف كل شي

            // إخفاء العناصر بناءً على الصلاحيات
            const perms = user.permissions || {};

            // قائمة العناصر المرتبطة بكل صلاحية
            const elementsToHide = {
                'subscribers': ['nav-subscribers', 'card-subscribers', 'btn-quick-activate'],
                'debts': ['nav-debts', 'card-debts'],
                'payments': ['nav-payments', 'card-payments'],
                'reports': ['nav-reports', 'card-reports'],
                'expenses': ['nav-expenses'] // أزلنا btn-quick-expense لأن الموظفين يحتاجونه للسلف
            };

            // إخفاء العناصر المحظورة
            for (const [perm, ids] of Object.entries(elementsToHide)) {
                if (!perms[perm]) { // إذا لم يملك الصلاحية
                    ids.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.style.display = 'none';
                            el.setAttribute('hidden', 'true'); // زيادة في التأكيد
                        }
                    });
                }
            }

            // إخفاء روابط الإدارة دائماً للموظف
            ['nav-employees', 'nav-telegram'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        };

        // التأكد من أن الصفحة محملة قبل التنفيذ
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', executeUpdate);
        } else {
            executeUpdate();
        }
    }
};

window.AuthSystem = AuthSystem;
