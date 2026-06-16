طريقة الاستخدام:

1) فك الضغط عن الملف.
2) انسخ fix-package-json-node22.js داخل فولدر المشروع الرئيسي، نفس المكان الموجود فيه package.json.
3) افتح Terminal أو PowerShell داخل فولدر المشروع.
4) شغل الأمر:

node fix-package-json-node22.js

5) بعد التعديل شغل:

npm install
npm run build

6) لو build اشتغل، ارفع التعديل على GitHub:

git add package.json package-lock.json
git commit -m "Fix Vercel Node version"
git push

7) في Vercel تأكد أن Node.js Version = 22.x.

ملاحظة:
هذا الملف لا يستبدل package.json بالكامل، لكنه يعدل السطر المطلوب فقط بأمان حتى لا تضيع dependencies الخاصة بالمشروع.
