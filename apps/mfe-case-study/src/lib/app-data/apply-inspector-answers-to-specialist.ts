import type { CaseStudyFormAnswer } from "./case-study-form-data";
import type { PartyQuestionContribution } from "./case-study-party-answers";

/**
 * Pick the field inspector's answer for a question (party id `insp`).
 */
export function inspectorAnswerFromContributions(
  contributions: PartyQuestionContribution[] | undefined,
): CaseStudyFormAnswer | null {
  if (!contributions?.length) return null;
  const insp = contributions.find((c) => c.partyId === "insp");
  if (!insp) return null;
  if (insp.answer === "A" || insp.answer === "B" || insp.answer === "NA") {
    return insp.answer;
  }
  return null;
}

export type SpecialistAnswersMap = Record<string, CaseStudyFormAnswer | null>;

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
