/**
 * Fresh, fail-closed reads the appraiser's submit depends on. Both are deliberately NOT cached:
 * a stale «issued» flag or a swallowed network error must never let a submit through.
 */

import {
  getOpenValuationRequestByProperty,
  getPartyTaskSubmission,
  getValuationIssuanceGates,
} from "@platform/api-client";
import { apiConfig } from "./api-config";
import {
  studyReportGateForSubmission,
  type InspectionGateState,
} from "./evaluator-inspection-gate";

export const STUDY_REPORT_UNVERIFIED_MESSAGE =
  "تعذّر التحقق من إصدار تقرير دراسة الحالة — أعد المحاولة";

export const ISSUANCE_GATES_UNVERIFIED_MESSAGE =
  "تعذّر التحقق من بوابات الإصدار — أعد المحاولة";

/**
 * Re-reads the appraisal submission from the server (bypassing every cache) and applies the
 * study-report gate. No session, a failed read or a throw all close the gate.
 */
export async function readFreshStudyReportGate(
  appraisalTaskId: string,
): Promise<InspectionGateState> {
  const config = apiConfig();
  if (!config) return { ready: false, reason: STUDY_REPORT_UNVERIFIED_MESSAGE };
  try {
    const res = await getPartyTaskSubmission(config, appraisalTaskId);
    if (!res.ok) return { ready: false, reason: STUDY_REPORT_UNVERIFIED_MESSAGE };
    return studyReportGateForSubmission(res.data);
  } catch {
    return { ready: false, reason: STUDY_REPORT_UNVERIFIED_MESSAGE };
  }
}

export type IssuanceGateCheck =
  | { ok: true }
  | { ok: false; kind: "blocked" | "unverified"; message: string };

/**
 * Valuation issuance gates, fail closed. The only path that proceeds without gates is a
 * property with NO open valuation request yet (first submit — `finalizeAppraiserSubmission`
 * opens it and reserves the report number); every other unknown blocks.
 */
export async function checkIssuanceGatesFailClosed(input: {
  token: string | null | undefined;
  propertyId: string | null | undefined;
}): Promise<IssuanceGateCheck> {
  const unverified: IssuanceGateCheck = {
    ok: false,
    kind: "unverified",
    message: ISSUANCE_GATES_UNVERIFIED_MESSAGE,
  };
  const token = input.token?.trim();
  const propertyId = input.propertyId?.trim();
  if (!token || !propertyId) return unverified;

  try {
    const open = await getOpenValuationRequestByProperty({ token }, propertyId);
    if (!open.ok) return unverified;
    if (!open.data?.id) return { ok: true };

    const gatesRes = await getValuationIssuanceGates({ token }, open.data.id);
    if (!gatesRes.ok || !gatesRes.data) return unverified;
    if (gatesRes.data.allowsIssuance) return { ok: true };

    // Show every reason, not just the first — otherwise the appraiser fixes one,
    // resubmits, hits the next, and repeats a trial-and-error loop.
    const reasons = gatesRes.data.blockingReasonsAr ?? [];
    const reasonText = reasons.length
      ? reasons.slice(0, 4).join("؛ ") +
        (reasons.length > 4 ? ` وغيرها (${reasons.length - 4} أخرى)` : "")
      : "شروط الإصدار غير مستوفاة";
    return { ok: false, kind: "blocked", message: `الاعتماد ممنوع — ${reasonText}` };
  } catch {
    return unverified;
  }
}
