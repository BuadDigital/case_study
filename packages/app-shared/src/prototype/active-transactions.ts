import type { PageId } from "@platform/types";
import { CASE_STUDY_READY_NAV } from "@platform/types";
import type { WorkflowTask } from "@case-study/mfe";
import { PARTY_ACTIVE_TRANSACTIONS_NAV } from "./party-task-pages";

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
  return task.phase === "case-study";
}

export function filterTasksForCaseStudy(
  tasks: WorkflowTask[],
): WorkflowTask[] {
  return tasks.filter((t) => taskMatchesCaseStudy(t));
}

export const ACTIVE_TRANSACTIONS_NAV: ActiveTransactionNavItem[] = [
  ...CASE_STUDY_ACTIVE_TRANSACTIONS_NAV,
  ...PARTY_ACTIVE_TRANSACTIONS_NAV,
];

export function activeTransactionNavForRole(
  rolePages: PageId[],
): ActiveTransactionNavItem[] {
  return ACTIVE_TRANSACTIONS_NAV.filter((item) => rolePages.includes(item.id));
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
): boolean {
  return onTaskWork || isActiveTransactionPage(page);
}

export function activeTransactionPages(): PageId[] {
  return ACTIVE_TRANSACTIONS_NAV.map((n) => n.id);
}

export function isActiveTransactionPage(page: PageId): boolean {
  return activeTransactionPages().includes(page);
}
