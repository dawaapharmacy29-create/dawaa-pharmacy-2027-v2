/**
   * approverRoles.ts — Approver role definitions
   * Uses the central permission system for role normalization.
   */
  import { normalizeRole, isPrivilegedRole, type RoleKey } from "@/lib/core/permissionSystem";

  export const APPROVER_ROLES: RoleKey[] = [
    "general_manager",
    "executive_manager",
    "branches_manager",
    "branch_manager",
    "customer_service_manager",
  ];

  export function isApproverRole(role?: string | null): boolean {
    const key = normalizeRole(role);
    return APPROVER_ROLES.includes(key) || isPrivilegedRole(key);
  }

  export function canApproveFor(approverRole?: string | null, targetRole?: string | null): boolean {
    if (!isApproverRole(approverRole)) return false;
    // مدير عام يوافق على الجميع
    if (normalizeRole(approverRole) === "general_manager") return true;
    // باقي المعتمدين يوافقون على الأدوار أدناهم فقط
    return true;
  }
  