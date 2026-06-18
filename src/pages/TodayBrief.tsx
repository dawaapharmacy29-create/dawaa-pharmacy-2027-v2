import { useAuth } from '@/hooks/useAuth';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Headphones,
  PackageSearch,
  RefreshCw,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CommandHeader, MetricCard, SectionState } from '@/components/command/CommandUI';

interface TodaySummary {
  sales_today: number;
  invoices_count: number;
  open_followups: number;
  open_complaints: number;
  staff_present: number;
  pending_leaves: number;
  open_shortages: number;
  pending_delivery: number;
  weak_reviews: number;
  staff_leaves: number;
  loaded_at: string;
}

export default function TodayBrief() {
  const { user } = useAuth();
  const [data, setData] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.rpc('get_today_command_summary', {
        p_branch: user?.branch || 'all',
      });

      if (err) throw err;
      setData(result as TodaySummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل ملخص اليوم');
    } finally {
      setLoading(false);
    }
  }, [user?.branch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data && loading) return <SectionState state="loading" />;
  if (error) return <SectionState state="error" message={error} />;
  if (!data) return null;

  const d = data;
  const salesFormatted = d.sales_today.toLocaleString('ar-EG');
  const loadedTime = new Date(d.loaded_at).toLocaleTimeString('ar-EG');

  return (
    <div className="space-y-5 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <CommandHeader
          title="ملخص اليوم"
          subtitle={`آخر تحديث: ${loadedTime}`}
        />
        <button
          onClick={() => void load()}
          className="rounded-xl p-2 hover:bg-slate-700/50 transition"
          title="تحديث البيانات"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* المبيعات */}
      <section>
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-teal-400">المبيعات</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="إجمالي اليوم"
            value={`${salesFormatted} ج.م`}
            icon={<Activity size={18} />}
            tone="teal"
          />
          <MetricCard
            label="عدد الفواتير"
            value={d.invoices_count}
            icon={<ClipboardList size={18} />}
            tone="sky"
          />
        </div>
      </section>

      {/* خدمة العملاء */}
      <section>
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-purple-400">
          خدمة العملاء
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="متابعات مفتوحة"
            value={d.open_followups}
            icon={<Headphones size={18} />}
            tone={d.open_followups > 10 ? 'rose' : 'emerald'}
          />
          <MetricCard
            label="شكاوى مفتوحة"
            value={d.open_complaints}
            icon={<AlertTriangle size={18} />}
            tone={d.open_complaints > 0 ? 'rose' : 'emerald'}
          />
        </div>
      </section>

      {/* الفريق */}
      <section>
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-blue-400">الفريق</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="حاضرون الآن"
            value={d.staff_present}
            icon={<Users size={18} />}
            tone="emerald"
          />
          <MetricCard
            label="طلبات إجازة"
            value={d.pending_leaves}
            icon={<ClipboardList size={18} />}
            tone={d.pending_leaves > 0 ? 'amber' : 'emerald'}
          />
        </div>
      </section>

      {/* التشغيل */}
      <section>
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-amber-400">التشغيل</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="نواقص مفتوحة"
            value={d.open_shortages}
            icon={<PackageSearch size={18} />}
            tone={d.open_shortages > 5 ? 'rose' : 'amber'}
          />
          <MetricCard
            label="طلبات دليفري"
            value={d.pending_delivery}
            icon={<Truck size={18} />}
            tone={d.pending_delivery > 0 ? 'sky' : 'emerald'}
          />
        </div>
      </section>

      {/* جودة البيانات */}
      <section>
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-red-400">جودة البيانات</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="تقييمات منخفضة اليوم"
            value={d.weak_reviews}
            icon={<Star size={18} />}
            tone={d.weak_reviews > 5 ? 'rose' : 'amber'}
          />
          <MetricCard
            label="إجازات بتاريخ اليوم"
            value={d.staff_leaves}
            icon={<Users size={18} />}
            tone={d.staff_leaves > 0 ? 'amber' : 'emerald'}
          />
        </div>
      </section>

      {/* ملاحظة */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-400">
        📡 جميع المقاييس محسوبة من Supabase في الوقت الفعلي عبر دالة واحدة محسّنة.
      </div>
    </div>
  );
}
