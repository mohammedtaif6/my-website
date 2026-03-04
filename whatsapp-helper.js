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
        const message = `✨ أهلاً بك أستاذ/ة *${name}* في خدمتنا ✨\n\n✅ *تم تفعيل اشتراكك بنجاح!*\n\n📅 *تاريخ الانتهاء:* ${endDate}\n💰 *المبلغ:* ${parseInt(price).toLocaleString('en-US')} د.ع\n💳 *طريقة الدفع:* ${type}\n\nنحن سعداء لانضمامك إلينا، ونتمنى لك تجربة ممتعة! 🚀\n\n📌 *ملاحظة:* لأي استفسار يمكنكم التواصل معنا في أي وقت.\n💬 *OK Computer* - دائماً بخدمتكم.`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه دين
     */
    sendDebtReminder(name, phone, amount) {
        const message = `👋 مرحباً أستاذ/ة *${name}*،\n\nنأمل أن تكونوا بأفضل حال 🌸\n\n💡 نود تذكيركم بلطف بوجود مبلغ متبقي في ذمتكم وقدره: *${parseInt(amount).toLocaleString('en-US')} د.ع*\n\nنتمنى تسوية المبلغ في أقرب فرصة لضمان استمرار الخدمة بأفضل شكل.\n\nشكراً لتعاونكم وثقتكم بنا 🙏✨`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه انتهاء الاشتراك
     */
    sendExpiryWarning(name, phone, expiryDate) {
        const message = `🔔 تنبيه باقتراب موعد التجديد\n\nمرحباً أستاذ/ة *${name}*،\nنود إعلامكم أن اشتراككم سينتهي قريباً بتاريخ: 🗓️ *${expiryDate}*\n\n⚡ لضمان استمرارية الخدمة وعدم الانقطاع، يُرجى تجديد الاشتراك في أقرب وقت.\n\nيسعدنا خدمتكم دائماً! 💙`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه اشتراك منتهي
     */
    sendExpiredNotification(name, phone) {
        const message = `⚠️ الاشتراك منتهي\n\nأهلاً بك أستاذ/ة *${name}*،\nنلفت انتباهكم إلى أن اشتراككم قد *انتهى* للأسف 🔴\n\nيسعدنا جداً تجديدكم للاشتراك لنستمر في تقديم الخدمة لكم بأفضل صورة 🌐.\n\nللإستفسار أو المساعدة، نحن هنا دائماً! 📞`;
        return this.send(phone, message);
    },

    /**
     * إرسال وصل تسديد دين
     */
    sendDebtPaymentReceipt(name, phone, paidAmount, remainingDebt) {
        let remainingMsg = parseInt(remainingDebt) > 0 ? `\n\n⚠️ *المتبقي في الذمة:* ${parseInt(remainingDebt).toLocaleString('en-US')} د.ع` : `\n\n🎉 *تم تسديد كامل المبلغ!* شكراً لالتزامكم.`;
        const message = `🧾 *وصل تسديد*\n\nمرحباً أستاذ/ة *${name}*،\n\n✅ تم استلام الدفعة بنجاح!\n💵 *المبلغ المسدد:* ${parseInt(paidAmount).toLocaleString('en-US')} د.ع${remainingMsg}\n\nشكراً لتعاملكم معنا 🙏✨`;
        return this.send(phone, message);
    }
};

console.log('✅ WhatsApp Helper loaded successfully');
