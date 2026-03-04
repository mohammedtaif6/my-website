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

        // استخدام البروتوكول المباشر لفتح تطبيق واتساب على الموبايل والكمبيوتر مباشرة
        const url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;

        console.log('✅ WhatsApp URL:', url);

        try {
            // توجيه مباشر ليتم فتح التطبيق مباشرة في الجهاز
            window.location.href = url;

            // احتياط: في حال كان المتصفح يمنع التوجيه المباشر بعد وقت صامت
            setTimeout(() => {
                // إذا لم ينجح التوجيه (أو إذا لم يكن التطبيق مثبتًا والكمبيوتر لم يستجب)، 
                // ممكن وضع fallback هنا مستقبلا لكن طلب المستخدم فتح التطبيق مباشرة دائماً.
            }, 1000);

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
        const message = `مرحباً ${name} 🌹\nتم تفعيل اشتراكك بنجاح ✅\n\nتاريخ الانتهاء: ${endDate}\nالمبلغ: ${parseInt(price).toLocaleString('en-US')} د.ع\nالدفع: ${type}\n\nالامين تيليكوم بخدمتكم دائماً 🤍\n\n------------\nالـدعــم : 07709443145\nالصيانة : 07713966640`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه دين
     */
    sendDebtReminder(name, phone, amount) {
        const message = `مرحباً ${name} 🌸\nتذكير ودي بوجود رصيد متبقي: ${parseInt(amount).toLocaleString('en-US')} د.ع\nيرجى تسويته لضمان استمرار الخدمة.\n\nشكراً لتعاونكم 🤍\n\n------------\nالـدعــم : 07709443145\nالصيانة : 07713966640`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه انتهاء الاشتراك
     */
    sendExpiryWarning(name, phone, expiryDate) {
        const message = `مرحباً ${name} ⚠️\nاشتراكك سينتهي بتاريخ: ${expiryDate}\nيرجى التجديد لتجنب انقطاع الخدمة ⚡\n\n------------\nالـدعــم : 07709443145\nالصيانة : 07713966640`;
        return this.send(phone, message);
    },

    /**
     * إرسال تنبيه اشتراك منتهي
     */
    sendExpiredNotification(name, phone) {
        const message = `مرحباً ${name} 🔴\nلقد انتهى اشتراكك لدينا.\n\nيسعدنا تجديدكم لعودة الخدمة بأسرع وقت 🌐\n\n------------\nالـدعــم : 07709443145\nالصيانة : 07713966640`;
        return this.send(phone, message);
    },

    /**
     * إرسال وصل تسديد دين
     */
    sendDebtPaymentReceipt(name, phone, paidAmount, remainingDebt) {
        let remainingMsg = parseInt(remainingDebt) > 0 ? `المتبقي: ${parseInt(remainingDebt).toLocaleString('en-US')} د.ع ⚠️` : `تم تسديد كامل المبلغ! 🎉`;
        const message = `مرحباً ${name} ✅\nتم استلام الدفعة: ${parseInt(paidAmount).toLocaleString('en-US')} د.ع\n\n${remainingMsg}\nشكراً لكم 🌸\n\n------------\nالـدعــم : 07709443145\nالصيانة : 07713966640`;
        return this.send(phone, message);
    }
};

console.log('✅ WhatsApp Helper loaded successfully');
