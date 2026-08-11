import {
  loadPartyCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
} from "@case-study/mfe";
import type { EngineeringSurveySubmission } from "./engineering-survey-data";
import { submitEngineeringSurveySubmission } from "./engineering-survey-submission-storage";

export type FinalizeEngineeringSurveyResult = {
  submission: EngineeringSurveySubmission;
  warning?: string;
};

/** API lock message when the party case-study form is already submitted. */
const PARTY_FORM_ALREADY_CLOSED =
  "تم إغلاق نموذج الطرف بعد رفع دراسة الحالة";

function isPartyFormAlreadyClosedError(error: string | undefined): boolean {
  if (!error) return false;
  return (
    error === PARTY_FORM_ALREADY_CLOSED ||
    error.includes("إغلاق نموذج الطرف")
  );
}

/** يرسل الرفع المساحي + إجابات نموذج الدراسة لأخصائي دراسة الحالة. */
export async function finalizeEngineeringSurveySubmission(
  surveyTaskId: string,
): Promise<FinalizeEngineeringSurveyResult | null> {
  const submitted = await submitEngineeringSurveySubmission(surveyTaskId);
  if (!submitted.ok) return null;

  let warning: string | undefined;
  const partyDraft = await loadPartyCaseStudyFormDraft(surveyTaskId);
  // Already locked on a previous attempt — leave alone; success UI is the
  // single host toast ("اكتمل الرفع المساحي…"), not this side-effect.
  if (partyDraft && partyDraft.status !== "submitted") {
    const saved = await savePartyCaseStudyFormDraft({
      ...partyDraft,
      status: "submitted",
      savedAtUtc: new Date().toISOString(),
    });
    if (!saved.ok && !isPartyFormAlreadyClosedError(saved.error)) {
      warning =
        saved.error ?? "تعذّر حفظ إجابات دراسة الحالة — راجع مع الأخصائي";
    }
  }

  return warning
    ? { submission: submitted.data, warning }
    : { submission: submitted.data };
}
