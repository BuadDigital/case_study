/**
 * Deed↔nature match outcomes — keep in sync with
 * `RealEstateEval.Shared.Contracts.Domain.DeedNatureMatchOutcomes`.
 *
 * Draft saves allow Unset (empty). Traditional deeds: downstream work
 * (valuation calc and the case-study report) requires `matched`.
 * Registered title skips the gate. فروق / مرشح تعذر is an impediment path,
 * not a report.
 */

export const DeedNatureMatchOutcomes = {
  Unset: "",
  Matched: "matched",
  Differences: "differences",
  Impediment: "impediment",
} as const;

export const DEED_NATURE_MATCH_OPTIONS = [
  { value: DeedNatureMatchOutcomes.Matched, label: "مطابق" },
  { value: DeedNatureMatchOutcomes.Differences, label: "فروق" },
  { value: DeedNatureMatchOutcomes.Impediment, label: "مرشح تعذّر" },
] as const;

export function normalizeDeedNatureMatchOutcome(
  value: string | null | undefined,
): string {
  return (value ?? "").trim().toLowerCase();
}

/** Vocabulary check for draft saves — empty (Unset) is allowed. */
export function isDeedNatureMatchKnown(
  value: string | null | undefined,
): boolean {
  const n = normalizeDeedNatureMatchOutcome(value);
  return (
    n === DeedNatureMatchOutcomes.Unset ||
    n === DeedNatureMatchOutcomes.Matched ||
    n === DeedNatureMatchOutcomes.Differences ||
    n === DeedNatureMatchOutcomes.Impediment
  );
}

/** Specialist chose a concrete outcome. Unset is not chosen. */
export function isDeedNatureMatchChosen(
  value: string | null | undefined,
): boolean {
  const n = normalizeDeedNatureMatchOutcome(value);
  return (
    n === DeedNatureMatchOutcomes.Matched ||
    n === DeedNatureMatchOutcomes.Differences ||
    n === DeedNatureMatchOutcomes.Impediment
  );
}

/**
 * Registered title always passes. Traditional deed: only `matched` unlocks
 * valuation calc and the case-study report.
 */
export function deedNatureMatchAllowsDownstreamWork(
  registeredTitle: boolean,
  outcome: string | null | undefined,
): boolean {
  if (registeredTitle) return true;
  return (
    normalizeDeedNatureMatchOutcome(outcome) === DeedNatureMatchOutcomes.Matched
  );
}

/** The specialist's «مطابق» against the inspector's «غير مطابق» needs this many characters of reason. */
export const DEED_MATCH_OVERRIDE_REASON_MIN = 10;

export const DEED_MATCH_OVERRIDE_REASON_MESSAGE = `سبب اعتماد «مطابق» خلافاً لرأي المعاين مطلوب (${DEED_MATCH_OVERRIDE_REASON_MIN} أحرف على الأقل)`;

/**
 * «مطابق» chosen while the inspector said «غير مطابق» (2026-10-29 ruling): the reason, kept in the
 * match notes, must be at least DEED_MATCH_OVERRIDE_REASON_MIN characters. Twin of the server's
 * CaseStudyReportDeedNatureMatchRules.ValidateForSave(inspectorSaidNotMatched).
 */
export function deedMatchOverrideReasonMissing(
  outcome: string | null | undefined,
  notes: string | null | undefined,
  inspectorSaidNotMatched: boolean,
): boolean {
  return (
    inspectorSaidNotMatched &&
    normalizeDeedNatureMatchOutcome(outcome) === DeedNatureMatchOutcomes.Matched &&
    (notes ?? "").trim().length < DEED_MATCH_OVERRIDE_REASON_MIN
  );
}

export function deedNatureMatchRequiresNotes(
  value: string | null | undefined,
): boolean {
  const n = normalizeDeedNatureMatchOutcome(value);
  return (
    n === DeedNatureMatchOutcomes.Differences ||
    n === DeedNatureMatchOutcomes.Impediment
  );
}
