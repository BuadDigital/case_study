import type { FailureRecord, FailureStatus } from "./failures-types";
import {
  DEED_INACTIVE_RESOLVED_LABEL,
  failureProblemTypeLabel,
} from "./failure-types-data";
import { isHistoricalFailureStatus } from "./failures-types";

export function failureRecordTitle(
  failure: Pick<FailureRecord, "problemTypeId" | "title" | "status">,
): string {
  if (
    failure.problemTypeId === "deed-inactive" &&
    isHistoricalFailureStatus(failure.status)
  ) {
    return DEED_INACTIVE_RESOLVED_LABEL;
  }
  return failureProblemTypeLabel(failure.problemTypeId, failure.title);
}

export function isPanelBlockingFailure(
  failure: Pick<FailureRecord, "status">,
): boolean {
  return (
    failure.status === "internal" ||
    failure.status === "review" ||
    failure.status === "returned"
  );
}

export function failureStatusLabel(status: FailureStatus): string {
  if (status === "internal") return "مسودة داخلية";
  if (status === "review") return "عند مشرف دراسة الحالة";
  if (status === "suspended") return "معلقة";
  if (status === "approved") return "معتمد";
  if (status === "resolved") return "تم الحل";
  return "معاد للأخصائي";
}

export function failureSeverityLabel(
  severity: FailureRecord["severity"],
): string {
  if (severity === "suspected") return "احتمال تعذر";
  return "تعذر داخلي";
}

export type GroupedFailureRow = {
  id: string;
  title: string;
  statusLabel: string;
  count: number;
  latestUpdatedAt: string;
};

export function failureOccurrenceSuffix(count: number): string {
  if (count <= 1) return "";
  if (count === 2) return " · مرتين";
  return ` · ${count} مرات`;
}

/** Collapse identical title + status rows (e.g. duplicate resolved deed records). */
export function groupSimilarFailureRecords(
  failures: FailureRecord[],
): GroupedFailureRow[] {
  const groups = new Map<string, GroupedFailureRow>();

  for (const failure of failures) {
    const title = failureRecordTitle(failure);
    const statusLabel = failureStatusLabel(failure.status);
    const key = `${title}|${failure.status}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      if (failure.updatedAt > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = failure.updatedAt;
      }
      continue;
    }

    groups.set(key, {
      id: key,
      title,
      statusLabel,
      count: 1,
      latestUpdatedAt: failure.updatedAt,
    });
  }

  return [...groups.values()].sort((a, b) =>
    b.latestUpdatedAt.localeCompare(a.latestUpdatedAt),
  );
}
