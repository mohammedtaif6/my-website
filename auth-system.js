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
            const adminOnlyElements = ['nav-employees', 'nav-telegram', 'nav-settings', 'card-settings'];
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
                if (el.hasAttribute('hidden')) return;
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
            // إذا العنصر مخفي بسبب صلاحيات الموظف (hidden attribute) → لا تلمسه أبداً
            if (el.hasAttribute('hidden')) return;
            if (settings[id] === false) {
                el.style.display = 'none';
            } else if (settings.hasOwnProperty(id) && settings[id] === true) {
                // فقط أعد إظهاره إذا كان الإعداد موجود صراحةً وقيمته true
                if (this.currentUser && this.currentUser.type === 'admin') {
                    el.style.display = '';
                }
            }
        });

        // 3. تغيير اسم النظام إذا وجد
        if (settings.systemName) {
            document.querySelectorAll('.logo').forEach(el => {
                const icon = el.querySelector('i');
                const textNode = Array.from(el.childNodes).find(n => n.nodeType === 3); // Find text node
                if (icon) {
                    if (textNode) {
                        textNode.nodeValue = ' ' + settings.systemName;
                    } else {
                        el.innerHTML = '';
                        el.appendChild(icon);
                        el.appendChild(document.createTextNode(' ' + settings.systemName));
                    }
                } else {
                    el.innerText = settings.systemName;
                }
            });
            // تحديث عنوان الصفحة أيضاً
            if (!window.location.href.includes('login.html')) {
                const currentTitle = document.title.split(' - ').pop();
                document.title = settings.systemName + (currentTitle ? ' - ' + currentTitle : '');
            }
        }

        // 4. تحديث القيم الافتراضية في النماذج (إذا كانت موجودة في الصفحة الحالية)
        if (settings.defaultPrice) {
            const priceInputs = ['act-price', 'qa-price', 'new-price', 'set-default-price'];
            priceInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.getAttribute('data-user-modified')) {
                    el.value = settings.defaultPrice;
                }
            });
        }

        return settings;
    },

    // مساعد لفحص هل العنصر محظور برمجياً (للموظفين)
    isRestricted(id) {
        if (!this.currentUser || this.currentUser.type === 'admin') return false;
        const perms = this.currentUser.permissions || {};

        const map = {
            'nav-subscribers': 'subscribers', 'card-subscribers': 'subscribers',
            'nav-debts': 'debts', 'card-debts': 'debts',
            'nav-payments': 'box', 'card-payments': 'box',
            'nav-reports': 'reports', 'card-reports': 'reports',
            'nav-employees': 'admin_only', 'nav-card-employees': 'admin_only',
            'nav-telegram': 'admin_only', 'nav-card-telegram': 'admin_only'
        };

        const req = map[id];
        if (!req) return false;
        if (req === 'admin_only') return true;
        return !perms[req];
    },

    // ميزة اختصار المبالغ (كتب 30 تصبح 30,000)
    setupAmountShortcuts() {
        if (window.isAmountShortcutsSetup) return;
        window.isAmountShortcutsSetup = true;

        console.log("💰 Amount shortcuts v2.0 (Type 30 -> 30,000)");

        const processInput = (input) => {
            if (!input || input.tagName !== 'INPUT') return;

            // تنظيف القيمة من الفواصل أو المسافات قبل المعالجة
            let rawValue = input.value.toString().replace(/,/g, '').trim();
            if (rawValue === "") return;

            const id = (input.id || "").toLowerCase();
            const name = (input.name || "").toLowerCase();
            const classes = (input.className || "").toLowerCase();

            const isAmountField = id.includes('amount') || id.includes('price') || id.includes('cost') ||
                id.includes('salary') || id.includes('debt') || id.includes('advance') ||
                id.includes('bonus') || id.includes('revenue') || name.includes('price') ||
                classes.includes('amount');

            const isExcluded = id.includes('phone') || id.includes('duration') || id.includes('code') ||
                id.includes('id') || id.includes('num') || name.includes('phone') ||
                name.includes('id');

            if (isAmountField && !isExcluded) {
                let val = parseFloat(rawValue);

                // 1. منطق إضافة الأصفار (إذا كان بين 1 و 999)
                if (!isNaN(val) && val > 0 && val < 1000) {
                    val = val * 1000;
                }

                // 2. تحديث الحقل بالقيمة الجديدة
                if (!isNaN(val)) {
                    // إذا كان الحقل من نوع text، نعرض الفواصل للجمالية
                    // إذا كان number، نضع الرقم الصافي فقط (لأن number لا يدعم الفواصل)
                    if (input.type === 'number') {
                        input.value = Math.round(val);
                    } else {
                        input.value = Math.round(val).toLocaleString('en-US');
                    }

                    // إطلاق أحداث التغيير لتنبيه الأنظمة الأخرى
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        };

        // معالجة عند الخروج من الحقل
        document.body.addEventListener('focusout', (e) => processInput(e.target), true);

        // معالجة عند ضغط Enter
        document.body.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                processInput(e.target);
            }
        });

        // تنظيف تلقائي للمبالغ عند التركيز (إزالة الفواصل ليسهل التعديل)
        document.body.addEventListener('focusin', (e) => {
            const input = e.target;
            if (input && input.tagName === 'INPUT' && input.type !== 'number') {
                input.value = input.value.replace(/,/g, '');
            }
        }, true);
    }
};

window.AuthSystem = AuthSystem;

// Swipe gesture removed for better mobile performance
// End of AuthSystem.js
