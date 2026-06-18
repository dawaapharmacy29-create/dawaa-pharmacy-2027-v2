import { useCallback, useEffect, useState } from 'react';
import { Award, ClipboardCheck, RefreshCw, Star, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CommandHeader, MetricCard, SectionState } from '@/components/command/CommandUI';

type KpiRow = {
  staff_id: string;
  staff_name: string;
  branch: string;
  role: string;
  reward_points: number;
  penalty_points: number;
  avg_review_score: number;
  review_count: number;
  days_present: number;
  days_absent: number;
  tasks_done: number;
  tasks_open: number;
  total_score: number;
};

export default function EmployeeKpi() {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('الكل');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('employee_kpi_cycle_summary')
        .select('*')
        .order('total_score', { ascending: false });

      if (error) throw error;
      setRows((data || []) as KpiRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مؤشرات الأداء');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const branches = [...new Set(rows.map((r) => r.branch).filter(Boolean))];
  const filtered = rows.filter((r) => {
    const branchMatch = branch === 'الكل' || r.branch === branch;
    const searchMatch = !search || r.staff_name.toLowerCase().includes(search.toLowerCase());
    return branchMatch && searchMatch;
  });

  const stats = {
    total: filtered.length,
    excellent: filtered.filter((r) => r.total_score >= 80).length,
    needsFollow: filtered.filter((r) => r.total_score < 60).length,
    avgScore: filtered.length
      ? Math.round(filtered.reduce((s, r) => s + r.total_score, 0) / filtered.length)
      : 0,
  };

  function getRecommendation(score: number): string {
    return score >= 80 ? '🏆 ممتاز' : score >= 60 ? '✅ جيد' : '⚠️ يحتاج متابعة';
  }

  return (
    <div className="space-y-5 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <CommandHeader
          title="مؤشرات أداء الموظفين"
          subtitle="آخر 30 يوم • بيانات محسوبة من Supabase"
        />
        <button
          onClick={() => void load()}
          className="rounded-xl p-2 hover:bg-slate-700/50 transition"
          title="تحديث البيانات"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* الملخص السريع */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="إجمالي الموظفين" value={stats.total} icon={<Users size={18} />} tone="sky" />
        <MetricCard label="متوسط الأداء" value={`${stats.avgScore}%`} icon={<Star size={18} />} tone="emerald" />
        <MetricCard label="ممتاز" value={stats.excellent} icon={<Award size={18} />} tone="amber" />
        <MetricCard
          label="يحتاج متابعة"
          value={stats.needsFollow}
          icon={<ClipboardCheck size={18} />}
          tone="rose"
        />
      </section>

      {/* الفلاتر */}
      <section className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم الموظف..."
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option>الكل</option>
          {branches.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </section>

      {/* الجدول */}
      <SectionState loading={loading} error={error} empty={!rows.length}>
        <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-900/50">
              <tr>
                {['#', 'الموظف', 'الفرع', 'التقييم', 'الحضور', 'المهام', 'النقاط', 'الدرجة'].map((h) => (
                  <th key={h} className="p-3 text-right text-xs font-black text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((row, i) => (
                <tr key={row.staff_id} className="hover:bg-slate-700/30 transition">
                  <td className="p-3 text-slate-500">{i + 1}</td>
                  <td className="p-3">
                    <p className="font-bold text-white">{row.staff_name}</p>
                    <p className="text-xs text-slate-400">{row.role}</p>
                  </td>
                  <td className="p-3 text-slate-300">{row.branch}</td>
                  <td className="p-3 font-bold text-white">{row.avg_review_score}/100</td>
                  <td className="p-3">
                    <span className="text-emerald-400">{row.days_present} ✓</span>
                    {row.days_absent > 0 && <span className="ml-2 text-rose-400">{row.days_absent} ✗</span>}
                  </td>
                  <td className="p-3 text-white">
                    {row.tasks_done}/{row.tasks_done + row.tasks_open}
                  </td>
                  <td className="p-3">
                    <span className="text-teal-400">+{row.reward_points}</span>
                    {row.penalty_points > 0 && (
                      <span className="ml-1 text-rose-400">-{row.penalty_points}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${
                        row.total_score >= 80
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : row.total_score >= 60
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {getRecommendation(row.total_score)} · {row.total_score}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </SectionState>

      {/* ملاحظة */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-700">
        📊 هذه النتائج توصيات فقط؛ الاعتماد النهائي والمكافآت المالية بقرار المدير.
      </div>
    </div>
  );
}
