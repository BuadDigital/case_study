import type { InspectorFeeBillingStatus, InspectorFeeRowDto } from "@platform/api-client";
import { compareInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";

export type FinanceDisburseBuckets = {
  readyToDisburse: InspectorFeeRowDto[];
  waitingOffice: InspectorFeeRowDto[];
  needsAttention: InspectorFeeRowDto[];
};

const ATTENTION_STATUSES: InspectorFeeBillingStatus[] = ["returned", "inquiry"];

/** Engineering office ready/deferred/statement lines are not party صرف. */
function isEngSurveyBillingPath(row: InspectorFeeRowDto): boolean {
  return (
    row.taskKind === "engineering-survey" &&
    (row.billingStatus === "at-finance" ||
      row.billingStatus === "deferred" ||
      row.billingStatus === "in-statement")
  );
}

export function financeDisburseVisibleRows(rows: InspectorFeeRowDto[]): InspectorFeeRowDto[] {
  return rows.filter(
    (r) =>
      r.workStatus !== "cancelled" &&
      r.billingStatus !== "disbursed" &&
      r.billingStatus !== "draft" &&
      r.billingStatus !== "sup-review" &&
      !isEngSurveyBillingPath(r),
  );
}

export function bucketFinanceDisburseRows(rows: InspectorFeeRowDto[]): FinanceDisburseBuckets {
  const sorted = [...rows].sort((a, b) => {
    const batchA = a.disbursementBatchId ?? "";
    const batchB = b.disbursementBatchId ?? "";
    if (batchA && batchB && batchA !== batchB) {
      // Newer batches first when both have ids — fall back to date within mixed sets.
      const dateCmp = compareInspectorFeeRowsNewestFirst(a, b);
      if (dateCmp !== 0) return dateCmp;
      return batchB.localeCompare(batchA);
    }
    if (batchA && !batchB) return -1;
    if (!batchA && batchB) return 1;
    return compareInspectorFeeRowsNewestFirst(a, b);
  });

  return {
    readyToDisburse: sorted.filter((r) => r.billingStatus === "disb-req"),
    waitingOffice: sorted.filter(
      (r) =>
        r.billingStatus === "at-finance" &&
        r.taskKind !== "engineering-survey",
    ),
    needsAttention: sorted.filter((r) =>
      ATTENTION_STATUSES.includes(r.billingStatus),
    ),
  };
}

export function countFinanceDisburseActions(rows: InspectorFeeRowDto[]) {
  const visible = financeDisburseVisibleRows(rows);
  return {
    readyToDisburse: visible.filter((r) => r.billingStatus === "disb-req").length,
    waitingOffice: visible.filter(
      (r) =>
        r.billingStatus === "at-finance" &&
        r.taskKind !== "engineering-survey",
    ).length,
    needsAttention: visible.filter((r) =>
      ATTENTION_STATUSES.includes(r.billingStatus),
    ).length,
  };
}
