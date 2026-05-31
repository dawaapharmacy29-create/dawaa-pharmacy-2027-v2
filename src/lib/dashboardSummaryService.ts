import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const ALL_BRANCHES = "all";
export const ALL_BRANCHES_LABEL = "كل الفروع";

export type SourceHealth = {
  rpcAvailable: boolean;
  salesSummaryAvailable: boolean;
  staffSummaryAvailable: boolean;
  deliverySummaryAvailable: boolean;
  followupSummaryAvailable: boolean;
  customerSummaryAvailable: boolean;
  notificationsAvailable: boolean;
  activityLogAvailable: boolean;
};

export type DataHealth = {
  invoicesWithoutCustomerCode: number | null;
  invoicesWithoutCustomerPhone: number | null;
  invoicesWithoutSellerName: number | null;
  invoicesWithoutBranch: number | null;
  lastInvoiceDate: string | null;
  latestImportBatch: string | null;
  error: string | null;
};

export type DashboardKpis = {
  netSales: number | null;
  invoicesCount: number | null;
  avgInvoice: number | null;
  uniqueCustomers: number | null;
  activeDoctors: number | null;
  activeDelivery: number | null;
  dueFollowups: number | null;
  overdueFollowups: number | null;
  tasksDueToday: number | null;
  invoicesWithoutCustomerCode: number | null;
  invoicesWithoutSellerName: number | null;
  invoicesWithoutBranch: number | null;
};

export type CustomerIntelligence = {
  importantNeedFollowup: number | null;
  stoppedCustomers: number | null;
  atRiskCustomers: number | null;
  customersWithoutValidPhone: number | null;
  incompleteCustomers: number | null;
  overdueFollowups: number | null;
  needsManagerFollowups: number | null;
  error: string | null;
};

export type SalesDailySummary = {
  saleDate: string;
  branch: string | null;
  shift: string | null;
  netTotal: number;
  invoicesCount: number;
  avgInvoice: number;
  uniqueCustomers: number;
};

export type StaffSalesSummary = {
  saleDate: string;
  sellerName: string | null;
  branch: string | null;
  netTotal: number;
  invoicesCount: number;
  avgInvoice: number;
  uniqueCustomers: number;
};

export type DeliveryPerformanceSummary = {
  saleDate: string;
  deliveryStaff: string | null;
  branch: string | null;
  deliveriesCount: number;
  deliverySalesTotal: number;
  courierCashTotal: number;
  extraFeesTotal: number;
};

export type FollowupPerformanceSummary = {
  followupDate: string;
  branch: string | null;
  responsibleName: string | null;
  assignedCount: number;
  completedCount: number;
  overdueCount: number;
  noAnswerCount: number;
  postponedCount: number;
  needsManagerCount: number;
  purchaseAfterFollowupAmount: number;
};

export type DashboardNotification = {
  id: string;
  title: string | null;
  message: string | null;
  priority: string | null;
  createdAt: string | null;
  routePath: string | null;
};

export type DashboardActivity = {
  id: string;
  action: string | null;
  description: string | null;
  userName: string | null;
  branch: string | null;
  createdAt: string | null;
  staffId: string | null;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
  routePath: string | null;
};

export type SourceError = {
  source: string;
  message: string;
};

export type DashboardSummary = {
  kpis: DashboardKpis | null;
  dailySales: SalesDailySummary[];
  staffSales: StaffSalesSummary[];
  deliveryPerformance: DeliveryPerformanceSummary[];
  followupPerformance: FollowupPerformanceSummary[];
  notifications: DashboardNotification[];
  activity: DashboardActivity[];
  customerIntelligence: CustomerIntelligence;
  dataHealth: DataHealth;
  sourceHealth: SourceHealth;
  errors: SourceError[];
};

type Row = Record<string, unknown>;

const SOURCE_HEALTH_EMPTY: SourceHealth = {
  rpcAvailable: false,
  salesSummaryAvailable: false,
  staffSummaryAvailable: false,
  deliverySummaryAvailable: false,
  followupSummaryAvailable: false,
  customerSummaryAvailable: false,
  notificationsAvailable: false,
  activityLogAvailable: false,
};

const DATA_HEALTH_EMPTY: DataHealth = {
  invoicesWithoutCustomerCode: null,
  invoicesWithoutCustomerPhone: null,
  invoicesWithoutSellerName: null,
  invoicesWithoutBranch: null,
  lastInvoiceDate: null,
  latestImportBatch: null,
  error: null,
};

const CUSTOMER_INTELLIGENCE_EMPTY: CustomerIntelligence = {
  importantNeedFollowup: null,
  stoppedCustomers: null,
  atRiskCustomers: null,
  customersWithoutValidPhone: null,
  incompleteCustomers: null,
  overdueFollowups: null,
  needsManagerFollowups: null,
  error: null,
};

function toNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readFirst(row: Row | null | undefined, keys: string[], fallback: unknown = null) {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function dayAfter(date: string) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function isAllBranches(branch?: string | null) {
  return !branch || branch === ALL_BRANCHES || branch === ALL_BRANCHES_LABEL || branch === "الكل";
}

function addError(errors: SourceError[], source: string, message: string) {
  errors.push({ source, message });
}

function normalizeRpcKpis(data: unknown): DashboardKpis | null {
  const row = Array.isArray(data) ? (data[0] as Row | undefined) : (data as Row | null);
  if (!row) return null;
  return {
    netSales: toNullableNumber(readFirst(row, ["net_total", "net_sales", "period_net_sales"])),
    invoicesCount: toNullableNumber(readFirst(row, ["invoices_count", "invoice_count", "total_invoices"])),
    avgInvoice: toNullableNumber(readFirst(row, ["avg_invoice", "average_invoice"])),
    uniqueCustomers: toNullableNumber(readFirst(row, ["unique_customers", "customers_count", "purchasing_customers"])),
    activeDoctors: toNullableNumber(readFirst(row, ["active_doctors", "active_sellers", "doctors_count"])),
    activeDelivery: toNullableNumber(readFirst(row, ["active_delivery", "active_delivery_staff", "delivery_staff_count"])),
    dueFollowups: toNullableNumber(readFirst(row, ["due_followups", "followups_due", "due_today"])),
    overdueFollowups: toNullableNumber(readFirst(row, ["overdue_followups", "followups_overdue", "overdue_count"])),
    tasksDueToday: toNullableNumber(readFirst(row, ["tasks_due_today", "due_tasks"])),
    invoicesWithoutCustomerCode: toNullableNumber(readFirst(row, ["invoices_without_customer_code"])),
    invoicesWithoutSellerName: toNullableNumber(readFirst(row, ["invoices_without_seller_name"])),
    invoicesWithoutBranch: toNullableNumber(readFirst(row, ["invoices_without_branch"])),
  };
}

async function fetchKpis(startDate: string, endDate: string, branch: string, errors: SourceError[], health: SourceHealth) {
  const { data, error } = await supabase.rpc("get_dashboard_kpis", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_branch: isAllBranches(branch) ? null : branch,
  });

  if (error) {
    addError(errors, "get_dashboard_kpis", error.message);
    return null;
  }

  health.rpcAvailable = true;
  return normalizeRpcKpis(data);
}

async function fetchSummaryRows(args: {
  table: string;
  dateColumn: string;
  startDate: string;
  endDate: string;
  branch: string;
  limit: number;
  errors: SourceError[];
  health: SourceHealth;
  healthKey: keyof SourceHealth;
}) {
  let query = supabase
    .from(args.table)
    .select("*")
    .gte(args.dateColumn, args.startDate)
    .lt(args.dateColumn, dayAfter(args.endDate))
    .limit(args.limit);

  if (!isAllBranches(args.branch)) query = query.eq("branch", args.branch);

  const { data, error } = await query;
  if (error) {
    addError(args.errors, args.table, error.message);
    return [];
  }

  args.health[args.healthKey] = true;
  return (data ?? []) as Row[];
}

async function fetchOrderedRows(
  table: string,
  orderColumn: string,
  limit: number,
  errors: SourceError[],
  health: SourceHealth,
  healthKey: keyof SourceHealth,
) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) {
    addError(errors, table, error.message);
    return [];
  }

  health[healthKey] = true;
  return (data ?? []) as Row[];
}

async function countMissing(column: string, startDate: string, endDate: string, branch: string) {
  let query = supabase
    .from("sales_invoices")
    .select("id", { count: "exact", head: true })
    .gte("invoice_date", startDate)
    .lt("invoice_date", dayAfter(endDate))
    .or(`${column}.is.null,${column}.eq.`);

  if (!isAllBranches(branch)) query = query.eq("branch", branch);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchDataHealth(startDate: string, endDate: string, branch: string): Promise<DataHealth> {
  try {
    let lastInvoiceQuery = supabase
      .from("sales_invoices")
      .select("invoice_date,import_batch")
      .gte("invoice_date", startDate)
      .lt("invoice_date", dayAfter(endDate))
      .order("invoice_date", { ascending: false })
      .limit(1);

    let latestBatchQuery = supabase
      .from("sales_invoices")
      .select("import_batch,created_at")
      .not("import_batch", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!isAllBranches(branch)) {
      lastInvoiceQuery = lastInvoiceQuery.eq("branch", branch);
      latestBatchQuery = latestBatchQuery.eq("branch", branch);
    }

    const [withoutCode, withoutPhone, withoutSeller, withoutBranch, lastInvoice, latestBatch] = await Promise.all([
      countMissing("customer_code", startDate, endDate, branch),
      countMissing("customer_phone", startDate, endDate, branch),
      countMissing("seller_name", startDate, endDate, branch),
      countMissing("branch", startDate, endDate, branch),
      lastInvoiceQuery,
      latestBatchQuery,
    ]);

    if (lastInvoice.error) throw new Error(lastInvoice.error.message);
    if (latestBatch.error) throw new Error(latestBatch.error.message);

    const lastInvoiceRow = (lastInvoice.data?.[0] ?? null) as Row | null;
    const latestBatchRow = (latestBatch.data?.[0] ?? null) as Row | null;

    return {
      invoicesWithoutCustomerCode: withoutCode,
      invoicesWithoutCustomerPhone: withoutPhone,
      invoicesWithoutSellerName: withoutSeller,
      invoicesWithoutBranch: withoutBranch,
      lastInvoiceDate: readFirst(lastInvoiceRow, ["invoice_date"], null) as string | null,
      latestImportBatch: readFirst(latestBatchRow, ["import_batch"], null) as string | null,
      error: null,
    };
  } catch (error) {
    return {
      ...DATA_HEALTH_EMPTY,
      error: error instanceof Error ? error.message : "غير متاح حاليًا",
    };
  }
}

async function countRows(table: string, build: (query: any) => any) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  query = build(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

async function fetchCustomerIntelligence(branch: string, errors: SourceError[], health: SourceHealth): Promise<CustomerIntelligence> {
  try {
    const today = startOfTodayIso();
    const applyBranch = (query: any) => (!isAllBranches(branch) ? query.eq("branch", branch) : query);
    const [
      importantNeedFollowup,
      stoppedCustomers,
      atRiskCustomers,
      customersWithoutValidPhone,
      incompleteCustomers,
      overdueFollowups,
      needsManagerFollowups,
    ] = await Promise.all([
      countRows("customer_metrics_summary", (query) =>
        applyBranch(query.in("segment", ["مهم جدًا", "مهم"]).in("customer_status", ["مهدد بالتوقف", "متوقف"])),
      ),
      countRows("customer_metrics_summary", (query) => applyBranch(query.eq("customer_status", "متوقف"))),
      countRows("customer_metrics_summary", (query) => applyBranch(query.eq("customer_status", "مهدد بالتوقف"))),
      countRows("customer_metrics_summary", (query) => applyBranch(query.or("customer_phone.is.null,customer_phone.eq."))),
      countRows("customer_metrics_summary", (query) => applyBranch(query.or("customer_code.is.null,customer_code.eq.,customer_name.is.null,customer_name.eq."))),
      countRows("daily_followups", (query) =>
        applyBranch(query.lt("followup_datetime", today).is("completed_at", null).is("postponed_until", null)),
      ),
      countRows("daily_followups", (query) => applyBranch(query.eq("needs_manager", true).is("completed_at", null))),
    ]);

    health.customerSummaryAvailable = true;
    return {
      importantNeedFollowup,
      stoppedCustomers,
      atRiskCustomers,
      customersWithoutValidPhone,
      incompleteCustomers,
      overdueFollowups,
      needsManagerFollowups,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "غير متاح حاليًا";
    addError(errors, "customer_metrics_summary", message);
    return { ...CUSTOMER_INTELLIGENCE_EMPTY, error: message };
  }
}

function mapDaily(row: Row): SalesDailySummary {
  return {
    saleDate: String(readFirst(row, ["sale_date"], "") || "").slice(0, 10),
    branch: readFirst(row, ["branch"], null) as string | null,
    shift: readFirst(row, ["shift_name", "shift"], null) as string | null,
    netTotal: toNumber(readFirst(row, ["net_total", "net_sales"])),
    invoicesCount: toNumber(readFirst(row, ["invoices_count", "invoice_count"])),
    avgInvoice: toNumber(readFirst(row, ["avg_invoice", "average_invoice"])),
    uniqueCustomers: toNumber(readFirst(row, ["unique_customers", "customers_count"])),
  };
}

function mapStaff(row: Row): StaffSalesSummary {
  return {
    saleDate: String(readFirst(row, ["sale_date"], "") || "").slice(0, 10),
    sellerName: readFirst(row, ["seller_name"], null) as string | null,
    branch: readFirst(row, ["branch"], null) as string | null,
    netTotal: toNumber(readFirst(row, ["net_total", "net_sales"])),
    invoicesCount: toNumber(readFirst(row, ["invoices_count", "invoice_count"])),
    avgInvoice: toNumber(readFirst(row, ["avg_invoice", "average_invoice"])),
    uniqueCustomers: toNumber(readFirst(row, ["unique_customers", "customers_count"])),
  };
}

function mapDelivery(row: Row): DeliveryPerformanceSummary {
  return {
    saleDate: String(readFirst(row, ["sale_date"], "") || "").slice(0, 10),
    deliveryStaff: readFirst(row, ["delivery_staff"], null) as string | null,
    branch: readFirst(row, ["branch"], null) as string | null,
    deliveriesCount: toNumber(readFirst(row, ["deliveries_count", "delivery_count", "invoices_count"])),
    deliverySalesTotal: toNumber(readFirst(row, ["delivery_sales_total", "net_total", "net_sales"])),
    courierCashTotal: toNumber(readFirst(row, ["courier_cash_total", "courier_cash"])),
    extraFeesTotal: toNumber(readFirst(row, ["extra_fees_total", "extra_fees"])),
  };
}

function mapFollowup(row: Row): FollowupPerformanceSummary {
  return {
    followupDate: String(readFirst(row, ["followup_date"], "") || "").slice(0, 10),
    branch: readFirst(row, ["branch"], null) as string | null,
    responsibleName: readFirst(row, ["responsible_name", "assigned_to", "staff_name"], null) as string | null,
    assignedCount: toNumber(readFirst(row, ["assigned_count", "total_assigned"])),
    completedCount: toNumber(readFirst(row, ["completed_count", "done_count"])),
    overdueCount: toNumber(readFirst(row, ["overdue_count"])),
    noAnswerCount: toNumber(readFirst(row, ["no_answer_count"])),
    postponedCount: toNumber(readFirst(row, ["postponed_count"])),
    needsManagerCount: toNumber(readFirst(row, ["needs_manager_count"])),
    purchaseAfterFollowupAmount: toNumber(readFirst(row, ["purchase_after_followup_amount", "purchase_amount"])),
  };
}

function mapNotification(row: Row): DashboardNotification {
  return {
    id: String(readFirst(row, ["id"], crypto.randomUUID())),
    title: readFirst(row, ["title", "notification_title"], null) as string | null,
    message: readFirst(row, ["message", "body", "description"], null) as string | null,
    priority: readFirst(row, ["priority", "severity"], null) as string | null,
    createdAt: readFirst(row, ["created_at"], null) as string | null,
    routePath: readFirst(row, ["route_path", "link", "url"], null) as string | null,
  };
}

function mapActivity(row: Row): DashboardActivity {
  return {
    id: String(readFirst(row, ["id"], crypto.randomUUID())),
    action: readFirst(row, ["action"], null) as string | null,
    description: readFirst(row, ["description"], null) as string | null,
    userName: readFirst(row, ["user_name"], null) as string | null,
    branch: readFirst(row, ["branch"], null) as string | null,
    createdAt: readFirst(row, ["created_at"], null) as string | null,
    staffId: readFirst(row, ["staff_id"], null) as string | null,
    targetType: readFirst(row, ["target_type"], null) as string | null,
    targetId: readFirst(row, ["target_id"], null) as string | null,
    details: readFirst(row, ["details"], null),
    routePath: readFirst(row, ["route_path"], null) as string | null,
  };
}

export async function fetchExecutiveDashboardSummary(params: {
  startDate: string;
  endDate: string;
  branch: string;
}): Promise<DashboardSummary> {
  if (!isSupabaseConfigured) {
    return {
      kpis: null,
      dailySales: [],
      staffSales: [],
      deliveryPerformance: [],
      followupPerformance: [],
      notifications: [],
      activity: [],
      customerIntelligence: { ...CUSTOMER_INTELLIGENCE_EMPTY, error: "إعدادات Supabase غير موجودة." },
      dataHealth: { ...DATA_HEALTH_EMPTY, error: "إعدادات Supabase غير موجودة." },
      sourceHealth: SOURCE_HEALTH_EMPTY,
      errors: [{ source: "Supabase", message: "إعدادات Supabase غير موجودة." }],
    };
  }

  const errors: SourceError[] = [];
  const sourceHealth: SourceHealth = { ...SOURCE_HEALTH_EMPTY };
  const { startDate, endDate, branch } = params;

  const [kpis, dailyRows, staffRows, deliveryRows, followupRows, notificationsRows, activityRows, dataHealth, customerIntelligence] = await Promise.all([
    fetchKpis(startDate, endDate, branch, errors, sourceHealth),
    fetchSummaryRows({
      table: "sales_daily_summary",
      dateColumn: "sale_date",
      startDate,
      endDate,
      branch,
      limit: 500,
      errors,
      health: sourceHealth,
      healthKey: "salesSummaryAvailable",
    }),
    fetchSummaryRows({
      table: "staff_sales_summary",
      dateColumn: "sale_date",
      startDate,
      endDate,
      branch,
      limit: 200,
      errors,
      health: sourceHealth,
      healthKey: "staffSummaryAvailable",
    }),
    fetchSummaryRows({
      table: "delivery_performance_summary",
      dateColumn: "sale_date",
      startDate,
      endDate,
      branch,
      limit: 200,
      errors,
      health: sourceHealth,
      healthKey: "deliverySummaryAvailable",
    }),
    fetchSummaryRows({
      table: "followup_performance_summary",
      dateColumn: "followup_date",
      startDate,
      endDate,
      branch,
      limit: 200,
      errors,
      health: sourceHealth,
      healthKey: "followupSummaryAvailable",
    }),
    fetchOrderedRows("notifications", "created_at", 10, errors, sourceHealth, "notificationsAvailable"),
    fetchOrderedRows("activity_log", "created_at", 12, errors, sourceHealth, "activityLogAvailable"),
    fetchDataHealth(startDate, endDate, branch),
    fetchCustomerIntelligence(branch, errors, sourceHealth),
  ]);

  return {
    kpis,
    dailySales: dailyRows.map(mapDaily).filter((row) => row.saleDate),
    staffSales: staffRows.map(mapStaff).filter((row) => row.sellerName),
    deliveryPerformance: deliveryRows.map(mapDelivery).filter((row) => row.deliveryStaff),
    followupPerformance: followupRows.map(mapFollowup).filter((row) => row.followupDate),
    notifications: notificationsRows.map(mapNotification),
    activity: activityRows.map(mapActivity),
    customerIntelligence,
    dataHealth,
    sourceHealth,
    errors,
  };
}
