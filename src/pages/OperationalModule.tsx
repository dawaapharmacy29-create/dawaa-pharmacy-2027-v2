import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Filter, Loader2, Plus, RefreshCw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth, getSafeCurrentUserId } from "@/hooks/useAuth";
import { logActivity } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/lib/supabase";
import { BRANCHES } from "@/lib/constants";

type FieldKind = "text" | "number" | "date" | "select" | "textarea";

interface ModuleField {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface ModuleConfig {
  title: string;
  route: string;
  table: string;
  icon: ElementType;
  description: string;
  primaryField: string;
  statusField: string;
  branchField?: string;
  dueDateField?: string;
  staffNameField?: string;
  defaultStatus: string;
  statuses: Array<{ value: string; label: string; tone: string }>;
  fields: ModuleField[];
  defaultValues: Record<string, string | number | boolean | null>;
  searchKeys: string[];
  dashboardHint: string;
}

const STATUS_TONES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  planned: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  completed: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  resolved: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  needs_review: "bg-purple-500/15 text-purple-300 border-purple-500/25",
  delayed: "bg-red-500/15 text-red-300 border-red-500/25",
  critical: "bg-red-500/15 text-red-300 border-red-500/25",
  low: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  shortage: "bg-red-500/15 text-red-300 border-red-500/25",
  active: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  scheduled: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  assigned: "bg-blue-500/15 text-blue-300 border-blue-500/25",
};

const COMMON_STATUSES = [
  { value: "pending", label: "لم تبدأ", tone: STATUS_TONES.pending },
  { value: "in_progress", label: "قيد التنفيذ", tone: STATUS_TONES.in_progress },
  { value: "completed", label: "مكتملة", tone: STATUS_TONES.completed },
  { value: "needs_review", label: "تحتاج مراجعة", tone: STATUS_TONES.needs_review },
  { value: "delayed", label: "متأخرة", tone: STATUS_TONES.delayed },
];

const REQUEST_STAGES = [
  { value: "registered", label: "تم تسجيل الطلب", tone: STATUS_TONES.pending },
  { value: "sent_to_purchasing", label: "تم تحويله للمشتريات", tone: STATUS_TONES.planned },
  { value: "searching", label: "جاري البحث", tone: STATUS_TONES.in_progress },
  { value: "awaiting_customer_confirmation", label: "بانتظار تأكيد العميل", tone: STATUS_TONES.needs_review },
  { value: "customer_confirmed", label: "تم التأكيد", tone: STATUS_TONES.in_progress },
  { value: "provided", label: "تم توفير الصنف", tone: STATUS_TONES.completed },
  { value: "arrived_branch", label: "وصل الفرع", tone: STATUS_TONES.completed },
  { value: "customer_contacted", label: "تم التواصل مع العميل", tone: STATUS_TONES.completed },
  { value: "delivered", label: "تم التسليم", tone: STATUS_TONES.completed },
  { value: "unavailable", label: "تعذر التوفير", tone: STATUS_TONES.delayed },
  { value: "cancelled", label: "ملغي", tone: STATUS_TONES.delayed },
];

const BRANCH_OPTIONS = [...BRANCHES, "كل الفروع"];
const STAFF_PLACEHOLDER = "اسم المسؤول";

const configs: Record<string, ModuleConfig> = {
  shelf: {
    title: "تنظيم الأدوية والرفوف",
    route: "/shelf-organization",
    table: "shelf_tasks",
    icon: ClipboardList,
    description: "إدارة مهام ترتيب الأقراص والكبسولات والمعمل والإكسسوار والمستلزمات حسب الفرع والنطاق الأبجدي.",
    primaryField: "title",
    statusField: "status",
    branchField: "branch",
    dueDateField: "due_date",
    staffNameField: "responsible_staff_name",
    defaultStatus: "pending",
    statuses: COMMON_STATUSES,
    dashboardHint: "تظهر المهام المتأخرة والمستحقة اليوم في لوحة القيادة.",
    defaultValues: { title: "", branch: BRANCHES[0], zone: "منطقة الأقراص والكبسول", section: "", alphabet_from: "", alphabet_to: "", responsible_staff_name: "", due_date: new Date().toISOString().slice(0, 10), frequency: "one_time", status: "pending", notes: "" },
    fields: [
      { key: "title", label: "عنوان المهمة", required: true, placeholder: "ترتيب الأقراص من A إلى H" },
      { key: "branch", label: "الفرع", kind: "select", options: BRANCH_OPTIONS, required: true },
      { key: "zone", label: "المنطقة", kind: "select", options: ["منطقة الأقراص والكبسول", "منطقة المعمل", "منطقة الإكسسوار", "منطقة المستلزمات", "منطقة البامبرز والأولويز", "الثلاجة", "المخزن الداخلي"] },
      { key: "section", label: "القسم/الدرج" },
      { key: "alphabet_from", label: "من حرف" },
      { key: "alphabet_to", label: "إلى حرف" },
      { key: "responsible_staff_name", label: "المسؤول", placeholder: STAFF_PLACEHOLDER },
      { key: "due_date", label: "تاريخ الاستحقاق", kind: "date" },
      { key: "frequency", label: "التكرار", kind: "select", options: ["one_time", "daily", "weekly", "monthly"] },
      { key: "notes", label: "ملاحظات", kind: "textarea" },
    ],
    searchKeys: ["title", "branch", "zone", "section", "responsible_staff_name"],
  },
  cleaning: {
    title: "نظافة الفروع",
    route: "/branch-cleaning",
    table: "branch_cleaning_tasks",
    icon: CheckCircle2,
    description: "متابعة نظافة الفروع حسب الشيفت والمسؤول ومراجعة المدير.",
    primaryField: "branch",
    statusField: "status",
    branchField: "branch",
    dueDateField: "task_date",
    staffNameField: "responsible_staff_name",
    defaultStatus: "pending",
    statuses: COMMON_STATUSES,
    dashboardHint: "أي فرع لم يغلق مهمة النظافة يظهر كتنبيه يومي.",
    defaultValues: { branch: BRANCHES[0], task_date: new Date().toISOString().slice(0, 10), shift: "morning", responsible_staff_name: "", status: "pending", notes: "" },
    fields: [
      { key: "branch", label: "الفرع", kind: "select", options: BRANCH_OPTIONS, required: true },
      { key: "task_date", label: "التاريخ", kind: "date" },
      { key: "shift", label: "الشيفت", kind: "select", options: ["morning", "evening", "closing"] },
      { key: "responsible_staff_name", label: "المسؤول" },
      { key: "notes", label: "ملاحظات", kind: "textarea" },
    ],
    searchKeys: ["branch", "responsible_staff_name", "shift", "notes"],
  },
  inventory: {
    title: "الجرد",
    route: "/inventory-counts",
    table: "inventory_count_sessions",
    icon: ClipboardList,
    description: "جلسات جرد كاملة أو حسب قسم أو نطاق حروف أو رواكد ونواقص.",
    primaryField: "title",
    statusField: "status",
    branchField: "branch",
    dueDateField: "due_date",
    staffNameField: "responsible_staff_name",
    defaultStatus: "planned",
    statuses: [
      { value: "planned", label: "مخطط", tone: STATUS_TONES.planned },
      ...COMMON_STATUSES.slice(1),
      { value: "closed", label: "مغلق", tone: STATUS_TONES.completed },
    ],
    dashboardHint: "فروق الجرد الخطيرة والجلسات المتأخرة تظهر للمدير.",
    defaultValues: { title: "", branch: BRANCHES[0], count_type: "جرد قسم", alphabet_from: "", alphabet_to: "", responsible_staff_name: "", due_date: new Date().toISOString().slice(0, 10), status: "planned", notes: "" },
    fields: [
      { key: "title", label: "عنوان الجرد", required: true },
      { key: "branch", label: "الفرع", kind: "select", options: BRANCH_OPTIONS, required: true },
      { key: "count_type", label: "نوع الجرد", kind: "select", options: ["جرد كامل", "جرد قسم", "جرد أصناف محددة", "جرد نطاق حروف", "جرد رواكد", "جرد نواقص", "جرد أدوية لستة"] },
      { key: "alphabet_from", label: "من حرف" },
      { key: "alphabet_to", label: "إلى حرف" },
      { key: "responsible_staff_name", label: "المسؤول" },
      { key: "due_date", label: "تاريخ الاستحقاق", kind: "date" },
      { key: "notes", label: "ملاحظات", kind: "textarea" },
    ],
    searchKeys: ["title", "branch", "count_type", "responsible_staff_name"],
  },
  shortages: {
    title: "النواقص",
    route: "/shortages",
    table: "shortage_items",
    icon: AlertTriangle,
    description: "متابعة الأصناف الناقصة والحرجة وتحويلها لمهام شراء أو طلبات عملاء.",
    primaryField: "item_name",
    statusField: "status",
    branchField: "branch",
    staffNameField: "responsible_staff_name",
    defaultStatus: "shortage",
    statuses: [
      { value: "available", label: "متوفر", tone: STATUS_TONES.completed },
      { value: "low", label: "قليل", tone: STATUS_TONES.low },
      { value: "shortage", label: "ناقص", tone: STATUS_TONES.shortage },
      { value: "unavailable", label: "غير متوفر", tone: STATUS_TONES.delayed },
      { value: "purchase_required", label: "مطلوب شراء", tone: STATUS_TONES.needs_review },
      { value: "resolved", label: "تم الحل", tone: STATUS_TONES.resolved },
    ],
    dashboardHint: "الأصناف الحرجة تظهر ضمن أولويات اليوم.",
    defaultValues: { item_name: "", branch: BRANCHES[0], current_qty: 0, min_qty: 1, max_qty: 0, requested_qty: 1, priority: "medium", category: "", status: "shortage", responsible_staff_name: "", notes: "" },
    fields: [
      { key: "item_name", label: "اسم الصنف", required: true },
      { key: "branch", label: "الفرع", kind: "select", options: BRANCH_OPTIONS },
      { key: "current_qty", label: "الكمية الحالية", kind: "number" },
      { key: "min_qty", label: "الحد الأدنى", kind: "number" },
      { key: "requested_qty", label: "الكمية المطلوبة", kind: "number" },
      { key: "priority", label: "الأولوية", kind: "select", options: ["high", "medium", "low"] },
      { key: "category", label: "التصنيف" },
      { key: "responsible_staff_name", label: "المسؤول" },
      { key: "notes", label: "ملاحظات", kind: "textarea" },
    ],
    searchKeys: ["item_name", "branch", "category", "supplier", "notes"],
  },
  supplies: stockConfig("المستلزمات", "/supplies", "supplies_items", "item_name", ["حقن وسرنجات", "كانيولات ومحاليل", "قطن وشاش", "بلاستر ودريسينج", "قساطر", "مستلزمات جروح", "جوانتيات وكمامات", "مستلزمات قياس", "أخرى"]),
  accessories: stockConfig("الإكسسوار", "/accessories", "accessory_items", "item_name", ["عناية شخصية", "مستلزمات أطفال", "منتجات تجميل", "شعر وبشرة", "منتجات موسمية", "منتجات عرض", "منتجات بطيئة الحركة", "أخرى"]),
  stories: {
    title: "الاستوريز والعروض",
    route: "/stories-offers",
    table: "offers",
    icon: Filter,
    description: "إدارة العروض النشطة وتقارير استوري واتساب اليومية.",
    primaryField: "title",
    statusField: "status",
    branchField: "branch",
    dueDateField: "end_date",
    defaultStatus: "scheduled",
    statuses: [
      { value: "scheduled", label: "مجدول", tone: STATUS_TONES.planned },
      { value: "active", label: "نشط", tone: STATUS_TONES.active },
      { value: "expired", label: "انتهى", tone: STATUS_TONES.delayed },
      { value: "stopped", label: "متوقف", tone: STATUS_TONES.needs_review },
    ],
    dashboardHint: "العروض النشطة والاستوريز التي تحتاج تقرير تظهر في لوحة القيادة.",
    defaultValues: { title: "", description: "", branch: "كل الفروع", start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10), discount_type: "note", discount_value: 0, status: "scheduled", notes: "" },
    fields: [
      { key: "title", label: "عنوان العرض", required: true },
      { key: "branch", label: "الفرع", kind: "select", options: BRANCH_OPTIONS },
      { key: "start_date", label: "تاريخ البداية", kind: "date" },
      { key: "end_date", label: "تاريخ النهاية", kind: "date" },
      { key: "discount_type", label: "نوع الخصم", kind: "select", options: ["percentage", "fixed", "bundle", "note"] },
      { key: "discount_value", label: "قيمة الخصم", kind: "number" },
      { key: "description", label: "الوصف", kind: "textarea" },
      { key: "notes", label: "ملاحظات", kind: "textarea" },
    ],
    searchKeys: ["title", "description", "branch", "status"],
  },
  training: {
    title: "أساسيات التدريب والاختبارات",
    route: "/training",
    table: "training_modules",
    icon: ClipboardList,
    description: "إنشاء مواد تدريبية وكويزات مرتبطة بجودة الواتساب والتشغيل والمخزون.",
    primaryField: "title",
    statusField: "active",
    defaultStatus: "true",
    statuses: [
      { value: "true", label: "نشط", tone: STATUS_TONES.completed },
      { value: "false", label: "متوقف", tone: STATUS_TONES.delayed },
    ],
    dashboardHint: "التدريبات الإجبارية غير المكتملة تظهر كتنبيه للمدير.",
    defaultValues: { title: "", category: "خدمة العملاء", description: "", content: "", active: true },
    fields: [
      { key: "title", label: "عنوان التدريب", required: true },
      { key: "category", label: "التصنيف", kind: "select", options: ["معلومات دوائية", "مبيعات وترشيحات", "خدمة العملاء", "التعامل مع الشكاوى", "الجرد والمخزون", "النواقص والبدائل", "الرواكد واللستة", "الانضباط والعمل الجماعي", "التوصيل والدليفري", "قواعد الخصم والمكافأة"] },
      { key: "description", label: "الوصف", kind: "textarea" },
      { key: "content", label: "محتوى مختصر", kind: "textarea" },
    ],
    searchKeys: ["title", "category", "description"],
  },
};

function stockConfig(title: string, route: string, table: string, primaryField: string, categories: string[]): ModuleConfig {
  return {
    title,
    route,
    table,
    icon: PackageIcon,
    description: `إدارة ${title} بالكميات والحدود ومتابعة الفحص الدوري.`,
    primaryField,
    statusField: "status",
    branchField: "branch",
    defaultStatus: "available",
    statuses: [
      { value: "available", label: "متوفر", tone: STATUS_TONES.completed },
      { value: "low", label: "قليل", tone: STATUS_TONES.low },
      { value: "shortage", label: "ناقص", tone: STATUS_TONES.shortage },
      { value: "needs_review", label: "يحتاج مراجعة", tone: STATUS_TONES.needs_review },
    ],
    dashboardHint: `أي نقص حرج في ${title} يظهر في لوحة القيادة.`,
    defaultValues: { item_name: "", category: categories[0], branch: BRANCHES[0], current_qty: 0, min_qty: 1, max_qty: 0, requested_qty: 0, status: "available", supplier: "", notes: "" },
    fields: [
      { key: "item_name", label: "اسم الصنف", required: true },
      { key: "category", label: "التصنيف", kind: "select", options: categories },
      { key: "branch", label: "الفرع", kind: "select", options: BRANCH_OPTIONS },
      { key: "current_qty", label: "الكمية الحالية", kind: "number" },
      { key: "min_qty", label: "الحد الأدنى", kind: "number" },
      { key: "max_qty", label: "الحد الأقصى", kind: "number" },
      { key: "supplier", label: "المورد" },
      { key: "notes", label: "ملاحظات", kind: "textarea" },
    ],
    searchKeys: ["item_name", "category", "branch", "supplier", "notes"],
  };
}

function PackageIcon(props: { className?: string; size?: number }) {
  return <ClipboardList {...props} />;
}

export function OperationalModulePage({ module }: { module: keyof typeof configs }) {
  const config = configs[module];
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("الكل");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [form, setForm] = useState<Record<string, string | number | boolean | null>>(config.defaultValues);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from(config.table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (loadError) {
      setError("تعذر تحميل البيانات. تأكد من تشغيل ترقية قاعدة البيانات.");
      setRows([]);
    } else {
      setRows((data || []) as Array<Record<string, unknown>>);
    }
    setLoading(false);
  }, [config.table]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const status = String(row[config.statusField] ?? "");
      const branch = config.branchField ? String(row[config.branchField] ?? "") : "";
      if (statusFilter !== "الكل" && status !== statusFilter) return false;
      if (branchFilter !== "الكل" && branch !== branchFilter) return false;
      if (!needle) return true;
      return config.searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
    });
  }, [branchFilter, config, query, rows, statusFilter]);

  const stats = useMemo(() => {
    const open = rows.filter((row) => !["completed", "resolved", "closed", "delivered", "false"].includes(String(row[config.statusField] ?? ""))).length;
    const delayed = rows.filter((row) => {
      const date = config.dueDateField ? String(row[config.dueDateField] || "") : "";
      return date && date < new Date().toISOString().slice(0, 10) && !["completed", "resolved", "closed"].includes(String(row[config.statusField] ?? ""));
    }).length;
    const urgent = rows.filter((row) => ["high", "critical", "shortage", "delayed"].includes(String(row.priority || row[config.statusField] || ""))).length;
    return { total: rows.length, open, delayed, urgent };
  }, [config.dueDateField, config.statusField, rows]);

  const submit = async () => {
    const missing = config.fields.find((field) => field.required && !String(form[field.key] ?? "").trim());
    if (missing) {
      toast.error(`أكمل حقل ${missing.label}`);
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      [config.statusField]: form[config.statusField] ?? config.defaultStatus,
      created_by: getSafeCurrentUserId(),
    };
    const { error: saveError } = await supabase.from(config.table).insert(payload);
    if (saveError) {
      toast.error("تعذر الحفظ. تأكد من تشغيل ترقية قاعدة البيانات.");
    } else {
      toast.success("تم الحفظ بنجاح");
      await logActivity(getSafeCurrentUserId(), user?.name || "النظام", `إضافة ${config.title}`, config.title, String(form[config.primaryField] || config.title), String(form[config.branchField || "branch"] || "كل الفروع"), { route_path: config.route, new_value: payload });
      setForm(config.defaultValues);
      await loadRows();
    }
    setSaving(false);
  };

  const updateStatus = async (row: Record<string, unknown>, status: string) => {
    const { error: statusError } = await supabase
      .from(config.table)
      .update({ [config.statusField]: module === "training" ? status === "true" : status, updated_at: new Date().toISOString(), ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) })
      .eq("id", row.id);
    if (statusError) toast.error("تعذر تحديث الحالة");
    else {
      toast.success("تم تحديث الحالة");
      await loadRows();
    }
  };

  const Icon = config.icon;
  const branchOptions = Array.from(new Set(rows.map((row) => String(row[config.branchField || "branch"] || "")).filter(Boolean)));

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-teal-400/20 bg-[#10213a] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-teal-500/15 p-3 text-teal-300"><Icon size={22} /></div>
            <div>
              <h1 className="text-2xl font-black text-white">{config.title}</h1>
              <p className="mt-1 text-sm text-slate-400">{config.description}</p>
              <p className="mt-2 text-xs text-teal-300">{config.dashboardHint}</p>
            </div>
          </div>
          <button type="button" onClick={loadRows} className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={stats.total} label="إجمالي السجلات" />
        <Stat value={stats.open} label="مفتوح" />
        <Stat value={stats.delayed} label="متأخر" danger />
        <Stat value={stats.urgent} label="أولوية عالية" danger={stats.urgent > 0} />
      </div>

      <div className="rounded-2xl border border-[#2d4063] bg-[#1B2B4B] p-5">
        <div className="mb-4 flex items-center gap-2 text-white font-bold">
          <Plus size={18} className="text-teal-300" />
          إضافة سجل جديد
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {config.fields.map((field) => (
            <Field key={field.key} field={field} value={form[field.key]} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />
          ))}
        </div>
        <button type="button" onClick={submit} disabled={saving} className="btn-primary mt-4 flex items-center gap-2 px-4 py-2 text-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ
        </button>
      </div>

      <div className="rounded-2xl border border-[#2d4063] bg-[#1B2B4B] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input className="input-dark pr-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث..." />
          </label>
          <select className="input-dark" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>الكل</option>
            {config.statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <select className="input-dark" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
            <option>الكل</option>
            {branchOptions.map((branch) => <option key={branch}>{branch}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2d4063] bg-[#1B2B4B] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-slate-300"><Loader2 className="animate-spin text-teal-300" /> جاري التحميل...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-200">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-slate-400">لا توجد بيانات مطابقة حاليا.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>العنوان</th>
                  {config.branchField && <th>الفرع</th>}
                  {config.staffNameField && <th>المسؤول</th>}
                  {config.dueDateField && <th>الاستحقاق</th>}
                  <th>الحالة</th>
                  <th>تغيير الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const status = String(row[config.statusField] ?? config.defaultStatus);
                  const statusMeta = config.statuses.find((item) => item.value === status);
                  return (
                    <tr key={String(row.id)}>
                      <td className="font-bold text-white">{String(row[config.primaryField] || row.title || row.item_name || row.branch || "-")}</td>
                      {config.branchField && <td>{String(row[config.branchField] || "-")}</td>}
                      {config.staffNameField && <td>{String(row[config.staffNameField] || "-")}</td>}
                      {config.dueDateField && <td>{formatArabicDate(row[config.dueDateField])}</td>}
                      <td><span className={`rounded-full border px-2 py-1 text-xs ${statusMeta?.tone || STATUS_TONES.pending}`}>{statusMeta?.label || status}</span></td>
                      <td>
                        <select className="input-dark min-w-40" value={status} onChange={(event) => updateStatus(row, event.target.value)}>
                          {config.statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ field, value, onChange }: { field: ModuleField; value: unknown; onChange: (value: string | number | boolean) => void }) {
  const kind = field.kind || "text";
  const common = "input-dark";
  return (
    <label className={`text-xs text-slate-300 space-y-1 ${kind === "textarea" ? "md:col-span-3" : ""}`}>
      <span>{field.label}{field.required ? " *" : ""}</span>
      {kind === "select" ? (
        <select className={common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : kind === "textarea" ? (
        <textarea className={common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      ) : (
        <input className={common} type={kind} value={String(value ?? "")} onChange={(event) => onChange(kind === "number" ? Number(event.target.value) : event.target.value)} placeholder={field.placeholder} />
      )}
    </label>
  );
}

function Stat({ value, label, danger = false }: { value: number; label: string; danger?: boolean }) {
  return (
    <div className="stat-card">
      <div className={`text-2xl font-black ${danger ? "text-red-300" : "text-teal-300"}`}>{value.toLocaleString("ar-EG")}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}

function formatArabicDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export default OperationalModulePage;
