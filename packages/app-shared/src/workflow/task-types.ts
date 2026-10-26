import type { RoleId } from "@platform/types";

/** @deprecated Tasks persist in PostgreSQL — kept for storage-event compatibility. */
export const TASKS_STORAGE_KEY = "evalWorkflowTasks";
export const TASKS_CHANGED_EVENT = "eval-workflow-tasks-changed";

/** Phases of the case-study property task (specialist workflow). */
export type CaseStudyTaskPhase =
  | "enfath"
  | "bourse"
  | "distribution"
  | "case-study"
  | "done"
  | "obstruction";

export type WorkflowTaskKind =
  | "case-study-property"
  | "field-inspection"
  | "government-review"
  | "engineering-survey"
  | "property-appraisal";

export type WorkflowTaskStatus = "open" | "completed" | "blocked" | "cancelled";

/** The appraiser's package: draft → submitted (handed to the specialist) → reopened (returned). */
type AppraisalPackageStatus = "draft" | "submitted" | "reopened";

/** Party selection on transaction distribution — checkbox gates each dropdown group. */
export type TaskDistributionDraft = {
  /** @deprecated Not used in distribution UI — government work comes from operations tasks. */
  governmentAuditor: boolean;
  /** @deprecated Not used in distribution UI. */
  governmentAuditorId: string;
  valuationDepartment: boolean;
  inspectorId: string;
  valuatorId: string;
  engineeringOffice: boolean;
  engineeringOfficeId: string;
  caseSpecialist: boolean;
  caseSpecialistId: string;
};

export type AssignmentType = "تنفيذ" | "تركات" | "قطاع خاص";

export type WorkflowTask = {
  id: string;
  kind: WorkflowTaskKind;
  poNumber: string;
  /** Set after phase 1 (Enfath) saves the property. */
  propertyId?: string;
  /** Slot index 1..expectedPropertyCount on the PO. */
  propertyOrdinal: number;
  title: string;
  phase: CaseStudyTaskPhase;
  assigneeRole: RoleId;
  assigneeName: string;
  /** Distribution dropdown id (e.g. fi-ahmed) — filters queue per prototype user. */
  assigneeId?: string;
  parentTaskId?: string;
  status: WorkflowTaskStatus;
  distribution?: TaskDistributionDraft;
  /** Party child tasks: the case specialist's name — parties cannot see the parent or list staff. */
  caseSpecialistName?: string;
  obstructionReason?: string;
  obstructionPriorPhase?: CaseStudyTaskPhase;
  assignmentType?: AssignmentType;
  createdAt: string;
  updatedAt: string;
  /** Server flag on engineering-survey / property-appraisal: sibling field-inspection completed. */
  fieldInspectionCompleted?: boolean;
  /**
   * Server flag on property-appraisal: sibling inspection package specialist-accepted.
   * Informational only — acceptance does not gate the appraiser's start; readiness uses
   * `fieldInspectionCompleted` (the inspector submitted).
   */
  fieldInspectionAccepted?: boolean;
  /**
   * Server flag on property-appraisal / case-study-property: the specialist's study report
   * is issued. Issuing opens the appraiser's SUBMISSION (not the start of the work).
   */
  studyReportIssued?: boolean;
  /**
   * Server field on property-appraisal / case-study-property: where the appraiser's package stands.
   * `submitted` on an open task = handed to the specialist (data locked); the task completes only at
   * the final issuance of the valuation report. Absent when there is no appraisal package yet.
   */
  appraisalPackageStatus?: AppraisalPackageStatus;
  /** Completed sibling field-inspection task id (server). */
  fieldInspectionTaskId?: string;
  /** Server flag on property-appraisal: sibling engineering-survey completed. */
  engineeringSurveyCompleted?: boolean;
  /** Server flag on property-appraisal: a sibling engineering-survey task exists. */
  engineeringSurveyAssigned?: boolean;
  /** Server flag: the task's property has a failure that is neither resolved nor suspended. */
  propertyFailureBlocked?: boolean;
  /*
   * The task's property, as the server joined it onto the row
   * (`docs/architecture/pagination-contract.md` §2). Undefined when the task has
   * no property yet — queues fall back to the PO record for display.
   */
  deedNumber?: string;
  city?: string;
  district?: string;
  propertyType?: string;
  classification?: string;
  /** The property's transaction number (PR-… once confirmed, else the TMP- temporary number), joined server-side. */
  transactionNumber?: string;
  /** The property's transaction id, joined server-side. */
  transactionId?: string;
  /**
   * Phase 4: set when another deed of the same transaction holds the one study — this
   * case-study row is folded into it and hidden from the study queues.
   */
  transactionStudyHolderPropertyId?: string;
};

/**
 * Phases 4–5: true for a task on a deed whose transaction's study and valuation live on
 * another deed (the holder deed, «الصك الأساس»).
 *
 * How it works: reads `transactionStudyHolderPropertyId`, which the server joins onto every
 * task of a deed in a merged transaction, trims it, and returns true only when it is set and
 * names a deed other than the task's own `propertyId`.
 *
 * Edge cases: a task on the holder deed itself carries its own id as the holder → false (it is
 * the one that keeps the study); a deed outside any merge has no holder → false.
 */
export function isFoldedTransactionTask(
  task: Pick<WorkflowTask, "propertyId" | "transactionStudyHolderPropertyId">,
): boolean {
  const holder = task.transactionStudyHolderPropertyId?.trim();
  return Boolean(holder) && holder !== task.propertyId;
}

/** Phase 4: a case-study row whose transaction's study lives on another deed's task. */
export function isFoldedCaseStudyTask(
  task: Pick<WorkflowTask, "kind" | "propertyId" | "transactionStudyHolderPropertyId">,
): boolean {
  return task.kind === "case-study-property" && isFoldedTransactionTask(task);
}

/** Phase 5: an appraisal row whose transaction's valuation lives on the holder deed's task. */
export function isFoldedAppraisalTask(
  task: Pick<WorkflowTask, "kind" | "propertyId" | "transactionStudyHolderPropertyId">,
): boolean {
  return task.kind === "property-appraisal" && isFoldedTransactionTask(task);
}

/**
 * Phase 5 (decision 2026-10-19, one valuation per transaction): the holder deed's appraisal
 * task that a folded appraisal task redirects to.
 *
 * How it works: returns null unless `task` is a folded `property-appraisal` task
 * (`isFoldedAppraisalTask`); then searches `tasks` for a `property-appraisal` task on the
 * holder deed (`transactionStudyHolderPropertyId`) that is not cancelled and is not `task`
 * itself, and returns it (or null).
 *
 * Edge cases: a task whose holder is its own deed → null (it is the holder); the holder's task
 * missing from the list (not loaded yet, or cancelled) → null, so the caller shows the deed's
 * own workspace instead of redirecting nowhere.
 */
export function holderAppraisalTaskFor(
  task: Pick<WorkflowTask, "id" | "kind" | "propertyId" | "transactionStudyHolderPropertyId">,
  tasks: readonly Pick<WorkflowTask, "id" | "kind" | "propertyId" | "status">[],
): Pick<WorkflowTask, "id" | "kind" | "propertyId" | "status"> | null {
  if (!isFoldedAppraisalTask(task)) return null;
  const holder = task.transactionStudyHolderPropertyId!.trim();
  return (
    tasks.find(
      (t) =>
        t.kind === "property-appraisal" &&
        t.propertyId === holder &&
        t.status !== "cancelled" &&
        t.id !== task.id,
    ) ?? null
  );
}

export function notifyTasksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
}
