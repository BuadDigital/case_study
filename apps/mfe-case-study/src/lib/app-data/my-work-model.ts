/**
 * «أعمالي» — every decision waiting for the viewer's roles, in one list (plan 2026-11-05, phase 1).
 *
 * The rows come from the same filters the stage queues and the sidebar badges use, so a stage's
 * count here always equals its queue's count. Three stages that had no queue are added: the
 * valuation draft (study), the «قيمة» deposit (review) and — split out of the receipt queue — the
 * transactions whose parties have all delivered. Where a transaction stands and who it waits for is
 * `transactionProgress`, shared with «المعاملات النشطة». Pure: no React, no I/O.
 */
import type { PendingBoursePropertyDto } from "@platform/api-client";
import {
  filterTasksForCaseStudy,
  filterTasksForReceipt,
} from "@platform/app-shared/app-data/active-transactions";
import { isFoldedAppraisalTask, isFoldedCaseStudyTask } from "@platform/app-shared/workflow/task-types";
import { isValuationDepositedForTask } from "@platform/app-shared/workflow/task-done";
import {
  appraisalStageLabel,
  type ReportDraftState,
} from "@platform/app-shared/workflow/report-draft-state";
import {
  poPropertyCoordinationPath,
  propertyAppraisalWorkspacePath,
  poPropertyWorkPath,
  poTaskCoordinationPath,
} from "@platform/app-shared/domain/po-routes";
import type { PoIntakeRecord } from "./po-intake-data";
import type { WorkflowTask } from "./tasks";
import {
  filterTasksForDistribution,
  filterTasksForPrimaryData,
} from "./transaction-filters";
import { isTaskOnSuspendedProperty } from "./suspended-transactions-model";
import { resolveRemainingTime } from "./my-task-row";
import { caseStudyWorkspacePath } from "../my-task-routes";

/** Where the intake of a deed stands — the «إدخال المعاملة» row's line (Omar 2026-11-08). */
const INTAKE_PROGRESS = {
  primary: "البيانات الأولية ← · البورصة · التوزيع",
  bourse: "البيانات الأولية ✓ · البورصة ← · التوزيع",
  distribution: "البيانات الأولية ✓ · البورصة ✓ · التوزيع ←",
} as const;

/** The case specialist's sub-role a row or a work-page section belongs to: coordination, study, review. */
export type CaseSpecialistGroup = "co" | "st" | "rv";

/** The group a row belongs to: a case specialist's sub-role, or the appraiser's own work («ap», Omar 2026-11-10). */
export type MyWorkGroup = CaseSpecialistGroup | "ap";

export type MyWorkStage =
  | "intake"
  | "follow"
  | "study"
  | "review"
  | "deposit"
  | "upload"
  // The appraiser's three (Omar 2026-11-10): a valuation to do, one returned, a draft to approve.
  | "valuation"
  | "correction"
  | "approval"
  // A valuation he handed over: nothing waits for him — a lookup chip, never part of «الكل» (Omar 2026-11-11).
  | "handed";

export type MyWorkDue = "late" | "soon" | "ok" | "none";

/** One decision waiting for the viewer. */
export type MyWorkItem = {
  key: string;
  group: MyWorkGroup;
  stage: MyWorkStage;
  /** The verb the viewer has to do. */
  action: string;
  /** Why it reached him. */
  reason: string;
  /** The deed's case-study task the row stands on (its ⋮ menu acts on it); none for a bourse item without one. */
  taskId?: string;
  poNumber: string;
  propertyId?: string;
  deedNumber: string;
  transactionNumber?: string;
  propertyType?: string;
  place: string;
  /**
   * When the action reached the viewer (ISO) — the clock of «وقت الإجراء» (Omar 2026-11-08): the
   * deed's latest business milestone, else the task's creation.
   */
  arrivedIso: string;
  /** «تاريخ الاستلام»: when the PO was received from Enfaz (date). */
  receivedIso?: string;
  /** «تاريخ الاستحقاق»: the PO's deadline. */
  dueIso?: string;
  /** «وصف أمر العمل», shown small under the PO number (Omar 2026-11-08). */
  poDescription?: string;
  due: MyWorkDue;
  dueText: string;
  href: string;
  /** The transaction is reopened after its approval (Omar 2026-11-05) — the row shows «معادة للدراسة» (renamed from «معاد فتحها» 2026-11-08). */
  reopened?: boolean;
};

/** A reopening not closed yet, as «أعمالي» needs it. */
export type MyWorkReopening = {
  propertyId: string;
  status: "open" | "awaiting_reply" | "closed";
  source: "enfaz" | "internal";
  enfazReference?: string | null;
  reason: string;
  uploadedAgainAtUtc?: string | null;
  openedAtUtc: string;
};

export type MyWorkStageDef = { key: MyWorkStage; label: string };

/** The stage chips, grouped by sub-role, in the order the transaction moves. */
export const MY_WORK_GROUPS: readonly {
  key: MyWorkGroup;
  label: string;
  stages: readonly MyWorkStageDef[];
}[] = [
  {
    key: "co",
    label: "التنسيق",
    stages: [
      { key: "intake", label: "إدخال المعاملة" },
      { key: "follow", label: "متابعة المعاملات" },
    ],
  },
  {
    key: "st",
    label: "دراسة العقار",
    stages: [{ key: "study", label: "دراسة العقار" }],
  },
  {
    key: "rv",
    label: "المراجعة والاعتماد والرفع",
    stages: [
      { key: "review", label: "المراجعة والاعتماد" },
      { key: "deposit", label: "الإيداع في «قيمة»" },
      { key: "upload", label: "التجهيز والرفع على إنفاذ" },
    ],
  },
  {
    key: "ap",
    label: "التقييم",
    stages: [
      { key: "valuation", label: "التقييم" },
      { key: "correction", label: "معادة للتصحيح" },
      { key: "approval", label: "مسودة بانتظار اعتمادك" },
      { key: "handed", label: "المسلَّمة" },
    ],
  },
];

const STAGE_LABEL = new Map<MyWorkStage, string>(
  MY_WORK_GROUPS.flatMap((g) => g.stages.map((s) => [s.key, s.label] as const)),
);

/** The chip label of a stage. */
export function myWorkStageLabel(stage: MyWorkStage): string {
  return STAGE_LABEL.get(stage) ?? stage;
}

/**
 * Which sub-role groups the viewer sees, from the pages he holds.
 *
 * How it works: a group shows when the viewer holds one of its queue pages — the server already
 * trimmed a case specialist's pages to his sub-roles, and the supervisor / CDO / general manager
 * hold them all. Edge cases: a role with none of the pages sees no group (empty page).
 */
export function myWorkGroupsForPages(pages: readonly string[]): MyWorkGroup[] {
  const has = (ids: readonly string[]) => ids.some((id) => pages.includes(id));
  const groups: MyWorkGroup[] = [];
  if (
    has([
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-receipt",
    ])
  )
    groups.push("co");
  if (has(["active-case-study"])) groups.push("st");
  if (has(["system-upload"])) groups.push("rv");
  // The appraiser's own work (Omar 2026-11-10): whoever holds his queue page.
  if (has(["property-appraisal"])) groups.push("ap");
  return groups;
}

/** Where the appraiser's task stands — his «أعمالي» row. */
export type AppraiserStep = {
  stage: "valuation" | "correction" | "approval" | "handed";
  action: string;
  reason: string;
};

/**
 * What an appraisal task needs from the appraiser now (Omar 2026-11-10): to value the property, to
 * correct a valuation returned to him, or to approve the report draft review issued.
 *
 * How it works, in this order:
 * - the package was reopened → «تصحيح التقييم» (correction);
 * - the package was handed over: a draft waiting for HIS approval is his («اعتماد مسودة
 *   التقرير»); anything else (a draft being prepared, an approved report waiting for the deposit, an
 *   issued one) waits for others — the «handed» lookup row (2026-11-11), which says where it stands
 *   and is not counted as work waiting for him;
 * - otherwise it is his valuation: «بدء التقييم» until the server's progress ladder says it started
 *   (`progressPct` above 0), then «متابعة التقييم»; the line says whether the study has been issued,
 *   since only the hand-over waits for it (the form is open from the start).
 * Edge cases: a handed-over package with no draft state yet reads «بانتظار المراجعة»; no draft state
 * loaded yet reads as not started (the ladder arrives with the batch read);
 * a returned package whose draft state is missing is still a correction.
 */
export function appraiserStep(
  task: Pick<WorkflowTask, "appraisalPackageStatus" | "studyReportIssued">,
  draft: ReportDraftState | undefined,
): AppraiserStep {
  if (task.appraisalPackageStatus === "reopened") {
    return {
      stage: "correction",
      action: "تصحيح التقييم",
      reason: "أُعيد إليك التقييم للتصحيح — عدّله ثم سلّمه من جديد",
    };
  }
  if (task.appraisalPackageStatus === "submitted") {
    const label = appraisalStageLabel(draft);
    return label?.group === "draft_sent"
      ? {
          stage: "approval",
          action: "اعتماد مسودة التقرير",
          reason: "أصدرت المراجعة مسودة التقرير — اقرأها ثم اعتمدها أو أعدها",
        }
      : {
          stage: "handed",
          action: "تم التسليم",
          reason: label ? label.label : "سُلِّم التقييم — بانتظار المراجعة",
        };
  }
  const started = (draft?.progressPct ?? 0) > 0;
  const study = task.studyReportIssued === true ? "الدراسة صدرت" : "الدراسة لم تصدر بعد";
  return started
    ? {
        stage: "valuation",
        action: "متابعة التقييم",
        reason: `قيد التقييم — ${study}${task.studyReportIssued === true ? " — جاهز للتسليم" : ""}`,
      }
    : { stage: "valuation", action: "بدء التقييم", reason: `تقييم جديد — ${study}` };
}

/** The study row's usual line: the transaction came from coordination. */
const STUDY_INCOMING_LINE = "معاملة واردة من التنسيق";

/**
 * Why work came back to this desk, from the deed's latest milestone (A→Z 2026-11-09): the study
 * returned to the study («أُعيدت للدراسة») or the draft returned by the appraiser («أعادها المقيّم»),
 * with the reason the milestone carries; null when the latest step is not a return.
 *
 * How it works: matches the milestone key (`case-study-report:…:reopened…`,
 * `valuation:…:returned-to-reviewer…`) and keeps the detail after its «الاسم — » prefix.
 * Edge cases: a detail without the dash is shown whole; no detail → the label alone. Only the
 * LATEST milestone is read: a later step on the deed (the appraiser submitting meanwhile) hides the
 * return, and the row falls back to its usual line.
 */
export function returnedLine(
  task: Pick<WorkflowTask, "lastStepKey" | "lastStepDetail">,
  kind: "study" | "draft",
): string | null {
  const key = task.lastStepKey ?? "";
  const matches =
    kind === "study"
      ? /^case-study-report:[^:]+:reopened/.test(key)
      : /^valuation:[^:]+:returned-to-reviewer/.test(key);
  if (!matches) return null;
  const detail = task.lastStepDetail ?? "";
  const dash = detail.indexOf(" — ");
  const reason = (dash >= 0 ? detail.slice(dash + 3) : detail).trim();
  const label = kind === "study" ? "أُعيدت للدراسة" : "أعادها المقيّم";
  return reason ? `${label}: ${reason}` : label;
}

/**
 * When a row's action arrived: the later of the deed's latest milestone and the task's creation.
 *
 * How it works: compares the two instants and keeps the later; an unreadable or missing one loses.
 * Edge cases / fixed (A→Z 2026-11-09): the PO-receipt milestone is date-only (midnight UTC), so a
 * PO entered at 14:00 opened its intake row at «14س» — the task's creation is the real arrival then.
 */
export function laterIso(milestoneIso: string | undefined, createdIso: string): string {
  const a = milestoneIso ? Date.parse(milestoneIso) : Number.NaN;
  const b = Date.parse(createdIso);
  if (Number.isNaN(a)) return createdIso;
  if (Number.isNaN(b)) return milestoneIso!;
  return a >= b ? milestoneIso! : createdIso;
}

/**
 * «وقت الإجراء» (Omar 2026-11-08): how long the action has waited with the viewer, as a running clock —
 * seconds, then minutes, hours, days: «45ث» · «12د 05ث» · «3س 20د» · «4ي 06س».
 *
 * How it works: whole seconds from `arrivedIso` to `nowMs`; the two largest units, the second one
 * zero-padded so the clock keeps its width while it runs.
 * Edge cases: an unreadable or future time → «—» / «0ث» (a clock skew of a few seconds reads as zero).
 */
export function formatActionClock(arrivedIso: string, nowMs: number): string {
  const at = Date.parse(arrivedIso);
  if (Number.isNaN(at)) return "—";
  const total = Math.max(0, Math.floor((nowMs - at) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}ي ${pad(hours)}س`;
  if (hours > 0) return `${hours}س ${pad(minutes)}د`;
  if (minutes > 0) return `${minutes}د ${pad(seconds)}ث`;
  return `${seconds}ث`;
}

/** «باقي يومان» / «باقي ٣ أيام» — the Arabic count after «باقي». */
function remainingDaysText(days: number): string {
  if (days === 2) return "باقي يومان";
  if (days >= 3 && days <= 10) return `باقي ${days} أيام`;
  return `باقي ${days} يوماً`;
}

/**
 * The PO deadline as a row's due tone and text.
 *
 * How it works: the PO's SLA deadline (`resolveRemainingTime`): past → late; today or tomorrow →
 * soon; later → ok. Edge cases: a PO with no deadline → «—».
 */
export function myWorkDue(
  dueIso: string | undefined,
  now: Date,
): { due: MyWorkDue; dueText: string } {
  const r = resolveRemainingTime(dueIso ?? "", now);
  if (r.status === "missing") return { due: "none", dueText: "—" };
  if (r.status === "overdue") return { due: "late", dueText: "متأخرة" };
  if (r.days === 0) return { due: "soon", dueText: "تنتهي اليوم" };
  if (r.days === 1) return { due: "soon", dueText: "تنتهي غدًا" };
  return { due: "ok", dueText: remainingDaysText(r.days) };
}

function placeOf(task: Pick<WorkflowTask, "city" | "district">): string {
  return (
    [task.city?.trim(), task.district?.trim()].filter(Boolean).join(" · ") ||
    "—"
  );
}

const open = (t: WorkflowTask) => t.status === "open" || t.status === "blocked";

/** The latest live appraisal task of a property (the valuation lives on the holder deed). */
function latestAppraisal(
  propertyId: string,
  allTasks: readonly WorkflowTask[],
): WorkflowTask | undefined {
  let latest: WorkflowTask | undefined;
  for (const t of allTasks) {
    if (
      t.kind !== "property-appraisal" ||
      t.status === "cancelled" ||
      t.propertyId !== propertyId
    )
      continue;
    if (!latest || t.createdAt.localeCompare(latest.createdAt) > 0) latest = t;
  }
  return latest;
}

const PARTY_NAME: Partial<Record<WorkflowTask["kind"], string>> = {
  "field-inspection": "المعاين",
  "engineering-survey": "المكتب الهندسي",
};

/**
 * The field parties (inspector, engineering office) of a case-study task that have not delivered.
 *
 * How it works: live field-inspection / engineering-survey children not completed — a party task
 * completes when the party submits. Edge cases: no live child at all → null (not distributed yet);
 * cancelled children are ignored.
 */
function undeliveredFieldParties(
  parent: WorkflowTask,
  allTasks: readonly WorkflowTask[],
): string[] | null {
  const parties = allTasks.filter(
    (t) =>
      t.parentTaskId === parent.id &&
      t.status !== "cancelled" &&
      (t.kind === "field-inspection" || t.kind === "engineering-survey"),
  );
  if (parties.length === 0) return null;
  // Fixed order (inspector, then office) so «بانتظار» reads the same on every row.
  const kinds = new Set(
    parties.filter((p) => p.status !== "completed").map((p) => p.kind),
  );
  return (["field-inspection", "engineering-survey"] as const)
    .filter((k) => kinds.has(k))
    .map((k) => PARTY_NAME[k] ?? "");
}

/** One step of review's line (Omar 2026-11-08), in the order the transaction moves. */
export type ReviewStepKey = "study" | "value" | "draft" | "deposit" | "prep" | "upload";

/** done ✓ · review acts now ← · waits for the appraiser · not reached yet. */
export type ReviewStepState = "done" | "now" | "wait" | "todo";

/** Where a sent study stands with review — one line per transaction (Omar 2026-11-08). */
export type ReviewPipeline = {
  steps: { key: ReviewStepKey; label: string; state: ReviewStepState }[];
  /** Review's verbs now, in step order; empty when the transaction waits for the appraiser. */
  actions: string[];
  /** Whom else it waits for («المقيّم»), or empty. */
  waitingOn: string[];
};

const REVIEW_STEP_LABEL: Record<ReviewStepKey, string> = {
  study: "الدراسة",
  value: "القيمة",
  draft: "المسودة",
  deposit: "الإيداع",
  prep: "التجهيز",
  upload: "الرفع",
};

const REVIEW_STEP_ACTION: Record<ReviewStepKey, string> = {
  study: "اعتماد الدراسة",
  value: "قبول القيمة",
  draft: "إصدار المسودة للمقيّم",
  deposit: "تسجيل الإيداع",
  prep: "تجهيز المعاملة للرفع",
  upload: "الرفع على إنفاذ",
};

/**
 * Review's line for a deed whose study was sent (Omar 2026-11-08): study · value · draft · deposit ·
 * preparation · upload, each done, review's now, the appraiser's, or not reached.
 *
 * How it works: the study is review's until it approves it (`reviewState`); the value is the
 * appraiser's until he hands it over, then review's until it accepts it; review issues the draft once
 * both are done, the appraiser approves it; review then deposits, prepares and uploads. The two first
 * steps run in parallel, so a row may carry two verbs.
 * Edge cases: not sent / handed over → null; a deed folded into another deed's study has only its own
 * preparation and upload (null until the holder's valuation is deposited); a draft already sent or
 * approved (transactions from before 2026-11-08) counts the study and the value as done.
 */
export function reviewPipeline(
  task: WorkflowTask,
  allTasks: readonly WorkflowTask[],
  draftState: (propertyId: string) => ReportDraftState | undefined,
): ReviewPipeline | null {
  if (!task.studyReportIssued || !task.propertyId || task.propertyHandedOverToEnfaz) return null;
  const deposited = isValuationDepositedForTask(task, allTasks);
  if (isFoldedCaseStudyTask(task) && !deposited) return null;
  const draft = draftState(task.propertyId);
  const draftApproved =
    deposited || draft?.status === "approved" || (draft != null && draft.reportStage !== "draft");
  const draftOut = draftApproved || draft?.status === "sent";
  const appraisal = latestAppraisal(task.propertyId, allTasks);

  const study: ReviewStepState = draftOut || task.reviewState === "approved" ? "done" : "now";
  const value: ReviewStepState = draftOut
    ? "done"
    : appraisal?.appraisalPackageStatus !== "submitted"
      ? "wait"
      : task.appraisalValueAccepted || appraisal.appraisalValueAccepted
        ? "done"
        : "now";
  const draftStep: ReviewStepState = draftApproved
    ? "done"
    : draft?.status === "sent"
      ? "wait"
      : study === "done" && value === "done"
        ? "now"
        : "todo";
  const state: Record<ReviewStepKey, ReviewStepState> = {
    study,
    value,
    draft: draftStep,
    deposit: deposited ? "done" : draftApproved ? "now" : "todo",
    prep: task.readyForUpload ? "done" : deposited ? "now" : "todo",
    upload: task.readyForUpload && deposited ? "now" : "todo",
  };
  const keys: ReviewStepKey[] = ["study", "value", "draft", "deposit", "prep", "upload"];
  return {
    steps: keys.map((key) => ({ key, label: REVIEW_STEP_LABEL[key], state: state[key] })),
    actions: keys.filter((k) => state[k] === "now").map((k) => REVIEW_STEP_ACTION[k]),
    waitingOn: keys.some((k) => state[k] === "wait") ? ["المقيّم"] : [],
  };
}

/** «الدراسة ✓ · القيمة ← · المسودة · …» — the row's line. */
export function reviewPipelineLine(pipeline: ReviewPipeline): string {
  const mark: Record<ReviewStepState, string> = { done: " ✓", now: " ←", wait: " …", todo: "" };
  return pipeline.steps.map((s) => `${s.label}${mark[s.state]}`).join(" · ");
}

/**
 * Which «أعمالي» chip a review row sits under, and which work-page section it opens: its first step
 * for review to act on (the study's approval opens the study, the value to the deposit the
 * valuation, the preparation and the upload the upload).
 */
function reviewPlaceOf(pipeline: ReviewPipeline): { stage: MyWorkStage; section: string } {
  const first = pipeline.steps.find((s) => s.state === "now")?.key;
  if (first === "study") return { stage: "review", section: "study" };
  if (first === "deposit") return { stage: "deposit", section: "valuation" };
  if (first === "prep" || first === "upload") return { stage: "upload", section: "upload" };
  return { stage: "review", section: "valuation" };
}

const REVIEW_PROGRESS_STAGE: Record<ReviewStepKey, Partial<Record<ReviewStepState, string>>> = {
  study: { now: "مراجعة الدراسة" },
  value: { now: "مراجعة القيمة", wait: "التقييم" },
  draft: { now: "إصدار المسودة", wait: "اعتماد المسودة" },
  deposit: { now: "الإيداع في «قيمة»" },
  prep: { now: "تجهيز المعاملة للرفع" },
  upload: { now: "الرفع على إنفاذ" },
};

/**
 * The field parties whose delivered package still waits for coordination's acceptance, with the
 * coordinator-page section that accepts each (A→Z 2026-11-09).
 *
 * How it works: live inspection / survey children that completed (the party submitted) and whose
 * row says `packageAccepted: false`, in the fixed order inspector, office.
 * Edge cases: a row without the flag (an older server) counts as accepted — the row then simply
 * reads like before; a returned package is not completed, so it is the party's again, not ours.
 */
function deliveredAwaitingAcceptance(
  parent: WorkflowTask,
  allTasks: readonly WorkflowTask[],
): { name: string; section: string }[] {
  const waiting = new Set(
    allTasks
      .filter(
        (t) =>
          t.parentTaskId === parent.id &&
          t.status === "completed" &&
          t.packageAccepted === false &&
          (t.kind === "field-inspection" || t.kind === "engineering-survey"),
      )
      .map((t) => t.kind),
  );
  return (
    [
      ["field-inspection", "inspector"],
      ["engineering-survey", "survey"],
    ] as const
  )
    .filter(([kind]) => waiting.has(kind))
    .map(([kind, section]) => ({ name: PARTY_NAME[kind] ?? "", section }));
}

/**
 * The «متابعة الأطراف» row's line: who has not delivered, whose delivery waits for your acceptance,
 * or — all delivered and accepted — the send (A→Z 2026-11-09: «بانتظار: المكتب الهندسي» used to hide
 * an inspection waiting for the coordinator's acceptance).
 */
function followUpReason(pending: string[] | null, toAccept: { name: string }[]): string {
  if (pending === null) return "لم تُوزَّع على الأطراف بعد";
  const parts: string[] = [];
  if (pending.length > 0) parts.push(`بانتظار: ${pending.join(" و")}`);
  if (toAccept.length > 0)
    parts.push(`بانتظار قبولك: مخرجات ${toAccept.map((p) => p.name).join(" و")}`);
  return parts.length > 0
    ? parts.join(" · ")
    : "سلّم الأطراف وقُبلت مخرجاتهم — أرسل المعاملة للدراسة";
}

/**
 * Who a transaction in the follow-up still waits for: the field parties that have not delivered,
 * then «طرف خارجي» when a delivery from outside the system is pending (Omar 2026-11-08).
 * Edge cases: not distributed yet → null.
 */
function followUpWaitingOn(
  task: WorkflowTask,
  allTasks: readonly WorkflowTask[],
): string[] | null {
  const pending = undeliveredFieldParties(task, allTasks);
  if (pending === null) return null;
  return task.awaitingExternalParty ? [...pending, "طرف خارجي"] : pending;
}

/** Where a live transaction stands and who it waits for. */
export type TransactionProgress = {
  stage: string;
  waitingOn: string;
};

/**
 * Where a transaction stands and who it waits for — the «المعاملات النشطة» stage and «بانتظار»
 * columns. Takes the deed's case-study task.
 *
 * How it works: by phase — primary data, bourse, distribution → coordination; failure → its
 * follow-up; case study before the receipt → the undelivered parties, or coordination's receipt once
 * all delivered; received and open → the study; issued → `valuationStep` (appraiser, study draft,
 * appraiser approval, review deposit, review upload).
 * Edge cases: null for a transaction that is no longer live — cancelled or handed over to Enfaz, or
 * a completed study with no issued report.
 */
export function transactionProgress(
  task: WorkflowTask,
  allTasks: readonly WorkflowTask[],
  draftState: (propertyId: string) => ReportDraftState | undefined,
): TransactionProgress | null {
  if (
    task.kind !== "case-study-property" ||
    task.status === "cancelled" ||
    task.propertyHandedOverToEnfaz
  ) {
    return null;
  }
  switch (task.phase) {
    case "enfath":
      return { stage: "البيانات الأولية", waitingOn: "التنسيق" };
    case "bourse":
      return { stage: "استعلام البورصة", waitingOn: "التنسيق" };
    case "distribution":
      return { stage: "التوزيع", waitingOn: "التنسيق" };
    case "obstruction":
      return { stage: "تعذّر", waitingOn: "معالجة التعذّر" };
    default:
      break;
  }
  if (task.phase === "case-study" && task.transactionReceived !== true) {
    const pending = followUpWaitingOn(task, allTasks);
    if (pending === null) return { stage: "التوزيع", waitingOn: "التنسيق" };
    return pending.length > 0
      ? { stage: "متابعة الأطراف", waitingOn: pending.join(" و") }
      : { stage: "متابعة الأطراف", waitingOn: "التنسيق" };
  }
  if (!task.studyReportIssued) {
    return task.status === "completed"
      ? null
      : { stage: "دراسة العقار", waitingOn: "دارس العقار" };
  }
  const pipeline = reviewPipeline(task, allTasks, draftState);
  const first = pipeline?.steps.find((s) => s.state !== "done");
  if (!pipeline || !first) return { stage: "التقييم", waitingOn: "المقيّم" };
  const parties = [...(pipeline.actions.length > 0 ? ["المراجع"] : []), ...pipeline.waitingOn];
  return {
    stage: REVIEW_PROGRESS_STAGE[first.key][first.state] ?? REVIEW_STEP_LABEL[first.key],
    waitingOn: parties.join(" و") || "المراجع",
  };
}

export type BuildMyWorkInput = {
  groups: readonly MyWorkGroup[];
  /** The viewer's case-study tasks (role-scoped, as the queues scope them). */
  mine: readonly WorkflowTask[];
  /** Every task loaded — the party children and appraisals are not the viewer's own. */
  allTasks: readonly WorkflowTask[];
  poByNumber: ReadonlyMap<string, PoIntakeRecord>;
  /** Bourse items already filtered to the actionable ones (`filterActionablePendingBourseItems`). */
  pendingBourse: readonly PendingBoursePropertyDto[];
  draftState: (propertyId: string) => ReportDraftState | undefined;
  /** Reopenings not closed yet (Omar 2026-11-05): the reopened chip on the transaction's rows. */
  reopenings?: readonly MyWorkReopening[];
  now: Date;
};

/**
 * Builds «أعمالي»: the decisions waiting for the viewer's sub-role groups.
 *
 * How it works, per group the viewer holds:
 * - coordination (Omar 2026-11-08): one «إدخال المعاملة» row per deed in primary data, bourse or
 *   distribution (the queues' own filters), opening the work page on the part left; then one
 *   «متابعة الأطراف» row per distributed transaction not yet sent to the study, naming the party it waits
 *   for.
 * - study: the study queue (received, open) → «دراسة العقار» (Omar 2026-11-08: the name alone; the inputs are
 *   part of it; the study no longer prepares or hands over the draft — Omar 2026-11-08).
 * - review: ONE row per sent transaction while review has something to do (Omar 2026-11-08) — the
 *   verbs of `reviewPipeline` and its line «الدراسة ✓ · القيمة ← · …» as the reason.
 * - appraiser (Omar 2026-11-10): his valuations to start or continue, those returned to him and the
 *   report drafts waiting for his approval (`appraiserStep`), each opening his page; plus, since
 *   2026-11-11, the ones he handed over (stage «handed»), listed after the rest and under their own chip.
 * Rows sort late first, then soon, then by age (oldest first).
 *
 * Edge cases / changed 2026-11-05: what waits for someone else is no longer listed here — Omar's
 * ruling: it is «المعاملات النشطة»'s «بانتظار» column (`transactionProgress`). Folded deeds are left
 * out of the study / draft / deposit stages but kept for the upload (each deed is uploaded alone);
 * suspended properties are left out of primary data like in the queue.
 */
export function buildMyWork(input: BuildMyWorkInput): { items: MyWorkItem[] } {
  const { groups, mine, allTasks, poByNumber, now } = input;
  const items: MyWorkItem[] = [];
  const mineList = [...mine];

  const fromTask = (
    task: WorkflowTask,
    group: MyWorkGroup,
    stage: MyWorkStage,
    action: string,
    reason: string,
    href: string,
  ): MyWorkItem => ({
    key: `${stage}:${task.id}`,
    group,
    stage,
    action,
    reason,
    taskId: task.id,
    poNumber: task.poNumber,
    propertyId: task.propertyId,
    deedNumber: task.deedNumber?.trim() || "—",
    transactionNumber: task.transactionNumber,
    propertyType: task.propertyType,
    place: placeOf(task),
    // Not `updatedAt`: any save moves it, so it never said when the action arrived.
    arrivedIso: laterIso(task.lastStepAtUtc, task.createdAt),
    receivedIso: poByNumber.get(task.poNumber.trim())?.receivedFromEnfathAt || undefined,
    dueIso: poByNumber.get(task.poNumber.trim())?.dueDateAt || undefined,
    poDescription: poByNumber.get(task.poNumber.trim())?.workOrderDescription?.trim() || undefined,
    ...myWorkDue(poByNumber.get(task.poNumber.trim())?.dueDateAt, now),
    href,
  });

  // Every row opens the transaction's work page on its section (plan 2026-11-05, phase 2); a task with
  // no deed yet falls back to the study workspace.
  const workOf = (task: WorkflowTask, section: string) =>
    task.propertyId
      ? poPropertyWorkPath(task.poNumber, task.propertyId, section)
      : caseStudyWorkspacePath(task.id);
  // Coordination's rows open the coordinator's page (Omar 2026-11-08), never the work page.
  const coordinationOf = (task: WorkflowTask, section: string) =>
    task.propertyId
      ? poPropertyCoordinationPath(task.poNumber, task.propertyId, section)
      : poTaskCoordinationPath(task.poNumber, task.id);

  if (groups.includes("co")) {
    const poMap = poByNumber as Map<string, PoIntakeRecord>;
    // Omar 2026-11-08: the intake is ONE row per deed — «إدخال المعاملة» — whatever part of it is
    // left; the row shows how far it got and opens the work page on that part.
    for (const t of filterTasksForPrimaryData(mineList, poMap)) {
      if (!open(t) || isTaskOnSuspendedProperty(t)) continue;
      items.push({
        ...fromTask(
          t,
          "co",
          "intake",
          "إدخال المعاملة",
          INTAKE_PROGRESS.primary,
          t.propertyId
            ? poPropertyCoordinationPath(t.poNumber, t.propertyId, "intake")
            : poTaskCoordinationPath(t.poNumber, t.id),
        ),
        key: `intake:${t.id}`,
      });
    }
    for (const b of input.pendingBourse) {
      const record = poByNumber.get(b.poNumber.trim());
      // The bourse item carries no place or type — the deed's case-study task does.
      const deedTask = allTasks.find(
        (x) =>
          x.kind === "case-study-property" && x.propertyId === b.propertyId,
      );
      items.push({
        key: deedTask ? `intake:${deedTask.id}` : `intake:${b.poNumber}:${b.propertyId}`,
        group: "co",
        stage: "intake",
        action: "إدخال المعاملة",
        reason: INTAKE_PROGRESS.bourse,
        taskId: deedTask?.id,
        poNumber: b.poNumber,
        propertyId: b.propertyId,
        deedNumber: b.deedNumber?.trim() || "—",
        transactionNumber: b.transactionNumber ?? undefined,
        propertyType: deedTask?.propertyType,
        place: deedTask ? placeOf(deedTask) : "—",
        arrivedIso: laterIso(deedTask?.lastStepAtUtc, b.createdAtUtc || b.receivedFromEnfathAt),
        receivedIso: b.receivedFromEnfathAt || record?.receivedFromEnfathAt || undefined,
        dueIso: b.dueDateAt || record?.dueDateAt || undefined,
        poDescription: record?.workOrderDescription?.trim() || undefined,
        ...myWorkDue(b.dueDateAt || record?.dueDateAt, now),
        href: poPropertyCoordinationPath(b.poNumber, b.propertyId, "bourse"),
      });
    }
    for (const t of filterTasksForDistribution(mineList, poMap)) {
      if (!open(t)) continue;
      items.push({
        ...fromTask(
          t,
          "co",
          "intake",
          "إدخال المعاملة",
          INTAKE_PROGRESS.distribution,
          coordinationOf(t, "distribution"),
        ),
        key: `intake:${t.id}`,
      });
    }
    // Omar 2026-11-08: from the distribution until it is sent to the study, the transaction is
    // coordination's «متابعة المعاملات» — the parties' work, their acceptance, then the send.
    for (const t of filterTasksForReceipt(mineList)) {
      // A→Z 2026-11-09: a cancelled transaction kept its row («لم تُوزَّع على الأطراف بعد»).
      if (!open(t)) continue;
      const pending = followUpWaitingOn(t, allTasks);
      const toAccept = deliveredAwaitingAcceptance(t, allTasks);
      items.push(
        fromTask(
          t,
          "co",
          "follow",
          "متابعة الأطراف",
          followUpReason(pending, toAccept),
          // Opens on the first package to accept; else on the inspector's section as before.
          coordinationOf(t, toAccept[0]?.section ?? "inspector"),
        ),
      );
    }
  }

  if (groups.includes("st")) {
    for (const t of filterTasksForCaseStudy(mineList)) {
      if (!open(t)) continue;
      items.push(
        fromTask(
          t,
          "st",
          "study",
          "دراسة العقار",
          // A study returned by review says so, with the reason (A→Z 2026-11-09).
          returnedLine(t, "study") ?? STUDY_INCOMING_LINE,
          workOf(t, "study"),
        ),
      );
    }
  }

  if (groups.includes("rv")) {
    for (const t of mineList) {
      if (t.kind !== "case-study-property") continue;
      const pipeline = reviewPipeline(t, allTasks, input.draftState);
      if (!pipeline || pipeline.actions.length === 0) continue;
      const { stage, section } = reviewPlaceOf(pipeline);
      items.push(
        fromTask(
          t,
          "rv",
          stage,
          pipeline.actions.join(" · "),
          // A draft the appraiser returned leads with his reason (A→Z 2026-11-09).
          [returnedLine(t, "draft"), reviewPipelineLine(pipeline)].filter(Boolean).join(" — "),
          workOf(t, section),
        ),
      );
    }
  }

  // The appraiser's own work (Omar 2026-11-10): one row per valuation he owes a step on; a deed folded
  // into another's valuation has none (the holder deed's task carries it), and what waits for someone
  // else is not listed.
  if (groups.includes("ap")) {
    for (const t of mineList) {
      if (t.kind !== "property-appraisal" || !open(t) || isFoldedAppraisalTask(t)) continue;
      const step = appraiserStep(t, t.propertyId ? input.draftState(t.propertyId) : undefined);
      const row = fromTask(
        t,
        "ap",
        step.stage,
        step.action,
        step.reason,
        // A draft to approve opens the report window straight away (`?report=1`).
        step.stage === "approval"
          ? `${propertyAppraisalWorkspacePath(t.id)}?report=1`
          : propertyAppraisalWorkspacePath(t.id),
      );
      // A handed-over row asks nothing of him: no late / soon tone, and it sorts after what does.
      items.push(step.stage === "handed" ? { ...row, due: "none" } : row);
    }
  }

  // Omar 2026-11-08: no «الرد على إنفاذ» row — a reopening ends at the re-upload; it only marks the rows.
  const reopenings = input.reopenings ?? [];
  const reopeningByProperty = new Map(reopenings.map((r) => [r.propertyId, r]));
  for (const item of items) {
    const reopening = item.propertyId ? reopeningByProperty.get(item.propertyId) : undefined;
    if (!reopening) continue;
    item.reopened = true;
    // A→Z 2026-11-09: the line under «معادة للدراسة» says why — it read «معاملة واردة من التنسيق».
    const why = reopening.reason.trim();
    if (why) {
      item.reason =
        item.reason === STUDY_INCOMING_LINE ? `سبب الإعادة: ${why}` : `سبب الإعادة: ${why} — ${item.reason}`;
    }
  }

  const rank: Record<MyWorkDue, number> = { late: 0, soon: 1, ok: 2, none: 3 };
  const lookup = (i: MyWorkItem) => (i.stage === "handed" ? 1 : 0);
  items.sort(
    (a, b) =>
      lookup(a) - lookup(b) ||
      rank[a.due] - rank[b.due] ||
      a.arrivedIso.localeCompare(b.arrivedIso),
  );
  return { items };
}
