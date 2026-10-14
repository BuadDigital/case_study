import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";

/** DOM id for a case-study matrix answer row. */
export function caseStudyQuestionTargetId(answerKey: string): string {
  return `cs-q-${answerKey}`;
}

export const CASE_STUDY_DEED_REMARKS_ID = "cs-deed-remarks";
export const CASE_STUDY_DEED_NATURE_MATCH_ID = "cs-deed-nature-match";
export const CASE_STUDY_DEED_NATURE_NOTES_ID = "deed-nature-match-notes";

export function scheduleScrollToCaseStudyQuestion(
  answerKey: string,
  delayMs = 120,
): void {
  scheduleScrollToFormField(caseStudyQuestionTargetId(answerKey), delayMs);
}

export function scheduleScrollToCaseStudyField(
  targetId: string | null | undefined,
  delayMs = 120,
): void {
  scheduleScrollToFormField(targetId, delayMs);
}
