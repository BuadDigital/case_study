import type { InspectorFeeBillingStatus, InspectorFeeRowDto } from "@platform/api-client";

export type FinanceDisburseBuckets = {
  readyToDisburse: InspectorFeeRowDto[];
  waitingOffice: InspectorFeeRowDto[];
  needsAttention: InspectorFeeRowDto[];
};

const ATTENTION_STATUSES: InspectorFeeBillingStatus[] = ["returned", "inquiry"];

export function financeDisburseVisibleRows(rows: InspectorFeeRowDto[]): InspectorFeeRowDto[] {
  return rows.filter(
    (r) =>
      r.workStatus !== "cancelled" &&
      r.billingStatus !== "disbursed" &&
      r.billingStatus !== "draft" &&
      r.billingStatus !== "sup-review",
  );
}

export function bucketFinanceDisburseRows(rows: InspectorFeeRowDto[]): FinanceDisburseBuckets {
  const sorted = [...rows].sort((a, b) => {
    const batchA = a.disbursementBatchId ?? "";
    const batchB = b.disbursementBatchId ?? "";
    if (batchA && batchB && batchA !== batchB) return batchA.localeCompare(batchB);
    if (batchA && !batchB) return -1;
    if (!batchA && batchB) return 1;
    return a.propertyLabel.localeCompare(b.propertyLabel, "ar");
  });

  return {
    readyToDisburse: sorted.filter((r) => r.billingStatus === "disb-req"),
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
