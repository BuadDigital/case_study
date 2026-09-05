import type { EnfazTrackingRowDto } from "@platform/api-client";
import { fmt } from "@platform/app-shared/format/number";
import {
  groupRowsByPo,
  revenueAmountsFromRow,
  revenueInPeriod,
  revenuePeriodDateIso,
} from "./finance-revenue-stages";

/**
 * Pure decisions behind the revenue stage tables (`FinanceRevenue*Table.tsx`):
 * filtering, grouping, sorting, sums and the cell labels. No React, no DOM.
 */

export type RevenuePeriod = "all" | "30" | "90";

// Whole amounts without decimals; fractional with two — differs from shared fmtSar which always fixes decimals.
export function fmtSar(n: number): string {
  return `${fmt(n, n % 1 === 0 ? 0 : 2)} ر.س`;
}

export function filterRows(
  rows: EnfazTrackingRowDto[],
  q: string,
  city: string,
  period: RevenuePeriod,
): EnfazTrackingRowDto[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (city && city !== "all") {
      if ((r.city ?? "").trim() !== city) return false;
    }
    if (!revenueInPeriod(revenuePeriodDateIso(r), period)) return false;
    if (!needle) return true;
    const hay =
      `${r.poNumber} ${r.deedNumber} ${r.propertyLabel} ${r.invoiceNumber ?? ""} ${r.city}`.toLowerCase();
    return hay.includes(needle);
  });
}

/** `—` for an empty or whitespace-only value. */
export function textOrDash(value: string | null | undefined): string {
  return (value || "—").trim() || "—";
}

/** Newest completion first; rows without a date sink to the end. */
export function sortByCompletedDesc(
  rows: EnfazTrackingRowDto[],
): EnfazTrackingRowDto[] {
  return [...rows].sort((a, b) =>
    (b.completedAtUtc || "").localeCompare(a.completedAtUtc || ""),
  );
}

/** Under-study groups: work orders A→Z, rows inside newest-completed first. */
export function studyGroups(
  rows: EnfazTrackingRowDto[],
): { poNumber: string; rows: EnfazTrackingRowDto[] }[] {
  return groupRowsByPo(rows)
    .map((group) => ({ ...group, rows: sortByCompletedDesc(group.rows) }))
    .sort((a, b) => a.poNumber.localeCompare(b.poNumber, "en"));
}

/** Rows per work order across the whole tracking set — the «Y» in «X of Y». */
export function rowsPerPo(rows: EnfazTrackingRowDto[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.poNumber || "—";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Sum of the rows whose fees are known (> 0); `feesKnown` is false when none are. */
export function knownFeesTotal(rows: EnfazTrackingRowDto[]): {
  feesSum: number;
  feesKnown: boolean;
} {
  let feesSum = 0;
  let feesKnown = false;
  for (const row of rows) {
    const total = revenueAmountsFromRow(row).total;
    if (total > 0) {
      feesSum += total;
      feesKnown = true;
    }
  }
  return { feesSum, feesKnown };
}

export type RevenueGroupSums = {
  base: number;
  vat: number;
  key: number;
  gross: number;
};

/** Column totals for a collapsible group (billing assistant / collection). */
export function sumRevenueAmounts(rows: EnfazTrackingRowDto[]): RevenueGroupSums {
  const sums: RevenueGroupSums = { base: 0, vat: 0, key: 0, gross: 0 };
  for (const row of rows) {
    const amounts = revenueAmountsFromRow(row);
    sums.base += amounts.taxable;
    sums.vat += amounts.vat;
    sums.key += amounts.key;
    sums.gross += amounts.total;
  }
  return sums;
}

export type StudyRowStatus = { label: string; tone: "warning" | "default" };

/** Status pill under the fees of an under-study row. */
export function studyRowStatus(row: EnfazTrackingRowDto): StudyRowStatus {
  if (row.invoiceNumber?.trim()) {
    return { label: "مفوتر جزئياً", tone: "warning" };
  }
  const work = (row.workStatusLabel || "").trim();
  if (work) return { label: work, tone: "default" };
  return { label: "لم يستحق بعد", tone: "default" };
}

/** Secondary label under the deed — only when it adds something. */
export function studyPropertyCaption(row: EnfazTrackingRowDto): string | null {
  const label = row.propertyLabel?.trim();
  return label && label !== row.deedNumber ? label : null;
}

/** «N متابعة» suffix on a collection group, empty when there were none. */
export function followupSuffix(count: number): string {
  return count > 0 ? ` · ${count} متابعة` : "";
}

/** «متابعة (N)» button label on a collection group. */
export function followButtonLabel(count: number): string {
  return `متابعة${count > 0 ? ` (${count})` : ""}`;
}
