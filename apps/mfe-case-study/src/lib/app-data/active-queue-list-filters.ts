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

export function buildPrimaryQueueRowMeta(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  now: Date,
  resolveBadge: (task: WorkflowTask) => QueueTaskStatusBadge | null,
): PrimaryQueueRowMeta[] {
  return tasks.map((task) => {
    const record = poByNumber.get(task.poNumber.trim());
    const property = findPropertyForTask(record, task);
    const row = buildPrimaryDataTableRow(task, property, record, now);
    const badge = resolveBadge(task);
    return {
      task,
      record,
      property,
      row,
      deed: row.propertySlot,
      assignmentType: row.assignmentType,
      city: row.city,
      district: row.district,
      statusLabel: resolveQueueTaskStatusFilterLabel(badge, row.remainingTime),
    };
  });
}

/** Returns the same meta — consumers (tables/cards) read the prebuilt row instead of rebuilding it. */
export function filterPrimaryQueueRowMeta(
  rows: PrimaryQueueRowMeta[],
  filters: {
    search: string;
    statusFilter: string;
    typeFilter: string;
  },
): PrimaryQueueRowMeta[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.typeFilter && row.assignmentType !== filters.typeFilter) {
      return false;
    }
    if (filters.statusFilter && row.statusLabel !== filters.statusFilter) {
      return false;
    }
    if (!q) return true;
    const hay = [row.deed, row.assignmentType, row.city, row.district]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
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
      deed: row.deedLabel,
      poNumber: task.poNumber.trim(),
      city: row.city,
      district: row.district,
      propertyType: row.propertyType,
      classification: row.classification,
      assignmentType:
        record?.assignmentType?.trim() || task.assignmentType?.trim() || "—",
    };
  });
}

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
