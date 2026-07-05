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

/** يرسل الرفع المساحي + إجابات نموذج الدراسة لأخصائي دراسة الحالة. */
export async function finalizeEngineeringSurveySubmission(
  surveyTaskId: string,
): Promise<FinalizeEngineeringSurveyResult | null> {
  const submitted = await submitEngineeringSurveySubmission(surveyTaskId);
  if (!submitted) return null;

  let warning: string | undefined;
  const partyDraft = await loadPartyCaseStudyFormDraft(surveyTaskId);
  if (partyDraft) {
    const saved = await savePartyCaseStudyFormDraft({
      ...partyDraft,
      status: "submitted",
      savedAtUtc: new Date().toISOString(),
    });
    if (!saved.ok) {
      warning =
        saved.error ?? "تعذّر حفظ إجابات دراسة الحالة — راجع مع الأخصائي";
    }
  }

  return warning ? { submission: submitted, warning } : { submission: submitted };
}
