# 🔧 التغييرات التقنية - للمطورين

## 📋 جدول المتغيرات الجديدة

### في data-manager.js (يتم الحفظ تلقائياً):

```javascript
// الحقول المتاحة للمشترك:
{
    id: Number,                 // معرّف فريد (محسوب تلقائياً)
    name: String,              // اسم المشترك
    phone: String,             // رقم الهاتف
    subscribeDate: String,     // تاريخ الاشتراك (YYYY-MM-DD)
    expiryDate: String,        // تاريخ الانتهاء (YYYY-MM-DD)
    status: String,            // 'نشط' أو 'قيد الانتظار' أو 'غير نشط'
    price: Number,             // المبلغ المستحق (0 إذا مدفوع)
    paymentType: String,       // 'نقد' أو 'أجل'
    
    // حقول جديدة للتسديد:
    lastPaymentDate: String,   // تاريخ التسديد (YYYY-MM-DD)
    originalPrice: Number,     // السعر الأصلي قبل التسديد
    
    // حقول إضافية:
    notified: Boolean,         // هل تم الإشعار
    firebaseId: String,        // معرّف Firebase (تلقائي)
    createdAt: String          // وقت الإنشاء (ISO 8601)
}
```

---

## 🔄 تدفق البيانات

### 1️⃣ إضافة اشتراك جديد (نقد)
```
addSubscriber({
    name: 'أحمد',
    phone: '0771234567',
    subscribeDate: '2025-11-25',
    expiryDate: '2025-12-25',
    status: 'نشط',
    price: 35000,
    paymentType: 'نقد'
})
  ↓
Firebase يحفظه مباشرة
  ↓
يظهر في الواجهة الرئيسية والمشتركين
  ↓
NOT يظهر في الديون (لأن paymentType = 'نقد')
```

### 2️⃣ إضافة اشتراك جديد (أجل)
```
addSubscriber({
    name: 'فاطمة',
    phone: '0772345678',
    subscribeDate: '2025-11-25',
    expiryDate: '2025-12-25',
    status: 'نشط',
    price: 50000,
    paymentType: 'أجل'
})
  ↓
Firebase يحفظه مباشرة
  ↓
يظهر في الواجهة الرئيسية والمشتركين
  ↓
يظهر في الديون (price > 0 و paymentType = 'أجل')
  ↓
المبالغ المستحقة تُحدّث تلقائياً
```

### 3️⃣ تسديد الدين
```
markAsPaid(id, name, amount)
  ↓
updateSubscriber(id, {
    paymentType: 'نقد',
    lastPaymentDate: '2025-11-25',
    originalPrice: 50000,
    price: 0
})
  ↓
Firebase يحفظ البيانات
  ↓
المشترك يختفي من الديون (price = 0)
  ↓
يظهر في المبالغ المستلمة (lastPaymentDate موجود)
  ↓
جميع الصفحات تُحدّث تلقائياً
```

---

## 📊 الصيغ والحسابات

### حساب الديون المستحقة:
```javascript
const debts = subscribers
    .filter(s => s.paymentType === 'أجل' && s.price > 0)
    .reduce((sum, s) => sum + s.price, 0);
```

### حساب الديون المسددة:
```javascript
const paidDebts = subscribers
    .filter(s => s.lastPaymentDate && s.originalPrice > 0)
    .map(s => ({
        ...s,
        amount: s.originalPrice,
        date: s.lastPaymentDate,
        type: 'أجل (مدفوع)'
    }));
```

### حساب المنتهيين:
```javascript
const expired = subscribers
    .filter(s => {
        if (!s.expiryDate) return false;
        return new Date(s.expiryDate) < new Date();
    });
```

### حساب القريب الانتهاء:
```javascript
const today = new Date();
const in3Days = new Date();
in3Days.setDate(in3Days.getDate() + 3);

const expiring = subscribers
    .filter(s => {
        if (!s.expiryDate) return false;
        const expDate = new Date(s.expiryDate);
        return expDate > today && expDate <= in3Days;
    });
```

---

## 🔌 الدوال الأساسية

### DataManager.addSubscriber(data)
```javascript
// استخدام:
DataManager.addSubscriber({
    name: 'أحمد',
    phone: '0771234567',
    subscribeDate: '2025-11-25',
    expiryDate: '2025-12-25',
    status: 'نشط',
    price: 35000,
    paymentType: 'نقد'
});

// النتيجة:
// - يُضاف إلى Firebase
// - يظهر في جميع الصفحات تلقائياً
// - تُحدّث جميع الإحصائيات
```

### DataManager.updateSubscriber(id, data)
```javascript
// استخدام:
DataManager.updateSubscriber(1, {
    price: 0,
    paymentType: 'نقد',
    lastPaymentDate: '2025-11-25'
});

// النتيجة:
// - تُحدّث البيانات في Firebase
// - تُحدّث جميع الصفحات
// - تُحدّث جميع الإحصائيات
```

### DataManager.deleteSubscriber(id)
```javascript
// استخدام:
DataManager.deleteSubscriber(1);

// النتيجة:
// - يُحذف من Firebase
// - يختفي من جميع الصفحات
```

### DataManager.getSubscriber(id)
```javascript
// استخدام:
const subscriber = DataManager.getSubscriber(1);

// النتيجة:
// - يعيد كائن المشترك
// - null إذا لم يوجد
```

### DataManager.getSubscribers()
```javascript
// استخدام:
const all = DataManager.getSubscribers();

// النتيجة:
// - مصفوفة بجميع المشتركين
// - من الذاكرة المحلية (سريع جداً)
```

### DataManager.searchSubscribers(query)
```javascript
// استخدام:
const results = DataManager.searchSubscribers('أحمد');

// النتيجة:
// - مصفوفة بنتائج البحث
// - البحث في الاسم والهاتف
```

### DataManager.getStatistics()
```javascript
// استخدام:
const stats = DataManager.getStatistics();

// النتيجة:
stats = {
    totalSubscribers: 10,
    activeSubscribers: 8,
    pendingSubscribers: 1,
    inactiveSubscribers: 1,
    expiredSubscribers: 2,
    expiringSubscribers: 3,
    totalRevenue: 350000
}
```

### DataManager.exportToCSV(data, filename)
```javascript
// استخدام:
const data = [
    { name: 'أحمد', price: 35000 },
    { name: 'فاطمة', price: 50000 }
];
DataManager.exportToCSV(data, 'subscribers');

// النتيجة:
// - يحمّل ملف CSV
// - اسم الملف: subscribers_2025-11-25.csv
```

---

## 🔄 نمط التحديث في الصفحات

### في جميع الصفحات:
```javascript
// 1. دالة التحميل الأولي
function load[Page]() {
    const data = DataManager.get[Data]();
    renderUI(data);
}

// 2. تحديث البيانات
DataManager.update[Data](id, changes);

// 3. إعادة التحميل الفوري
load[Page](); // ينادي الدالة الأولى لإعادة تحميل البيانات
```

### مثال من صفحة الديون:
```javascript
window.loadDebts = function() {
    // 1. جلب البيانات
    const debts = DataManager.getSubscribers()
        .filter(s => s.paymentType === 'أجل' && s.price > 0);
    
    // 2. تحديث الإحصائيات
    updateStats(debts);
    
    // 3. رسم الجدول
    renderTable(debts);
};

window.markAsPaid = (id, name, amount) => {
    // 1. حفظ التسديد
    DataManager.updateSubscriber(id, {
        paymentType: 'نقد',
        lastPaymentDate: new Date().toISOString().split('T')[0],
        originalPrice: amount,
        price: 0
    });
    
    // 2. إعادة تحميل البيانات
    window.loadDebts();
};
```

---

## 🎯 أفضل الممارسات

### 1. دائماً استخدم DataManager
```javascript
// ✅ صحيح
DataManager.updateSubscriber(id, { price: 0 });

// ❌ خطأ
subscriber.price = 0; // لن يُحفظ في Firebase
```

### 2. تحديث الواجهة بعد التغيير
```javascript
// ✅ صحيح
DataManager.updateSubscriber(id, data);
loadData(); // إعادة تحميل

// ❌ خطأ
renderUI(data); // قد تكون بيانات قديمة
```

### 3. التحقق من وجود البيانات
```javascript
// ✅ صحيح
const subscriber = DataManager.getSubscriber(id);
if (subscriber) {
    doSomething(subscriber);
}

// ❌ خطأ
const subscriber = DataManager.getSubscriber(id);
doSomething(subscriber); // قد يكون undefined
```

### 4. استخدام القيم الافتراضية
```javascript
// ✅ صحيح
const amount = s.price || 0;
const date = s.expiryDate || '-';

// ❌ خطأ
const amount = s.price; // قد يكون undefined
const date = s.expiryDate; // قد يكون undefined
```

---

## 🧪 الاختبار والتصحيح

### فتح Developer Tools:
```
Windows/Linux: F12
Mac: Cmd + Option + I
```

### التحقق من الأخطاء:
```javascript
// في Console:
DataManager.getSubscribers()
// يجب أن يعيد مصفوفة من المشتركين
```

### اختبار الدوال:
```javascript
// في Console:
DataManager.searchSubscribers('أحمد')
DataManager.getStatistics()
DataManager.getSubscriber(1)
```

### تتبع البيانات:
```javascript
// في Console:
console.log('جميع المشتركين:', DataManager.getSubscribers());
console.log('الديون:', DataManager.getSubscribers()
    .filter(s => s.paymentType === 'أجل' && s.price > 0));
```

---

## 🚨 الأخطاء الشائعة

### 1. عدم حفظ في Firebase
```
السبب: نسيان استخدام DataManager
الحل: استخدم DataManager.updateSubscriber() دائماً
```

### 2. بيانات قديمة في الواجهة
```
السبب: عدم استدعاء dالة التحميل بعد التغيير
الحل: استدعِ loadData() بعد updateSubscriber()
```

### 3. الأخطاء في الحسابات
```
السبب: عدم التحقق من القيم
الحل: استخدم || 0 و || ''
```

### 4. النتائج الخاطئة في البحث
```
السبب: عدم التحقق من النوع
الحل: حول كل شيء إلى نفس النوع قبل المقارنة
```

---

## 📈 الأداء والتحسينات

### الذاكرة المحلية (localStorage):
```javascript
// التخزين:
localStorage.setItem('ok_cache_subs', JSON.stringify(data));

// الاسترجاع:
const cached = JSON.parse(localStorage.getItem('ok_cache_subs'));
```

### الحد من عمليات البحث:
```javascript
// ✅ بحث فعال
const results = DataManager.searchSubscribers(query);

// ❌ بحث غير فعال
const results = DataManager.getSubscribers()
    .filter(s => s.name.includes(query))
    .filter(s => s.status === 'نشط')
    .filter(s => s.price > 0);
```

---

**النظام جاهز للإنتاج! ✨**
