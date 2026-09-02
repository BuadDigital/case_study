import {
  type RowMoreMenuItem,
  type StatusPillStyle,
} from "@platform/ui-kit";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import type { RoleId } from "@platform/types";
import {
  buildPrimaryDataTableRow,
  findPropertyForTask,
} from "./my-task-row";
import type { PoIntakeRecord } from "./po-intake-data";
import {
  taskKindLabel,
  type WorkflowTask,
} from "./tasks-storage";
import { poPropertyDetailPath, poPropertiesPath } from "@platform/app-shared/domain/po-routes";

/** Short phase labels matching Case Study.html `renderAllTransactions`. */
export function allTransactionsPhaseLabel(task: WorkflowTask): string {
  if (task.status === "completed" || task.phase === "done") return "مكتمل";
  if (task.kind === "government-review") return "المراجعة الحكومية";
  if (task.kind === "field-inspection") return "معاينة العقار";
  if (task.kind === "property-appraisal") return "تقييم العقار";
  if (task.kind === "engineering-survey") return "الرفع المساحي";
  if (task.phase === "enfath") return "البيانات الأولية";
  if (task.phase === "bourse") return "البورصة";
  if (task.phase === "distribution") return "التوزيع";
  if (task.phase === "case-study") return "دراسة الحالة";
  if (task.phase === "obstruction") return "تعذر";
  return taskKindLabel(task.kind);
}

export function allTransactionsPhaseStyle(task: WorkflowTask): StatusPillStyle {
  const label = allTransactionsPhaseLabel(task);
  if (label === "مكتمل") {
    return { base: "var(--success)", fg: "var(--success-text)" };
  }
  if (label === "البورصة" || label === "تعذر") {
    return { base: "var(--amber)", fg: "var(--amber-text)" };
  }
  if (label === "البيانات الأولية") {
    return { base: "#8a8d96", fg: "#696c75" };
  }
  // Case study / distribution / government review / party stages
  return { base: "var(--gold)", fg: "var(--gold-d)" };
}

/** Deed cell: `Deed {n}` as in Case Study.html. */
export function formatAllTransactionsDeedCell(deedOrSlot: string): string {
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
};

/** Groups sibling workflow tasks that belong to the same property / slot. */
export function allTransactionsPropertyGroupKey(
  row: Pick<
    AllTransactionsQueueRowMeta,
    "poNumber" | "propertyId" | "deed" | "task"
  >,
): string {
  const po = row.poNumber.trim();
  const propertyId = row.propertyId?.trim();
  if (propertyId) return `${po}::prop::${propertyId}`;
  const deed = row.deed.trim() || "—";
  return `${po}::deed::${deed}::ord::${row.task.propertyOrdinal}`;
}

/**
 * Relative progress along the case-study pipeline (higher = farther along).
 * Used to keep one row per property showing the latest stage reached.
 */
export function allTransactionsStageProgress(task: WorkflowTask): number {
  const completed =
    task.status === "completed" || task.phase === "done";

  if (task.kind === "field-inspection") return completed ? 51 : 50.5;
  if (task.kind === "engineering-survey") return completed ? 56 : 55.5;
  if (task.kind === "property-appraisal") return completed ? 61 : 60.5;
  if (task.kind === "government-review") return completed ? 71 : 70.5;

  const phaseBase =
    task.phase === "enfath"
      ? 10
      : task.phase === "bourse"
        ? 20
        : task.phase === "obstruction"
          ? 25
          : task.phase === "distribution"
            ? 30
            : task.phase === "case-study"
              ? 40
              : task.phase === "done"
                ? 100
                : 15;

  // Fully finished track only when phase is done — intermediate completed rows
  // still rank at the phase they finished so live party work can outrank them.
  if (task.phase === "done") return 100;
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
      (row) =>
        row.task.status === "completed" || row.task.phase === "done",
    );

    const live = group.filter(
      (row) =>
        row.task.status === "open" || row.task.status === "blocked",
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

export function buildAllTransactionsQueueRowMeta(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  now: Date,
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
    };
  });
  return collapseAllTransactionsToLatestPhase(rows);
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
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .map((row) => row.task);
}

export function uniqueSortedPoOrder(poNumbers: string[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const po of poNumbers) {
    const key = po.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  return order;
}

/** Section-supervisor and above may reopen a completed transaction. */
export function canReopenCompletedTransaction(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "general-manager"
  );
}

export function buildAllTransactionsRowMoreItems(options: {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
  viewerRole?: RoleId;
  /** Opens the «Reopen transaction» modal for this row (completed tasks only). */
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
    options.task.status === "completed" &&
    options.onReopenCompleted &&
    options.viewerRole &&
    canReopenCompletedTransaction(options.viewerRole)
  ) {
    items.push({
      id: "reopen-completed",
      label: "إعادة فتح المعاملة",
      danger: true,
      onClick: options.onReopenCompleted,
    });
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
