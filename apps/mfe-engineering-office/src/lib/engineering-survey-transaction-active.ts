import type { EngineeringSurveySubmissionStatus } from "./engineering-survey-data";

/**
 * المعاملة «نشطة» عند المكتب الهندسي = ما زالت ضمن دوره (لم يُرسَل الرفع بعد).
 * بعد الإرسال تخرج من الدور النشط ويُتاح طلب الاسترجاع فقط.
 */
export function isEngineeringSurveyTransactionActive(
  taskStatus: string,
  submissionStatus: EngineeringSurveySubmissionStatus | null | undefined,
): boolean {
  if (taskStatus === "completed") return false;
  return submissionStatus !== "submitted";
}
