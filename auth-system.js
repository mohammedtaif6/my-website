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
            'telegram-settings.html': 'admin_only',
            'maintenance-log.html': 'admin_only', // سجل الصيانات للمدير فقط
            'maintenance.html': 'employee_only' // تسجيل الصيانة للموظفين فقط
        };

        const required = protections[page];
        if (!required) return; // صفحة عامة

        // فحص الصلاحية
        if (required === 'employee_only') {
            if (user.type === 'admin') {
                alert('🚫 هذه الصفحة للموظفين فقط!');
                window.location.href = 'index.html';
                return;
            }
            // الموظفون مسموح لهم
            return;
        }

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

            // إخفاء الكروت الخاصة بالمدير فقط في لوحة التحكم الجديدة
            if (user.type !== 'admin') {
                const restricted = ['nav-card-employees', 'nav-card-maintenance', 'nav-card-telegram'];
                restricted.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
            }


            // إخفاء روابط الإدارة دائماً للموظف (المدير فقط)
            ['nav-employees', 'nav-telegram', 'nav-maintenance-log'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // إظهار رابط تسجيل الصيانة للموظفين فقط
            const maintLink = document.getElementById('nav-maintenance');
            if (maintLink) {
                maintLink.style.display = 'list-item';
            }
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

// === Swipe Back Gesture Logic (Native App Feel + Visual Indicator) ===
(function () {
    let touchStartX = 0;
    let touchStartY = 0;
    let isEdgeSwipe = false;
    let indicator = null;
    let icon = null;

    // Create Indicator Element
    function createIndicator() {
        if (document.getElementById('swipe-back-indicator')) return;
        indicator = document.createElement('div');
        indicator.id = 'swipe-back-indicator';
        indicator.innerHTML = '<i class="fas fa-arrow-right"></i>'; // سهم يشير لليمين (اتجاه العودة للصفحة السابقة)
        document.body.appendChild(indicator);
        icon = indicator.querySelector('i');
    }

    document.addEventListener('touchstart', e => {
        createIndicator(); // Ensure it exists
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;

        // المنطقة الآمنة للسحب (آخر 40px من اليمين)
        isEdgeSwipe = touchStartX > (window.innerWidth - 40);

        // لا تعمل في الصفحات الرئيسية
        const currentPath = window.location.pathname;
        if (currentPath.includes('index.html') || currentPath.endsWith('/') || currentPath.includes('login.html')) {
            isEdgeSwipe = false;
        }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        if (!isEdgeSwipe) return;

        const touchCurrentX = e.changedTouches[0].screenX;
        const touchCurrentY = e.changedTouches[0].screenY;

        const diffX = touchStartX - touchCurrentX; // موجب عند السحب لليسار
        const diffY = Math.abs(touchCurrentY - touchStartY);

        // إذا كان السحب عمودياً أكثر، نلغي العملية (Scroll)
        if (diffY > diffX && diffY > 10) {
            isEdgeSwipe = false;
            indicator.style.right = '-50px';
            indicator.style.opacity = '0';
            return;
        }

        // تحريك المؤشر مع الإصبع
        // الحد الأقصى للسحب المرئي 100px
        const pullDistance = Math.min(Math.max(diffX, 0), 120);

        if (pullDistance > 10) {
            indicator.style.opacity = '1';
            // نحركه من -50 (مخفي) إلى 0 أو أكثر
            // معادلة بسيطة: كلما سحبت، يخرج المؤشر
            const rightVal = -50 + (pullDistance * 0.8);
            indicator.style.right = `${rightVal}px`;

            // تدوير السهم وتكبيره عند الوصول للحد
            if (pullDistance > 80) {
                indicator.style.background = 'rgba(16, 185, 129, 0.9)'; // أخضر عند الجاهزية
                icon.style.transform = 'scale(1.2)';
            } else {
                indicator.style.background = 'rgba(0, 0, 0, 0.6)';
                icon.style.transform = 'scale(1)';
            }
        }

    }, { passive: true });

    document.addEventListener('touchend', e => {
        if (!isEdgeSwipe) return;

        const touchEndX = e.changedTouches[0].screenX;
        const diffX = touchStartX - touchEndX;

        // إخفاء المؤشر
        indicator.style.right = '-50px';
        indicator.style.opacity = '0';
        indicator.style.background = 'rgba(0, 0, 0, 0.6)'; // reset color

        if (diffX > 80) { // مسافة كافية للرجوع
            // تنفيذ الرجوع بأنيميشن
            document.body.classList.add('sliding-back');

            // Visual Pop effect
            indicator.classList.add('release');
            setTimeout(() => indicator.classList.remove('release'), 300);

            setTimeout(() => {
                window.history.back();
            }, 100);
        }

        isEdgeSwipe = false;
    }, { passive: true });
})();
