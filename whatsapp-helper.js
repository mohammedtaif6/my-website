/**
 * WhatsApp Helper - دالة موحدة لإرسال رسائل الواتساب
 * تعمل على جميع الأجهزة (موبايل وكمبيوتر)
 */

window.WhatsAppHelper = {
    /**
     * تنظيف وتنسيق رقم الهاتف العراقي
     * @param {string} phone - رقم الهاتف الخام
     * @returns {string|null} - رقم الهاتف المنسق أو null إذا كان غير صالح
     */
    formatPhone(phone) {
        if (!phone) return null;

        // إزالة جميع الأحرف غير الرقمية
        let cleaned = phone.toString().replace(/\D/g, '');

        if (!cleaned) return null;

        // إزالة الصفر من البداية إذا كان موجوداً
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }

        // إضافة كود الدولة (964) إذا لم يكن موجوداً
        if (!cleaned.startsWith('964')) {
            cleaned = '964' + cleaned;
        }

        // التحقق من أن الرقم صحيح (يجب أن يبدأ بـ 964 ويكون طوله مناسب)
        if (cleaned.length < 12 || cleaned.length > 13) {
            console.warn('⚠️ رقم هاتف غير صحيح:', phone, '→', cleaned);
            return null;
        }

        return cleaned;
    },

    /**
     * إرسال رسالة واتساب
     * @param {string} phone - رقم الهاتف
     * @param {string} message - نص الرسالة
     * @param {function} onError - دالة تُستدعى عند حدوث خطأ
     */
    send(phone, message, onError) {
        const formattedPhone = this.formatPhone(phone);

        if (!formattedPhone) {
            const errorMsg = 'رقم الهاتف غير صحيح أو غير موجود';
            console.error('❌ WhatsApp Error:', errorMsg, '- Phone:', phone);

            if (onError) {
                onError(errorMsg);
            } else if (window.DataManager && window.DataManager.showToast) {
                window.DataManager.showToast('⚠️ ' + errorMsg, 'error');
            } else {
                alert(errorMsg);
            }
            return false;
        }

        // تحديد نوع الجهاز
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        // بناء الرابط
        let url;
        if (isMobile) {
            // على الموبايل، استخدم whatsapp:// protocol
            url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
        } else {
            // على الكمبيوتر، استخدم web.whatsapp.com
            url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        }

        console.log('✅ WhatsApp URL:', url);

        // فتح الرابط
        try {
            if (isMobile) {
                // على الموبايل، استخدم window.location.href للتوافق الأفضل
                window.location.href = url;
            } else {
                // على الكمبيوتر، افتح في نافذة جديدة
                const newWindow = window.open(url, '_blank');

                // التحقق من أن النافذة فُتحت بنجاح
                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    console.warn('⚠️ Pop-up blocked, trying alternative method...');
                    window.location.href = url;
                }
            }
            return true;
        } catch (error) {
            console.error('❌ WhatsApp Send Error:', error);
            if (onError) {
                onError('فشل فتح الواتساب: ' + error.message);
            }
            return false;
        }
    },

    /**
     * إرسال رسالة تفعيل اشتراك
     */
    sendActivation(name, phone, price, type, endDate) {
        const message = `مرحباً ${name}،\n\nتم تفعيل اشتراكك بنجاح ✅\n\n📋 التفاصيل:\nالمبلغ: ${parseInt(price).toLocaleString('en-US')} د.ع\nنوع الدفع: ${type}\nتاريخ الانتهاء: ${endDate}\n\nشكراً لثقتكم بنا 🌟`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه دين
     */
    sendDebtReminder(name, phone, amount) {
        const message = `مرحباً ${name}،\n\nيرجى تسديد الدين المتبقي: ${parseInt(amount).toLocaleString('en-US')} د.ع\n\nشكراً لكم 🙏`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه انتهاء الاشتراك
     */
    sendExpiryWarning(name, phone, expiryDate) {
        const message = `مرحباً ${name}،\n\nنود تذكيركم بأن اشتراككم سينتهي قريباً بتاريخ ${expiryDate}\n\nيرجى التجديد لضمان استمرار الخدمة ⚡\n\nشكراً لكم`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه اشتراك منتهي
     */
    sendExpiredNotification(name, phone) {
        const message = `مرحباً ${name}،\n\nنود إخباركم بأن اشتراككم قد انتهى 🔴\n\nنرجو منكم زيارتنا لتجديد الاشتراك لضمان استمرار الخدمة\n\nشكراً لكم`;
        return this.send(phone, message);
    },

    /**
     * إرسال وصل تسديد دين
     */
    sendDebtPaymentReceipt(name, phone, paidAmount, remainingDebt) {
        const message = `مرحباً ${name}،\n\nتم استلام دفعة بمبلغ: ${parseInt(paidAmount).toLocaleString('en-US')} د.ع ✅\n\nالمتبقي: ${parseInt(remainingDebt).toLocaleString('en-US')} د.ع\n\nشكراً لكم 🙏`;
        return this.send(phone, message);
    }
};

console.log('✅ WhatsApp Helper loaded successfully');
