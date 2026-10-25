/**
 * Title, meta line and SLA-timer fields of a task card in the phone queues
 * (`active-transaction-queue-cards`, `InspectorMobileQueue`). Pure — no React.
 */
import {
  formatRemainingDuration,
  resolveSlaTimerRatio,
  type PrimaryDataTableRow,
} from "./my-task-row";
import { formatPoDisplay, type PoIntakeRecord, type PoPropertyIntake } from "./po-intake-data";
import type { WorkflowTask } from "./tasks";

/** «slot — قطعة n — district», or «مهمة <id>» when none of them is known. */
export function queueCardTitle(
  row: Pick<PrimaryDataTableRow, "propertySlot" | "district">,
  property: Pick<PoPropertyIntake, "plotNumber"> | null | undefined,
  taskId: string,
): string {
  const titleParts = [
    row.propertySlot !== "—" ? row.propertySlot : null,
    property?.plotNumber?.trim()
      ? `قطعة ${property.plotNumber.trim()}`
      : null,
    row.district !== "—" ? row.district : null,
  ].filter(Boolean);
  return titleParts.length > 0 ? titleParts.join(" — ") : `مهمة ${taskId}`;
}

export type QueueCardMetaItem = { text: string; kind: "po" | "place" | "type" };

/**
 * The card's meta line: PO, transaction number (when given), city, property type
 * (when asked for), assignment type — skipping the ones that are unknown («—»).
 */
export function queueCardMeta(
  poNumber: string,
  row: Pick<PrimaryDataTableRow, "city" | "assignmentType" | "propertyType">,
  options: { transactionNumber?: string | null; withPropertyType?: boolean } = {},
): QueueCardMetaItem[] {
  const meta: (QueueCardMetaItem | null)[] = [
    { text: formatPoDisplay(poNumber), kind: "po" },
    options.transactionNumber ? { text: options.transactionNumber, kind: "po" } : null,
    row.city !== "—" ? { text: row.city, kind: "place" } : null,
    options.withPropertyType && row.propertyType && row.propertyType !== "—"
      ? { text: row.propertyType, kind: "type" }
      : null,
    row.assignmentType !== "—" ? { text: row.assignmentType, kind: "type" } : null,
  ];
  return meta.filter((v): v is QueueCardMetaItem => v !== null);
}

/** The card's countdown against the order's due date — all unset when there is none. */
export function queueCardTimer(
  record: Pick<PoIntakeRecord, "dueDateAt"> | null | undefined,
  task: Pick<WorkflowTask, "createdAt">,
  now: Date,
): { timerLabel?: string; timerOverdue?: boolean; timerRatio?: number } {
  const timer = formatRemainingDuration(record?.dueDateAt ?? "", now);
  const showTimer = timer.remainingDuration !== "—";
  return {
    timerLabel: showTimer
      ? timer.remainingOverdue
        ? "متأخرة"
        : `متبقي ${timer.remainingDuration}`
      : undefined,
    timerOverdue: showTimer ? timer.remainingOverdue : undefined,
    timerRatio: showTimer
      ? resolveSlaTimerRatio(record?.dueDateAt ?? "", task.createdAt ?? "", now)
      : undefined,
  };
}
