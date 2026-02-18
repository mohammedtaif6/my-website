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
            'payments.html': 'box', // الصندوق
            'reports.html': 'reports',
            'employees.html': 'admin_only', // صفحة الموظفين للمدير فقط
            'telegram-settings.html': 'admin_only',


        };

        const required = protections[page];
        if (!required) return; // صفحة عامة

        // فحص الصلاحية (بدون رسائل مزعجة)
        if (required === 'employee_only') {
            if (user.type === 'admin') {
                window.location.replace('index.html');
                return;
            }
            // الموظفون مسموح لهم
            return;
        }

        if (required === 'admin_only') {
            window.location.replace('index.html');
            return;
        }

        if (!user.permissions[required]) {
            window.location.replace('index.html');
        }
    },

    // تحديث الواجهة (إخفاء الأزرار والروابط)
    updateUI(user) {
        // دالة التنفيذ الفعلي
        const executeUpdate = () => {
            // عرض اسم المستخدم
            const nameEl = document.getElementById('user-name-display');
            if (nameEl) nameEl.innerText = user.name;
            const headerNameEl = document.getElementById('user-name-display-header');
            if (headerNameEl) headerNameEl.innerText = user.name;

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

            // إخفاء الصفحات الخاصة بالمدير فقط
            const adminOnlyElements = ['nav-employees', 'nav-telegram'];
            adminOnlyElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    el.setAttribute('hidden', 'true');
                }
            });

            // إخفاء الكروت الخاصة بالمدير فقط في لوحة التحكم الجديدة
            if (user.type !== 'admin') {
                const restricted = ['nav-card-employees', 'nav-card-telegram'];
                restricted.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
            }


            // إخفاء روابط الإدارة دائماً للموظف (المدير فقط)
            ['nav-employees', 'nav-telegram'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // تطبيق إعدادات المستخدم الإضافية (من صفحة الإعدادات)
            this.applyUIConfigs();
            this.setupAmountShortcuts();
        };

        // التأكد من أن الصفحة محملة قبل التنفيذ
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', executeUpdate);
        } else {
            executeUpdate();
        }
    },

    // تطبيق إعدادات الظهور/الإخفاء المحفوظة في localStorage
    applyUIConfigs() {
        const settings = JSON.parse(localStorage.getItem('sas_settings') || '{}');

        // 1. كروت الداشبورد
        const cardIds = [
            'card-subscribers', 'card-active', 'card-debts', 'card-payments',
            'card-reports', 'nav-card-employees', 'card-expiring', 'card-expired',
            'nav-card-telegram'
        ];
        cardIds.forEach(id => {
            if (settings[id] === false) {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            }
        });

        // 2. صفحات القائمة الجانبية (لجميع الصفحات)
        const navIds = [
            'nav-subscribers', 'nav-active', 'nav-debts', 'nav-payments',
            'nav-reports', 'nav-employees', 'nav-telegram'
        ];
        navIds.forEach(id => {
            if (settings[id] === false) {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            }
        });

        // تغيير اسم النظام إذا وجد
        if (settings.systemName) {
            document.querySelectorAll('.logo').forEach(el => {
                const icon = el.querySelector('i');
                if (icon) {
                    el.innerHTML = '';
                    el.appendChild(icon);
                    el.innerHTML += ' ' + settings.systemName;
                } else {
                    el.innerText = settings.systemName;
                }
            });
        }
    },

    // ميزة اختصار المبالغ (كتب 30 تصبح 30,000)
    setupAmountShortcuts() {
        // نراقب جميع حقول الأرقام في الصفحة
        const inputs = document.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            // استثناء: لا نريد تطبيقها على كود التحقق أو أرقام الهواتف أو المدد القصيرة
            if (input.id.includes('phone') || input.id.includes('id') || input.id.includes('duration') || input.id.includes('code')) return;

            input.addEventListener('blur', (e) => {
                let val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && val < 1000) {
                    e.target.value = val * 1000;
                }
            });
        });
    }
};

window.AuthSystem = AuthSystem;

// Swipe gesture removed for better mobile performance
// End of AuthSystem.js
