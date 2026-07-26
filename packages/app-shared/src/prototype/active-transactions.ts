import type { PageId, RoleId } from "@platform/types";
import { CASE_STUDY_READY_NAV } from "@platform/types";
import type { WorkflowTask } from "@case-study/mfe";
import { PARTY_ACTIVE_TRANSACTIONS_NAV } from "./party-task-pages";
import { isInOrphanScreensSection } from "./orphan-screens-nav";

/** عناصر الشريط الجانبي — المعاملات النشطة */
export type ActiveTransactionNavItem = {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  /** Placeholder route — used by screen catalog until fully implemented */
  placeholder?: boolean;
};

/** دراسة الحالة — المعاملات النشطة (ready routes owned by @case-study/mfe) */
export const CASE_STUDY_ACTIVE_TRANSACTIONS_NAV: ActiveTransactionNavItem[] = [
  ...CASE_STUDY_READY_NAV.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    available: true,
  })),
  {
    id: "active-case-study",
    label: "دراسة حالة العقارات",
    icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    available: true,
  },
];

export function taskMatchesCaseStudy(task: WorkflowTask): boolean {
  if (task.kind !== "case-study-property") return false;
  return task.phase === "case-study" || task.phase === "done";
}

export function filterTasksForCaseStudy(
  tasks: WorkflowTask[],
): WorkflowTask[] {
  return tasks.filter((t) => taskMatchesCaseStudy(t));
}

/** فوترة الأتعاب — تحت المعاملات النشطة (المكتب الهندسي + المسؤول). */
export const ENGINEERING_FEES_ACTIVE_NAV_ITEM: ActiveTransactionNavItem = {
  id: "party-fees",
  label: "فوترة الأتعاب",
  icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  available: true,
};

/** أدوار تظهر فيها فوترة الأتعاب تحت المعاملات النشطة وليس تحت إعدادات النظام. */
export function isPartyFeesUnderActiveTransactions(role?: RoleId): boolean {
  return role === "engineering-office" || role === "cdo";
}

export const ACTIVE_TRANSACTIONS_NAV: ActiveTransactionNavItem[] = [
  ...CASE_STUDY_ACTIVE_TRANSACTIONS_NAV,
  ...PARTY_ACTIVE_TRANSACTIONS_NAV,
  ENGINEERING_FEES_ACTIVE_NAV_ITEM,
];

export function activeTransactionNavForRole(
  rolePages: PageId[],
  role?: RoleId,
): ActiveTransactionNavItem[] {
  return ACTIVE_TRANSACTIONS_NAV.filter((item) => {
    if (item.id === "party-fees") {
      return (
        isPartyFeesUnderActiveTransactions(role) &&
        rolePages.includes("party-fees")
      );
    }
    return rolePages.includes(item.id);
  });
}

export function isActiveTransactionPlaceholder(page: PageId): boolean {
  return ACTIVE_TRANSACTIONS_NAV.some((n) => n.id === page && n.placeholder);
}

export const ACTIVE_TRANSACTIONS_GROUP = "المعاملات النشطة";

export const ACTIVE_TRANSACTIONS_GROUP_ICON =
  "M22 12h-4l-3 9L9 3l-3 9H2";

export function isInActiveTransactionsSection(
  page: PageId,
  onTaskWork: boolean,
  role?: RoleId,
): boolean {
  // Orphan legacy lists (e.g. government-review) keep task work routes but
  // highlight under الشاشات اليتيمة, not المعاملات النشطة.
  if (isInOrphanScreensSection(page)) return false;
  if (page === "party-fees") {
    return isPartyFeesUnderActiveTransactions(role);
  }
  return onTaskWork || isActiveTransactionPage(page);
}

export function activeTransactionPages(): PageId[] {
  return ACTIVE_TRANSACTIONS_NAV.map((n) => n.id);
}

export function isActiveTransactionPage(page: PageId): boolean {
  return activeTransactionPages().includes(page);
}
