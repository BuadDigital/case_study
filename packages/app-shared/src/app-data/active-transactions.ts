import type { PageId, RoleId } from "@platform/types";
import { CASE_STUDY_READY_NAV } from "@platform/types";
import { isValuationDepositedForTask } from "../workflow/task-done";
import { isFoldedCaseStudyTask, type WorkflowTask } from "../workflow/task-types";
import { PARTY_ACTIVE_TRANSACTIONS_NAV } from "./party-task-pages";

/** Sidebar items under Active Transactions. */
export type ActiveTransactionNavItem = {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  /** Placeholder route — used by screen catalog until fully implemented */
  placeholder?: boolean;
};

/** Case study — Active Transactions (ready routes owned by @case-study/mfe). */
const CASE_STUDY_ACTIVE_TRANSACTIONS_NAV: ActiveTransactionNavItem[] = [
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
  {
    id: "system-upload",
    label: "الرفع على النظام",
    icon: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
    available: true,
  },
];

/**
 * Whether a task is a row of the case-study active-transactions list.
 *
 * How it works: keeps `case-study-property` tasks in the case-study or done phase, after
 * dropping folded ones (`isFoldedCaseStudyTask`).
 *
 * Edge cases: phase 4 — one study per transaction, so a deed folded into another deed's study
 * is not a row (the holder deed's row carries the study); the system-upload list below keeps
 * folded deeds, because every deed is uploaded to Enfaz on its own.
 */
function taskMatchesCaseStudy(task: WorkflowTask): boolean {
  if (task.kind !== "case-study-property") return false;
  // Phase 4: one study per transaction — a deed folded into another deed's study is not a row.
  if (isFoldedCaseStudyTask(task)) return false;
  // Ruling 2026-11-02: a transaction joins the study queue at coordination's formal receipt.
  if (task.phase === "case-study") return task.transactionReceived === true;
  return task.phase === "done";
}

/**
 * Coordination's «الاستلام من الأطراف» queue (ruling 2026-11-02): distributed transactions not yet
 * formally received — the parties are still working, or delivered and waiting for the receipt.
 *
 * How it works: case-study tasks in the case-study phase whose transaction is not received; folded
 * deeds are left out like in the study queue (the holder deed's row stands for the transaction).
 * Edge cases: a returned inspection after the receipt does not bring the row back — the receipt is
 * never cleared, the study follows the inspector up.
 */
export function filterTasksForReceipt(tasks: WorkflowTask[]): WorkflowTask[] {
  return tasks.filter(
    (t) =>
      t.kind === "case-study-property" &&
      !isFoldedCaseStudyTask(t) &&
      t.phase === "case-study" &&
      t.transactionReceived !== true,
  );
}

export function filterTasksForCaseStudy(
  tasks: WorkflowTask[],
): WorkflowTask[] {
  return tasks.filter((t) => taskMatchesCaseStudy(t));
}

/**
 * Deeds whose study report is issued AND whose valuation report is deposited, not yet uploaded to
 * Enfaz. Every deed of a transaction is uploaded on its own, so folded deeds stay listed.
 *
 * @param allTasks Every task the screen loaded — the appraisal tasks are not the viewer's own
 *   (the specialist's `mine` holds only case-study tasks). Defaults to `tasks`.
 */
function filterDepositedNotUploaded(
  tasks: readonly WorkflowTask[],
  allTasks: readonly WorkflowTask[],
): WorkflowTask[] {
  const appraisals = allTasks.filter((t) => t.kind === "property-appraisal");
  return tasks.filter(
    (t) =>
      t.kind === "case-study-property" &&
      t.status === "completed" &&
      t.propertyHandedOverToEnfaz !== true &&
      isValuationDepositedForTask(t, appraisals),
  );
}

/**
 * The upload queue: deposited deeds review prepared with «تجهيز المعاملة للرفع» (Omar 2026-11-08 — the
 * package was checked; nothing enters the queue incomplete). A deed already handed over leaves it.
 *
 * Edge cases / changed 2026-11-08: a deposited deed not prepared yet is not listed — it waits in
 * `filterTasksForUploadPrep` (review's «تجهيز» step).
 */
export function filterTasksForSystemUpload(
  tasks: WorkflowTask[],
  allTasks: readonly WorkflowTask[] = tasks,
): WorkflowTask[] {
  return filterDepositedNotUploaded(tasks, allTasks).filter((t) => t.readyForUpload === true);
}

/** Deposited deeds waiting for review's «تجهيز المعاملة للرفع» (Omar 2026-11-08). */
export function filterTasksForUploadPrep(
  tasks: WorkflowTask[],
  allTasks: readonly WorkflowTask[] = tasks,
): WorkflowTask[] {
  return filterDepositedNotUploaded(tasks, allTasks).filter((t) => t.readyForUpload !== true);
}

/** Party fee billing — under Active Transactions for party roles and supervisor. */
const ENGINEERING_FEES_ACTIVE_NAV_ITEM: ActiveTransactionNavItem = {
  id: "party-fees",
  label: "فوترة الأتعاب",
  icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  available: true,
};

/** Roles that show party fees under Active Transactions, not System Settings. */
export function isPartyFeesUnderActiveTransactions(role?: RoleId): boolean {
  return (
    role === "engineering-office" ||
    role === "field-inspector" ||
    role === "government-reviewer" ||
    role === "section-supervisor" ||
    role === "case-specialist" ||
    role === "cdo"
  );
}

export const ACTIVE_TRANSACTIONS_NAV: ActiveTransactionNavItem[] = [
  ...CASE_STUDY_ACTIVE_TRANSACTIONS_NAV,
  ...PARTY_ACTIVE_TRANSACTIONS_NAV,
  ENGINEERING_FEES_ACTIVE_NAV_ITEM,
];

const CASE_STUDY_STAGE_PAGE_IDS = new Set<PageId>(
  CASE_STUDY_ACTIVE_TRANSACTIONS_NAV.map((item) => item.id),
);

/** Queues «أعمالي» replaces: the case-study stage queues and the appraiser's «تقييم العقار». */
const REPLACED_BY_MY_WORK = new Set<PageId>([...CASE_STUDY_STAGE_PAGE_IDS, "property-appraisal"]);

/**
 * The «قوائم المراحل» dropdown rows a role sees.
 *
 * How it works: the pages the role holds; «فوترة الأتعاب» only for the roles that keep it here.
 * Edge cases / changed 2026-11-05 (Omar): a role that has «أعمالي» no longer gets the six case-study
 * stage queues here — «أعمالي» lists the same rows with the same ⋮ menu, and «المعاملات النشطة»
 * follows them. The pages stay reachable (the rows open them); the party queues and fees stay.
 * Changed 2026-11-11 (Omar): the appraiser's queue «تقييم العقار» goes the same way — his «أعمالي»
 * lists his valuations with the same rows, so the two entries said the same thing; his handed-over
 * valuations are one chip of «أعمالي». The page stays reachable (the rows open its work page).
 */
export function activeTransactionNavForRole(
  rolePages: PageId[],
  role?: RoleId,
): ActiveTransactionNavItem[] {
  const hasMyWork = rolePages.includes("my-work");
  return ACTIVE_TRANSACTIONS_NAV.filter((item) => {
    if (hasMyWork && REPLACED_BY_MY_WORK.has(item.id)) return false;
    if (item.id === "party-fees") {
      return (
        isPartyFeesUnderActiveTransactions(role) &&
        rolePages.includes("party-fees")
      );
    }
    return rolePages.includes(item.id);
  });
}

/** Interim name (2026-11-05): «المعاملات النشطة» is now the follow-up page of every live transaction; this dropdown of stage queues goes away in phase 6. */
export const ACTIVE_TRANSACTIONS_GROUP = "قوائم العمل";

export const ACTIVE_TRANSACTIONS_GROUP_ICON =
  "M22 12h-4l-3 9L9 3l-3 9H2";

export function isInActiveTransactionsSection(
  page: PageId,
  onTaskWork: boolean,
  role?: RoleId,
): boolean {
  if (page === "party-fees") {
    return isPartyFeesUnderActiveTransactions(role);
  }
  return onTaskWork || isActiveTransactionPage(page);
}

function activeTransactionPages(): PageId[] {
  return ACTIVE_TRANSACTIONS_NAV.map((n) => n.id);
}

function isActiveTransactionPage(page: PageId): boolean {
  return activeTransactionPages().includes(page);
}
