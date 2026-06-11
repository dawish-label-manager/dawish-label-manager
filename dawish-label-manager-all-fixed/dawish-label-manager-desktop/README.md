# Dawish Label Manager

برنامج كمبيوتر لنظام إدارة الملصقات والباركودات - عطارة الدويش.

## التشغيل المحلي

من نفس المجلد الذي يحتوي على `package.json`:

```bash
npm install
npm start
```

## بناء ملف التثبيت بدون نشر

```bash
npm run dist
```

سيظهر ملف التثبيت داخل مجلد:

```text
release
```

## النشر على GitHub Releases للتحديث التلقائي

المستودع مضبوط على:

```text
https://github.com/dawish-label-manager/dawish-label-manager.git
```

### أول رفع للمستودع

```bash
git init
git add .
git commit -m "Initial desktop app"
git branch -M main
git remote add origin https://github.com/dawish-label-manager/dawish-label-manager.git
git push -u origin main
```

### إنشاء إصدار جديد تلقائيًا عبر GitHub Actions

1. غيّر رقم الإصدار في `package.json` مثل:

```json
"version": "1.1.3"
```

2. ارفع التعديل:

```bash
git add .
git commit -m "Release 1.1.3"
git push
```

3. أنشئ tag:

```bash
git tag v1.1.3
git push origin v1.1.3
```

بعدها GitHub Actions يبني نسخة Windows ويرفعها في Releases، والبرنامج المثبت يستطيع فحص التحديث.

### نشر يدوي من جهازك

تحتاج GitHub Token بصلاحية repo أو contents write:

```bash
set GH_TOKEN=ضع_التوكن_هنا
npm run publish:win
```

## ملاحظات مهمة

- لا تشغل أوامر npm من مجلد `assets`.
- يجب تشغيل الأوامر من المجلد الذي يحتوي على `package.json`.
- الأيقونة المستخدمة للويندوز موجودة هنا:

```text
assets/icon.ico
```

## إضافات نسخة الكمبيوتر

- مركز تحكم داخل البرنامج.
- إعدادات الطابعة واختيار مقاس الملصق.
- الطباعة الآمنة قبل التنفيذ.
- استرجاع آخر قائمة طباعة.
- سجل عمليات اليوم.
- نسخ احتياطي تصدير واستيراد.
- صيانة سريعة.
- إدارة اسم ودور الجهاز.
- شاشة قفل برمز.
- وضع التدريب.
- إعداد GitHub Releases للتحديث.
