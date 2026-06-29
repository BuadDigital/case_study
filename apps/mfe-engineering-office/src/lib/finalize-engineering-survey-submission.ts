import {
  loadPartyCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
} from "@case-study/mfe";
import type { EngineeringSurveySubmission } from "./engineering-survey-data";
import { submitEngineeringSurveySubmission } from "./engineering-survey-submission-storage";

/** يرسل الرفع المساحي + إجابات نموذج الدراسة لأخصائي دراسة الحالة. */
export async function finalizeEngineeringSurveySubmission(
  surveyTaskId: string,
): Promise<EngineeringSurveySubmission | null> {
  const submitted = await submitEngineeringSurveySubmission(surveyTaskId);
  if (!submitted) return null;

  const partyDraft = await loadPartyCaseStudyFormDraft(surveyTaskId);
  if (partyDraft) {
    const saved = await savePartyCaseStudyFormDraft({
      ...partyDraft,
      status: "submitted",
      savedAtUtc: new Date().toISOString(),
    });
    if (!saved.ok) {
      console.warn("Case study party form save failed:", saved.error);
    }
  }

  return submitted;
}
