import type { RowMoreMenuItem } from "@platform/ui-kit";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import type { RoleId } from "@platform/types";
import type { StaffAccess } from "@platform/app-shared/app-data/case-specialist-sub-roles";
import { isPartyTaskDone } from "@platform/app-shared/workflow/task-done";
import { isTaskFailureObstructed } from "@platform/app-shared/workflow/task-failure-status";
import {
  buildPrimaryDataTableRow,
  findPropertyForTask,
} from "./my-task-row";
import type { PoIntakeRecord } from "./po-intake-data";
import {
  taskKindLabel,
  type WorkflowTask,
} from "./tasks";
import { canReopenCaseStudyReport } from "./po-roles";
import { poPropertyDetailPath, poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { transactionNumberOf } from "./transaction-number";
import { areaText } from "./appraiser-summary-model";
import type { TransactionProgress, TransactionParty } from "./my-work-model";

import { WorkflowTaskStatuses, WorkflowTaskKinds, CaseStudyTaskPhases } from "@platform/app-shared/workflow/task-types";
import { Roles } from "@platform/types";
/** Short phase labels matching Case Study.html `renderAllTransactions`. */
export function allTransactionsPhaseLabel(task: WorkflowTask): string {
  // «إلغاء المعاملة»: a cancelled task reads «ملغاة» — also the status-filter option for them.
  if (task.status === WorkflowTaskStatuses.Cancelled) return "ملغاة";
  if (isPartyTaskDone(task)) return "مكتمل";
  if (isTaskFailureObstructed(task)) return "تعذّر";
  if (task.kind === WorkflowTaskKinds.GovernmentReview) return "المراجعة الحكومية";
  if (task.kind === WorkflowTaskKinds.FieldInspection) return "معاينة العقار";
  if (task.kind === WorkflowTaskKinds.PropertyAppraisal) return "تقييم العقار";
  if (task.kind === WorkflowTaskKinds.EngineeringSurvey) return "الرفع المساحي";
  if (task.phase === CaseStudyTaskPhases.Enfath) return "البيانات الأولية";
  if (task.phase === CaseStudyTaskPhases.Bourse) return "البورصة";
  if (task.phase === CaseStudyTaskPhases.Distribution) return "التوزيع";
  if (task.phase === CaseStudyTaskPhases.CaseStudy) return "دراسة الحالة";
  if (task.phase === CaseStudyTaskPhases.Obstruction) return "تعذّر";
  return taskKindLabel(task.kind);
}

/** Deed cell: `Deed {n}` as in Case Study.html. */
function formatAllTransactionsDeedCell(deedOrSlot: string): string {
  const v = deedOrSlot.trim();
  if (!v || v === "—") return "—";
  if (v.startsWith("صك ")) return v;
  return `صك ${v}`;
}

/**
 * Deed cell for all-transactions table.
 * Phase stays in the «Stage» column — do not append it next to the deed
 * (e.g. avoid `Deed Under study 1 (primary data)`).
 */
export function formatAllTransactionsDeedWithPhase(
  deedOrSlot: string,
  _phaseLabel?: string,
): string {
  return formatAllTransactionsDeedCell(deedOrSlot);
}

export type AllTransactionsQueueRowMeta = {
  task: WorkflowTask;
  deed: string;
  deedCell: string;
  poNumber: string;
  assignmentType: string;
  city: string;
  district: string;
  phaseLabel: string;
  propertyId?: string;
  /** PR-… once official, else the TMP- temporary number; null when the deed has no transaction yet. */
  transactionNumber: string | null;
  /** Deeds in this deed's transaction; above 1 they collapse into one queue row. */
  transactionDeedCount: number;
  /** «بانتظار» — who the live transaction waits for (`transactionProgress`); null when not resolved. */
  waitingOn: string | null;
  /** `waitingOn` as the page's party cards (`TransactionProgress.parties`); empty when not resolved. */
  waitingParties: readonly TransactionParty[];
  /** The deed's property type, under the place (as «أعمالي»). */
  propertyType?: string;
  /** The deed's area as «900.21 م²» under the deed number (Omar 2026-11-16); «» when not entered. */
  area: string;
  /** The work order's description, under its number. */
  poDescription?: string;
  /** The work order's receipt from Enfaz and its deadline. */
  receivedIso?: string;
  dueIso?: string;
  /** Uploaded to Enfaz or cancelled (`closedTransactionProgress`): no deadline runs against it. */
  closed: boolean;
};

/**
 * The key that decides which «كل المعاملات» rows collapse into one: sibling workflow tasks of the
 * same property / slot — and, since phase 4, every deed of a transaction with several deeds
 * (the transaction is the property).
 *
 * How it works, first match wins: 1) the task has a transaction id and the deed's transaction
 * holds more than one deed → `tx::<transactionId>`; 2) a property id → `<po>::prop::<id>`;
 * 3) otherwise `<po>::deed::<deed or —>::ord::<property ordinal>`.
 *
 * Edge cases: a one-deed transaction keeps its per-property key, so ordinary deeds group as before.
 */
function allTransactionsPropertyGroupKey(
  row: Pick<
    AllTransactionsQueueRowMeta,
    "poNumber" | "propertyId" | "deed" | "task" | "transactionDeedCount"
  >,
): string {
  const po = row.poNumber.trim();
  const propertyId = row.propertyId?.trim();
  const transactionId = row.task.transactionId?.trim();
  if (transactionId && row.transactionDeedCount > 1) return `tx::${transactionId}`;
  if (propertyId) return `${po}::prop::${propertyId}`;
  const deed = row.deed.trim() || "—";
  return `${po}::deed::${deed}::ord::${row.task.propertyOrdinal}`;
}

/**
 * Relative progress along the case-study pipeline (higher = farther along).
 * Used to keep one row per property showing the latest stage reached.
 */
function allTransactionsStageProgress(task: WorkflowTask): number {
  const completed = isPartyTaskDone(task);

  if (task.kind === WorkflowTaskKinds.FieldInspection) return completed ? 51 : 50.5;
  if (task.kind === WorkflowTaskKinds.EngineeringSurvey) return completed ? 56 : 55.5;
  if (task.kind === WorkflowTaskKinds.PropertyAppraisal) return completed ? 61 : 60.5;
  if (task.kind === WorkflowTaskKinds.GovernmentReview) return completed ? 71 : 70.5;

  const phaseBase =
    task.phase === CaseStudyTaskPhases.Enfath
      ? 10
      : task.phase === CaseStudyTaskPhases.Bourse
        ? 20
        : task.phase === CaseStudyTaskPhases.Obstruction
          ? 25
          : task.phase === CaseStudyTaskPhases.Distribution
            ? 30
            : task.phase === CaseStudyTaskPhases.CaseStudy
              ? 40
              : task.phase === "done"
                ? 100
                : 15;

  // Fully finished track only when phase is done — intermediate completed rows
  // still rank at the phase they finished so live party work can outrank them.
  if (task.phase === CaseStudyTaskPhases.Done) return 100;
  if (completed) return phaseBase + 0.25;
  return phaseBase;
}

function taskUpdatedMs(task: WorkflowTask): number {
  const ms = Date.parse(task.updatedAt);
  return Number.isFinite(ms) ? ms : 0;
}

function pickFarthestRow(
  group: AllTransactionsQueueRowMeta[],
): AllTransactionsQueueRowMeta {
  let winner = group[0]!;
  for (let i = 1; i < group.length; i++) {
    const cand = group[i]!;
    const progW = allTransactionsStageProgress(winner.task);
    const progC = allTransactionsStageProgress(cand.task);
    if (progC > progW) {
      winner = cand;
      continue;
    }
    if (progC < progW) continue;
    if (taskUpdatedMs(cand.task) > taskUpdatedMs(winner.task)) {
      winner = cand;
    }
  }
  return winner;
}

/**
 * One row per property: furthest pipeline stage, labeled with that stage.
 * When live work remains, only open/blocked tasks compete so the row opens
 * the current stage (not a finished sibling).
 */
export function collapseAllTransactionsToLatestPhase(
  rows: AllTransactionsQueueRowMeta[],
): AllTransactionsQueueRowMeta[] {
  const groups = new Map<string, AllTransactionsQueueRowMeta[]>();
  for (const row of rows) {
    const key = allTransactionsPropertyGroupKey(row);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const collapsed: AllTransactionsQueueRowMeta[] = [];
  for (const group of groups.values()) {
    const allDone = group.every(
      (row) => isPartyTaskDone(row.task),
    );

    const live = group.filter(
      (row) =>
        row.task.status === WorkflowTaskStatuses.Open || row.task.status === WorkflowTaskStatuses.Blocked,
    );
    const pool = live.length > 0 ? live : group;
    const winner = pickFarthestRow(pool);

    const phaseLabel = allDone
      ? "مكتمل"
      : allTransactionsPhaseLabel(winner.task);

    collapsed.push({
      ...winner,
      phaseLabel,
      deedCell: formatAllTransactionsDeedWithPhase(winner.deed, phaseLabel),
    });
  }

  // Stable visual order: newest activity first within the collapsed set.
  collapsed.sort(
    (a, b) => taskUpdatedMs(b.task) - taskUpdatedMs(a.task),
  );
  return collapsed;
}

/**
 * The «المعاملات النشطة» rows: one per property at its latest stage.
 *
 * How it works: builds a row per task, collapses them per property (`collapseAllTransactionsToLatestPhase`),
 * then — when `progressOf` is given (staff) — replaces the coarse phase with the transaction's state
 * («قيد الدراسة», or how a closed one ended) and who it waits for, and drops what it cannot place.
 * Edge cases / changed 2026-11-05 (Omar: «المعاملات النشطة» replaces the hidden «جميع المعاملات»):
 * without `progressOf` (party roles, their own tasks) the rows keep the phase label and every status.
 */
export function buildAllTransactionsQueueRowMeta(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  now: Date,
  progressOf?: (task: WorkflowTask) => (TransactionProgress & { closed?: boolean }) | null,
): AllTransactionsQueueRowMeta[] {
  const rows = tasks.map((task) => {
    const record = poByNumber.get(task.poNumber.trim());
    const property = findPropertyForTask(record, task);
    const row = buildPrimaryDataTableRow(task, property, record, now);
    const deed = row.propertySlot;
    const phaseLabel = allTransactionsPhaseLabel(task);
    return {
      task,
      deed,
      deedCell: formatAllTransactionsDeedWithPhase(deed, phaseLabel),
      poNumber: task.poNumber.trim(),
      assignmentType: row.assignmentType,
      city: row.city,
      district: row.district,
      phaseLabel,
      propertyId: property?.id ?? task.propertyId,
      transactionNumber:
        transactionNumberOf(property) ?? task.transactionNumber ?? null,
      transactionDeedCount: property?.transactionDeedCount ?? 1,
      waitingOn: null,
      waitingParties: [],
      propertyType: task.propertyType,
      area: areaText(property?.area),
      poDescription: record?.workOrderDescription?.trim() || undefined,
      receivedIso: record?.receivedFromEnfathAt || undefined,
      dueIso: record?.dueDateAt || undefined,
      closed: false,
    };
  });
  const collapsed = collapseAllTransactionsToLatestPhase(rows);
  if (!progressOf) return collapsed;
  const live: AllTransactionsQueueRowMeta[] = [];
  for (const row of collapsed) {
    const progress = progressOf(row.task);
    if (!progress) continue;
    live.push({
      ...row,
      // A live transaction reads where it is: the party it waits at, the same word as its card and as
      // the status filter (Omar 2026-11-17, replacing «قيد الدراسة» for every live one). Two parties at
      // once read both. One waiting at no card's party (a failure, an outside party) reads its stage.
      // A closed one reads how it ended.
      phaseLabel:
        progress.closed === true
          ? progress.stage
          : allTxPartiesLabel(progress.parties) || progress.stage,
      waitingOn: progress.waitingOn || null,
      waitingParties: progress.parties,
      closed: progress.closed === true,
    });
  }
  return live;
}

/**
 * How many live transactions wait for each party — the cards above «المعاملات النشطة» (Omar 2026-11-15).
 *
 * How it works: counts each row once under every party in its `waitingParties`.
 * Edge cases: a transaction waiting for two parties at once (inspector and office, review and
 * appraiser) is counted under both, so the cards may add up to more than the rows (Omar: no total
 * card); a failure or an outside party alone is under none.
 */
/**
 * Where a transaction that is no longer live stands, for «جميع العقارات» (Omar 2026-11-15: every
 * property, the uploaded and the cancelled too) — `transactionProgress` gives null for these.
 *
 * How it works: on the deed's case-study task — cancelled → «ملغاة»; uploaded to Enfaz or completed →
 * «مكتملة»; it waits for no one and counts on no card.
 * Edge cases: a live task → null (read `transactionProgress` instead); not a case-study task → null.
 */
export function closedTransactionProgress(
  task: WorkflowTask,
): (TransactionProgress & { closed: true }) | null {
  if (task.kind !== WorkflowTaskKinds.CaseStudyProperty) return null;
  const done = { waitingOn: "", parties: [], closed: true } as const;
  if (task.status === WorkflowTaskStatuses.Cancelled) return { stage: "ملغاة", ...done };
  if (task.propertyHandedOverToEnfaz || task.status === WorkflowTaskStatuses.Completed) return { stage: "مكتملة", ...done };
  return null;
}

/**
 * «جميع العقارات»'s six parties, in the order of its cards. These are the card labels, the status
 * filter's party options and the live rows' status (Omar 2026-11-17).
 */
export const ALL_TX_PARTIES: readonly { party: TransactionParty; label: string }[] = [
  { party: "co", label: "التنسيق" },
  { party: "fi", label: "المعاينة" },
  { party: "es", label: "المكتب الهندسي" },
  { party: "st", label: "الدراسة" },
  { party: "ap", label: "التقييم" },
  { party: "rv", label: "الرفع" },
];

/**
 * What: the status a live row shows, which is where it waits.
 * How it works: the labels of its parties in the cards' order, joined with « · ».
 * Edge cases: "" for no party, so the caller falls back to the stage.
 */
export function allTxPartiesLabel(parties: readonly TransactionParty[]): string {
  return ALL_TX_PARTIES.filter((p) => parties.includes(p.party))
    .map((p) => p.label)
    .join(" · ");
}

export function countAllTransactionsByParty(
  rows: readonly Pick<AllTransactionsQueueRowMeta, "waitingParties">[],
): Record<TransactionParty, number> {
  const counts: Record<TransactionParty, number> = { co: 0, fi: 0, es: 0, st: 0, ap: 0, rv: 0 };
  for (const row of rows) for (const party of row.waitingParties) counts[party] += 1;
  return counts;
}

export function filterAllTransactionsQueueRows(
  rows: AllTransactionsQueueRowMeta[],
  filters: {
    search: string;
    statusFilter: string;
    typeFilter: string;
  },
): WorkflowTask[] {
  const q = filters.search.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (filters.typeFilter && row.assignmentType !== filters.typeFilter) {
        return false;
      }
      if (filters.statusFilter && row.phaseLabel !== filters.statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        row.deed,
        row.deedCell,
        row.poNumber,
        row.assignmentType,
        row.city,
        row.district,
        row.phaseLabel,
        row.waitingOn ?? "",
        row.transactionNumber ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .map((row) => row.task);
}

/** Section-supervisor and above may reopen a completed transaction. */
export function canReopenCompletedTransaction(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === Roles.SectionSupervisor ||
    role === Roles.GeneralManager
  );
}

export function buildAllTransactionsRowMoreItems(options: {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
  viewerRole?: RoleId;
  /** Viewer role + sub-roles — reopening a finished study is the study sub-role's. */
  viewerAccess?: StaffAccess;
  /** Opens the reopen dialog for this row (completed tasks only) — the report reopen for a case-study parent. */
  onReopenCompleted?: () => void;
}): RowMoreMenuItem[] {
  const po = options.task.poNumber.trim();
  const propertyId = options.propertyId?.trim();
  const propertyHref = propertyId
    ? poPropertyDetailPath(po, propertyId)
    : po
      ? poPropertiesPath(po)
      : null;
  const propertyBasicHref = propertyId
    ? poPropertyDetailPath(po, propertyId, "basic")
    : propertyHref;

  const items: RowMoreMenuItem[] = [
    {
      id: "open",
      label: "فتح المعاملة",
      onClick: options.openTask,
    },
  ];

  if (
    options.task.status === WorkflowTaskStatuses.Completed &&
    options.onReopenCompleted &&
    options.viewerRole
  ) {
    if (options.task.kind === WorkflowTaskKinds.CaseStudyProperty) {
      // The server refuses the generic reopen for a case-study parent — it reopens through the
      // issued report, and only the case specialist may.
      if (options.viewerAccess && canReopenCaseStudyReport(options.viewerAccess)) {
        items.push({
          id: "reopen-case-study-report",
          label: "إعادة فتح تقرير الدراسة",
          danger: true,
          onClick: options.onReopenCompleted,
        });
      }
    } else if (canReopenCompletedTransaction(options.viewerRole)) {
      items.push({
        id: "reopen-completed",
        label: "إعادة فتح المعاملة",
        danger: true,
        onClick: options.onReopenCompleted,
      });
    }
  }

  if (propertyHref) {
    items.push({
      id: "phase-log",
      label: "سجل المراحل",
      onClick: () => options.router.push(propertyHref),
    });
  }
  if (propertyBasicHref) {
    items.push({
      id: "property-data",
      label: "عرض بيانات العقار",
      onClick: () => options.router.push(propertyBasicHref),
    });
  }

  return items;
}
