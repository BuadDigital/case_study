import { loadPartyCaseStudyFormDraft } from "@case-study/mfe/lib/app-data/case-study-form-reads";
import { savePartyCaseStudyFormDraft } from "@case-study/mfe/lib/app-data/case-study-form-commands";
import { loadEvaluatorSubmission } from "./evaluator-submission-model";
import {
  saveEvaluatorSubmission,
  submitEvaluatorSubmission,
  syncEvaluatorChecklistFromPartyCaseStudy,
} from "./evaluator-submission-commands";
import {
  ensureOpenValuationRequest,
  reservedNumberFromValuationRequest,
  snapshotIssuedValuationReport,
} from "./issue-valuation-report";
import {
  allocateValuationReportNumber,
  formatValuationReportIssueDateIso,
} from "./valuation-report-number";
import { clearPartyTaskRecall } from "@platform/app-shared/app-data/party-task-recall-model";
import type { EvaluatorSubmission } from "./evaluator-window-data";

export type FinalizeAppraiserResult =
  | { ok: true; submission: EvaluatorSubmission }
  | { ok: false; message: string };

/** Submits the appraiser valuation + inference answers to the case-study specialist. */
export async function finalizeAppraiserSubmission(
  appraisalTaskId: string,
  idempotencyKey?: string,
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
    let reportNo = current.reportNo.trim();
    if (current.status === "reopened" || !reportNo) {
      // Report number from server sequence (valuation request id VR-####) —
      // local browser counter is a last-resort fallback when the service is down.
      try {
        const open = await ensureOpenValuationRequest({
          propertyId: current.propertyId,
        });
        reportNo = reservedNumberFromValuationRequest(open);
      } catch {
        reportNo = allocateValuationReportNumber(issuedAt);
      }
    }
    const reportIssueDate =
      current.status === "reopened" || !current.reportIssueDate.trim()
        ? formatValuationReportIssueDateIso(issuedAt)
        : current.reportIssueDate.trim();
    const appraisalDate =
      current.status === "reopened" || !current.appraisalDate.trim()
        ? reportIssueDate
        : current.appraisalDate.trim();

    const prepared = await saveEvaluatorSubmission({
      ...current,
      reportNo,
      reportIssueDate,
      appraisalDate,
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

  const result = await submitEvaluatorSubmission(appraisalTaskId, idempotencyKey);
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
