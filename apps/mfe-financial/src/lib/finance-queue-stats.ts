import type { InspectorFeeBillingStatus, InspectorFeeRowDto } from "@platform/api-client";
import { compareInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";

export type FinanceDisburseBuckets = {
  readyToDisburse: InspectorFeeRowDto[];
  waitingOffice: InspectorFeeRowDto[];
  needsAttention: InspectorFeeRowDto[];
};

const ATTENTION_STATUSES: InspectorFeeBillingStatus[] = ["returned", "inquiry"];

/** ج٩: party fee statement path — not the legacy DisbursementBatch صرف queue. */
function isStatementBillingPath(row: InspectorFeeRowDto): boolean {
  const statementKind =
    row.taskKind === "engineering-survey" ||
    row.taskKind === "field-inspection" ||
    row.taskKind === "government-review";
  return (
    statementKind &&
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
      // A line under pricing dispute belongs to operations until it is resolved, and must not show
      // up on the finance surface even for an actor who can see it elsewhere. A suspended line is
      // withheld by the supervisor, so it is not payable either.
      r.billingStatus !== "disputed" &&
      r.billingStatus !== "suspended" &&
      !isStatementBillingPath(r),
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
    // Only legacy rows that somehow remain at-finance outside the statement path.
    waitingOffice: sorted.filter((r) => r.billingStatus === "at-finance"),
    needsAttention: sorted.filter((r) =>
      ATTENTION_STATUSES.includes(r.billingStatus),
    ),
  };
}

export function countFinanceDisburseActions(rows: InspectorFeeRowDto[]) {
  const visible = financeDisburseVisibleRows(rows);
  return {
    readyToDisburse: visible.filter((r) => r.billingStatus === "disb-req").length,
    waitingOffice: visible.filter((r) => r.billingStatus === "at-finance").length,
    needsAttention: visible.filter((r) =>
      ATTENTION_STATUSES.includes(r.billingStatus),
    ).length,
  };
}
