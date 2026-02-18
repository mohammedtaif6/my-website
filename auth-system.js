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

    // تطبيق إعدادات الظهور/الإخفاء (من localStorage أو Cloud)
    applyUIConfigs(cloudSettings = null) {
        // نستخدم الإعدادات القادمة من السحاب إذا وجدت، وإلا نستخدم المحلي
        const settings = cloudSettings || JSON.parse(localStorage.getItem('sas_settings') || '{}');

        // حفظ نسخة محلية للتسريع المستقبلي (Anti-flicker)
        if (cloudSettings) {
            localStorage.setItem('sas_settings', JSON.stringify(cloudSettings));
        }

        // 1. كروت الداشبورد
        const cardIds = [
            'card-subscribers', 'card-active', 'card-debts', 'card-payments',
            'card-reports', 'nav-card-employees', 'card-expiring', 'card-expired',
            'nav-card-telegram'
        ];
        cardIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (settings[id] === false) {
                el.style.display = 'none';
            } else {
                // قد نحتاج لإعادة إظهار العنصر إذا تغير الإعداد في السحاب من false إلى true
                // بشرط ألا يكون المستخدم موظفاً ومحروماً من الصلاحية أصلاً
                if (this.currentUser && this.currentUser.type === 'admin') {
                    el.style.display = '';
                }
            }
        });

        // 2. صفحات القائمة الجانبية (لجميع الصفحات)
        const navIds = [
            'nav-subscribers', 'nav-active', 'nav-debts', 'nav-payments',
            'nav-reports', 'nav-employees', 'nav-telegram'
        ];
        navIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (settings[id] === false) {
                el.style.display = 'none';
            } else {
                if (this.currentUser && this.currentUser.type === 'admin') {
                    el.style.display = '';
                }
            }
        });

        // 3. تغيير اسم النظام إذا وجد
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

    // ميزة اختصار المبالغ (كتب 30 تصبح 30,000) باستخدام Event Delegation
    setupAmountShortcuts() {
        // حماية من التكرار
        if (window._shortcutBound) return;
        window._shortcutBound = true;

        // استخدام الـ Capture Phase للتعامل مع حدث Blur الذي لا ينتشر (Bubbles)
        document.body.addEventListener('blur', (e) => {
            const input = e.target;
            if (input && input.tagName === 'INPUT' && (input.type === 'number' || input.classList.contains('setting-input'))) {
                // استثناء الحقول التي لا نريد تحويلها
                const id = (input.id || "").toLowerCase();
                const name = (input.name || "").toLowerCase();
                if (id.includes('phone') || id.includes('duration') || id.includes('code') || id.includes('id') || name.includes('phone')) return;

                let val = parseFloat(input.value);
                // التحقق من أن القيمة ليست "اسم النظام" أو نصوص أخرى
                if (!isNaN(val) && val > 0 && val < 1000) {
                    input.value = val * 1000;
                    // إطلاق حدث change للتأكد من أن الأنظمة الأخرى تشعر بالتغيير
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }, true);
    }
};

window.AuthSystem = AuthSystem;

// Swipe gesture removed for better mobile performance
// End of AuthSystem.js
