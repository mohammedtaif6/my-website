/**
 * Telegram Bot Integration v1.0
 * نظام إشعارات Telegram الاحترافي
 */

class TelegramBot {
    constructor() {
        // إعدادات البوت - محفوظة في Firebase
        this.config = null;
        this.db = null;
        this.configLoaded = false;
    }

    // تهيئة الاتصال بـ Firebase
    async initFirebase(db) {
        this.db = db;
        await this.loadConfig();
    }

    async loadConfig() {
        if (!this.db) {
            console.warn('Firebase not initialized yet');
            return this.getDefaultConfig();
        }

        try {
            // محاولة تحميل الإعدادات من Firebase
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const configDoc = await getDoc(doc(this.db, "settings", "telegram"));

            if (configDoc.exists()) {
                this.config = configDoc.data();
                this.configLoaded = true;
                console.log('✅ تم تحميل إعدادات Telegram من Firebase');
                return this.config;
            } else {
                // إذا لم تكن موجودة، نستخدم القيم الافتراضية
                this.config = this.getDefaultConfig();
                await this.saveConfig(this.config);
                return this.config;
            }
        } catch (error) {
            console.error('خطأ في تحميل إعدادات Telegram:', error);
            this.config = this.getDefaultConfig();
            return this.config;
        }
    }

    getDefaultConfig() {
        return {
            botToken: '', // سيتم إدخاله من الإعدادات
            chatId: '',   // سيتم إدخاله من الإعدادات
            enabled: false,
            notifications: {
                newActivation: true,      // تفعيل جديد
                renewal: true,            // تجديد اشتراك
                expiringSoon: true,       // اشتراك على وشك الانتهاء
                expired: true,            // اشتراك منتهي
                debtAdded: true,          // دين جديد
                debtPaid: true,           // تسديد دين
                expense: true,            // صرفية جديدة
                dailySummary: true,       // ملخص يومي

            }
        };
    }

    async saveConfig(config) {
        if (!this.db) {
            console.error('Cannot save config: Firebase not initialized');
            return;
        }

        try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            this.config = { ...this.config, ...config };
            await setDoc(doc(this.db, "settings", "telegram"), this.config);
            console.log('✅ تم حفظ إعدادات Telegram في Firebase');
        } catch (error) {
            console.error('خطأ في حفظ إعدادات Telegram:', error);
        }
    }

    async sendMessage(message, options = {}) {
        // Ensure config is loaded
        if (!this.configLoaded && this.db) {
            await this.loadConfig();
        }

        if (!this.config || !this.config.enabled || !this.config.botToken || !this.config.chatId) {
            console.log('⚠️ Telegram غير مفعّل أو الإعدادات غير مكتملة');
            return false;
        }

        const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

        const payload = {
            chat_id: this.config.chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...options
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.ok) {
                console.log('✅ تم إرسال رسالة Telegram بنجاح');
                return true;
            } else {
                console.error('❌ خطأ في إرسال رسالة Telegram:', data.description);
                return false;
            }
        } catch (error) {
            console.error('❌ خطأ في الاتصال بـ Telegram:', error);
            return false;
        }
    }

    // إشعار تفعيل جديد
    async notifyNewActivation(subscriberName, price, type, endDate) {
        if (!this.config.notifications.newActivation) return;

        const emoji = type === 'نقد' ? '💵' : '📝';
        const message = `
🎉 <b>تفعيل اشتراك جديد</b>

👤 المشترك: <b>${subscriberName}</b>
${emoji} المبلغ: <b>${price.toLocaleString()} د.ع</b>
💳 نوع الدفع: <b>${type}</b>
📅 ينتهي في: <b>${endDate}</b>

⏰ ${new Date().toLocaleString('ar-IQ')}
        `.trim();

        return await this.sendMessage(message);
    }

    // إشعار تجديد اشتراك
    async notifyRenewal(subscriberName, price, type, endDate) {
        if (!this.config.notifications.renewal) return;

        const emoji = type === 'نقد' ? '💵' : '📝';
        const message = `
🔄 <b>تجديد اشتراك</b>

👤 المشترك: <b>${subscriberName}</b>
${emoji} المبلغ: <b>${price.toLocaleString()} د.ع</b>
💳 نوع الدفع: <b>${type}</b>
📅 ينتهي في: <b>${endDate}</b>

⏰ ${new Date().toLocaleString('ar-IQ')}
        `.trim();

        return await this.sendMessage(message);
    }

    // إشعار اشتراك على وشك الانتهاء
    async notifyExpiringSoon(subscribers) {
        if (!this.config.notifications.expiringSoon || subscribers.length === 0) return;

        let message = `⚠️ <b>اشتراكات على وشك الانتهاء</b>\n\n`;

        subscribers.forEach((sub, index) => {
            const daysLeft = this.getDaysUntilExpiry(sub.expiryDate);
            message += `${index + 1}. <b>${sub.name}</b> - ينتهي خلال ${daysLeft} يوم\n`;
        });

        message += `\n⏰ ${new Date().toLocaleString('ar-IQ')}`;

        return await this.sendMessage(message);
    }

    // إشعار اشتراك منتهي
    async notifyExpired(subscribers) {
        if (!this.config.notifications.expired || subscribers.length === 0) return;

        let message = `❌ <b>اشتراكات منتهية</b>\n\n`;

        subscribers.forEach((sub, index) => {
            message += `${index + 1}. <b>${sub.name}</b> - انتهى في ${sub.expiryDate}\n`;
        });

        message += `\n⏰ ${new Date().toLocaleString('ar-IQ')}`;

        return await this.sendMessage(message);
    }

    // إشعار دين جديد
    async notifyDebtAdded(subscriberName, amount) {
        if (!this.config.notifications.debtAdded) return;

        const message = `
📝 <b>دين جديد</b>

👤 المشترك: <b>${subscriberName}</b>
💰 المبلغ: <b>${amount.toLocaleString()} د.ع</b>

⏰ ${new Date().toLocaleString('ar-IQ')}
        `.trim();

        return await this.sendMessage(message);
    }

    // إشعار تسديد دين
    async notifyDebtPaid(subscriberName, amount, remaining) {
        if (!this.config.notifications.debtPaid) return;

        const message = `
✅ <b>تسديد دين</b>

👤 المشترك: <b>${subscriberName}</b>
💵 المبلغ المسدد: <b>${amount.toLocaleString()} د.ع</b>
💰 المتبقي: <b>${remaining.toLocaleString()} د.ع</b>

⏰ ${new Date().toLocaleString('ar-IQ')}
        `.trim();

        return await this.sendMessage(message);
    }

    // إشعار صرفية جديدة
    async notifyExpense(description, amount) {
        if (!this.config.notifications.expense) return;

        const message = `
💸 <b>صرفية جديدة</b>

📝 الوصف: <b>${description}</b>
💰 المبلغ: <b>${amount.toLocaleString()} د.ع</b>

⏰ ${new Date().toLocaleString('ar-IQ')}
        `.trim();

        return await this.sendMessage(message);
    }

    // ملخص يومي
    async sendDailySummary(stats) {
        if (!this.config.notifications.dailySummary) return;

        const message = `
📊 <b>الملخص اليومي</b>

👥 إجمالي المشتركين: <b>${stats.totalSubs}</b>
💰 الديون: <b>${stats.debts.toLocaleString()} د.ع</b>
💵 رصيد الصندوق: <b>${stats.boxBalance.toLocaleString()} د.ع</b>
❌ المنتهية: <b>${stats.expired}</b>
⚠️ تنتهي قريباً: <b>${stats.expiring}</b>

📅 ${new Date().toLocaleDateString('ar-IQ')}
⏰ ${new Date().toLocaleTimeString('ar-IQ')}
        `.trim();

        return await this.sendMessage(message);
    }

    // حساب الأيام المتبقية
    getDaysUntilExpiry(expiryDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDate);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }



    // اختبار الاتصال
    async testConnection() {
        const message = `
🤖 <b>اختبار اتصال Telegram Bot</b>

✅ تم الاتصال بنجاح!
النظام جاهز لإرسال الإشعارات.

⏰ ${new Date().toLocaleString('ar-IQ')}
        `.trim();

        return await this.sendMessage(message);
    }
}

// تصدير للاستخدام
export const telegramBot = new TelegramBot();
