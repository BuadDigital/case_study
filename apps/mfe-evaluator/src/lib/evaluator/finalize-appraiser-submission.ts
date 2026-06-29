import {
  loadPartyCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
} from "@case-study/mfe";
import {
  loadEvaluatorSubmission,
  submitEvaluatorSubmission,
  syncEvaluatorChecklistFromPartyCaseStudy,
} from "./evaluator-submission-storage";
import { clearEvaluatorRecall } from "./evaluator-recall-storage";
import type { EvaluatorSubmission } from "./evaluator-window-data";

export type FinalizeAppraiserResult =
  | { ok: true; submission: EvaluatorSubmission }
  | { ok: false; message: string };

/** يرسل تقييم المقيم + إجابات الاستدلال لأخصائي دراسة الحالة. */
export async function finalizeAppraiserSubmission(
  appraisalTaskId: string,
): Promise<FinalizeAppraiserResult> {
  const partyDraft = await loadPartyCaseStudyFormDraft(appraisalTaskId);
  if (loadEvaluatorSubmission(appraisalTaskId) && partyDraft) {
    await syncEvaluatorChecklistFromPartyCaseStudy(appraisalTaskId, {
      overwriteLinked: true,
    });
  }

  const result = await submitEvaluatorSubmission(appraisalTaskId);
  if (!result.ok) return result;

  clearEvaluatorRecall(appraisalTaskId);

  if (partyDraft) {
    const saved = await savePartyCaseStudyFormDraft({
      ...partyDraft,
      status: "submitted",
      savedAtUtc: new Date().toISOString(),
    });
    if (!saved.ok) {
      return { ok: false, message: saved.error };
    }
  }

  return result;
}

export function hasSubmittedAppraisalForChild(
  appraisalTaskId: string,
): boolean {
  const sub = loadEvaluatorSubmission(appraisalTaskId);
  return sub?.status === "submitted" || sub?.status === "completed";
}
