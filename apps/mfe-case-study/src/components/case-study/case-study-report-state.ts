import { caseStudyAnswerKey, type CaseStudyReportAnswer, type CaseStudyQuestionSection } from "../../lib/app-data/case-study-report-data";
import { emptyCaseStudyReportDraft, type CaseStudyReportDraft } from "../../lib/app-data/case-study-report-model";
import { CASE_STUDY_DEED_NATURE_MATCH_ID, 
  CASE_STUDY_DEED_NATURE_NOTES_ID,
  caseStudyQuestionTargetId,
} from "../../lib/app-data/case-study-report-ux";
import { deedNatureMatchAllowsDownstreamWork, deedNatureMatchRequiresNotes, isDeedNatureMatchChosen,
  normalizeDeedNatureMatchOutcome,
} from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import {
  propertyHasRegisteredTitle,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";

export const FORM_STEP_SECTIONS: CaseStudyQuestionSection[] = [
  "deed",
  "survey",
  "comp",
  "occ",
  "extra",
];

export type SectionQuestions = Record< CaseStudyQuestionSection, readonly string[]>;

/** Question is visible to the current viewer (specialist or party). */
export type QuestionVisibilityPredicate = (key: string) => boolean;

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
): Partial<CaseStudyReportDraft> {
  const deed = property?.deedNumber?.trim() ?? "";
  return {
    requestNumber: task.poNumber.trim(),
    requestDate: requestDateSeed?.slice(0, 10) || undefined,
    deedNumber: deed,
    propertyId: property?.id,
    poNumber: task.poNumber.trim(),
  };
}

function isAnswered(value: CaseStudyReportAnswer | null | undefined): boolean {
  return value === "A" || value === "B" || value === "NA";
}

/** The stored draft merged onto the seed — party drafts layer over the parent answers. */
export function hydrateCaseStudyReportDraft(args: {
  stored: CaseStudyReportDraft | null;
  parentDraft: CaseStudyReportDraft | null;
  seed: Partial<CaseStudyReportDraft>;
  storageTaskId: string;
  isParty: boolean;
}): { draft: CaseStudyReportDraft; parentSubmitted: boolean } {
  const { stored, parentDraft, seed, storageTaskId, isParty } = args;
  const base = stored ?? emptyCaseStudyReportDraft(storageTaskId, seed);
  const mergedAnswers = isParty
    ? { ...parentDraft?.answers, ...base.answers }
    : base.answers;
  const mergedNotes = isParty
    ? { ...parentDraft?.answerNotes, ...base.answerNotes }
    : base.answerNotes;
  const parentSubmitted = parentDraft?.status === "issued";
  return {
    parentSubmitted,
    draft: { ...base, ...seed,
      answers: mergedAnswers,
      answerNotes: mergedNotes,
      status: parentSubmitted && isParty ? "issued" : base.status,
      specialistReviewApproved: { ...base.specialistReviewApproved, ...stored?.specialistReviewApproved },
      requestNumber: seed.requestNumber ?? base.requestNumber,
      deedNumber: seed.deedNumber ?? base.deedNumber,
      requestDate: seed.requestDate ?? base.requestDate,
      currentStep: stored ? normalizeFormStep(stored.currentStep) : 0,
    },
  };
}

/** Answered / pending counts over the questions visible to this viewer. */
export function caseStudyAnswerSummary(
  answers: CaseStudyReportDraft["answers"],
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

/** Unanswered visible questions plus the first one, for the scroll-to on submit. */
export function collectMissingCaseStudyAnswers(
  answers: CaseStudyReportDraft["answers"],
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

/**
 * Where the first of the server's missing question keys sits in form order — the keys arrive as an
 * unordered set. Null when none of them belongs to a known section.
 */
export function firstMissingQuestionLocation(
  missing: ReadonlySet<string>,
  sectionQuestions: SectionQuestions,
): { key: string; step: number } | null {
  for (let step = 0; step < FORM_STEP_SECTIONS.length; step += 1) {
    const section = FORM_STEP_SECTIONS[step];
    for (let i = 0; i < sectionQuestions[section].length; i += 1) {
      const key = caseStudyAnswerKey(section, i);
      if (missing.has(key)) return { key, step };
    }
  }
  return null;
}

export type CaseStudyReportScrollTarget = {
  targetId: string;
  step: number;
  message: string;
  /** Blocks the issue — the deed-nature gate and, since the server enforces 100%, matrix gaps. */
  blocking: boolean;
  /** Matrix gaps only: every unanswered visible question, to highlight. */
  missingAnswerKeys?: Set<string>;
  invalidDeedRemarks?: boolean;
  invalidDeedNature?: boolean;
  invalidDeedNatureNotes?: boolean;
};

/** Toast of the hard block — N answered of M visible questions. */
export function caseStudyIncompleteMessage(answered: number, total: number): string {
  return `أجب عن كل الأسئلة الظاهرة (${answered} من ${total})`;
}

/** First incomplete control in form order: deed remarks, nature match, then matrix. */
export function firstCaseStudyReportScrollTarget(args: {
  draft: CaseStudyReportDraft;
  sectionQuestions: SectionQuestions;
  isQuestionVisible: QuestionVisibilityPredicate;
  property: PoPropertyIntake | null;
  isParty: boolean;
}): CaseStudyReportScrollTarget | null {
  const { draft, sectionQuestions, isQuestionVisible, property, isParty } = args;

  if (!isParty) {
    const skipMatch =
      property != null && propertyHasRegisteredTitle(property);
    if (!skipMatch) {
      // Submit gate uses IsChosen (not IsKnown) — empty is draft-ok on the API.
      const outcome = normalizeDeedNatureMatchOutcome(
        draft.deedNatureMatchOutcome,
      );
      if (!isDeedNatureMatchChosen(outcome)) {
        return {
          targetId: CASE_STUDY_DEED_NATURE_MATCH_ID,
          step: 0,
          message: "أكّد مطابقة الصك على الطبيعة من تبويب مدخلات المعاين قبل إصدار تقرير دراسة الحالة.",
          blocking: true,
          invalidDeedNature: true,
        };
      }
      if (
        deedNatureMatchRequiresNotes(outcome) &&
        !String(draft.deedNatureMatchNotes ?? "").trim()
      ) {
        return {
          targetId: CASE_STUDY_DEED_NATURE_NOTES_ID,
          step: 0,
          message: "ملاحظات المطابقة إلزامية عند «فروق» أو «مرشح تعذر».",
          blocking: true,
          invalidDeedNatureNotes: true,
        };
      }
      if (
        !deedNatureMatchAllowsDownstreamWork(
          false,
          outcome,
        )
      ) {
        return {
          targetId: CASE_STUDY_DEED_NATURE_MATCH_ID,
          step: 0,
          message:
            "مخرج المطابقة ليس مطابقًا — أكّد أو عدّل من تبويب مدخلات المعاين. الفروق والتعذر مسار تعذر.",
          blocking: true,
          invalidDeedNature: true,
        };
      }
    }
  }

  const { missing, firstMissingKey, firstMissingStep } =
    collectMissingCaseStudyAnswers(
      draft.answers,
      sectionQuestions,
      isQuestionVisible,
    );
  if (firstMissingKey) {
    const { answered, total } = caseStudyAnswerSummary(
      draft.answers,
      sectionQuestions,
      isQuestionVisible,
    );
    return {
      targetId: caseStudyQuestionTargetId(firstMissingKey),
      step: firstMissingStep ?? draft.currentStep,
      message: caseStudyIncompleteMessage(answered, total),
      blocking: true,
      missingAnswerKeys: missing,
    };
  }
  return null;
}