/**
 * Pure helpers behind the engineering survey work hooks — field-error clearing,
 * the checklist change signature and the attachment field mapping. No React and
 * no I/O, so the data and command hooks stay about state and effects.
 */
import type { EngineeringSurveySubmission } from "../lib/engineering-survey-data";
import type { EngineeringSurveyFieldErrors } from "../lib/engineering-survey-validation";
import type { LocalTextFields } from "./EngineeringSurveyWorkParts";

export type EngineeringSurveyFieldErrorKey = keyof EngineeringSurveyFieldErrors;

export type SurveyAttachmentField =
  | "surveyReportFileName"
  | "siteLetterFileName";

export type SurveyAttachmentTarget = {
  docField: "surveyReport" | "siteLetter";
  errorKey: Extract<
    EngineeringSurveyFieldErrorKey,
    "survey_report" | "site_letter"
  >;
};

/** Local text fields whose edit clears a validation error — others clear nothing. */
const FIELD_ERROR_BY_LOCAL_FIELD: Partial<
  Record<keyof LocalTextFields, EngineeringSurveyFieldErrorKey>
> = {
  latitude: "latitude",
  longitude: "longitude",
  onSiteAreaSqm: "on_site_area",
  natureOnSiteAreaSqm: "nature_on_site_area",
};

export function fieldErrorKeyForLocalField(
  key: keyof LocalTextFields,
): EngineeringSurveyFieldErrorKey | undefined {
  return FIELD_ERROR_BY_LOCAL_FIELD[key];
}

/** Drop the given errors from the map — returns a new object, never mutates. */
export function withoutFieldErrors(
  errors: EngineeringSurveyFieldErrors,
  keys: readonly EngineeringSurveyFieldErrorKey[],
): EngineeringSurveyFieldErrors {
  const next = { ...errors };
  for (const key of keys) delete next[key];
  return next;
}

/** Answer fingerprint — checklist edits only sync the case study when answers move. */
export function checklistAnswerSignature(
  checklist: EngineeringSurveySubmission["checklist"] | undefined,
): string {
  return (checklist ?? []).map((row) => row.answer).join("|");
}

export function surveyAttachmentTarget(
  field: SurveyAttachmentField,
): SurveyAttachmentTarget {
  return field === "surveyReportFileName"
    ? { docField: "surveyReport", errorKey: "survey_report" }
    : { docField: "siteLetter", errorKey: "site_letter" };
}
