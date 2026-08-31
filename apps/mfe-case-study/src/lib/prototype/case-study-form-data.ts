import { todayIso } from "@platform/app-shared/format/date";
/** Question banks for the case-study form — labels from the field dictionary (API) with local defaults. */

import {
  getCachedOrganizationBranding,
  getCachedOrganizationCompanyName,
  getCachedOrganizationSettings,
} from "@platform/app-shared/organization/organization-settings-cache";
import {
  DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  type CaseStudyQuestionSection,
} from "@platform/app-shared/domain/case-study/question-catalog";

export type { CaseStudyQuestionSection };

export type CaseStudyFormAnswer = "A" | "B" | "NA";

export { CASE_STUDY_FORM_STEPS } from "@platform/app-shared/domain/case-study/question-catalog";

const DEFAULT_PROVIDER_NAME = "شركة إجادة المهنية للتقييم";
const DEFAULT_STAMP = "/case-study/ejadah-stamp.svg";
const DEFAULT_SIGNATURE = "/case-study/emad-signature.png";

/** Resolved from OrganizationSettings when cache is warm; falls back to built-in defaults. */
export function caseStudyProviderName(): string {
  return getCachedOrganizationCompanyName(DEFAULT_PROVIDER_NAME);
}

export const CASE_STUDY_REPORT_TITLE = "نموذج دراسة الحالة";
export const CASE_STUDY_REPORT_SUBTITLE = "منصة إدارة التقييم العقاري";
const DEFAULT_APPROVER_NAME = "عماد رشيد الرشيد";
/** Report approver = certified valuer from org settings (Decision 25) — not the assignment specialist from the work order. */
export function caseStudyApproverName(): string {
  const name = getCachedOrganizationSettings()?.evaluator.name?.trim();
  return name || DEFAULT_APPROVER_NAME;
}
export function caseStudySignatureImage(): string {
  return getCachedOrganizationBranding()?.signatureUrl || DEFAULT_SIGNATURE;
}
export function caseStudyStampImage(): string {
  return getCachedOrganizationBranding()?.stampUrl || DEFAULT_STAMP;
}

/** Fixed text under deed and survey tables — matches the paper form. */
export const CASE_STUDY_SECTION_REMARKS_HINT =
  "في حال وجود اختلاف في البيانات أعلاه يتم التوضيح في الملاحظات ادناه";

export const CASE_STUDY_DEED_QUESTIONS =
  DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionQuestions.deed;
export const CASE_STUDY_SURVEY_QUESTIONS =
  DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionQuestions.survey;
export const CASE_STUDY_COMPONENTS_QUESTIONS =
  DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionQuestions.comp;
export const CASE_STUDY_OCCUPANCY_QUESTIONS =
  DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionQuestions.occ;
export const CASE_STUDY_EXTRA_QUESTIONS =
  DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionQuestions.extra;

export const CASE_STUDY_TABLE_HEADERS: Record<
  CaseStudyQuestionSection,
  { colA: string; colB: string; colNa: string }
> = {
  deed: {
    colA: "فعال / مطابق / نعم",
    colB: "غيرفعال / غير مطابق / لا",
    colNa: "لا ينطبق",
  },
  survey: { colA: "تم التطبيق", colB: "لم يتم التطبيق", colNa: "لا ينطبق" },
  comp: { colA: "يوجد", colB: "لا يوجد", colNa: "لا ينطبق" },
  occ: { colA: "نعم", colB: "لا", colNa: "لا ينطبق" },
  extra: { colA: "يوجد", colB: "لا يوجد", colNa: "لا ينطبق" },
};

export {
  CASE_STUDY_SECTION_QUESTIONS,
  caseStudyAnswerKey,
} from "@platform/app-shared/domain/case-study/question-catalog";

export function caseStudyTotalQuestions(): number {
  return (
    CASE_STUDY_DEED_QUESTIONS.length +
    CASE_STUDY_SURVEY_QUESTIONS.length +
    CASE_STUDY_COMPONENTS_QUESTIONS.length +
    CASE_STUDY_OCCUPANCY_QUESTIONS.length +
    CASE_STUDY_EXTRA_QUESTIONS.length
  );
}

export function caseStudyFormSummary(answers: Record<string, CaseStudyFormAnswer | null | undefined>): {
  total: number;
  answered: number;
  pending: number;
  pct: number;
} {
  const total = caseStudyTotalQuestions();
  const answered = Object.values(answers).filter(
    (v) => v === "A" || v === "B" || v === "NA",
  ).length;
  const pending = total - answered;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return { total, answered, pending, pct };
}

export function todayIsoDate(): string {
  return todayIso();
}