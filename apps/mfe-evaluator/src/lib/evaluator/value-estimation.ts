import { amountToArabicWords } from "./arabic-amount-words";

export function parseEvaluatorAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
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

/** تفقيط بأسلوب إنفاذ: الصفر يظهر «صفر» فقط، وغير الصفر بالريال. */
export function amountWordsOrZero(value: number | string): string {
  const n =
    typeof value === "number" ? value : parseEvaluatorAmount(value);
  if (n == null) return "صفر";
  if (n === 0) return "صفر";
  return amountToArabicWords(n);
}
