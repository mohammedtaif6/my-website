/**
 * Telegram Bot Integration v1.0
 * نظام إشعارات Telegram الاحترافي
 */

class TelegramBot {
    constructor() {
        // إعدادات البوت - محفوظة في Firebase
        this.config = null;
        this.db = null;
        this.isInitialized = false;
        this.instanceId = Math.random().toString(36).substring(7);
        this.isPolling = false; // Keep this, as it's used later
        this.configLoaded = false; // Keep this, as it's used later

        // تنظيف القفل عند إغلاق التبويب
        window.addEventListener('beforeunload', () => {
            if (localStorage.getItem('sas_tg_poll_id') === this.instanceId) {
                localStorage.removeItem('sas_tg_poll_active');
                localStorage.removeItem('sas_tg_poll_id');
            }
        });
    }

    // تهيئة الاتصال بـ Firebase
    async initFirebase(db) {
        this.db = db;
        await this.loadConfig();

        // محاولة مسح أي Webhook قديم قد يسبب تعارض 409 مع getUpdates
        if (this.config && this.config.botToken) {
            try {
                const url = `https://api.telegram.org/bot${this.config.botToken}/deleteWebhook?drop_pending_updates=true`;
                await fetch(url);
            } catch (e) { }
        }
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
${emoji} المبلغ: <b>${price.toLocaleString('en-US')} د.ع</b>
💳 نوع الدفع: <b>${type}</b>
📅 ينتهي في: <b>${endDate}</b>

⏰ ${new Date().toLocaleString('en-US')}
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
${emoji} المبلغ: <b>${price.toLocaleString('en-US')} د.ع</b>
💳 نوع الدفع: <b>${type}</b>
📅 ينتهي في: <b>${endDate}</b>

⏰ ${new Date().toLocaleString('en-US')}
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

        message += `\n⏰ ${new Date().toLocaleString('en-US')}`;

        return await this.sendMessage(message);
    }

    // إشعار اشتراك منتهي
    async notifyExpired(subscribers) {
        if (!this.config.notifications.expired || subscribers.length === 0) return;

        let message = `❌ <b>اشتراكات منتهية</b>\n\n`;

        subscribers.forEach((sub, index) => {
            message += `${index + 1}. <b>${sub.name}</b> - انتهى في ${sub.expiryDate}\n`;
        });

        message += `\n⏰ ${new Date().toLocaleString('en-US')}`;

        return await this.sendMessage(message);
    }

    // إشعار دين جديد
    async notifyDebtAdded(subscriberName, amount) {
        if (!this.config.notifications.debtAdded) return;

        const message = `
📝 <b>دين جديد</b>

👤 المشترك: <b>${subscriberName}</b>
💰 المبلغ: <b>${amount.toLocaleString('en-US')} د.ع</b>

⏰ ${new Date().toLocaleString('en-US')}
        `.trim();

        return await this.sendMessage(message);
    }

    // إشعار تسديد دين
    async notifyDebtPaid(subscriberName, amount, remaining) {
        if (!this.config.notifications.debtPaid) return;

        const message = `
✅ <b>تسديد دين</b>

👤 المشترك: <b>${subscriberName}</b>
💵 المبلغ المسدد: <b>${amount.toLocaleString('en-US')} د.ع</b>
💰 المتبقي: <b>${remaining.toLocaleString('en-US')} د.ع</b>

⏰ ${new Date().toLocaleString('en-US')}
        `.trim();

        return await this.sendMessage(message);
    }

    // إشعار صرفية جديدة
    async notifyExpense(description, amount) {
        if (!this.config.notifications.expense) return;

        const message = `
💸 <b>صرفية جديدة</b>

📝 الوصف: <b>${description}</b>
💰 المبلغ: <b>${amount.toLocaleString('en-US')} د.ع</b>

⏰ ${new Date().toLocaleString('en-US')}
        `.trim();

        return await this.sendMessage(message);
    }

    // ملخص يومي
    async sendDailySummary(stats) {
        if (!this.config.notifications.dailySummary) return;

        const message = `
📊 <b>الملخص اليومي</b>

👥 إجمالي المشتركين: <b>${stats.totalSubs}</b>
💰 الديون: <b>${stats.debts.toLocaleString('en-US')} د.ع</b>
💵 رصيد الصندوق: <b>${stats.boxBalance.toLocaleString('en-US')} د.ع</b>
❌ المنتهية: <b>${stats.expired}</b>
⚠️ تنتهي قريباً: <b>${stats.expiring}</b>

📅 ${new Date().toLocaleDateString('ar-u-nu-latn')}
⏰ ${new Date().toLocaleTimeString('ar-u-nu-latn')}
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



    async notifyTopUpRequest(amount, topUpId) {
        if (!this.config || !this.config.chatId) return;

        const message = `
🔔 <b>طلب تعبئة رصيد النظام</b>

💰 المبلغ: <b>${amount.toLocaleString('en-US')} د.ع</b>
📅 التاريخ: ${new Date().toLocaleString('en-US')}

يرجى اتخاذ إجراء:
        `.trim();

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ موافقة وتعبئة", callback_data: `approve_${topUpId}` },
                        { text: "❌ رفض الطلب", callback_data: `reject_${topUpId}` }
                    ]
                ]
            }
        };

        return await this.sendMessage(message, options);
    }

    async startBackgroundPolling() {
        if (this.isPolling) return;
        if (!this.config || !this.config.botToken) return;

        // علامة لمنع التشغيل المتكرر في نفس التبويب
        if (this._pollStarted) return;
        this._pollStarted = true;

        this.isPolling = true;

        // استخدام Web Locks API إذا كان متاحاً (أفضل وسيلة للتنظيم بين التبويبات)
        if (navigator.locks) {
            navigator.locks.request('sas_telegram_polling', { ifAvailable: false }, async (lock) => {
                if (!lock) {
                    console.log("📡 Telegram Polling: Another tab is already Master. Standing by.");
                    return;
                }
                console.log("📡 Telegram Polling: This tab is now the MASTER instance.");
                await this.doPolling();
            }).catch(e => {
                this._pollStarted = false;
                this.isPolling = false;
            });
        } else {
            // Fallback للمتصفحات القديمة
            this.doPolling();
        }
    }

    async doPolling() {
        let lastUpdateId = 0;
        console.log("📡 Telegram Polling Loop Started (" + this.instanceId + ")");

        while (this.isPolling) {
            // التحقق مما إذا كان هناك تبويب آخر يقوم بالبث بالفعل
            const now = Date.now();
            const lastPolled = parseInt(localStorage.getItem('sas_tg_poll_active') || '0');

            // نظام التنسيق بين التبويبات (Lock Table) كطبقة حماية ثانية
            // تقليل المهلة قليلاً لسرعة الاستجابة بما أننا نستخدم Web Locks
            if (now - lastPolled < 30000 && localStorage.getItem('sas_tg_poll_id') !== this.instanceId) {
                await new Promise(r => setTimeout(r, 10000));
                continue;
            }

            // تحديث حالتي كثنائي نشط حالياً
            localStorage.setItem('sas_tg_poll_active', now.toString());
            localStorage.setItem('sas_tg_poll_id', this.instanceId);

            try {
                const url = `https://api.telegram.org/bot${this.config.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`;
                const response = await fetch(url);

                if (response.status === 409) {
                    const errData = await response.json().catch(() => ({}));
                    console.warn(`⚠️ Telegram: Conflict (409) - ${errData.description || 'Another instance is active'}. Retrying in 60s...`);
                    await new Promise(r => setTimeout(r, 60000));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                const data = await response.json();
                if (data.ok && data.result.length > 0) {
                    const { doc, updateDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    for (const update of data.result) {
                        lastUpdateId = update.update_id;
                        if (update.callback_query) {
                            const cb = update.callback_query;
                            const [action, txId] = cb.data.split('_');
                            if (action === 'approve' || action === 'reject') {
                                await this.answerCallback(cb.id, action === 'approve' ? "تمت الموافقة" : "تم الرفض");
                                const newText = action === 'approve'
                                    ? `✅ <b>تمت العملية</b>\n تمت الموافقة على طلب التعبئة.`
                                    : `❌ <b>تمت العملية</b>\n تم رفض طلب التعبئة.`;
                                await this.editMessage(cb.message.chat.id, cb.message.message_id, newText);
                                try {
                                    if (action === 'reject') {
                                        await updateDoc(doc(this.db, "transactions", txId), {
                                            status: 'rejected',
                                            decidedAt: new Date().toISOString()
                                        });
                                        setTimeout(async () => {
                                            try { await deleteDoc(doc(this.db, "transactions", txId)); } catch (e) { }
                                        }, 500);
                                    } else {
                                        await updateDoc(doc(this.db, "transactions", txId), {
                                            status: 'approved',
                                            decidedAt: new Date().toISOString()
                                        });
                                    }
                                } catch (dbErr) { console.error("DB Update Error:", dbErr); }
                            }
                        }
                    }
                }
            } catch (e) {
                const isNetworkError = e.message?.toLowerCase().includes('network') || e.name === 'TypeError' || e.message?.toLowerCase().includes('failed to fetch');
                if (isNetworkError) {
                    console.warn("📡 Telegram Polling: Connection issue, retrying in 15s...");
                } else {
                    console.error("BG Polling Error:", e);
                }
                await new Promise(r => setTimeout(r, 15000));
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    async answerCallback(callbackId, text) {
        const url = `https://api.telegram.org/bot${this.config.botToken}/answerCallbackQuery`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackId, text: text })
        });
    }

    async editMessage(chatId, messageId, text) {
        const url = `https://api.telegram.org/bot${this.config.botToken}/editMessageText`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: 'HTML'
            })
        });
    }

    // اختبار الاتصال
    async testConnection() {
        const message = `
🤖 <b>اختبار اتصال Telegram Bot</b>

✅ تم الاتصال بنجاح!
النظام جاهز لإرسال الإشعارات.

⏰ ${new Date().toLocaleString('en-US')}
        `.trim();

        return await this.sendMessage(message);
    }
}

// تصدير للاستخدام
export const telegramBot = new TelegramBot();
