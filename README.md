# 3D Model Viewer — Walkthrough

## ساخته شد ✅

یک اپلیکیشن دسکتاپ ویندوز با Electron + Three.js که شبیه‌ترین نورپردازی را به سایت modelviewer.dev دارد.

## فایل‌های پروژه

| فایل | توضیح |
|------|-------|
| `main.js` | Electron main process — پنجره، منو، file dialogs |
| `preload.js` | Bridge بین Electron و UI |
| `index.html` | رابط کاربری کامل با تمام کنترل‌ها |
| `viewer.css` | استایل dark premium |
| `viewer.js` | Three.js scene + loaders + سیستم نورپردازی |

## نورپردازی AR-Like

- ✅ **Environment Map (IBL)** — 6 پریست محیطی: Studio, Outdoor, Sunset, Night, Warehouse, Apartment
- ✅ **Exposure Control** — کنترل روشنایی
- ✅ **Tone Mapping** — ACESFilmic, Linear, Reinhard, Cineon, AgX  
- ✅ **Sun Light** — کنترل intensity، elevation، azimuth، رنگ
- ✅ **Ambient Light** — نور محیطی با کنترل رنگ
- ✅ **Soft Shadows** — سایه نرم با PCF
- ✅ **Background modes** — Sky / Neutral / Black

## فرمت‌های پشتیبانی

`.glb` `.gltf` `.obj` `.fbx` `.stl`

## چطور استفاده کنم؟

### باز کردن با دابل‌کلیک
File association ثبت شده — فقط روی هر فایل `.glb` یا `.gltf` دابل‌کلیک کنید.

### اجرای دستی
```bash
d:\antigravity\node_modules\electron\dist\electron.exe d:\antigravity
```

### با batch file
`start-viewer.bat` را اجرا کنید.

## ✅ تست شده
- Electron processes در حال اجرا: 4 process (طبیعی)
- File associations در ویندوز رجیستری ثبت شد
