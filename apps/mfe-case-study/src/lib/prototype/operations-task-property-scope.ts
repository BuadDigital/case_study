import type {
  OperationsTaskDto,
  OperationsTaskLetterRowDto,
} from "@platform/api-client";
import { deedsMatch } from "./deed-number";

export type PropertyOpsScopeInput = {
  poNumber: string;
  deedNumber: string;
  /** Display form (e.g. with مدينة) for softer deed matching. */
  deedDisplay?: string;
};

function deedMatchesScope(
  deedOnTask: string,
  scope: PropertyOpsScopeInput,
): boolean {
  const deedNumber = scope.deedNumber.trim();
  const deedDisplay = (scope.deedDisplay ?? deedNumber).trim() || deedNumber;
  return (
    deedsMatch(deedOnTask, deedDisplay) ||
    deedsMatch(deedOnTask, deedNumber) ||
    Boolean(deedNumber && deedOnTask.includes(deedNumber))
  );
}

/**
 * Letter row for this property on a multi-deed (work_order) court visit.
 * Avoids always showing letterRows[0], which may be a sibling property.
 */
export function letterRowForProperty(
  task: OperationsTaskDto | null | undefined,
  scope: PropertyOpsScopeInput,
): OperationsTaskLetterRowDto | null {
  if (!task?.letterRows?.length) return null;
  const match = task.letterRows.find((row) => deedMatchesScope(row.deed, scope));
  return match ?? (task.letterRows.length === 1 ? task.letterRows[0]! : null);
}

/** Same property/deed scope rule as PropertyDetailLinkedTab / MobileGlance. */
export function filterOperationsTasksForProperty(
  tasks: readonly OperationsTaskDto[],
  scope: PropertyOpsScopeInput,
): OperationsTaskDto[] {
  const poNumber = scope.poNumber.trim();

  return tasks.filter((t) => {
    if (t.poNumber?.trim() === poNumber) {
      // Work-order / multi: whole PO applies to every property on that order.
      if (t.scope === "work_order" || t.scope === "multi") return true;
      if (t.scope === "transaction") {
        return t.deeds.some((d) => deedMatchesScope(d, scope));
      }
    }
    return t.deeds.some((d) => deedMatchesScope(d, scope));
  });
}

export function isCourtVisitTask(task: OperationsTaskDto): boolean {
  return task.type === "court_visit";
}

export function courtVisitTasksForProperty(
  tasks: readonly OperationsTaskDto[],
  scope: PropertyOpsScopeInput,
): OperationsTaskDto[] {
  return filterOperationsTasksForProperty(tasks, scope)
    .filter(isCourtVisitTask)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Prefer completed visit with a result; else newest court visit. */
export function primaryCourtVisitTask(
  tasks: readonly OperationsTaskDto[],
  scope: PropertyOpsScopeInput,
): OperationsTaskDto | null {
  const visits = courtVisitTasksForProperty(tasks, scope);
  if (visits.length === 0) return null;
  const completedWithResult = visits.find(
    (t) =>
      t.status === "completed" &&
      Boolean(t.courtVisitResult?.kind?.trim()),
  );
  if (completedWithResult) return completedWithResult;
  const completed = visits.find((t) => t.status === "completed");
  return completed ?? visits[0] ?? null;
}

export const COURT_VISIT_RESULT_KIND_LABELS: Record<string, string> = {
  received: "استُلم ظرف مفاتيح",
  other_party: "الظرف عند طرف آخر (إفادة الدائرة)",
  none: "لا يوجد ظرف / لم يُستلم",
  other: "أخرى",
};

export function courtVisitResultKindLabel(kind: string | null | undefined): string {
  const k = kind?.trim() ?? "";
  if (!k) return "—";
  return COURT_VISIT_RESULT_KIND_LABELS[k] ?? k;
}
