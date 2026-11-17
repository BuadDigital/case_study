/**
 * A cash area adjustment as the screen and the report print it (2026-11-16, Taqeem curriculum 105
 * examples 16–17: on a whole-value comparison the area difference is an amount in riyals).
 */
import { fmt } from "@platform/app-shared/format/number";

/**
 * What: «+37,500 ر.س», «−22,500 ر.س», «0 ر.س».
 * How it works: the sign, then the amount in whole riyals with thousands separators.
 * Edge cases: a missing or non-numeric amount prints as «0 ر.س».
 */
export function formatCashAdjustment(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  if (n === 0) return "0 ر.س";
  return `${n > 0 ? "+" : "−"}${fmt(Math.abs(n))} ر.س`;
}
