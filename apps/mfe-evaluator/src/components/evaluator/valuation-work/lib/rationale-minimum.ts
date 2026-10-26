/**
 * Round-2 decision B — a rationale the methodology requires (a non-zero adjustment factor, a
 * manual weight, an alert override, the liquidation discount, the cap rate outside 4–12٪) is at
 * least 10 characters after trimming. Mirrors the server's `JustificationRules.RequiredMinLength`
 * and its message, so the field is marked before the round trip. Blank stays the caller's own
 * rule (a draft, or «مطلوب»). Pure.
 */
export const REQUIRED_RATIONALE_MIN_LENGTH = 10;

/** Written but shorter than the minimum (blank is not "too short"). */
export function isRationaleBelowMinimum(text: string | null | undefined): boolean {
  const length = (text ?? "").trim().length;
  return length > 0 && length < REQUIRED_RATIONALE_MIN_LENGTH;
}

/** «مبرر الوزن اليدوي يجب ألا يقل عن 10 أحرف» — the server's wording. */
export function rationaleMinimumMessage(labelAr: string): string {
  return `${labelAr} يجب ألا يقل عن ${REQUIRED_RATIONALE_MIN_LENGTH} أحرف`;
}

/** The message when `text` is written but too short, else null. */
export function rationaleMinimumError(labelAr: string, text: string | null | undefined): string | null {
  return isRationaleBelowMinimum(text) ? rationaleMinimumMessage(labelAr) : null;
}
