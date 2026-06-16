نسخة Dawaa Pharmacy 2027 جاهزة للنشر على Vercel

التعديلات المطبقة:
1) تم ضبط Node.js على 22.x لأنه أكثر استقرارًا من Node 24 مع npm/pnpm ومناسب للمكتبات التي تحتاج >=22.
2) تم ضبط Vercel لاستخدام pnpm@9.15.9 بدل npm لتجنب خطأ npm: Exit handler never called.
3) تم الحفاظ على Vite build و outputDirectory=dist.
4) تم الحفاظ على rewrites حتى تعمل روابط React Router بعد الرفع.
5) تم الحفاظ على cache headers للأصول داخل /assets.

طريقة الاستخدام:
- فك الضغط.
- انسخ الملفات فوق مشروعك أو ارفعها كمستودع GitHub جديد.
- في Vercel اعمل Import للمشروع.
- اعمل Redeploy without cache.

أوامر Vercel المتوقعة:
Install Command:
corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --no-frozen-lockfile

Build Command:
pnpm run build

Output Directory:
dist

ملاحظة مهمة:
لا تستخدم Node 20 لأنه سبب مشكلة camera-controls، ولا Node 24 لأنه سبب مشاكل ERR_INVALID_THIS/Exit handler في أدوات التثبيت.
