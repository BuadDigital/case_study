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
  obstructionReason?: string;
  obstructionPriorPhase?: CaseStudyTaskPhase;
  assignmentType?: AssignmentType;
  createdAt: string;
  updatedAt: string;
  /** Server flag on engineering-survey / property-appraisal: sibling field-inspection completed. */
  fieldInspectionCompleted?: boolean;
  /** Server flag on property-appraisal: sibling inspection package specialist-accepted. */
  fieldInspectionAccepted?: boolean;
  /** Completed sibling field-inspection task id (server). */
  fieldInspectionTaskId?: string;
};

export function notifyTasksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
}
