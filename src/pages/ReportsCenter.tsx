import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CommandHeader } from '@/components/command/CommandUI';

type ReportType = 'daily_sales' | 'staff_payroll' | 'customer_stopped' | 'top_customers' | 'shortages_summary';

const REPORTS: { type: ReportType; label: string; icon: string; desc: string }[] = [
  { type: 'daily_sales', label: 'تقرير المبيعات اليومي', icon: '📊', desc: 'مبيعات كل فرع مع المقارنة بالأمس' },
  { type: 'staff_payroll', label: 'تقرير الرواتب والحوافز', icon: '💰', desc: 'رواتب + بونص + خصومات لكل موظف' },
  {
    type: 'customer_stopped',
    label: 'تقرير العملاء المتوقفين',
    icon: '👥',
    desc: 'عملاء لم يشتروا منذ 30+ يوم',
  },
  { type: 'top_customers', label: 'تقرير أفضل العملاء', icon: '⭐', desc: 'أعلى 50 عميل مبيعاً' },
  { type: 'shortages_summary', label: 'تقرير النواقص', icon: '📦', desc: 'أدوية ناقصة حسب الفرع' },
];

async function generateReport(type: ReportType, branch: string): Promise<void> {
  // This is a placeholder - actual PDF generation with jsPDF would go here
  // For now, we'll just prepare the data query
  try {
    let data: unknown[] = [];

    if (type === 'staff_payroll') {
      const { data: payrollData } = await supabase.from('staff_payroll_summary').select('*').order('staff_name');
      data = payrollData || [];
    } else if (type === 'customer_stopped') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: customerData } = await supabase
        .from('customer_metrics')
        .select('customer_name, phone, branch, last_invoice_date, total_invoices_count')
        .lt('last_invoice_date', thirtyDaysAgo)
        .order('last_invoice_date', { ascending: true })
        .limit(100);
      data = customerData || [];
    }

    // Generate CSV instead of PDF (simpler for now)
    if (data.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const csv = generateCSV(data as Record<string, unknown>[]);
    downloadFile(csv, `${type}-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success('جاري تنزيل التقرير...');
  } catch (error) {
    console.error('Error generating report:', error);
    toast.error('تعذر إنشاء التقرير');
  }
}

function generateCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => `"${row[h] || ''}"`).join(','));

  return [headers.join(','), ...rows].join('\n');
}

function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ReportsCenter() {
  const [loading, setLoading] = useState<ReportType | null>(null);
  const [branch, setBranch] = useState('الكل');

  async function handleGenerate(type: ReportType) {
    setLoading(type);
    try {
      await generateReport(type, branch);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-5 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <CommandHeader title="مركز التقارير" subtitle="تصدير تقارير CSV/PDF جاهزة للطباعة" />
        </div>
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option>الكل</option>
          <option>فرع 1</option>
          <option>فرع 2</option>
          <option>فرع 3</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <div
            key={report.type}
            className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 hover:border-teal-500/50 transition"
          >
            <div className="mb-3 flex items-start justify-between">
              <span className="text-3xl">{report.icon}</span>
              <FileText size={16} className="text-slate-500" />
            </div>
            <h3 className="font-black text-white">{report.label}</h3>
            <p className="mt-1 text-xs text-slate-400">{report.desc}</p>
            <button
              onClick={() => void handleGenerate(report.type)}
              disabled={loading === report.type}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-black text-white transition hover:bg-teal-500 disabled:opacity-50"
            >
              {loading === report.type ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> جاري الإنشاء...
                </>
              ) : (
                <>
                  <Download size={15} /> تنزيل CSV
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
