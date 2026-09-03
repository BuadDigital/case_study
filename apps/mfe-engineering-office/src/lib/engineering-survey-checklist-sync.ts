import type { CaseStudyFormAnswer } from "@case-study/mfe/lib/app-data/case-study-form-data";
import { caseStudyAnswerKey } from "@case-study/mfe/lib/app-data/case-study-form-data";
import type {
  ChecklistAnswer,
  EngineeringSurveyChecklistRow,
} from "./engineering-survey-data";

/** Overlapping questions: checklist (above) ↔ survey and nature (below). */
type ChecklistCaseStudyLink = {
  checklistIndex: number;
  caseStudyKey: string;
  /** checklist «yes» → case study column A */
  yesMapsToA: boolean;
};

function surveyKey(index: number): string {
  return caseStudyAnswerKey("survey", index);
}

/** Shared wording between the 13-item checklist and survey step questions. */
const CHECKLIST_CASE_STUDY_LINKS: ChecklistCaseStudyLink[] = [
  {
    checklistIndex: 0,
    caseStudyKey: surveyKey(0),
    yesMapsToA: true,
  },
  {
    checklistIndex: 1,
    caseStudyKey: surveyKey(3),
    yesMapsToA: true,
  },
  {
    checklistIndex: 5,
    caseStudyKey: surveyKey(4),
    yesMapsToA: true,
  },
  {
    checklistIndex: 5,
    caseStudyKey: surveyKey(5),
    yesMapsToA: true,
  },
  {
    checklistIndex: 6,
    caseStudyKey: surveyKey(6),
    yesMapsToA: true,
  },
  {
    checklistIndex: 10,
    caseStudyKey: surveyKey(2),
    yesMapsToA: true,
  },
];

function checklistAnswerToCaseStudy(
  answer: ChecklistAnswer,
  yesMapsToA: boolean,
): CaseStudyFormAnswer | null {
  if (answer === null) return null;
  if (yesMapsToA) return answer === "yes" ? "A" : "B";
  return answer === "yes" ? "B" : "A";
}

function isAnswered(
  value: CaseStudyFormAnswer | null | undefined,
): value is CaseStudyFormAnswer {
  return value === "A" || value === "B";
}

/** One-way: checklist → case study. Skips keys the party already answered. */
export function applyChecklistToCaseStudyAnswers(
  checklist: EngineeringSurveyChecklistRow[],
  answers: Record<string, CaseStudyFormAnswer | null | undefined>,
): Record<string, CaseStudyFormAnswer | null> {
  const next: Record<string, CaseStudyFormAnswer | null> = {};
  for (const [key, value] of Object.entries(answers)) {
    next[key] = value ?? null;
  }

  for (const link of CHECKLIST_CASE_STUDY_LINKS) {
    const row = checklist[link.checklistIndex];
    if (!row || row.answer === null) continue;
    if (isAnswered(next[link.caseStudyKey])) continue;

    next[link.caseStudyKey] = checklistAnswerToCaseStudy(
      row.answer,
      link.yesMapsToA,
    );
  }

  return next;
}

export function caseStudyAnswersChanged(
  before: Record<string, CaseStudyFormAnswer | null | undefined>,
  after: Record<string, CaseStudyFormAnswer | null>,
): boolean {
  for (const link of CHECKLIST_CASE_STUDY_LINKS) {
    if (before[link.caseStudyKey] !== after[link.caseStudyKey]) return true;
  }
  return false;
}
