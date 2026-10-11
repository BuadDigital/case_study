import {
  invalidControlClass,
  resolveFirstErrorMessage,
  resolveFirstErrorTarget,
  type FormErrorTarget,
} from "@platform/app-shared/form-ux";
import { parseCoordinate } from "@platform/app-shared/domain/geo";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
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
  { key: "latitude", targetId: "eng-map-coords" },
  { key: "longitude", targetId: "eng-map-coords" },
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

/** An area typed but not a number above 0 — the server's TryParseAreaM2 rejects 0 too. */
function isBadArea(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const n = parseLocaleNumber(raw);
  return !(Number.isFinite(n) && n > 0);
}

/** A readable number as plain Latin text («١٬٢٥٠ م²» → "1250"); unreadable text stays as typed. */
function latinNumberText(raw: string, parse: (text: string) => number | null): string {
  if (!raw.trim()) return raw;
  const n = parse(raw);
  return n == null || !Number.isFinite(n) ? raw : String(n);
}

type SurveyNumberFields = {
  latitude: string;
  longitude: string;
  onSiteAreaSqm: string;
  natureOnSiteAreaSqm?: string;
};

/**
 * The typed coordinates and areas as the server reads them — Latin digits, "." decimal, no
 * grouping or units — so what passed validation here is what the server parses.
 */
export function normalizeEngineeringSurveyNumbers<T extends SurveyNumberFields>(fields: T): T {
  const area = (text: string) => parseLocaleNumber(text);
  const next: T = {
    ...fields,
    latitude: latinNumberText(fields.latitude, (t) => parseCoordinate(t, "lat")),
    longitude: latinNumberText(fields.longitude, (t) => parseCoordinate(t, "lng")),
    onSiteAreaSqm: latinNumberText(fields.onSiteAreaSqm, area),
  };
  if (fields.natureOnSiteAreaSqm != null) {
    next.natureOnSiteAreaSqm = latinNumberText(fields.natureOnSiteAreaSqm, area);
  }
  return next;
}

export function validateEngineeringSurveySubmission(
  submission: EngineeringSurveySubmission,
  options?: { siteLetterRequired?: boolean },
): EngineeringSurveyFieldErrors {
  const errors: EngineeringSurveyFieldErrors = {};

  if (parseCoordinate(submission.latitude, "lat") == null) {
    errors.latitude = "أدخل خط العرض بصيغة رقمية صحيحة";
  }
  if (parseCoordinate(submission.longitude, "lng") == null) {
    errors.longitude = "أدخل خط الطول بصيغة رقمية صحيحة";
  }

  if (submission.deedMatchesNature !== "yes" && submission.deedMatchesNature !== "no") {
    errors.deed_matches_nature = "حدد هل الصك مطابق للطبيعة";
  }

  if (isBadArea(submission.onSiteAreaSqm)) {
    errors.on_site_area = "المساحة الإجمالية (حسب الصك) يجب أن تكون رقماً أكبر من صفر.";
  }

  if (submission.deedMatchesNature === "no" && isBadArea(submission.natureOnSiteAreaSqm)) {
    errors.nature_on_site_area =
      "المساحة الإجمالية (حسب الطبيعة) يجب أن تكون رقماً أكبر من صفر.";
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
