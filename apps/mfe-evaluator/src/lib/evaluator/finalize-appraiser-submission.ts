import { loadPartyCaseStudyReportDraft } from "../../lib/case-study-bridge";
import { readFreshStudyReportGate } from "./evaluator-submit-gates";
import { loadEvaluatorSubmission } from "./evaluator-submission-model";
import {
  saveEvaluatorSubmission,
  submitEvaluatorSubmission,
  syncEvaluatorChecklistFromPartyCaseStudy,
} from "./evaluator-submission-commands";
import { ensureOpenValuationRequest } from "./issue-valuation-report";
import { formatValuationReportIssueDateIso } from "./valuation-report-number";
import { clearPartyTaskRecall } from "@platform/app-shared/app-data/party-task-recall-model";
import type { EvaluatorSubmission } from "./evaluator-window-data";

type FinalizeAppraiserResult =
  | { ok: true; submission: EvaluatorSubmission }
  | { ok: false; message: string };

/**
 * Submits the appraiser valuation + inference answers to the case-study specialist.
 *
 * How it works: 1) reads the study-report gate fresh and stops if it is not ready; 2) if a
 * package and a party study draft exist, re-syncs the checklist from the study; 3) for a
 * package not yet submitted/completed: makes sure the deed's valuation request is open, fixes
 * the report issue date and appraisal date (today when reopened or empty) and saves; 4) submits
 * (`submitEvaluatorSubmission`) and clears the task's recall flag. Returns ok + submission or a
 * message.
 *
 * Edge cases: — the report number is not drawn here any more (it used to
 * reserve VR/TQ numbers, with a "could not reserve" failure); the server fixes PRV-… at report
 * approval. An unopenable valuation request or a failed date save stops before submitting.
 */
export async function finalizeAppraiserSubmission(
  appraisalTaskId: string,
  idempotencyKey?: string,
): Promise<FinalizeAppraiserResult> {
  // Fresh study-report flag BEFORE any side effect (checklist sync write, valuation-request
  // open, draft save). Fails closed on an unreadable flag.
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
    // The valuation request must be open for the package to land on; the report number is NOT
    // drawn here: the server fixes PRV-… when the report is approved.
    try {
      await ensureOpenValuationRequest({ propertyId: current.propertyId });
    } catch {
      return {
        ok: false,
        message: "تعذّر فتح طلب التقييم على الخادم. أعد المحاولة.",
      };
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
      reportIssueDate,
      appraisalDate,
      updatedAtUtc: issuedAt.toISOString(),
    });
    if (!prepared) {
      return { ok: false, message: "تعذّر تثبيت تاريخ التقرير قبل الإرسال." };
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
