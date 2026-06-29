import type { CaseStudyFormAnswer } from "@case-study/mfe/lib/prototype/case-study-form-data";import type { CaseStudyInfoRolesMatrix } from "@settings/mfe/lib/prototype/case-study-info-roles-storage";
import { isPartyQuestionVisible } from "@settings/mfe/lib/prototype/case-study-info-roles-storage";
import type {
  EvaluatorChecklistAnswers,
  EvaluatorBooleanQuestion,
  SharedDeedScope,
} from "./evaluator-window-data";
import { checklistAnswerLabel } from "./evaluator-window-data";

export const APPRAISER_PARTY_ID = "val" as const;

/** قائمة فحص المقيم ↔ مفاتيح إجابات نموذج دراسة الحالة (طرف المقيم). */
export type EvaluatorChecklistCaseStudyLink = {
  checklistKey: keyof Pick<
    EvaluatorChecklistAnswers,
    | "q_plan_match"
    | "q_excess_zoning"
    | "q_land_waqf"
    | "q_property_waqf"
    | "q_expropriation"
    | "q_property_use_verified"
    | "q_agriculture_inquiry"
    | "q_overlap"
    | "q_shared_building"
    | "q_environmental_factors"
    | "q_unregistered_additions"
    | "q_shared_deed"
    | "q_lease_exists"
    | "q_lease_active"
    | "q_technical_notes_exists"
  >;
  caseStudyKey: string;
};

export const EVALUATOR_CHECKLIST_CASE_STUDY_LINKS: EvaluatorChecklistCaseStudyLink[] =
  [
    { checklistKey: "q_plan_match", caseStudyKey: "deed_2" },
    { checklistKey: "q_excess_zoning", caseStudyKey: "deed_3" },
    { checklistKey: "q_expropriation", caseStudyKey: "deed_4" },
    { checklistKey: "q_land_waqf", caseStudyKey: "deed_5" },
    { checklistKey: "q_property_waqf", caseStudyKey: "deed_6" },
    { checklistKey: "q_property_use_verified", caseStudyKey: "deed_7" },
    { checklistKey: "q_agriculture_inquiry", caseStudyKey: "deed_8" },
    { checklistKey: "q_shared_deed", caseStudyKey: "deed_9" },
    { checklistKey: "q_overlap", caseStudyKey: "survey_4" },
    { checklistKey: "q_shared_building", caseStudyKey: "survey_5" },
    { checklistKey: "q_lease_exists", caseStudyKey: "occ_1" },
    { checklistKey: "q_lease_active", caseStudyKey: "occ_3" },
    { checklistKey: "q_technical_notes_exists", caseStudyKey: "extra_1" },
    { checklistKey: "q_environmental_factors", caseStudyKey: "extra_2" },
    { checklistKey: "q_unregistered_additions", caseStudyKey: "extra_3" },
  ];

/** أسئلة نموذج الدراسة المسندة للمقيم دون مفتاح q_* في قائمة الفحص القديمة. */
export type AppraiserOnlyCaseStudyChecklistItem = {
  caseStudyKey: string;
  label: string;
};

export const APPRAISER_ONLY_CASE_STUDY_CHECKLIST: AppraiserOnlyCaseStudyChecklistItem[] =
  [];

const LEGACY_MAPPED_CASE_STUDY_KEYS = new Set(
  EVALUATOR_CHECKLIST_CASE_STUDY_LINKS.map((link) => link.caseStudyKey),
);

export type EvaluatorChecklistBooleanKey =
  EvaluatorChecklistCaseStudyLink["checklistKey"];

/** هل سؤال قائمة الفحص مسند للمقيم العقاري في علاقة المستخدم بالمعلومة؟ */
export function isEvaluatorChecklistQuestionAssignedToAppraiser(
  matrix: CaseStudyInfoRolesMatrix,
  checklistKey: EvaluatorChecklistBooleanKey,
): boolean {
  const link = EVALUATOR_CHECKLIST_CASE_STUDY_LINKS.find(
    (entry) => entry.checklistKey === checklistKey,
  );
  if (!link) return false;
  return isPartyQuestionVisible(matrix, link.caseStudyKey, APPRAISER_PARTY_ID);
}

export function evaluatorChecklistKeysForAppraiser(
  matrix: CaseStudyInfoRolesMatrix,
): Set<EvaluatorChecklistBooleanKey> {
  return new Set(
    EVALUATOR_CHECKLIST_CASE_STUDY_LINKS.filter((link) =>
      isPartyQuestionVisible(matrix, link.caseStudyKey, APPRAISER_PARTY_ID),
    ).map((link) => link.checklistKey),
  );
}

export function filterEvaluatorChecklistQuestions(
  questions: EvaluatorBooleanQuestion[],
  matrix: CaseStudyInfoRolesMatrix,
): EvaluatorBooleanQuestion[] {
  const assigned = evaluatorChecklistKeysForAppraiser(matrix);
  return questions.filter((q) => assigned.has(q.id));
}

/** أسئلة الدراسة الإضافية المسندة للمقيم (ليست ضمن الـ 13 سؤالاً القديمة). */
export function appraiserOnlyCaseStudyChecklistItems(
  matrix: CaseStudyInfoRolesMatrix,
): AppraiserOnlyCaseStudyChecklistItem[] {
  return APPRAISER_ONLY_CASE_STUDY_CHECKLIST.filter(
    (item) =>
      !LEGACY_MAPPED_CASE_STUDY_KEYS.has(item.caseStudyKey) &&
      isPartyQuestionVisible(matrix, item.caseStudyKey, APPRAISER_PARTY_ID),
  );
}

export function caseStudyAnswerDisplayLabel(
  answer: CaseStudyFormAnswer | null | undefined,
): string {
  return checklistAnswerLabel(caseStudyAnswerToChecklistBoolean(answer));
}

export function caseStudyAnswerToChecklistBoolean(
  answer: CaseStudyFormAnswer | null | undefined,
): boolean | null {
  if (answer === "A") return true;
  if (answer === "B") return false;
  return null;
}

function sharedDeedScopeFromCaseStudy(
  answers: Record<string, CaseStudyFormAnswer | null | undefined>,
): SharedDeedScope | null {
  const answer = answers.deed_10;
  if (answer === "A") return "full";
  if (answer === "B") return "part";
  return null;
}

export type CaseStudyChecklistRemarks = {
  deedRemarks?: string;
  componentsRemarks?: string;
};

export type MergeEvaluatorChecklistOptions = {
  /** يستبدل مفاتيح q_* المرتبطة بإجابات نموذج الدراسة عند توفرها. */
  overwriteLinked?: boolean;
};

/** يملأ قائمة الفحص من إجابات نموذج الدراسة (طرف المقيم). */
export function mergeEvaluatorChecklistFromCaseStudy(
  checklist: EvaluatorChecklistAnswers,
  answers: Record<string, CaseStudyFormAnswer | null | undefined>,
  remarks: CaseStudyChecklistRemarks = {},
  options: MergeEvaluatorChecklistOptions = {},
): EvaluatorChecklistAnswers {
  const { overwriteLinked = false } = options;
  const next: EvaluatorChecklistAnswers = { ...checklist };

  for (const link of EVALUATOR_CHECKLIST_CASE_STUDY_LINKS) {
    const hasAnswer = Object.prototype.hasOwnProperty.call(
      answers,
      link.caseStudyKey,
    );
    if (!overwriteLinked && next[link.checklistKey] !== null) continue;
    if (!overwriteLinked && !hasAnswer) continue;

    const derived = caseStudyAnswerToChecklistBoolean(answers[link.caseStudyKey]);
    if (derived !== null) {
      next[link.checklistKey] = derived;
    } else if (overwriteLinked && hasAnswer) {
      next[link.checklistKey] = null;
    }
  }
  if (next.q_shared_deed === true && next.shared_deed_scope === null) {
    const scope = sharedDeedScopeFromCaseStudy(answers);
    if (scope) next.shared_deed_scope = scope;
  }

  if (
    next.shared_deed_scope === "part" &&
    !next.shared_deed_percentage.trim()
  ) {
    const pct = remarks.deedRemarks?.trim() ?? "";
    if (pct) next.shared_deed_percentage = pct;
  }

  if (
    next.q_technical_notes_exists === true &&
    !next.technical_notes_text.trim()
  ) {
    const text =
      remarks.componentsRemarks?.trim() ||
      remarks.deedRemarks?.trim() ||
      "";
    if (text) next.technical_notes_text = text;
  }

  return next;
}

/** يبني قائمة الفحص من إجابات الدراسة فقط (للعرض قبل إرسال التقييم). */
export function evaluatorChecklistFromCaseStudyAnswers(
  answers: Record<string, CaseStudyFormAnswer | null | undefined>,
  remarks: CaseStudyChecklistRemarks = {},
): EvaluatorChecklistAnswers {
  const empty: EvaluatorChecklistAnswers = {
    q_plan_match: null,
    q_excess_zoning: null,
    q_land_waqf: null,
    q_property_waqf: null,
    q_expropriation: null,
    q_property_use_verified: null,
    q_agriculture_inquiry: null,    q_overlap: null,
    q_shared_building: null,
    q_environmental_factors: null,
    q_unregistered_additions: null,
    q_shared_deed: null,
    shared_deed_scope: null,
    shared_deed_percentage: "",
    q_lease_exists: null,
    q_lease_active: null,
    q_technical_notes_exists: null,
    technical_notes_text: "",
  };
  return mergeEvaluatorChecklistFromCaseStudy(empty, answers, remarks);
}
