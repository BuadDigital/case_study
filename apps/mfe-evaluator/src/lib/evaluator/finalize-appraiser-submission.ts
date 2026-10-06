import { loadPartyCaseStudyReportDraft } from "../../lib/case-study-bridge";
import { readFreshStudyReportGate } from "./evaluator-submit-gates";
import { loadEvaluatorSubmission } from "./evaluator-submission-model";
import {
  saveEvaluatorSubmission,
  submitEvaluatorSubmission,
  syncEvaluatorChecklistFromPartyCaseStudy,
} from "./evaluator-submission-commands";
import {
  ensureOpenValuationRequest,
  reservedNumberFromValuationRequest,
} from "./issue-valuation-report";
import {
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
  // Fresh study-report flag BEFORE any side effect (checklist sync write, valuation-request
  // open / report-number reservation, draft save). Fails closed on an unreadable flag.
  const studyGate = await readFreshStudyReportGate(appraisalTaskId);
  if (!studyGate.ready) return { ok: false, message: studyGate.reason };

  const partyDraft = await loadPartyCaseStudyReportDraft(appraisalTaskId);
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
        return {
          ok: false,
          message: "تعذّر حجز رقم التقرير من الخادم. أعد المحاولة.",
        };
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
  }

  const result = await submitEvaluatorSubmission(appraisalTaskId, idempotencyKey);
  if (!result.ok) return result;

  clearPartyTaskRecall(appraisalTaskId);

  // No post-submit write of the party draft: the study report is already issued (the submit
  // gate), so the server has locked party contributions and such a save would be refused
  // although the submit itself succeeded.
  return result;
}
