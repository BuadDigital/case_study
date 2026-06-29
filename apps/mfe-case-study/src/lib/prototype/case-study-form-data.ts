/** Question banks for نموذج دراسة الحالة — labels من قاموس الحقول (API) مع افتراضيات محلية. */

import {
  DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  type CaseStudyQuestionSection,
} from "./case-study-question-catalog";

export type { CaseStudyQuestionSection };

export type CaseStudyFormAnswer = "A" | "B";

export const CASE_STUDY_FORM_STEPS = [
  { id: 1, label: "بيانات الصك والعقار" },
  { id: 2, label: "الرفع المساحي والطبيعة" },
  { id: 3, label: "مكونات العقار" },
  { id: 4, label: "الإشغال والإيجار" },
  { id: 5, label: "ملاحظات إضافية" },
] as const;

export const CASE_STUDY_PROVIDER_NAME = "شركة إجادة المهنية للتقييم";
export const CASE_STUDY_REPORT_TITLE = "نموذج دراسة الحالة";
export const CASE_STUDY_REPORT_SUBTITLE = "منصة إدارة التقييم العقاري";
/** معتمد التقرير — ثابت في التقرير (ليس أخصائي الإسناد من أمر العمل). */
export const CASE_STUDY_REPORT_APPROVER_NAME = "عماد رشيد الرشيد";
export const CASE_STUDY_SIGNATURE_IMAGE = "/case-study/emad-signature.png";
export const CASE_STUDY_STAMP_IMAGE = "/case-study/ejadah-stamp.png";

/** نص ثابت أسفل جداول الصك والرفع المساحي — مطابق للنموذج الورقي. */
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
  { colA: string; colB: string }
> = {
  deed: {
    colA: "فعال / مطابق / نعم",
    colB: "غيرفعال / غير مطابق / لا",
  },
  survey: { colA: "تم التطبيق", colB: "لم يتم التطبيق" },
  comp: { colA: "يوجد", colB: "لا يوجد" },
  occ: { colA: "نعم", colB: "لا" },
  extra: { colA: "يوجد", colB: "لا يوجد" },
};

export const CASE_STUDY_SECTION_QUESTIONS =
  DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionQuestions;

export function caseStudyAnswerKey(
  section: CaseStudyQuestionSection,
  index: number,
): string {
  return `${section}_${index}`;
}

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
    (v) => v === "A" || v === "B",
  ).length;
  const pending = total - answered;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return { total, answered, pending, pct };
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}