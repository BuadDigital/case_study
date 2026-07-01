import type { EngineeringSurveySubmission } from "./engineering-survey-data";
import { normalizeEngineeringSurveyChecklist } from "./engineering-survey-data";

export type EngineeringSurveyFieldErrors = Partial<
  Record<
    | "latitude"
    | "longitude"
    | "survey_report"
    | "site_letter"
    | "site_confirmed"
    | "checklist",
    string
  >
>;

export function validateEngineeringSurveySubmission(
  submission: EngineeringSurveySubmission,
): EngineeringSurveyFieldErrors {
  const errors: EngineeringSurveyFieldErrors = {};

  const lat = submission.latitude.trim();
  const lng = submission.longitude.trim();
  if (!lat || Number.isNaN(Number(lat))) {
    errors.latitude = "أدخل خط العرض بصيغة رقمية صحيحة";
  }
  if (!lng || Number.isNaN(Number(lng))) {
    errors.longitude = "أدخل خط الطول بصيغة رقمية صحيحة";
  }

  if (!submission.surveyReportFileName.trim()) {
    errors.survey_report = "ارفع التقرير المساحي (PDF)";
  }
  if (!submission.siteLetterFileName.trim()) {
    errors.site_letter = "ارفع خطاب إقرار صحة الموقع";
  }
  if (!submission.siteConfirmed) {
    errors.site_confirmed = "يجب الإقرار بصحة البيانات المساحية";
  }

  const checklist = normalizeEngineeringSurveyChecklist(submission.checklist);
  const unanswered = checklist.some((row) => row.answer === null);
  if (unanswered) {
    errors.checklist = "أكمل جميع بنود نموذج التحقق الميداني (13 بنداً)";
  }

  return errors;
}

export function firstEngineeringSurveyError(
  errors: EngineeringSurveyFieldErrors,
): string {
  return (
    errors.latitude ??
    errors.longitude ??
    errors.survey_report ??
    errors.site_letter ??
    errors.site_confirmed ??
    errors.checklist ??
    "تحقق من الحقول المطلوبة"
  );
}
