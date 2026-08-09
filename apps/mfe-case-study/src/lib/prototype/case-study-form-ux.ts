import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";

/** DOM id for a case-study matrix answer row. */
export function caseStudyQuestionTargetId(answerKey: string): string {
  return `cs-q-${answerKey}`;
}

export function scheduleScrollToCaseStudyQuestion(
  answerKey: string,
  delayMs = 120,
): void {
  scheduleScrollToFormField(caseStudyQuestionTargetId(answerKey), delayMs);
}
