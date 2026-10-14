import { parseLocaleNumber } from "@platform/app-shared/format/number";

/** Typed amount via the shared locale rule; blank or not a number → null. */
export function parseEvaluatorAmount(raw: string): number | null {
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) ? n : null;
}

export function computePropertyTotal(
  landValue: string,
  buildingValue: string,
): number {
  const land = parseEvaluatorAmount(landValue) ?? 0;
  const building = parseEvaluatorAmount(buildingValue) ?? 0;
  return Math.round((land + building) * 100) / 100;
}

export function computeForcedSaleValue(
  total: number,
  discountPctRaw: string,
): number {
  const pct = parseEvaluatorAmount(discountPctRaw) ?? 0;
  const clamped = Math.min(100, Math.max(0, pct));
  return Math.round(total * (1 - clamped / 100) * 100) / 100;
}
