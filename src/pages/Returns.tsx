import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CommandHeader, SectionState } from '@/components/command/CommandUI';

interface ReturnOrder {
  id?: string;
  customer_code: string;
  customer_name: string;
  original_invoice_number: string;
  return_date: string;
  reason: 'expired' | 'wrong_item' | 'customer_changed_mind' | 'doctor_change' | 'other';
  total_return_value: number;
  refund_method: 'cash' | 'credit' | 'exchange';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  processed_by?: string;
  notes?: string;
}

const RETURN_REASONS: Record<string, string> = {
  expired: 'دواء منتهي الصلاحية',
  wrong_item: 'صنف خاطئ',
  customer_changed_mind: 'العميل غيّر رأيه',
  doctor_change: 'تغيير وصفة الدكتور',
  other: 'أخرى',
};

const REFUND_METHODS: Record<string, string> = {
  cash: 'استرداد كاش',
  credit: 'رصيد في الحساب',
  exchange: 'استبدال بصنف آخر',
};

export default function Returns() {
  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [formData, setFormData] = useState<Partial<ReturnOrder>>({
    status: 'pending',
    refund_method: 'cash',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('return_orders')
        .select('*')
        .order('return_date', { ascending: false });

      if (err) throw err;
      setReturns((data || []) as ReturnOrder[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المرتجعات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name || !formData.total_return_value) {
      toast.error('الرجاء ملء البيانات المطلوبة');
      return;
    }

    try {
      const { error: err } = await supabase.from('return_orders').insert([
        {
          customer_code: formData.customer_code || '',
          customer_name: formData.customer_name,
          original_invoice_number: formData.original_invoice_number || '',
          return_date: formData.return_date || new Date().toISOString().slice(0, 10),
          reason: formData.reason || 'other',
          total_return_value: formData.total_return_value,
          refund_method: formData.refund_method || 'cash',
          status: 'pending',
          notes: formData.notes || '',
        },
      ]);

      if (err) throw err;

      toast.success('تم تسجيل المرتجع بنجاح');
      setShowForm(false);
      setFormData({ status: 'pending', refund_method: 'cash' });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر تسجيل المرتجع');
    }
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;

    try {
      const { error: err } = await supabase.from('return_orders').delete().eq('id', id);

      if (err) throw err;

      toast.success('تم حذف المرتجع');
      void load();
    } catch (e) {
      toast.error('تعذر حذف المرتجع');
    }
  };

  const monthlyReturnValue = returns
    .filter((r) => r.return_date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .reduce((sum, r) => sum + r.total_return_value, 0);

  const filtered = returns.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="space-y-5 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <CommandHeader title="إدارة المرتجعات" subtitle={`إجمالي الشهر: ${monthlyReturnValue.toLocaleString('ar-EG')} ج.م`} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="rounded-xl p-2 hover:bg-slate-700/50 transition"
            title="تحديث البيانات"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white hover:bg-teal-500 transition"
          >
            <Plus size={18} /> مرتجع جديد
          </button>
        </div>
      </div>

      {/* فلاتر */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'completed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
              filter === s ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {s === 'all'
              ? `الكل (${returns.length})`
              : s === 'pending'
                ? `⏳ قيد الانتظار (${returns.filter((r) => r.status === 'pending').length})`
                : `✓ مكتملة (${returns.filter((r) => r.status === 'completed').length})`}
          </button>
        ))}
      </div>

      {/* قائمة المرتجعات */}
      <SectionState loading={loading} error={error} empty={!returns.length}>
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-900/50">
              <tr>
                {['#', 'العميل', 'الفاتورة الأصلية', 'المبلغ', 'السبب', 'الحالة', 'الإجراء'].map((h) => (
                  <th key={h} className="p-3 text-right text-xs font-black text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((row, i) => (
                <tr key={row.id} className="hover:bg-slate-700/30 transition">
                  <td className="p-3 text-slate-500">{i + 1}</td>
                  <td className="p-3">
                    <p className="font-bold text-white">{row.customer_name}</p>
                    <p className="text-xs text-slate-400">{row.customer_code}</p>
                  </td>
                  <td className="p-3 text-slate-300">{row.original_invoice_number}</td>
                  <td className="p-3 font-bold text-teal-400">
                    {row.total_return_value.toLocaleString('ar-EG')} ج
                  </td>
                  <td className="p-3 text-xs">
                    <span className="inline-block rounded-full bg-slate-700/50 px-2 py-1">
                      {RETURN_REASONS[row.reason] || 'أخرى'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-black ${
                        row.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300'
                          : row.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {row.status === 'pending'
                        ? '⏳ قيد الانتظار'
                        : row.status === 'completed'
                          ? '✓ مكتملة'
                          : '✗ مرفوضة'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => {
                        if (confirm('هل تريد حذف هذا المرتجع؟')) {
                          void handleDelete(row.id);
                        }
                      }}
                      className="text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>

      {/* فورم المرتجع الجديد */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6">
            <h2 className="text-xl font-black text-white mb-4">مرتجع جديد</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="اسم العميل"
                required
                value={formData.customer_name || ''}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                placeholder="رقم الفاتورة الأصلية"
                value={formData.original_invoice_number || ''}
                onChange={(e) => setFormData({ ...formData, original_invoice_number: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="number"
                placeholder="المبلغ"
                required
                value={formData.total_return_value || ''}
                onChange={(e) =>
                  setFormData({ ...formData, total_return_value: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <select
                value={formData.reason || 'other'}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value as any })}
                className="w-full rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {Object.entries(RETURN_REASONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={formData.refund_method || 'cash'}
                onChange={(e) => setFormData({ ...formData, refund_method: e.target.value as any })}
                className="w-full rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {Object.entries(REFUND_METHODS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="ملاحظات (اختياري)"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-teal-600 py-2.5 font-black text-white hover:bg-teal-500 transition"
                >
                  حفظ المرتجع
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 font-black text-white hover:bg-slate-700/50 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
