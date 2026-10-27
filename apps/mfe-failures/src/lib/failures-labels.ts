import type { FailureRecord, FailureStatus } from "@platform/app-shared/failures/failures-types";
import {
  DEED_INACTIVE_RESOLVED_LABEL,
  failureProblemTypeLabel,
} from "./failure-types-data";
import { isHistoricalFailureStatus } from "@platform/app-shared/failures/failures-types";

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
  if (status === "review") return "قيد المراجعة";
  if (status === "suspended") return "معلّقة";
  if (status === "approved") return "معتمد";
  if (status === "resolved") return "تم الحل";
  return "معاد للأخصائي";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Display labels for raiser / specialist cells (system token + raw user ids). */
export function failureActorLabel(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "—";
  if (value.toLowerCase() === "system" || value === "النظام") return "النظام";
  if (UUID_PATTERN.test(value)) {
    return "—";
  }
  return value;
}

/**
 * The queue's «الحالة» cell — the failure's stage, the severity folded in: a failure not yet
 * escalated reads «احتمال تعذّر» or «تعذّر داخلي», the supervisor's approval reads «تعذّر نهائي».
 *
 * How it works: `internal` splits on the severity; every other status maps to one word.
 *
 * Edge cases: the table used to carry a separate «الخطورة» column (احتمال / مؤكد) while this cell
 * said «داخلي» for a possible failure and «مفتوح» for both a new and a returned one — the two
 * columns contradicted each other. they are merged now; «مُعاد» now tells the specialist
 * the supervisor sent it back, and «معلّق» agrees in gender with the other values.
 */
export function failureListStatusLabel(
  status: FailureStatus,
  severity?: FailureRecord["severity"],
): string {
  if (status === "internal") {
    return severity === "suspected" ? "احتمال تعذّر" : "تعذّر داخلي";
  }
  if (status === "returned") return "مُعاد";
  if (status === "review") return "قيد المراجعة";
  if (status === "approved") return "تعذّر نهائي";
  if (status === "resolved") return "تم الحل";
  if (status === "suspended") return "معلّق";
  return failureStatusLabel(status);
}

/**
 * The pill colour of `failureListStatusLabel`.
 *
 * How it works: keyed on the status (and severity for `internal`) — navy for a possible failure,
 * red for work waiting on the specialist, gold under review, dark red for a final failure, green
 * once resolved, grey otherwise.
 *
 * Edge cases: it used to compare the label text, so renaming a label silently turned its pill
 * grey; keying on the status keeps colours stable through wording changes. A final failure is no
 * longer green — it was grouped with «تم الحل» as "closed", which read as good news.
 */
export function failureListStatusColor(
  status: FailureStatus,
  severity?: FailureRecord["severity"],
): string {
  if (status === "internal") return severity === "suspected" ? "#102B4E" : "#d9694f";
  if (status === "returned") return "#d9694f";
  if (status === "review") return "#d9a441";
  if (status === "approved") return "#a33a3a";
  if (status === "resolved") return "#3f8f5f";
  return "#8a8d96";
}

export function failureSeverityLabel(
  severity: FailureRecord["severity"],
): string {
  if (severity === "suspected") return "احتمال تعذّر";
  return "تعذّر داخلي";
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
