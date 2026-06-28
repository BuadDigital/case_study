/** Question banks for نموذج دراسة الحالة (from docs/case_study_form 3.html). */

export type CaseStudyFormAnswer = "A" | "B";

export type CaseStudyQuestionSection =
  | "deed"
  | "survey"
  | "comp"
  | "occ"
  | "extra";

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

export const CASE_STUDY_DEED_QUESTIONS = [
  "هل الصك فعال",
  "هل رقم القطعة مطابق للصك.",
  "هل رقم المخطط مطابق للصك.",
  "هل القطعة زائدة تنظيمية.",
  "هل يوجد نزع على منطقة العقار.",
  "هل الأرض موقوفة",
  "هل العقاروقوف.",
  "هل تم التأكد من استخدام العقار(سكني – تجاري – ...).",
  "هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية.",
  "هل الصك مشاع.",
  "في حال ان الصك مشاع هل المساحة المملوكة بالصك لكامل مساحة العقار او لجزء محدد وتحديد النسبة في الملاحظات.",
] as const;

export const CASE_STUDY_SURVEY_QUESTIONS = [
  "هل الصك مطابق للرفع المساحي.",
  "هل تم ذكر جميع الاختلافات في الرفع المساحي.",
  "هل تم تطبيق جميع التعليمات الصادرة من المركز في الرفع المساحي.",
  "هل تم التوقيع وارفاق إقرار على صحة الموقع.",
  "هل يوجد تداخل في الأصل.",
  "هل يوجد على الأصل مبنى مشترك.",
  "هل ذكر المرجع المعتمد في الاستدلال على استخدام العقار.",
] as const;

export const CASE_STUDY_COMPONENTS_QUESTIONS = [
  "هل يوجد في العقار بئر.",
  "هل يوجد في العقار غرفة كهرباء.",
  "هل يوجد في العقار أبراج كهرباء.",
  "هل يوجد في العقار أبراج اتصالات.",
  "هل يوجد في العقار مضخة دفاع مدني.",
  "هل يوجد في العقار منقولات.",
  "هل يوجد في العقار مركبات.",
  "هل يوجد في العقار معدات زراعية او موجودات حيوية.",
  "هل تم مطابقة مكونات العقار على الطبيعة مع المكونات المذكورة في الصك. (للأصول المجمدة)",
] as const;

export const CASE_STUDY_OCCUPANCY_QUESTIONS = [
  "هل العقار مأهول بالسكن.",
  "هل يوجد عقد إيجار.",
  "هل تم مطابقة رقم الصك بالمذكوربعقد الإيجار.",
  "هل عقد الإيجار ساري.",
  "هل عقد الإيجار إلكتروني.",
  "هل يوجد اتحاد ملاك؟",
] as const;

export const CASE_STUDY_EXTRA_QUESTIONS = [
  "هل تم ذكر جميع الملاحظات للتوضيح في حال عدم المطابقة",
  "هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار",
  "هل هناك أي عوامل بيئية أوتنظيمية قد تؤثر على العقار(مثل طريق مستقبلي أو قيود بناء).",
  "هل العقاريحتوي على أي إضافات غير مسجلة في الصك.",
] as const;

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

export const CASE_STUDY_SECTION_QUESTIONS: Record<
  CaseStudyQuestionSection,
  readonly string[]
> = {
  deed: CASE_STUDY_DEED_QUESTIONS,
  survey: CASE_STUDY_SURVEY_QUESTIONS,
  comp: CASE_STUDY_COMPONENTS_QUESTIONS,
  occ: CASE_STUDY_OCCUPANCY_QUESTIONS,
  extra: CASE_STUDY_EXTRA_QUESTIONS,
};

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