import { loadPartyCaseStudyReportDraft } from "@case-study/mfe/lib/app-data/case-study-report-reads";
import { savePartyCaseStudyReportDraft } from "@case-study/mfe/lib/app-data/case-study-report-commands";
import type { EngineeringSurveySubmission } from "./engineering-survey-data";
import { submitEngineeringSurveySubmission } from "./engineering-survey-submission-commands";

export type FinalizeEngineeringSurveyResult = {
  submission: EngineeringSurveySubmission;
  warning?: string;
};

/** API lock message when the party case-study report is already issued. */
const PARTY_CONTRIBUTION_ALREADY_CLOSED =
  "تم إغلاق مساهمة الطرف بعد إصدار تقرير دراسة الحالة";

function isPartyContributionAlreadyClosedError(error: string | undefined): boolean {
  if (!error) return false;
  return (
    error === PARTY_CONTRIBUTION_ALREADY_CLOSED ||
    error.includes("إغلاق مساهمة الطرف")
  );
}

/** Sends the survey + case-study form answers to the case-study specialist. */
export async function finalizeEngineeringSurveySubmission(
  surveyTaskId: string,
  idempotencyKey?: string,
): Promise<FinalizeEngineeringSurveyResult | null> {
  const submitted = await submitEngineeringSurveySubmission(surveyTaskId, idempotencyKey);
  if (!submitted.ok) return null;

  let warning: string | undefined;
  const partyDraft = await loadPartyCaseStudyReportDraft(surveyTaskId);
  // Already locked on a previous attempt — leave alone; success UI is the
  // single host toast ("survey completed…"), not this side-effect.
  if (partyDraft && partyDraft.status !== "issued") {
    const saved = await savePartyCaseStudyReportDraft({
      ...partyDraft,
      status: "issued",
      savedAtUtc: new Date().toISOString(),
    });
    if (!saved.ok && !isPartyContributionAlreadyClosedError(saved.error)) {
      warning =
        saved.error ?? "تعذّر حفظ إجابات دراسة الحالة — راجع مع الأخصائي";
    }
  }

  return warning
    ? { submission: submitted.data, warning }
    : { submission: submitted.data };
}
