import {
  loadPartyCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
} from "@case-study/mfe";
import {
  loadEvaluatorSubmission,
  saveEvaluatorSubmission,
  submitEvaluatorSubmission,
  syncEvaluatorChecklistFromPartyCaseStudy,
} from "./evaluator-submission-storage";
import { snapshotIssuedValuationReport } from "./issue-valuation-report";
import {
  allocateValuationReportNumber,
  formatValuationReportIssueDateIso,
} from "./valuation-report-number";
import { clearPartyTaskRecall } from "@platform/app-shared/prototype/party-task-recall-storage";
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

  const current = loadEvaluatorSubmission(appraisalTaskId);
  if (current && current.status !== "submitted" && current.status !== "completed") {
    const issuedAt = new Date();
    const reportNo =
      current.status === "reopened" || !current.reportNo.trim()
        ? allocateValuationReportNumber(issuedAt)
        : current.reportNo.trim();
    const reportIssueDate =
      current.status === "reopened" || !current.reportIssueDate.trim()
        ? formatValuationReportIssueDateIso(issuedAt)
        : current.reportIssueDate.trim();

    const prepared = await saveEvaluatorSubmission({
      ...current,
      reportNo,
      reportIssueDate,
      updatedAtUtc: issuedAt.toISOString(),
    });
    if (!prepared) {
      return { ok: false, message: "تعذّر تثبيت رقم التقرير قبل الإرسال." };
    }

    try {
      await snapshotIssuedValuationReport({
        taskId: appraisalTaskId,
        propertyId: prepared.propertyId,
        reportNo,
        reportIssueDate,
        depositCode: prepared.depositCode,
      });
    } catch (err: unknown) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "تعذّر توليد تقرير التقييم من النظام.",
      };
    }
  }

  const result = await submitEvaluatorSubmission(appraisalTaskId);
  if (!result.ok) return result;

  clearPartyTaskRecall(appraisalTaskId);

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
