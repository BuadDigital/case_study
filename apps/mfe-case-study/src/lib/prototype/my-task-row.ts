import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import {
  dueDateToDeadline,
  formatPropertyDeedDisplay,
} from "./po-intake-data";
import {
  taskPhaseLabel,
  taskStatusLabel,
  type WorkflowTask,
} from "./tasks-storage";

export type TaskTableRow = {
  deedLabel: string;
  location: string;
  typeDisplay: string;
  deedStatus: string;
  statusBadgeClass: string;
  statusLabel: string;
};

export type PrimaryDataTableRow = {
  deedLabel: string;
  assignmentType: string;
  propertySlot: string;
  city: string;
  district: string;
  remainingTime: RemainingTimeState;
};

export type DistributionTableRow = {
  deedLabel: string;
  city: string;
  district: string;
  propertyType: string;
  classification: string;
  area: string;
};

export type RemainingTimeState =
  | { status: "missing" }
  | { status: "overdue" }
  | {
      status: "active";
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
    };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Countdown to PO SLA deadline (end of due business day at 17:00). */
export function resolveRemainingTime(
  dueIso: string,
  now: Date = new Date(),
): RemainingTimeState {
  const due = dueDateToDeadline(dueIso);
  if (!due) return { status: "missing" };

  const diffMs = due.getTime() - now.getTime();
  if (diffMs < 0) return { status: "overdue" };

  const totalSec = Math.floor(diffMs / 1000);
  return {
    status: "active",
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

/** أيام + ساعات:دقائق:ثوانٍ — للعرض في الجدول */
export function formatRemainingDuration(
  dueIso: string,
  now: Date = new Date(),
): { remainingDuration: string; remainingOverdue: boolean } {
  const state = resolveRemainingTime(dueIso, now);
  if (state.status === "missing") {
    return { remainingDuration: "—", remainingOverdue: false };
  }
  if (state.status === "overdue") {
    return { remainingDuration: "متأخر", remainingOverdue: true };
  }
  return {
    remainingDuration: `${state.days}.${pad2(state.hours)}:${pad2(state.minutes)}:${pad2(state.seconds)}`,
    remainingOverdue: false,
  };
}

/** أيام متبقية ليوم التسليم — للشريط الوصفي (أرقام غربية). */
export function formatDeliveryRemainingLabel(
  dueIso: string,
  now: Date = new Date(),
): string {
  const day = dueIso.trim().slice(0, 10);
  if (!day) return "—";

  const due = new Date(`${day}T12:00:00`);
  if (Number.isNaN(due.getTime())) return "—";

  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays > 0) {
    return `${diffDays} ${diffDays === 1 ? "يوم" : "أيام"}`;
  }
  if (diffDays < 0) {
    return `متأخر ${Math.abs(diffDays)} يوم`;
  }
  return "0 أيام";
}

export function formatPropertySlotOnPo(
  task: WorkflowTask,
  record: PoIntakeRecord | undefined,
): string {
  const total = Math.max(
    1,
    record?.expectedPropertyCount ?? task.propertyOrdinal,
  );
  return `${task.propertyOrdinal}/${total}`;
}

/** Deed when registered; otherwise slot index on the PO (e.g. 3/12). */
export function formatPrimaryDataPropertyLabel(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
  record: PoIntakeRecord | undefined,
): string {
  if (property) {
    const label = formatPropertyDeedDisplay(property);
    if (label !== "—") return label;
  }
  return formatPropertySlotOnPo(task, record);
}

function fieldOrDash(value: string | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

export function buildDistributionTableRow(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
  record: PoIntakeRecord | undefined,
): DistributionTableRow {
  return {
    deedLabel: formatPrimaryDataPropertyLabel(task, property, record),
    city: fieldOrDash(property?.city),
    district: fieldOrDash(property?.district),
    propertyType: fieldOrDash(property?.propertyType),
    classification: fieldOrDash(property?.classification),
    area: fieldOrDash(property?.area),
  };
}

export function buildPrimaryDataTableRow(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
  record: PoIntakeRecord | undefined,
  now: Date,
): PrimaryDataTableRow {
  const base = buildTaskTableRow(task, property);
  return {
    deedLabel: base.deedLabel,
    assignmentType:
      record?.assignmentType?.trim() || task.assignmentType?.trim() || "—",
    propertySlot: formatPrimaryDataPropertyLabel(task, property, record),
    city: fieldOrDash(property?.city),
    district: fieldOrDash(property?.district),
    remainingTime: resolveRemainingTime(record?.dueDateAt ?? "", now),
  };
}

export function findPropertyForTask(
  record: PoIntakeRecord | undefined,
  task: WorkflowTask,
): PoPropertyIntake | null {
  if (!record || !task.propertyId) return null;
  return record.properties.find((p) => p.id === task.propertyId) ?? null;
}

export function buildTaskTableRow(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
): TaskTableRow {
  const boursePending = property ? !property.bourseDataCompleted : true;
  const deedLabel = property?.deedNumber.trim()
    ? property.deedNumber.trim()
    : `خانة ${task.propertyOrdinal}`;

  const location =
    !property || boursePending
      ? "—"
      : property.district
        ? `${property.city} · ${property.district}`
        : property.city || "—";

  const typeLabel = property?.propertyType || property?.classification || "—";
  const typeDisplay =
    !property || boursePending
      ? task.kind === "case-study-property"
        ? taskPhaseLabel(task.phase)
        : "—"
      : property.classification
        ? `${property.classification} · ${typeLabel}`
        : typeLabel;

  const deedStatus = property?.deedStatus?.trim() || "—";

  if (task.status === "completed" || task.phase === "done") {
    return {
      deedLabel,
      location,
      typeDisplay,
      deedStatus,
      statusBadgeClass: "b-done",
      statusLabel: "مكتملة",
    };
  }
  if (task.status === "blocked" || task.phase === "obstruction") {
    return {
      deedLabel,
      location,
      typeDisplay,
      deedStatus,
      statusBadgeClass: "b-cancel",
      statusLabel: taskStatusLabel(task.status),
    };
  }
  if (boursePending && task.phase === "bourse") {
    return {
      deedLabel,
      location,
      typeDisplay,
      deedStatus,
      statusBadgeClass: "b-prog",
      statusLabel: "بانتظار البورصة",
    };
  }
  if (task.phase === "distribution") {
    return {
      deedLabel,
      location,
      typeDisplay,
      deedStatus,
      statusBadgeClass: "b-prog",
      statusLabel: "بانتظار التوزيع",
    };
  }
  if (task.phase === "case-study") {
    return {
      deedLabel,
      location,
      typeDisplay,
      deedStatus,
      statusBadgeClass: "b-prog",
      statusLabel: "دراسة الحالة",
    };
  }
  if (!property?.deedNumber.trim()) {
    return {
      deedLabel,
      location,
      typeDisplay,
      deedStatus,
      statusBadgeClass: "b-new",
      statusLabel: "جديد",
    };
  }

  return {
    deedLabel,
    location,
    typeDisplay,
    deedStatus,
    statusBadgeClass: "b-prog",
    statusLabel: "بانتظار المراجعة",
  };
}

/** PO receipt date — for FIFO (oldest receipt first). */
function poReceiptDateForSort(
  task: WorkflowTask,
  poByNumber: Map<string, PoIntakeRecord>,
): string {
  const record = poByNumber.get(task.poNumber.trim());
  return (
    record?.receivedFromEnfathAt?.trim() ||
    record?.createdAtUtc?.trim() ||
    task.createdAt ||
    ""
  );
}

/** When the PO was created in the system — for newest-first queues. */
function poCreatedAtForSort(
  task: WorkflowTask,
  poByNumber: Map<string, PoIntakeRecord>,
): string {
  const record = poByNumber.get(task.poNumber.trim());
  return (
    record?.createdAtUtc?.trim() ||
    record?.receivedFromEnfathAt?.trim() ||
    task.createdAt ||
    ""
  );
}

/** Oldest PO receipt first, then property slot within the same PO. */
export function compareQueueTasksOldestFirst(
  a: WorkflowTask,
  b: WorkflowTask,
  poByNumber: Map<string, PoIntakeRecord>,
): number {
  const dateA = poReceiptDateForSort(a, poByNumber);
  const dateB = poReceiptDateForSort(b, poByNumber);
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  const poCmp = a.poNumber.trim().localeCompare(b.poNumber.trim(), "ar");
  if (poCmp !== 0) return poCmp;
  return a.propertyOrdinal - b.propertyOrdinal;
}

/** Newest PO creation first, then property slot within the same PO. */
export function compareQueueTasksNewestFirst(
  a: WorkflowTask,
  b: WorkflowTask,
  poByNumber: Map<string, PoIntakeRecord>,
): number {
  const dateA = poCreatedAtForSort(a, poByNumber);
  const dateB = poCreatedAtForSort(b, poByNumber);
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  const poCmp = a.poNumber.trim().localeCompare(b.poNumber.trim(), "ar");
  if (poCmp !== 0) return poCmp;
  return a.propertyOrdinal - b.propertyOrdinal;
}

/** Next task in queue order after `currentTaskId` (listed must already be sorted). */
export function nextPrimaryDataTaskId(
  listed: WorkflowTask[],
  currentTaskId: string,
  poByNumber: Map<string, PoIntakeRecord>,
): string | null {
  const idx = listed.findIndex((t) => t.id === currentTaskId);
  if (idx >= 0 && idx + 1 < listed.length) {
    return listed[idx + 1]!.id;
  }
  const pivot = listed.find((t) => t.id === currentTaskId);
  if (!pivot) return null;
  return (
    listed.find(
      (t) => compareQueueTasksNewestFirst(pivot, t, poByNumber) < 0,
    )?.id ?? null
  );
}
