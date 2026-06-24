import type { PoIntakeRecord } from "../../lib/prototype/po-intake-data";
import { formatPropertyDeedDisplay } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { taskKindLabel } from "../../lib/prototype/tasks-storage";

/** Deed / property ref for a party child task (title is «kind — deed»). */
export function governmentReviewTaskDeedLabel(task: WorkflowTask): string {
  const parts = task.title
    .split(" — ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1]!;
  if (parts.length === 1) return parts[0]!;
  return `عقار ${task.propertyOrdinal}`;
}

export function governmentReviewTaskKindLabel(task: WorkflowTask): string {
  return taskKindLabel(task.kind);
}

export function governmentReviewTaskRowTitle(
  task: WorkflowTask,
  record?: PoIntakeRecord,
): string {
  const deed = governmentReviewTaskDeedLabel(task);
  if (!record) return deed;

  const property =
    record.properties.find((p) => p.id === task.propertyId) ??
    record.properties.find((p) => {
      const display = formatPropertyDeedDisplay(p);
      return display === deed || display.endsWith(deed);
    });

  if (property?.ownerName?.trim()) {
    return `${formatPropertyDeedDisplay(property) || deed} — ${property.ownerName.trim()}`;
  }

  if (property) {
    return formatPropertyDeedDisplay(property) || deed;
  }

  return deed;
}
