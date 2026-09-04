/**
 * Pure state helpers behind the case study form hooks: the step sections and
 * their clamping, the draft seed, the hydration merge and the answer scans
 * (progress summary, missing answers, deed non-match). No React and no I/O.
 */
import {
  caseStudyAnswerKey,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "../../lib/app-data/case-study-form-data";
import {
  emptyCaseStudyFormDraft,
  type CaseStudyFormDraft,
} from "../../lib/app-data/case-study-form-model";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";

export const FORM_STEP_SECTIONS: CaseStudyQuestionSection[] = [
  "deed",
  "survey",
  "comp",
  "occ",
  "extra",
];

export type SectionQuestions = Record<
  CaseStudyQuestionSection,
  readonly string[]
>;

/** Question is visible to the current viewer (specialist or party). */
export type QuestionVisibilityPredicate = (key: string) => boolean;

/** Clamp step index; only shift when value is from legacy six-tab drafts (promulgation + 5 sections). */
export function normalizeFormStep(storedStep: number): number {
  const max = FORM_STEP_SECTIONS.length - 1;
  let step = storedStep;
  if (step > max) {
    step = step - 1;
  }
  return Math.max(0, Math.min(max, step));
}

export function buildSeed(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
  requestDateSeed?: string,
): Partial<CaseStudyFormDraft> {
  const deed = property?.deedNumber?.trim() ?? "";
  return {
    requestNumber: task.poNumber.trim(),
    requestDate: requestDateSeed?.slice(0, 10) || undefined,
    deedNumber: deed,
    propertyId: property?.id,
    poNumber: task.poNumber.trim(),
  };
}

function isAnswered(value: CaseStudyFormAnswer | null | undefined): boolean {
  return value === "A" || value === "B" || value === "NA";
}

/** The stored draft merged onto the seed — party drafts layer over the parent answers. */
export function hydrateCaseStudyFormDraft(args: {
  stored: CaseStudyFormDraft | null;
  parentDraft: CaseStudyFormDraft | null;
  seed: Partial<CaseStudyFormDraft>;
  storageTaskId: string;
  isParty: boolean;
}): { draft: CaseStudyFormDraft; parentSubmitted: boolean } {
  const { stored, parentDraft, seed, storageTaskId, isParty } = args;
  const base = stored ?? emptyCaseStudyFormDraft(storageTaskId, seed);
  const mergedAnswers = isParty
    ? { ...parentDraft?.answers, ...base.answers }
    : base.answers;
  const parentSubmitted = parentDraft?.status === "submitted";
  return {
    parentSubmitted,
    draft: {
      ...base,
      ...seed,
      answers: mergedAnswers,
      status: parentSubmitted && isParty ? "submitted" : base.status,
      specialistReviewApproved: {
        ...base.specialistReviewApproved,
        ...stored?.specialistReviewApproved,
      },
      requestNumber: seed.requestNumber ?? base.requestNumber,
      deedNumber: seed.deedNumber ?? base.deedNumber,
      requestDate: seed.requestDate ?? base.requestDate,
      currentStep: stored ? normalizeFormStep(stored.currentStep) : 0,
    },
  };
}

/** Answered / pending counts over the questions visible to this viewer. */
export function caseStudyAnswerSummary(
  answers: CaseStudyFormDraft["answers"],
  sectionQuestions: SectionQuestions,
  isQuestionVisible: QuestionVisibilityPredicate,
): { total: number; answered: number; pending: number; pct: number } {
  let total = 0;
  let answered = 0;
  for (const section of FORM_STEP_SECTIONS) {
    sectionQuestions[section].forEach((_, i) => {
      const key = caseStudyAnswerKey(section, i);
      if (!isQuestionVisible(key)) return;
      total += 1;
      if (isAnswered(answers[key])) answered += 1;
    });
  }
  const pending = total - answered;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return { total, answered, pending, pct };
}

/** Visible deed questions answered «غير مطابق» — remarks become mandatory. */
export function deedNonMatchAnswerKeys(
  answers: CaseStudyFormDraft["answers"],
  sectionQuestions: SectionQuestions,
  isQuestionVisible: QuestionVisibilityPredicate,
): string[] {
  return sectionQuestions.deed
    .map((_, i) => caseStudyAnswerKey("deed", i))
    .filter((key) => isQuestionVisible(key) && answers[key] === "B");
}

/** Unanswered visible questions plus the first one, for the scroll-to on submit. */
export function collectMissingCaseStudyAnswers(
  answers: CaseStudyFormDraft["answers"],
  sectionQuestions: SectionQuestions,
  isQuestionVisible: QuestionVisibilityPredicate,
): { missing: Set<string>; firstMissingKey: string | null; firstMissingStep: number | null } {
  const missing = new Set<string>();
  let firstMissingKey: string | null = null;
  let firstMissingStep: number | null = null;
  FORM_STEP_SECTIONS.forEach((section, stepIndex) => {
    sectionQuestions[section].forEach((_, i) => {
      const key = caseStudyAnswerKey(section, i);
      if (!isQuestionVisible(key)) return;
      if (isAnswered(answers[key])) return;
      missing.add(key);
      if (!firstMissingKey) {
        firstMissingKey = key;
        firstMissingStep = stepIndex;
      }
    });
  });
  return { missing, firstMissingKey, firstMissingStep };
}
