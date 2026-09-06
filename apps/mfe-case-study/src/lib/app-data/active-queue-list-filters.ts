import type { FieldInspectionWorkspaceListItemDto } from "@platform/api-client";
import type { PartyTaskSubmissionDto } from "@platform/api-client";
import {
  buildDistributionTableRow,
  buildPrimaryDataTableRow,
  findPropertyForTask,
  type PrimaryDataTableRow,
  type RemainingTimeState,
} from "./my-task-row";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import type { WorkflowTask } from "./tasks-storage";
import { fieldInspectionTaskStatusBadge } from "./field-inspection-work-queue";

export type QueueTaskStatusBadge = { label: string; className: string };

export function resolveQueueTaskStatusBadge(
  task: WorkflowTask,
  options: {
    getTaskStatusBadge?: (task: WorkflowTask) => QueueTaskStatusBadge | null;
    inspectionWorkspace?: FieldInspectionWorkspaceListItemDto;
    partySubmission?: PartyTaskSubmissionDto | null;
  },
): QueueTaskStatusBadge | null {
  void options.partySubmission;
  if (task.kind === "field-inspection") {
    return fieldInspectionTaskStatusBadge(
      task.id,
      task.status,
      options.inspectionWorkspace,
    );
  }
  return options.getTaskStatusBadge?.(task) ?? null;
}

export function resolveQueueTaskStatusFilterLabel(
  badge: QueueTaskStatusBadge | null,
  remainingTime: RemainingTimeState,
): string {
  if (badge?.label.trim()) return badge.label.trim();
  if (remainingTime.status === "overdue") return "متأخرة";
  if (remainingTime.status === "active") return "ضمن المهلة";
  return "—";
}

export type PrimaryQueueRowMeta = {
  task: WorkflowTask;
  /** Record, property, and prebuilt row — loaded here so no consumer rebuilds them per row. */
  record: PoIntakeRecord | undefined;
  property: PoPropertyIntake | null;
  row: PrimaryDataTableRow;
  deed: string;
  assignmentType: string;
  city: string;
  district: string;
  statusLabel: string;
};

/**
 * The PO-record column the server joined onto the task row, or the record-derived
 * value when the task carries none (an unfilled slot). The join in
 * `buildPrimaryQueueRowMeta` / `buildDistributionQueueRowMeta` is no longer the
 * source of these five — pagination-contract §2, "The PO-record joins for display".
 */
function serverColumn(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

export function buildPrimaryQueueRowMeta(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  now: Date,
  resolveBadge: (task: WorkflowTask) => QueueTaskStatusBadge | null,
): PrimaryQueueRowMeta[] {
  return tasks.map((task) => {
    const record = poByNumber.get(task.poNumber.trim());
    const property = findPropertyForTask(record, task);
    const base = buildPrimaryDataTableRow(task, property, record, now);
    const row = {
      ...base,
      city: serverColumn(task.city, base.city),
      district: serverColumn(task.district, base.district),
    };
    const badge = resolveBadge(task);
    return {
      task,
      record,
      property,
      row,
      deed: serverColumn(task.deedNumber, row.propertySlot),
      assignmentType: row.assignmentType,
      city: row.city,
      district: row.district,
      statusLabel: resolveQueueTaskStatusFilterLabel(badge, row.remainingTime),
    };
  });
}

/**
 * Returns the same meta — consumers (tables/cards) read the prebuilt row instead
 * of rebuilding it.
 *
 * The free-text pass is **gone**: the deed / city / district haystack this used
 * to build is exactly what server `q` now matches, so the queues that call this
 * send the search term and render the page they get back
 * (pagination-contract §2, "Retired client-side rules"). Only the two filters
 * the server cannot answer are left: the badge *label* status filter (§2 "still
 * client-side" #1) and the assignment-type label, which the queue resolves as
 * `record.assignmentType ?? task.assignmentType` and so can differ from the
 * column the server would filter on.
 */
export function filterPrimaryQueueRowMeta(
  rows: PrimaryQueueRowMeta[],
  filters: {
    statusFilter: string;
    typeFilter: string;
  },
): PrimaryQueueRowMeta[] {
  if (!filters.typeFilter && !filters.statusFilter) return rows;
  return rows.filter((row) => {
    if (filters.typeFilter && row.assignmentType !== filters.typeFilter) {
      return false;
    }
    if (filters.statusFilter && row.statusLabel !== filters.statusFilter) {
      return false;
    }
    return true;
  });
}

export type DistributionQueueRowMeta = {
  task: WorkflowTask;
  deed: string;
  poNumber: string;
  city: string;
  district: string;
  propertyType: string;
  classification: string;
  assignmentType: string;
};

export function buildDistributionQueueRowMeta(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
): DistributionQueueRowMeta[] {
  return tasks.map((task) => {
    const record = poByNumber.get(task.poNumber.trim());
    const property = findPropertyForTask(record, task);
    const row = buildDistributionTableRow(task, property, record);
    return {
      task,
      deed: serverColumn(task.deedNumber, row.deedLabel),
      poNumber: task.poNumber.trim(),
      city: serverColumn(task.city, row.city),
      district: serverColumn(task.district, row.district),
      propertyType: serverColumn(task.propertyType, row.propertyType),
      classification: serverColumn(task.classification, row.classification),
      assignmentType:
        record?.assignmentType?.trim() || task.assignmentType?.trim() || "—",
    };
  });
}

/**
 * The distribution and case-study tables read a parent's children out of the
 * same list (`buildCaseStudyPartyAssignees`), so their request is deliberately
 * left unnarrowed and unpaged — sending `q` would drop the siblings the party
 * columns need. The free-text pass therefore stays here, over the same five
 * PO-record columns the server would match (pagination-contract §2, and the
 * sibling-reading exception it carves out for these layouts).
 */
export function filterDistributionQueueRows(
  rows: DistributionQueueRowMeta[],
  filters: {
    search: string;
    typeFilter: string;
  },
): WorkflowTask[] {
  const q = filters.search.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (filters.typeFilter && row.assignmentType !== filters.typeFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        row.deed,
        row.poNumber,
        row.city,
        row.district,
        row.propertyType,
        row.classification,
        row.assignmentType,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .map((row) => row.task);
}

export function uniqueSortedLabels(values: string[]): string[] {
  return [...new Set(values.filter((v) => v && v !== "—"))].sort((a, b) =>
    a.localeCompare(b, "ar"),
  );
}
