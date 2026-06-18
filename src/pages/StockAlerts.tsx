import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, PackageSearch, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CommandHeader, SectionState } from '@/components/command/CommandUI';

interface StockAlert {
  medicine_name: string;
  branch: string;
  current_stock: number;
  avg_daily_usage: number;
  days_remaining: number;
  last_order_date: string | null;
  alert_level: 'critical' | 'warning' | 'ok';
  suggested_order_qty: number;
}

export default function StockAlerts() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'warning'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('stock_reorder_alerts')
        .select('*')
        .order('alert_level', { ascending: true });

      if (err) throw err;
      setAlerts((data || []) as StockAlert[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل التنبيهات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const critical = alerts.filter((a) => a.alert_level === 'critical').length;
  const warning = alerts.filter((a) => a.alert_level === 'warning').length;

  const filtered = alerts.filter((a) => filterLevel === 'all' || a.alert_level === filterLevel);

  return (
    <div className="space-y-5 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <CommandHeader title="تنبيهات المخزون" subtitle="أدوية بحاجة لإعادة طلب فوري" />
        <button
          onClick={() => void load()}
          className="rounded-xl p-2 hover:bg-slate-700/50 transition"
          title="تحديث البيانات"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* تنبيه عاجل */}
      {critical > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-black text-red-300">{critical} دواء يحتاج طلب عاجل الآن</p>
            <p className="text-xs text-red-400/70">مخزون صفر أو أقل من 3 أيام</p>
          </div>
        </div>
      )}

      {/* فلاتر */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'critical', 'warning'] as const).map((level) => (
          <button
            key={level}
            onClick={() => setFilterLevel(level)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
              filterLevel === level ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {level === 'all'
              ? `الكل (${alerts.length})`
              : level === 'critical'
                ? `🚨 حرج (${critical})`
                : `⚠️ تحذير (${warning})`}
          </button>
        ))}
      </div>

      {/* القائمة */}
      <SectionState loading={loading} error={error} empty={!alerts.length}>
        <div className="space-y-2">
          {filtered.map((alert, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-4 transition ${
                alert.alert_level === 'critical'
                  ? 'border-red-500/30 bg-red-500/10 hover:border-red-500/50'
                  : 'border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  {alert.alert_level === 'critical' ? (
                    <AlertTriangle size={20} className="text-red-400 mt-0.5" />
                  ) : (
                    <PackageSearch size={20} className="text-amber-400 mt-0.5" />
                  )}
                  <div>
                    <p className="font-black text-white">{alert.medicine_name}</p>
                    <p className="text-xs text-slate-400">
                      {alert.branch} · متبقي {alert.current_stock} وحدة
                      {alert.avg_daily_usage > 0 && ` · ${alert.days_remaining} يوم`}
                    </p>
                    {alert.last_order_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        آخر طلب: {new Date(alert.last_order_date).toLocaleDateString('ar-EG')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">كمية مقترحة</p>
                  <p className="font-black text-teal-400">{alert.suggested_order_qty} وحدة</p>
                  <p className="text-xs text-slate-500 mt-1">
                    استهلاك يومي: {alert.avg_daily_usage.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionState>
    </div>
  );
}
