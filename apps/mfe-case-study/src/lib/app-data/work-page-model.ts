/**
 * The work page's sections — one vertical page for a transaction's input and actions, numbered in
 * the order the transaction moves (Omar 2026-11-05: «صفحة واحدة طولية، على اليمين الأقسام للأدوار
 * والإجراءات»). Omar 2026-11-08: the coordinator has his own page with the intake and the parties'
 * follow-up (`coordination-page-model`); the work page keeps every section — the coordination ones
 * first — because the study and the review study every detail and edit the data at the same level.
 * Pure: no React.
 */
import type { ReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import {
  COORDINATION_SECTIONS,
  type CoordinationSectionId,
} from "./coordination-page-model";
import type { MyWorkGroup } from "./my-work-model";
import { isValuationDepositedForTask } from "@platform/app-shared/workflow/task-done";
import type { WorkflowTask } from "./tasks";

export type WorkSectionId =
  | CoordinationSectionId
  | "inspection"
  | "study"
  | "photos"
  | "valuation"
  | "upload";

export type WorkSectionStatus = "done" | "current" | "todo";

export type WorkSectionDef = {
  id: WorkSectionId;
  title: string;
  /** The sub-role that owns the section's decision. */
  group: MyWorkGroup;
  /** Where the section sits in the flow — sections sharing a step are worked together. */
  step: number;
};

/** The sections, in order; their position + 1 is the number on the rail. */
export const WORK_SECTIONS: readonly WorkSectionDef[] = [
  ...COORDINATION_SECTIONS.map((s): WorkSectionDef => ({ ...s, group: "co" })),
  {
    id: "inspection",
    title: "المطابقة والمكوّنات",
    group: "st",
    step: 4,
  },
  { id: "study", title: "تقرير دراسة الحالة", group: "st", step: 4 },
  // Omar 2026-11-09: the report's photo board moved here from the details page's photos tab.
  { id: "photos", title: "صور التقرير", group: "st", step: 4 },
  {
    id: "valuation",
    title: "التقييم ومسودة التقرير والإيداع",
    group: "rv",
    step: 5,
  },
  { id: "upload", title: "الرفع على إنفاذ", group: "rv", step: 6 },
];

/**
 * The lock on a transaction's data, the same for everyone (Omar 2026-11-08): open until review approves
 * the study; «study-approved» once it did (only review's «إرجاع للدراسة» opens it); «report-approved»
 * once the appraiser gave the report his final approval (only a transaction reopen opens it).
 */
export type ReviewLock = "study-approved" | "report-approved" | null;

/**
 * The lock as the screens show it — the server's `WorkOrderPropertyWriteRules.ReviewLockError` is the
 * judge of every write.
 *
 * How it works: an approved or deposited draft → report-approved; else the study task's review state
 * «approved» → study-approved; else open. Edge cases / changed 2026-11-08: sending the study to review
 * no longer locks anything (the 2026-11-05 «handed» lock for everyone but review is gone); no task or
 * draft state loaded → open.
 */
export function reviewLockOf(
  studyTask: Pick<WorkflowTask, "reviewState"> | null | undefined,
  draft: ReportDraftState | undefined,
): ReviewLock {
  if (draft && (draft.status === "approved" || draft.reportStage !== "draft")) return "report-approved";
  return studyTask?.reviewState === "approved" ? "study-approved" : null;
}

/** Past the last section: the transaction is handed over (or no longer live). */
const FINISHED_STEP = 7;

const PHASE_STEP: Partial<Record<WorkflowTask["phase"], number>> = {
  enfath: 0,
  bourse: 1,
  distribution: 2,
};

/**
 * The step the transaction is at, from its case-study task.
 *
 * How it works: primary data / bourse / distribution by phase; a failure stands at the phase it
 * stopped; in the case-study phase the receipt until coordination receives, then the study until
 * the report is issued; after it the valuation until deposited, then the upload; handed over or
 * cancelled → finished.
 * Edge cases: no task (the deed has no case-study task loaded) → the first step; a draft state not
 * loaded yet keeps the valuation step.
 */
export function workPageStep(
  task: WorkflowTask | null | undefined,
  allTasks: readonly WorkflowTask[],
  draftState: (propertyId: string) => ReportDraftState | undefined,
): number {
  if (!task) return 0;
  if (task.status === "cancelled" || task.propertyHandedOverToEnfaz)
    return FINISHED_STEP;
  const byPhase =
    PHASE_STEP[
      task.phase === "obstruction"
        ? (task.obstructionPriorPhase ?? "enfath")
        : task.phase
    ];
  if (byPhase !== undefined) return byPhase;
  if (task.phase === "case-study" && task.transactionReceived !== true)
    return 3;
  if (!task.studyReportIssued) return 4;
  return isValuationDepositedForTask(task, allTasks) ? 6 : 5;
}

/** The first step of the study — the earlier ones are coordination's (shown on both pages). */
export const WORK_PAGE_FIRST_STEP = 4;

/** A section's status against the transaction's step (any frame page's section). */
export function workSectionStatus(
  section: Pick<WorkSectionDef, "step">,
  step: number,
): WorkSectionStatus {
  if (section.step < step) return "done";
  return section.step === step ? "current" : "todo";
}
