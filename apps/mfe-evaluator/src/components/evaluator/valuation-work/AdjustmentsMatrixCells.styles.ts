// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • A negative adjustment % is amber, not danger red (pctClass) — red is kept for the ±40٪ breach.
// ──────────────────────────────────────────────────────────────────────────────────────────────

import { type KeyboardEvent } from "react";
import { cn, opsLetterCard } from "@platform/ui-kit";
import type { ValuationComparableSelectionDto } from "@platform/api-client";

export const COMMIT_MS = 350;

/** Enter / Tab flush the pending commit; Escape discards the field's own change. */
export function commitKeys(
  e: KeyboardEvent<HTMLInputElement>,
  flush: () => void,
  discard?: () => void,
) {
  if (e.key === "Enter") {
    e.preventDefault();
    flush();
    e.currentTarget.blur();
    return;
  }
  if (e.key === "Tab") {
    flush();
    return;
  }
  if (e.key === "Escape") {
    discard?.();
    e.currentTarget.blur();
  }
}

export function pct(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(2)}%`;
}

/**
 * Sign colour of an adjustment %. A negative adjustment is a normal correction, not an error —
 * amber, never the danger red (red is kept for the ±40٪ breach, see `exceedsLargeAdjustmentThreshold`).
 */
export function pctClass(n: number): string {
  if (n > 0) return "text-[#2f7a4d]";
  if (n < 0) return "text-amber-text";
  return "text-text-2";
}

/** compEdit: effective comparable values after this valuation’s overrides. */
export function effPrice(item: ValuationComparableSelectionDto): number {
  return item.effectivePriceSar ?? item.comparable.price;
}
export function effUnit(item: ValuationComparableSelectionDto): number {
  return item.effectivePricePerSqm ?? item.comparable.pricePerSqm;
}
export function effArea(item: ValuationComparableSelectionDto): number {
  return item.effectiveAreaSqm ?? item.comparable.areaSqm;
}

/* ─── Module-level static classes — design-system tokens (brand + dark mode) via Tailwind ─── */
export const thBandClass =
  "border-b-2 border-b-gold bg-surface-2 px-4 py-[13px] text-start text-[12px] font-bold text-heading";
export const thCompBaseClass =
  "min-w-[126px] border-b-2 border-b-gold px-3 py-[11px] text-center text-[12px] font-bold text-heading";
export const thCompClass = cn(
  thCompBaseClass,
  "border-s border-s-border bg-surface-2",
);
export const tdLabelClass =
  "border-b border-border px-4 py-[9px] text-start align-top";
export const tdSubjClass =
  "min-w-[150px] border-x border-b border-border bg-surface-2 px-2.5 py-[7px] text-center align-middle";
export const tdCellClass = "border-b border-s border-border px-2.5 py-[7px] text-center align-middle";
export const tdJustClass = "min-w-[230px] border-b border-s border-border px-3 py-[7px] text-start align-middle";
export const noteClass = "mt-[3px] text-[10px] font-normal text-text-3";
export const cellInputBaseClass =
  "w-24 rounded-[7px] border px-2 py-[7px] text-center text-[13px] font-bold";
/** Phone card input: full width, 44px tall, 16px text so iOS never zooms on focus. */
export const cellInputTouchClass =
  "min-h-11 w-full rounded-[9px] border px-3 py-2 text-center text-[16px] font-bold";
export const panelCardClass = cn(opsLetterCard, "mb-6");
