# Aiso 3D Viewer - راهنمای ساخت و اجرای نسخه موبایل (iOS & Android)

این پروژه با موتور گرافیکی **Three.js** و فریم‌ورک استاندارد **Capacitor** طراحی شده است تا مدل‌های سه‌بعدی را با بالاترین کیفیت و نرخ فریم در گوشی‌های آیفون و اندروید نمایش دهد و مستقیماً با باز کردن فایل‌های سه‌بعدی در سیستم‌عامل اجرا شود.

---

## 📱 فرمت‌های سه‌بعدی پشتیبانی‌شده در موبایل
- **GLB** / **GLTF** (با پشتیبانی از انیمیشن‌ها و بافت‌های PBR)
- **OBJ** (Wavefront 3D)
- **FBX** (Autodesk FBX با انیمیشن)
- **STL** (Stereolithography 3D)

---

## 🛠️ ساخت نسخه اندروید (Android APK / AAB)

برای ایجاد خروجی اندروید در ویندوز یا مک:

1. وارد پوشه `mobile` شوید:
   ```bash
   cd d:\antigravity\mobile
   ```

2. بیلد فایل‌های وب:
   ```bash
   node build-mobile.js
   ```

3. اضافه کردن پلتفرم اندروید و سینک:
   ```bash
   npx @capacitor/cli add android
   npx @capacitor/cli sync
   ```

4. باز کردن پروژه در **Android Studio**:
   ```bash
   npx @capacitor/cli open android
   ```
   * فایل `mobile/android_config/AndroidManifest.xml` را با فایل منیفست اندروید در مسیر `android/app/src/main/AndroidManifest.xml` جایگزین کنید تا قابلیت باز شدن خودکار فایل‌ها (Open With) فعال شود.
   * از منوی **Build > Build Bundle(s) / APK(s) > Build APK** خروجی بگیرید.

---

## 🍎 ساخت نسخه آیفون (iOS App / IPA)

برای ایجاد خروجی آیفون (نیاز به سیستم‌عامل macOS با نرم‌افزار Xcode دارد):

1. وارد پوشه `mobile` شوید:
   ```bash
   cd d:\antigravity\mobile
   ```

2. بیلد فایل‌های وب:
   ```bash
   node build-mobile.js
   ```

3. اضافه کردن پلتفرم iOS و سینک:
   ```bash
   npx @capacitor/cli add ios
   npx @capacitor/cli sync
   ```

4. باز کردن پروژه در **Xcode**:
   ```bash
   npx @capacitor/cli open ios
   ```
   * تنظیمات `mobile/ios_config/Info.plist` را در بخش Info پروژه در Xcode قرار دهید تا فایل‌های سه بعدی در Files و AirDrop به عنوان فرمت‌های پیش‌فرض برنامه شناخته شوند.
   * دکمه **Run** را برای اجرا روی شبیه‌ساز یا آیفون متصل بزنید.
