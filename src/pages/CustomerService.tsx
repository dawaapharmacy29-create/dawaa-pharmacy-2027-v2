import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Loader2,
  MessageSquare,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ALL_FILTER } from '@/lib/api/customers';
import {
  calculateFollowupStats,
  createExceptionalFollowup,
  fetchCustomerServiceFollowups,
  generateTodayFollowupsFromCustomerMetrics,
  recommendedAction,
  riskLevel,
  updateFollowupResult,
  type FollowupRow,
} from '@/lib/api/customerServiceCommandCenter';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import { getBestCustomerPhone, isValidEgyptPhone } from '@/lib/customerAnalyticsService';
import { normalizeBranchName } from '@/lib/branch';
import { BRANCHES } from '@/lib/constants';
import { canSeeAllBranches, effectiveBranchFilter, scopeDescription } from '@/lib/security/permissionScopes';

const PAGE_TABS = [
  { id: 'today', label: 'متابعات اليوم' },
  { id: 'requests', label: 'المتابعات المسندة' },
  { id: 'history', label: 'سجل المتابعات' },
  { id: 'performance', label: 'تحليل أداء خدمة العملاء' },
] as const;

type PageTab = (typeof PAGE_TABS)[number]['id'];
const STATUS_OPTIONS = [ALL_FILTER, 'معلق', 'تم', 'لم يرد', 'مؤجل', 'متأخرة', 'يحتاج مدير'];
const CUSTOMER_CARE_RESPONSIBLES = [
  { branch: 'فرع الشامي', name: 'د ضحى' },
  { branch: 'فرع شكري', name: 'د دنيا' },
];

function text(value: unknown, fallback = 'غير محدد') {
  const v = String(value ?? '').trim();
  return v || fallback;
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  return `${Number.isFinite(n) ? n.toLocaleString('ar-EG', { maximumFractionDigits: 0 }) : '0'} جنيه`;
}

function formatDate(value?: string | null) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleDateString('ar-EG');
}

function formatDateTime(value?: string | null) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
}

function customerName(row: FollowupRow) {
  return text(row.customer_name || row.name, 'عميل بدون اسم');
}

function phoneOf(row: FollowupRow) {
  return getBestCustomerPhone(row, row.customer_metrics, row) || text(row.customer_phone || row.phone || row.whatsapp_phone || row.phone_alt, '');
}

function statusOf(row: FollowupRow) {
  if (row.completed_at) return row.followup_status || row.status || 'تم';
  if (row.postponed_until) return 'مؤجل';
  if (row.needs_manager) return 'يحتاج مدير';
  return row.followup_status || row.status || row.contact_status || 'معلق';
}

function segmentOf(row: FollowupRow) {
  return row.customer_metrics?.segment || row.segment || row.classification || 'غير محدد';
}

function customerStatusOf(row: FollowupRow) {
  return row.customer_metrics?.customer_status || row.customer_status || 'غير محدد';
}

function lastPurchaseOf(row: FollowupRow) {
  return row.customer_metrics?.last_purchase || row.last_purchase_date || null;
}

function avgMonthlyOf(row: FollowupRow) {
  return row.customer_metrics?.avg_monthly ?? null;
}

function responsibleOf(row: FollowupRow) {
  if (row.responsible_name || row.assigned_to || row.assigned_doctor) return row.responsible_name || row.assigned_to || row.assigned_doctor || 'غير محدد';
  const branch = normalizeBranchName(row.branch);
  return CUSTOMER_CARE_RESPONSIBLES.find((item) => normalizeBranchName(item.branch) === branch)?.name || 'غير محدد';
}

function scriptFor(row: FollowupRow) {
  const name = customerName(row);
  const reason = row.request_details || row.followup_reason || row.suggested_action || recommendedAction(row);
  return `السلام عليكم ${name}\nمع حضرتك صيدليات دواء.\nكنا بنتابع مع حضرتك بخصوص ${reason}.\nهل في أي حاجة نقدر نساعد حضرتك فيها؟`;
}

function isOverdue(row: FollowupRow) {
  if (row.completed_at || row.postponed_until) return false;
  const due = row.followup_datetime || row.followup_date || row.date;
  return due ? new Date(due).getTime() < Date.now() : false;
}

function priorityScore(row: FollowupRow) {
  let score = 0;
  if (row.needs_manager) score += 1000;
  if (isOverdue(row)) score += 700;
  if (segmentOf(row) === 'مهم جدًا') score += 500;
  if (segmentOf(row) === 'مهم') score += 300;
  if (customerStatusOf(row) === 'متوقف') score += 350;
  score += Number(avgMonthlyOf(row) || 0) / 100;
  return score;
}

function StatCard({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'cyan' | 'emerald' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'border-slate-700 bg-slate-900/70 text-slate-100',
    cyan: 'border-cyan-500/30 bg-cyan-950/30 text-cyan-100',
    emerald: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100',
    amber: 'border-amber-500/30 bg-amber-950/30 text-amber-100',
    rose: 'border-rose-500/30 bg-rose-950/30 text-rose-100',
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><div className="text-xs opacity-70">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function FollowupCard({ row, selected, onSelect, onDone }: { row: FollowupRow; selected: boolean; onSelect: () => void; onDone: () => void }) {
  const phone = phoneOf(row);
  const validPhone = isValidEgyptPhone(phone, row.customer_code);
  const status = statusOf(row);
  return (
    <article className={`rounded-3xl border p-4 transition ${selected ? 'border-cyan-400 bg-cyan-950/30' : 'border-slate-700 bg-slate-900/70 hover:border-cyan-600/60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-600 px-2 py-1 text-xs font-bold text-slate-200">{status}</span>
            {row.needs_manager && <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-100">يحتاج مدير</span>}
            {isOverdue(row) && <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-100">متأخرة</span>}
          </div>
          <h3 className="mt-3 text-xl font-black text-white">{customerName(row)}</h3>
          <div className="mt-2 grid gap-1 text-sm text-slate-300 md:grid-cols-2">
            <span>كود: {text(row.customer_code)}</span>
            <span>هاتف: {validPhone ? phone : 'بدون رقم صحيح'}</span>
            <span>فرع: {text(row.branch)}</span>
            <span>مسؤول: {responsibleOf(row)}</span>
            <span>تصنيف: {segmentOf(row)}</span>
            <span>الحالة: {customerStatusOf(row)}</span>
            <span>آخر شراء: {formatDate(lastPurchaseOf(row))}</span>
            <span>متوسط شهري: {avgMonthlyOf(row) ? money(avgMonthlyOf(row)) : 'غير متاح'}</span>
          </div>
        </div>
      </div>
      <p className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm font-bold text-cyan-50">{row.followup_reason || row.suggested_action || recommendedAction(row)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onSelect} className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-bold text-slate-100 hover:bg-slate-800"><Eye className="ml-1 inline h-4 w-4" /> عرض ملف العميل</button>
        {validPhone && <a href={generateWhatsAppLink(phone, scriptFor(row))} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500"><MessageSquare className="ml-1 inline h-4 w-4" /> واتساب</a>}
        {validPhone && <a href={`tel:${phone}`} className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-bold text-slate-100 hover:bg-slate-800"><PhoneCall className="ml-1 inline h-4 w-4" /> اتصال</a>}
        <button onClick={onDone} className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white hover:bg-cyan-500"><CheckCircle2 className="ml-1 inline h-4 w-4" /> تم</button>
      </div>
    </article>
  );
}

export default function CustomerService() {
  const { user, canManage } = useAuth();
  const mountedRef = useRef(true);
  const [followups, setFollowups] = useState<FollowupRow[]>([]);
  const [selected, setSelected] = useState<FollowupRow | null>(null);
  const [branchFilter, setBranchFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [responsibleFilter, setResponsibleFilter] = useState(ALL_FILTER);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<PageTab>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(18);

  const canUseAllBranches = canSeeAllBranches(user?.role);
  const manager = Boolean(canManage || canUseAllBranches || user?.role === 'customer_service_manager' || user?.role === 'branch_manager');
  const userScopeLabel = scopeDescription(user?.role);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!canUseAllBranches && user?.branch && branchFilter !== normalizeBranchName(user.branch)) setBranchFilter(normalizeBranchName(user.branch));
  }, [branchFilter, canUseAllBranches, user?.branch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadFollowups = useCallback(async (soft = false) => {
    if (!user) return;
    if (soft) setRefreshing(true);
    else if (!followups.length) setLoading(true);
    setError(null);
    try {
      const scopedBranch = effectiveBranchFilter(user, branchFilter, ALL_FILTER);
      const rows = await fetchCustomerServiceFollowups({ branch: scopedBranch, status: statusFilter, responsible: responsibleFilter, search: debouncedSearch, limit: 40 });
      const visibleRows = manager ? rows : rows.filter((row) => [row.assigned_to, row.responsible_name, row.assigned_doctor, responsibleOf(row)].filter(Boolean).includes(user?.name || ''));
      const sorted = [...visibleRows].sort((a, b) => priorityScore(b) - priorityScore(a));
      if (!mountedRef.current) return;
      setFollowups(sorted);
      setSelected((current) => (current && sorted.find((row) => row.id === current.id)) || sorted[0] || null);
      setVisibleCount(18);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'تعذر تحميل المتابعات');
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [branchFilter, debouncedSearch, followups.length, manager, responsibleFilter, statusFilter, user?.id, user?.name, user?.branch, user?.role]);

  useEffect(() => {
    loadFollowups(false);
  }, [loadFollowups]);

  const stats = useMemo(() => calculateFollowupStats(followups), [followups]);
  const recoveredCount = useMemo(() => followups.filter((row) => row.purchase_after_followup && ['متوقف', 'مهدد بالتوقف'].includes(customerStatusOf(row))).length, [followups]);
  const invalidPhoneCount = useMemo(() => followups.filter((row) => !isValidEgyptPhone(phoneOf(row), row.customer_code)).length, [followups]);
  const responsibleOptions = useMemo(() => [ALL_FILTER, ...new Set([...CUSTOMER_CARE_RESPONSIBLES.map((item) => item.name), ...followups.map(responsibleOf).filter((name) => name !== 'غير محدد')])], [followups]);

  const tabRows = useMemo(() => {
    if (activeTab === 'requests') return followups.filter((row) => row.request_type || row.request_details || row.assigned_doctor);
    if (activeTab === 'history') return followups.filter((row) => row.completed_at || statusOf(row).includes('تم'));
    return followups;
  }, [activeTab, followups]);
  const shownRows = tabRows.slice(0, visibleCount);

  const markDone = async (row: FollowupRow) => {
    try {
      const updated = await updateFollowupResult(row.id, { status: 'تم', followup_status: 'تم', completed_at: new Date().toISOString(), updated_by: user?.id || user?.name || null });
      setFollowups((items) => items.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      toast.success('تم حفظ نتيجة المتابعة');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر حفظ النتيجة');
    }
  };

  const copyScript = async (row: FollowupRow) => {
    await navigator.clipboard.writeText(scriptFor(row));
    toast.success('تم نسخ السكريبت');
  };

  const generateToday = async () => {
    setGenerating(true);
    try {
      const scopedBranch = effectiveBranchFilter(user, branchFilter, ALL_FILTER);
      const rows = await generateTodayFollowupsFromCustomerMetrics(scopedBranch, user?.name);
      toast.success(rows.length ? `تم إنشاء ${rows.length} متابعة` : 'لا توجد متابعات جديدة');
      await loadFollowups(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر إنشاء قائمة اليوم');
    } finally {
      setGenerating(false);
    }
  };

  if (loading && !followups.length) {
    return <div className="flex min-h-[60vh] items-center justify-center" dir="rtl"><div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 text-center text-white"><Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan-300" /><div className="text-lg font-black">جاري تحميل مركز خدمة العملاء...</div></div></div>;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-3xl border border-cyan-500/20 bg-slate-950/70 p-5 text-slate-100 shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-200">مركز خدمة العملاء</span>
            <h1 className="mt-3 text-2xl font-black">مركز خدمة العملاء والمتابعات</h1>
            <p className="mt-1 text-sm text-slate-400">نفس التصميم التفصيلي مع تحميل أخف وعرض تدريجي للكروت. نطاقك الحالي: {userScopeLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => loadFollowups(true)} disabled={refreshing} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold hover:bg-slate-800 disabled:opacity-60"><RefreshCw className={`ml-2 inline h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> تحديث هادئ</button>
            <button onClick={generateToday} disabled={generating} className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-60"><Plus className="ml-2 inline h-4 w-4" /> {generating ? 'جاري الإنشاء...' : 'إنشاء قائمة اليوم'}</button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="المسند" value={stats.totalToday} tone="cyan" />
        <StatCard label="المكتمل" value={stats.completed} tone="emerald" />
        <StatCard label="لم يرد" value={stats.noAnswer} tone="amber" />
        <StatCard label="متأخر" value={stats.overdue} tone="rose" />
        <StatCard label="استرجاع شراء" value={recoveredCount} tone="emerald" />
        <StatCard label="أرقام تحتاج مراجعة" value={invalidPhoneCount} tone="amber" />
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} disabled={!canUseAllBranches} className="rounded-2xl border border-slate-700 bg-slate-900 p-3 text-slate-100"><option value={ALL_FILTER}>كل الفروع</option>{BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}</select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-900 p-3 text-slate-100">{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-900 p-3 text-slate-100">{responsibleOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <div className="relative lg:col-span-2"><Search className="absolute right-4 top-3.5 h-5 w-5 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم / الكود / الهاتف / المسؤول" className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-3 pr-12 text-slate-100" /></div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100"><AlertTriangle className="ml-2 inline h-5 w-5" />{error}</div>}

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {PAGE_TABS.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-2xl px-4 py-2 text-sm font-bold ${activeTab === tab.id ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{tab.label}</button>)}
          </div>
          <div className="mb-3 flex items-center justify-between text-sm text-slate-400"><span>يتم عرض {shownRows.length} من {tabRows.length} متابعة لتخفيف المتصفح</span>{refreshing && <span className="text-cyan-300">تحديث...</span>}</div>
          <div className="grid gap-4 md:grid-cols-2">
            {shownRows.map((row) => <FollowupCard key={row.id} row={row} selected={selected?.id === row.id} onSelect={() => setSelected(row)} onDone={() => markDone(row)} />)}
          </div>
          {!shownRows.length && <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400">لا توجد متابعات مطابقة حاليًا.</div>}
          {visibleCount < tabRows.length && <div className="mt-5 text-center"><button onClick={() => setVisibleCount((count) => count + 18)} className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700">عرض المزيد</button></div>}
        </div>

        <aside className="rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-4 text-slate-100 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
          <h2 className="text-xl font-black">تفاصيل المتابعة</h2>
          {!selected ? <p className="mt-4 text-sm text-slate-400">اختار عميل من القائمة لعرض تفاصيله.</p> : <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <h3 className="text-2xl font-black">{customerName(selected)}</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                <div className="flex justify-between"><span>الكود</span><b>{text(selected.customer_code)}</b></div>
                <div className="flex justify-between"><span>الهاتف</span><b>{phoneOf(selected) || 'بدون رقم صحيح'}</b></div>
                <div className="flex justify-between"><span>الفرع</span><b>{text(selected.branch)}</b></div>
                <div className="flex justify-between"><span>الحالة</span><b>{customerStatusOf(selected)}</b></div>
                <div className="flex justify-between"><span>التصنيف</span><b>{segmentOf(selected)}</b></div>
                <div className="flex justify-between"><span>درجة الخطورة</span><b>{riskLevel(selected)}</b></div>
                <div className="flex justify-between"><span>آخر شراء</span><b>{formatDate(lastPurchaseOf(selected))}</b></div>
                <div className="flex justify-between"><span>الموعد</span><b>{formatDateTime(selected.followup_datetime || selected.followup_date || selected.created_at)}</b></div>
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4"><h4 className="mb-2 font-black">سكريبت مقترح</h4><p className="whitespace-pre-line text-sm leading-7 text-cyan-50">{scriptFor(selected)}</p></div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><h4 className="mb-2 font-black">ملاحظات قبل التواصل</h4><p className="text-sm text-slate-300">{selected.handling_notes || selected.service_notes || selected.whatsapp_notes || selected.customer_notes || selected.notes || 'لا توجد ملاحظات مسجلة.'}</p></div>
            <div className="flex flex-wrap gap-2">
              {isValidEgyptPhone(phoneOf(selected), selected.customer_code) && <a href={generateWhatsAppLink(phoneOf(selected), scriptFor(selected))} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"><MessageSquare className="ml-1 inline h-4 w-4" /> واتساب</a>}
              <button onClick={() => copyScript(selected)} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold hover:bg-slate-800"><Copy className="ml-1 inline h-4 w-4" /> نسخ سكريبت</button>
              <button onClick={() => markDone(selected)} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500"><CheckCircle2 className="ml-1 inline h-4 w-4" /> تسجيل نتيجة</button>
            </div>
          </div>}
        </aside>
      </section>
    </div>
  );
}
