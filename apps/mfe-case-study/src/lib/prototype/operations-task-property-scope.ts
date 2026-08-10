import type { OperationsTaskDto } from "@platform/api-client";
import { deedsMatch } from "./deed-number";

export type PropertyOpsScopeInput = {
  poNumber: string;
  deedNumber: string;
  /** Display form (e.g. with مدينة) for softer deed matching. */
  deedDisplay?: string;
};

/** Same property/deed scope rule as PropertyDetailLinkedTab / MobileGlance. */
export function filterOperationsTasksForProperty(
  tasks: readonly OperationsTaskDto[],
  scope: PropertyOpsScopeInput,
): OperationsTaskDto[] {
  const poNumber = scope.poNumber.trim();
  const deedNumber = scope.deedNumber.trim();
  const deedDisplay = (scope.deedDisplay ?? deedNumber).trim() || deedNumber;

  return tasks.filter((t) => {
    if (t.poNumber?.trim() === poNumber) {
      if (t.scope === "work_order" || t.scope === "multi") return true;
      if (t.scope === "transaction") {
        return t.deeds.some(
          (d) =>
            deedsMatch(d, deedDisplay) ||
            deedsMatch(d, deedNumber) ||
            (deedNumber && d.includes(deedNumber)),
        );
      }
    }
    return t.deeds.some(
      (d) =>
        deedsMatch(d, deedDisplay) ||
        deedsMatch(d, deedNumber) ||
        (deedNumber && d.includes(deedNumber)),
    );
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
