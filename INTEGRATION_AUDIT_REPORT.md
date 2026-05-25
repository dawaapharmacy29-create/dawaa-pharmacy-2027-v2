# Dawaa Pharmacy 2027 Integration Audit Report

## Scope
تمت مراجعة مسارات الربط الحالية مع التركيز على مصدر الحقيقة، الصور، العروض، الاستوريز، طلبات العملاء، الفواتير، والمتابعات.

## Source Of Truth Decisions
- customers: مصدر بيانات العميل الأساسية والكود الحقيقي والملاحظات وال flags.
- sales_invoices: مصدر مشتريات العملاء والتحليلات المالية والفواتير ومتوسطات الشراء.
- daily_followups / customer_followups: مصدر المتابعات.
- customer_requests / customer_request_events: مصدر طلبات العملاء وسجل حركتها.
- employee_transactions: دفتر النقاط والحوافز والخصومات الوحيد النشط.
- offers / offer_dispenses: مصدر العروض وصرفها وتحليلها.
- whatsapp_stories / story_performance_reports / story_sales: مصدر الاستوريز وتحليلها ومبيعاتها.
- customer_analysis: جدول مساعد/كاش فقط، لا يستخدم كمصدر مبيعات حي.

## Page Audit
| Page | Tables Read | Tables Written | Fix Applied |
| --- | --- | --- | --- |
| /customers | customers, sales_invoices | customers | منع عرض UUID كود عميل، والمشتريات من sales_invoices فقط. |
| /customer-service | daily_followups, customers, sales_invoices | daily_followups | المتابعات الآن تستخدم كود العميل الحقيقي عند توفره وتمنع UUID ككود. |
| /customer-requests | customer_requests, customer_request_events, customers, staff | customer_requests, customer_request_events, storage customer-request-images | إضافة رفع صورة الصنف، image_url/path، تواريخ الطلب، مصدر محتمل. |
| /import-invoices | sales_invoices, customer_analysis | sales_invoices, customer_analysis | مسح الفواتير على دفعات لتجنب timeout، واستيراد ملفات قديمة بمرونة أكبر. |
| /offers | offers, offer_dispenses | offers, storage offer-assets | صفحة جديدة منفصلة للعروض مع رفع صورة وتحليل وحالة العرض وحافز الدكتور. |
| /stories | whatsapp_stories, story_performance_reports, story_sales, offers | whatsapp_stories, story_performance_reports, storage story-assets | صفحة جديدة منفصلة للاستوريز مع رفع صورة وتقارير مشاهدة ومبيعات. |
| /stories-offers | none | none | تم تحويله إلى /offers حتى لا تختلط الشاشتان. |
| /penalty-incentive | employee_transactions | employee_transactions | يعتمد على pointsLedger لتنظيف السبب والمنفذ ومنع النصوص التقنية. |
| /points | employee_transactions | employee_transactions | المصدر النشط هو دفتر employee_transactions. |
| /shelf-organization | shelf_tasks | shelf_tasks | متصل بمهام الرفوف والمسؤول والمراجع. |
| /branch-cleaning | branch_cleaning_tasks | branch_cleaning_tasks | متصل بمسؤول النظافة والمراجع. |
| /inventory-counts | inventory_count_sessions/items | inventory_count_sessions/items | يدعم استيراد Excel للجرد والأصناف والتواريخ. |
| /shortages | shortage_items | shortage_items | التصنيفات والمسؤول من بيانات الدكاترة. |
| /supplies | supplies_items | supplies_items | قائمة مستلزمات ومراجع أسبوعي. |
| /accessories | accessory_items | accessory_items | موردين وتصنيف ومتابعة عرض. |

## Storage
تمت إضافة helper `storageUpload.ts` ومكون `ImageUploadBox.tsx`.
- customer-request-images: طلبات العملاء.
- offer-assets: صور العروض.
- story-assets: صور الاستوريز.

## Migrations
تمت إضافة migration جديد:
`supabase/20260524_full_integration_storage_offers_stories.sql`

يشمل:
- أعمدة customers المطلوبة.
- أعمدة employee_transactions المساعدة للعرض النظيف.
- أعمدة customer_requests للصور والتواريخ والمصدر.
- customer_request_sources.
- offers و offer_dispenses.
- whatsapp_stories و story_performance_reports و story_sales.
- manager_role_assignments و manager_performance_reviews.
- سياسات Storage للقراءة والرفع لل buckets الثلاثة.

## Raw/Stale Data Cleanup
- تم منع استخدام customer_analysis كمصدر أساسي لصفحة العملاء.
- تم منع customer_id/UUID من الظهور ككود عميل في العملاء والمتابعات.
- تم تقوية مسح فواتير sales_invoices على دفعات لتفريغ الداتا التجريبية بأمان.

## Tests
- `npm run build`: Pass.
- `npm run lint`: Pass with existing warnings only.

## Known Limitations
- يجب تشغيل migration الجديد على Supabase قبل تجربة حفظ العروض/الاستوريز ورفع الصور في الإنتاج.
- لم يتم تنفيذ اختبار رفع فعلي إلى Supabase من داخل المتصفح في هذه الجلسة لأن ذلك يحتاج تشغيل التطبيق وربط session المستخدم، لكن الكود يستخدم buckets العامة الجاهزة.
- بعض warnings قديمة خاصة Fast Refresh وليست أخطاء تشغيل.
