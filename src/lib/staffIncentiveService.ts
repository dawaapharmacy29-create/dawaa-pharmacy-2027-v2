import { getCurrentCycle, type PharmacyCycle } from "@/lib/pharmacy-cycle";
import { calculateIncentive, STARTING_POINTS, MAX_BASE_INCENTIVE } from "@/lib/points";
import {
  canonicalMaxPoints,
  canonicalSnapshotPoints,
  formatTransactionSource,
  getTransactionShortReason,
  isApprovedPointRecord,
  isRecordInCycle,
  pointRecordDelta,
  pointRecordStatus,
  recordBelongsToStaff,
  type PointLedgerRecord,
  type StaffLedgerTarget,
} from "@/lib/pointsLedger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { TABLES } from "@/lib/supabaseTables";

export type StaffIncentiveTransaction = PointLedgerRecord & {
  normalizedDelta: number;
  absPoints: number;
  sourceLabel: string;
  shortReason: string;
};

export type StaffCycleIncentive = {
  staff: StaffLedgerTarget;
  cycleStart: string;
  cycleEnd: string;
  startingPoints: number;
  approvedRewardPoints: number;
  approvedDeductionPoints: number;
  pendingRewardPoints: number;
  pendingDeductionPoints: number;
  finalPoints: number;
  incentiveValue: number;
  maxIncentiveValue: number;
  progressPercent: number;
  rewardTransactions: StaffIncentiveTransaction[];
  deductionTransactions: StaffIncentiveTransaction[];
  pendingTransactions: StaffIncentiveTransaction[];
  sourceBreakdown: Array<{ source: string; points: number; count: number }>;
  warnings: string[];
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeName(value: unknown) {
  return String(value || "")
    .replace(/[\u0623\u0625\u0622]/g, "ا")
    .replace(/\u0629/g, "ه")
    .replace(/^(\u062f|dr|doctor)\s*\/?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function uniqById(rows: PointLedgerRecord[]) {
  const map = new Map<string, PointLedgerRecord>();
  for (const row of rows) {
    const key = String(row.id || `${row.source_type || row.source}:${row.source_id || ""}:${row.created_at || ""}:${row.points_delta || row.points || ""}`);
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function normalizeTxn(row: PointLedgerRecord): StaffIncentiveTransaction {
  const delta = pointRecordDelta(row);
  return {
    ...row,
    normalizedDelta: delta,
    absPoints: Math.abs(delta),
    sourceLabel: formatTransactionSource(row),
    shortReason: getTransactionShortReason(row),
  };
}

export function calculateStaffCycleIncentiveFromRows(args: {
  staff: StaffLedgerTarget;
  records: PointLedgerRecord[];
  cycle?: PharmacyCycle;
}): StaffCycleIncentive {
  const cycle = args.cycle || getCurrentCycle();
  const staff = args.staff;
  const startingPoints = canonicalSnapshotPoints(staff);
  const maxPoints = canonicalMaxPoints(staff);
  const warnings: string[] = [];

  const staffRows = uniqById(args.records)
    .filter((row) => recordBelongsToStaff(row, staff))
    .filter((row) => isRecordInCycle(row, cycle))
    .map(normalizeTxn);

  const approved = staffRows.filter((row) => isApprovedPointRecord(row));
  const pending = staffRows.filter((row) => pointRecordStatus(row) === "pending");
  const rejected = staffRows.filter((row) => ["rejected", "cancelled"].includes(pointRecordStatus(row)));
  if (rejected.length) warnings.push(`${rejected.length} سجل مرفوض/ملغي لا يدخل في الحافز.`);

  const rewardTransactions = approved.filter((row) => row.normalizedDelta > 0);
  const deductionTransactions = approved.filter((row) => row.normalizedDelta < 0);
  const pendingTransactions = pending;
  const approvedRewardPoints = rewardTransactions.reduce((sum, row) => sum + row.absPoints, 0);
  const approvedDeductionPoints = deductionTransactions.reduce((sum, row) => sum + row.absPoints, 0);
  const pendingRewardPoints = pending.filter((row) => row.normalizedDelta > 0).reduce((sum, row) => sum + row.absPoints, 0);
  const pendingDeductionPoints = pending.filter((row) => row.normalizedDelta < 0).reduce((sum, row) => sum + row.absPoints, 0);
  const finalPoints = Math.max(0, startingPoints + approvedRewardPoints - approvedDeductionPoints);
  const cappedPoints = Math.min(finalPoints, STARTING_POINTS);
  if (finalPoints > STARTING_POINTS) warnings.push("النقاط النهائية أعلى من 500؛ الحافز النقدي الحالي مضبوط بسقف 1500 جنيه.");

  const sourceMap = new Map<string, { source: string; points: number; count: number }>();
  for (const row of approved) {
    const source = row.sourceLabel || "سجل نقاط";
    const current = sourceMap.get(source) || { source, points: 0, count: 0 };
    current.points += row.normalizedDelta;
    current.count += 1;
    sourceMap.set(source, current);
  }

  return {
    staff,
    cycleStart: dateKey(cycle.start),
    cycleEnd: dateKey(cycle.end),
    startingPoints,
    approvedRewardPoints,
    approvedDeductionPoints,
    pendingRewardPoints,
    pendingDeductionPoints,
    finalPoints,
    incentiveValue: calculateIncentive(cappedPoints),
    maxIncentiveValue: MAX_BASE_INCENTIVE,
    progressPercent: maxPoints ? Math.min(100, (finalPoints / maxPoints) * 100) : 0,
    rewardTransactions,
    deductionTransactions,
    pendingTransactions,
    sourceBreakdown: [...sourceMap.values()],
    warnings,
  };
}

export async function getStaffCycleIncentive(args: {
  staffId?: string | null;
  staffName?: string | null;
  branch?: string | null;
  cycleStart?: string;
  cycleEnd?: string;
}): Promise<StaffCycleIncentive> {
  if (!isSupabaseConfigured) throw new Error("إعدادات Supabase غير موجودة.");
  const cycle = getCurrentCycle();
  const staffQuery = args.staffId
    ? supabase.from("staff").select("id,name,points,max_points,branch").eq("id", args.staffId).maybeSingle()
    : supabase.from("staff").select("id,name,points,max_points,branch").eq("name", args.staffName || "").maybeSingle();
  const { data: staffData, error: staffError } = await staffQuery;
  if (staffError) throw new Error(staffError.message);
  const staff = (staffData || {
    id: args.staffId || null,
    name: args.staffName || "غير محدد",
    branch: args.branch || null,
    points: STARTING_POINTS,
    max_points: STARTING_POINTS,
  }) as StaffLedgerTarget;

  const name = String(staff.name || args.staffName || "");
  const normalized = normalizeName(name);
  const [byId, byEmployeeId, byName] = await Promise.all([
    staff.id ? supabase.from(TABLES.employeeTransactions).select("*").eq("staff_id", staff.id).limit(300) : Promise.resolve({ data: [], error: null } as any),
    staff.id ? supabase.from(TABLES.employeeTransactions).select("*").eq("employee_id", staff.id).limit(300) : Promise.resolve({ data: [], error: null } as any),
    name ? supabase.from(TABLES.employeeTransactions).select("*").eq("employee_name", name).limit(300) : Promise.resolve({ data: [], error: null } as any),
  ]);
  const rows = [...(byId.data || []), ...(byEmployeeId.data || []), ...(byName.data || [])] as PointLedgerRecord[];
  const result = calculateStaffCycleIncentiveFromRows({ staff, records: rows, cycle });
  if (normalized && !rows.length) result.warnings.push(`لم يتم العثور على سجلات نقاط باسم ${name}.`);
  return result;
}

export async function getStaffIncentiveSummaryForCycle(args: {
  cycle?: PharmacyCycle;
  branch?: string | null;
}) {
  const cycle = args.cycle || getCurrentCycle();
  let staffQuery = supabase.from("staff").select("id,name,points,max_points,branch").limit(500);
  if (args.branch && args.branch !== "الكل") staffQuery = staffQuery.eq("branch", args.branch);
  const [staffResult, recordsResult] = await Promise.all([
    staffQuery,
    supabase.from(TABLES.employeeTransactions).select("*").limit(5000),
  ]);
  if (staffResult.error) throw new Error(staffResult.error.message);
  if (recordsResult.error) throw new Error(recordsResult.error.message);
  return ((staffResult.data || []) as StaffLedgerTarget[]).map((staff) =>
    calculateStaffCycleIncentiveFromRows({
      staff,
      records: (recordsResult.data || []) as PointLedgerRecord[],
      cycle,
    }),
  );
}
