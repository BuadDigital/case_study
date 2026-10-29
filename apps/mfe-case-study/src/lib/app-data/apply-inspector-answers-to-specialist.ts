import type { CaseStudyReportAnswer } from "./case-study-report-data";
import type { PartyQuestionContribution } from "./case-study-party-answers";
import type { PoPropertyIntake } from "./po-intake-data";

/**
 * Pick the field inspector's answer for a question (party id `insp`).
 */
export function inspectorAnswerFromContributions(
  contributions: PartyQuestionContribution[] | undefined,
): CaseStudyReportAnswer | null {
  if (!contributions?.length) return null;
  const insp = contributions.find((c) => c.partyId === "insp");
  if (!insp) return null;
  if (insp.answer === "A" || insp.answer === "B" || insp.answer === "NA") {
    return insp.answer;
  }
  return null;
}

export type SpecialistAnswersMap = Record<string, CaseStudyReportAnswer | null>;

/**
 * The study's deed questions the bourse inquiry already answered.
 *
 * How it works: «هل الصك فعال» (deed_0) from the recorded deed status, «هل الصك مشاع» (deed_9)
 * from the ownership type the server derives from the owners count, «هل العقار موقوف» (deed_6)
 * from the restrictions answer (موقوف ticked → yes; restrictions answered without it → no).
 *
 * Edge cases: an unrecorded value gives no answer. Added 2026-10-28 — the study asked these with
 * no hint, and a «لا» for «مشاع» was issued although the bourse listed two owners.
 */
export function bourseAnswersForStudy(
  property: Pick<
    PoPropertyIntake,
    "deedStatus" | "ownershipType" | "restrictionsPresent" | "restrictionType"
  > | null | undefined,
): SpecialistAnswersMap {
  if (!property) return {};
  const out: SpecialistAnswersMap = {};
  const status = property.deedStatus.trim();
  if (status === "فعال") out.deed_0 = "A";
  else if (status === "غير فعال") out.deed_0 = "B";
  const ownership = property.ownershipType.trim();
  if (ownership === "shared") out.deed_9 = "A";
  else if (ownership === "absolute") out.deed_9 = "B";
  const restrictions = property.restrictionsPresent.trim();
  if (restrictions === "yes") {
    out.deed_6 = property.restrictionType.split(/[,،\s]+/).includes("suspended") ? "A" : "B";
  } else if (restrictions === "no") {
    out.deed_6 = "B";
  }
  return out;
}

/** Fills only the still-empty specialist cells from `defaults`; a chosen answer is never replaced. */
export function fillEmptySpecialistAnswers(
  specialistAnswers: SpecialistAnswersMap,
  defaults: SpecialistAnswersMap,
): { answers: SpecialistAnswersMap; changedKeys: string[] } {
  const answers: SpecialistAnswersMap = { ...specialistAnswers };
  const changedKeys: string[] = [];
  for (const [key, value] of Object.entries(defaults)) {
    const current = answers[key] ?? null;
    if (!value || current === "A" || current === "B" || current === "NA") continue;
    answers[key] = value;
    changedKeys.push(key);
  }
  return { answers, changedKeys };
}

/**
 * Mirror inspector answers into the specialist form so the matrix stays
 * responsive to what the field party filled.
 *
 * - Empty specialist cells take the inspector value.
 * - Cells that still match the previous inspector value follow updates
 *   (still mirroring).
 * - Cells the specialist changed to something else are left alone.
 */
export function applyInspectorAnswersToSpecialist(
  specialistAnswers: SpecialistAnswersMap,
  partyByKey: Record<string, PartyQuestionContribution[]>,
  previousInspector: SpecialistAnswersMap = {},
): {
  answers: SpecialistAnswersMap;
  changedKeys: string[];
  inspectorSnapshot: SpecialistAnswersMap;
} {
  const answers: SpecialistAnswersMap = { ...specialistAnswers };
  const inspectorSnapshot: SpecialistAnswersMap = {};
  const changedKeys: string[] = [];

  for (const [key, contributions] of Object.entries(partyByKey)) {
    const inspector = inspectorAnswerFromContributions(contributions);
    inspectorSnapshot[key] = inspector;
    if (!inspector) continue;

    const current = answers[key] ?? null;
    const previous = previousInspector[key] ?? null;
    const empty = current !== "A" && current !== "B" && current !== "NA";
    const stillMirroring = previous != null && current === previous;

    if (empty || stillMirroring) {
      if (current !== inspector) {
        answers[key] = inspector;
        changedKeys.push(key);
      }
    }
  }

  return { answers, changedKeys, inspectorSnapshot };
}
