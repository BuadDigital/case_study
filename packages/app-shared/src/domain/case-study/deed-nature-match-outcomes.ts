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

/** Who said «غير مطابق» that «مطابق» now goes against (A→Z 2026-11-02 #20: the engineering office too). */
export type DeedMatchDissent = "inspector" | "office" | "both";

/**
 * Who said «غير مطابق», as the reason's label names them — or null when nobody did.
 *
 * How it works: the inspector's «غير مطابق» and the engineering office's submitted «الصك غير مطابق للطبيعة»
 * combine into one of «المعاين», «المكتب الهندسي», «المعاين والمكتب الهندسي».
 *
 * Edge cases: added A→Z 2026-11-02 #20 — «مطابق» against the office alone used to need no reason.
 */
export function deedMatchDissent(inspectorSaidNo: boolean, officeSaidNo: boolean): DeedMatchDissent | null {
  if (inspectorSaidNo && officeSaidNo) return "both";
  if (inspectorSaidNo) return "inspector";
  return officeSaidNo ? "office" : null;
}

/** The party (or parties) a dissent names, for the reason's label and message. */
export function deedMatchDissentLabel(dissent: DeedMatchDissent | null | undefined): string {
  if (dissent === "office") return "المكتب الهندسي";
  if (dissent === "both") return "المعاين والمكتب الهندسي";
  return "المعاين";
}

/** The «reason required» message against whoever said «غير مطابق» — twin of the server's two messages. */
export function deedMatchOverrideReasonMessage(dissent: DeedMatchDissent | null | undefined): string {
  return dissent === "office"
    ? `سبب اعتماد «مطابق» خلافاً لرأي المكتب الهندسي مطلوب (${DEED_MATCH_OVERRIDE_REASON_MIN} أحرف على الأقل)`
    : DEED_MATCH_OVERRIDE_REASON_MESSAGE;
}

/**
 * «مطابق» chosen while the inspector — or, since A→Z 2026-11-02 #20, the engineering office (pass true for
 * either) — said «غير مطابق» (2026-10-29 ruling): the reason, kept in the
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
