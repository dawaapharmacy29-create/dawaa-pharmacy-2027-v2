import { calculateStaffCycleIncentiveFromRows } from './staffIncentiveService';
import { type PointLedgerRecord, type StaffLedgerTarget } from './pointsLedger';
import { getCurrentCycle } from './pharmacy-cycle';
import { OPERATING_POLICY_2027 } from './operatingPolicy';

export interface MonthlyPDFReportData {
  staff_id: string;
  staff_name: string;
  branch: string;
  cycle_start: string;
  cycle_end: string;
  starting_points: number;
  final_points: number;
  incentive_value: number;
  max_incentive_value: number;
  progress_percent: number;
  distinction_points: number;
  reward_transactions: Array<{
    title: string;
    points: number;
    date: string;
    source: string;
  }>;
  deduction_transactions: Array<{
    title: string;
    points: number;
    date: string;
    source: string;
  }>;
  pending_transactions: Array<{
    title: string;
    points: number;
    date: string;
    source: string;
  }>;
  pillar_scores: Array<{
    pillar: string;
    score: number;
    max_score: number;
    description: string;
  }>;
  permissions_used: number;
  permissions_remaining: number;
  permission_deduction: number;
  repeat_errors: Array<{
    rule_title: string;
    count: number;
    total_deduction: number;
  }>;
  classification_violations: number;
  classification_deduction: number;
  operating_policy_summary: string;
}

/**
 * خدمة إنشاء تقرير PDF الشهري
 */
export class MonthlyPDFReportService {
  /**
   * إنشاء بيانات التقرير الشهري لموظف
   */
  static async generateMonthlyReportData(staff: StaffLedgerTarget, records: PointLedgerRecord[]): Promise<MonthlyPDFReportData> {
    const cycle = getCurrentCycle();
    const incentiveData = calculateStaffCycleIncentiveFromRows({ staff, records, cycle });

    // تحويل المعاملات إلى تنسيق مناسب للتقرير
    const rewardTransactions = incentiveData.rewardTransactions.map(t => ({
      title: t.shortReason || t.reason || 'مكافأة',
      points: t.absPoints,
      date: (t.created_at || '').slice(0, 10),
      source: t.sourceLabel || 'غير محدد',
    }));

    const deductionTransactions = incentiveData.deductionTransactions.map(t => ({
      title: t.shortReason || t.reason || 'خصم',
      points: t.absPoints,
      date: (t.created_at || '').slice(0, 10),
      source: t.sourceLabel || 'غير محدد',
    }));

    const pendingTransactions = incentiveData.pendingTransactions.map(t => ({
      title: t.shortReason || t.reason || 'معلق',
      points: t.absPoints,
      date: (t.created_at || '').slice(0, 10),
      source: t.sourceLabel || 'غير محدد',
    }));

    // حساب درجات الأعمدة (محاكاة - يمكن تحسينها بالبيانات الفعلية)
    const pillarScores = [
      {
        pillar: 'خدمة العملاء والمتابعات',
        score: Math.min(100, (incentiveData.approvedRewardPoints / 200) * 100),
        max_score: 200,
        description: 'جودة التعامل، المتابعة، الشكاوى، ملاحظات العميل، ونجاح إعادة الشراء',
      },
      {
        pillar: 'الالتزام والتشغيل',
        score: Math.min(100, (incentiveData.approvedDeductionPoints < 50 ? 100 : 50)),
        max_score: 120,
        description: 'الحضور، الشيفت، التعليمات، التعاون، وإغلاق المهام اليومية',
      },
      {
        pillar: 'جودة البيع والتسجيل',
        score: Math.min(100, 80),
        max_score: 70,
        description: 'متوسط الفاتورة، التصنيف، دقة بيانات الفاتورة، وعدم إزعاج العميل',
      },
      {
        pillar: 'المخزون والرواكد واللستة',
        score: Math.min(100, 70),
        max_score: 70,
        description: 'تحريك الرواكد، أهداف اللستة، التسجيل بالفاتورة والعميل، وطلبات النواقص',
      },
      {
        pillar: 'استخدام السيستم والتطوير',
        score: Math.min(100, 60),
        max_score: 40,
        description: 'الالتزام بالتسجيل، جودة البيانات، المبادرات، وسجل الأنشطة',
      },
    ];

    // حساب الإذنات (محاكاة - يمكن تحسينها بالبيانات الفعلية)
    const permissions_used = 2; // مثال
    const permissions_remaining = 3 - permissions_used;
    const permission_deduction = permissions_used > 3 ? (permissions_used - 3) * 10 : 0;

    // حساب الأخطاء المتكررة (محاكاة - يمكن تحسينها بالبيانات الفعلية)
    const repeatErrors = [
      {
        rule_title: 'تأخير عن الشيفت',
        count: 2,
        total_deduction: 40,
      },
    ];

    // حساب انتهاكات التصنيف (محاكاة - يمكن تحسينها بالبيانات الفعلية)
    const classification_violations = 1;
    const classification_deduction = 15;

    // ملخص لائحة التشغيل
    const operating_policy_summary = OPERATING_POLICY_2027.sections
      .slice(0, 3)
      .map(s => `**${s.title}**\n${s.content.slice(0, 200)}...`)
      .join('\n\n');

    return {
      staff_id: staff.id,
      staff_name: staff.name,
      branch: (staff as any).branch || 'غير محدد',
      cycle_start: incentiveData.cycleStart,
      cycle_end: incentiveData.cycleEnd,
      starting_points: incentiveData.startingPoints,
      final_points: incentiveData.finalPoints,
      incentive_value: incentiveData.incentiveValue,
      max_incentive_value: incentiveData.maxIncentiveValue,
      progress_percent: incentiveData.progressPercent,
      distinction_points: incentiveData.distinctionPointsAbove500,
      reward_transactions: rewardTransactions,
      deduction_transactions: deductionTransactions,
      pending_transactions: pendingTransactions,
      pillar_scores: pillarScores,
      permissions_used: permissions_used,
      permissions_remaining: permissions_remaining,
      permission_deduction: permission_deduction,
      repeat_errors: repeatErrors,
      classification_violations: classification_violations,
      classification_deduction: classification_deduction,
      operating_policy_summary: operating_policy_summary,
    };
  }

  /**
   * إنشاء نص التقرير (يمكن استخدامه لإنشاء PDF)
   */
  static generateReportText(data: MonthlyPDFReportData): string {
    return `
# تقرير الأداء الشهري - ${data.staff_name}
## الفرع: ${data.branch}
## الدورة: ${data.cycle_start} إلى ${data.cycle_end}

---

## ملخص الأداء

- **النقاط البداية:** ${data.starting_points}
- **النقاط النهائية:** ${data.final_points}
- **نقاط التميز:** ${data.distinction_points}
- **الحافز الشهري:** ${data.incentive_value} جنيه (من أقصى ${data.max_incentive_value} جنيه)
- **نسبة الإنجاز:** ${data.progress_percent.toFixed(1)}%

---

## درجات الأعمدة

${data.pillar_scores.map(p => `
### ${p.pillar}
- الدرجة: ${p.score.toFixed(1)} / ${p.max_score}
- ${p.description}
`).join('\n')}

---

## المكافآت

${data.reward_transactions.length > 0 ? data.reward_transactions.map(t => `
- **${t.title}**: +${t.points} نقطة (${t.date}) - ${t.source}
`).join('\n') : 'لا توجد مكافآت في هذه الدورة'}

---

## الخصومات

${data.deduction_transactions.length > 0 ? data.deduction_transactions.map(t => `
- **${t.title}**: -${t.points} نقطة (${t.date}) - ${t.source}
`).join('\n') : 'لا توجد خصومات في هذه الدورة'}

---

## المعاملات المعلقة

${data.pending_transactions.length > 0 ? data.pending_transactions.map(t => `
- **${t.title}**: ${t.points} نقطة (${t.date}) - ${t.source}
`).join('\n') : 'لا توجد معاملات معلقة'}

---

## الإذنات

- **الإذنات المستخدمة:** ${data.permissions_used}
- **الإذنات المتبقية:** ${data.permissions_remaining}
- **خصم الإذنات:** ${data.permission_deduction} نقطة

---

## الأخطاء المتكررة

${data.repeat_errors.length > 0 ? data.repeat_errors.map(e => `
- **${e.rule_title}**: ${e.count} مرة، خصم ${e.total_deduction} نقطة
`).join('\n') : 'لا توجد أخطاء متكررة'}

---

## انتهاكات التصنيف

- **عدد الانتهاكات:** ${data.classification_violations}
- **خصم التصنيف:** ${data.classification_deduction} نقطة

---

## ملخص لائحة التشغيل

${data.operating_policy_summary}

---

*تم إنشاء هذا التقرير تلقائياً بواسطة نظام صيدليات دواء 2027*
    `.trim();
  }

  /**
   * تصدير التقرير كملف JSON
   */
  static exportReportAsJSON(data: MonthlyPDFReportData): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * تصدير التقرير كملف CSV
   */
  static exportReportAsCSV(data: MonthlyPDFReportData): string {
    const headers = [
      'Staff Name',
      'Branch',
      'Cycle Start',
      'Cycle End',
      'Starting Points',
      'Final Points',
      'Incentive Value',
      'Progress %',
      'Rewards Count',
      'Deductions Count',
      'Pending Count',
      'Permissions Used',
      'Classification Violations',
    ];

    const row = [
      data.staff_name,
      data.branch,
      data.cycle_start,
      data.cycle_end,
      data.starting_points,
      data.final_points,
      data.incentive_value,
      data.progress_percent.toFixed(1),
      data.reward_transactions.length,
      data.deduction_transactions.length,
      data.pending_transactions.length,
      data.permissions_used,
      data.classification_violations,
    ];

    return [headers.join(','), row.join(',')].join('\n');
  }
}
