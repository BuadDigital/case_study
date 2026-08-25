import {
  invalidControlClass,
  resolveFirstErrorMessage,
  resolveFirstErrorTarget,
  type FormErrorTarget,
} from "@platform/app-shared/form-ux";
import type { EngineeringSurveySubmission } from "./engineering-survey-data";
import { normalizeEngineeringSurveyChecklist } from "./engineering-survey-data";

export type EngineeringSurveyFieldErrors = Partial<
  Record<
    | "latitude"
    | "longitude"
    | "survey_report"
    | "site_letter"
    | "site_confirmed"
    | "checklist"
    | "deed_matches_nature"
    | "on_site_area"
    | "nature_on_site_area",
    string
  >
>;

/** Document order for scroll + first error message. */
const ENGINEERING_SURVEY_ERROR_TARGETS: readonly FormErrorTarget[] = [
  { key: "latitude", targetId: "eng-lat" },
  { key: "longitude", targetId: "eng-lng" },
  { key: "survey_report", targetId: "eng-survey-report" },
  { key: "on_site_area", targetId: "eng-on-site-area" },
  { key: "deed_matches_nature", targetId: "eng-deed-matches" },
  { key: "nature_on_site_area", targetId: "eng-nature-on-site-area" },
  { key: "site_letter", targetId: "eng-site-letter" },
  { key: "site_confirmed", targetId: "eng-site-confirm" },
  { key: "checklist", targetId: "eng-checklist" },
] as const;

const ENGINEERING_SURVEY_ERROR_KEYS = ENGINEERING_SURVEY_ERROR_TARGETS.map(
  (t) => t.key,
);

export function firstEngineeringSurveyErrorTarget(
  errors: EngineeringSurveyFieldErrors,
): string | null {
  return resolveFirstErrorTarget(
    errors as Record<string, unknown>,
    ENGINEERING_SURVEY_ERROR_TARGETS,
  );
}

export function isPlattedPropertyWithPlot(property?: {
  planNumber?: string | null;
  plotNumber?: string | null;
} | null): boolean {
  return Boolean(property?.planNumber?.trim() && property?.plotNumber?.trim());
}

export function validateEngineeringSurveySubmission(
  submission: EngineeringSurveySubmission,
  options?: { siteLetterRequired?: boolean },
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

  if (submission.deedMatchesNature !== "yes" && submission.deedMatchesNature !== "no") {
    errors.deed_matches_nature = "حدد هل الصك مطابق للطبيعة";
  }

  const onSite = submission.onSiteAreaSqm.replace(/,/g, "").trim();
  if (onSite && (Number.isNaN(Number(onSite)) || Number(onSite) < 0)) {
    errors.on_site_area = "المساحة الإجمالية (حسب الصك) يجب أن تكون رقماً صحيحاً (≥ 0).";
  }

  if (submission.deedMatchesNature === "no") {
    const natureArea = (submission.natureOnSiteAreaSqm ?? "")
      .replace(/,/g, "")
      .trim();
    if (
      natureArea &&
      (Number.isNaN(Number(natureArea)) || Number(natureArea) < 0)
    ) {
      errors.nature_on_site_area =
        "المساحة الإجمالية (حسب الطبيعة) يجب أن تكون رقماً صحيحاً (≥ 0).";
    }
  }

  if (!submission.surveyReportFileName.trim()) {
    errors.survey_report = "ارفع التقرير المساحي (PDF)";
  }
  const siteLetterRequired = options?.siteLetterRequired !== false;
  if (siteLetterRequired && !submission.siteLetterFileName.trim()) {
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
    resolveFirstErrorMessage(
      errors as Record<string, unknown>,
      ENGINEERING_SURVEY_ERROR_KEYS,
    ) ?? "تحقق من الحقول المطلوبة"
  );
}

export { invalidControlClass as engineeringInvalidControlClass };
