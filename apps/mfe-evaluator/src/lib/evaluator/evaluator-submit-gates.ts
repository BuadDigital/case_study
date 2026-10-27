// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • checkIssuanceGatesFailClosed refuses with every appraiser-fixable blocker and its owner
//         (classifyHandOverBlockers / handOverRefusalMessage) instead of the first four reasons; what the
//         specialist completes after the hand-over does not block. It announces the gates it read.
//  • Price New readHandOverPriceFromServer: the reconciliation's saved final value read fresh (null when
//          there is no open request / reconciliation); a failed read blocks (FINAL_VALUE_UNVERIFIED_MESSAGE).
// Round 2 (1b19bedc)
//  • The gate check returns the open valuationRequestId and readHandOverPriceFromServer accepts it,
//          skipping a second getOpenValuationRequestByProperty.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Fresh, fail-closed reads the appraiser's submit depends on. Both are deliberately NOT cached:
 * a stale «issued» flag or a swallowed network error must never let a submit through.
 */

import {
  getOpenValuationRequestByProperty,
  getPartyTaskSubmission,
  getValuationIssuanceGates,
  getValuationReconciliation,
} from "@platform/api-client";
import { apiConfig } from "./api-config";
import {
  studyReportGateForSubmission,
  type InspectionGateState,
} from "./evaluator-inspection-gate";
import {
  announceHandOverGatesRead,
  classifyHandOverBlockers,
  handOverRefusalMessage,
} from "./handover-blockers";

export const STUDY_REPORT_UNVERIFIED_MESSAGE =
  "تعذّر التحقق من إصدار تقرير دراسة الحالة — أعد المحاولة";

export const ISSUANCE_GATES_UNVERIFIED_MESSAGE =
  "تعذّر التحقق من بوابات الإصدار — أعد المحاولة";

export const FINAL_VALUE_UNVERIFIED_MESSAGE =
  "تعذّر قراءة القيمة النهائية من الترجيح — أعد المحاولة";

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

type IssuanceGateCheck =
  /** `valuationRequestId`: the open request this check read (null = none yet) — reused by the price read. */
  | { ok: true; valuationRequestId: string | null }
  | { ok: false; kind: "blocked" | "unverified"; message: string };

/**
 * Valuation issuance gates the hand-over waits on, fail closed. The only path that proceeds without gates is a
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
    if (!open.data?.id) return { ok: true, valuationRequestId: null };

    const gatesRes = await getValuationIssuanceGates({ token }, open.data.id);
    if (!gatesRes.ok || !gatesRes.data) return unverified;
    // The «المراجعة النهائية» list shows exactly what this check read.
    announceHandOverGatesRead({ valuationRequestId: open.data.id, gates: gatesRes.data });

    // What the specialist completes after the hand-over (report attachments) does not hold it
    // up; everything else does, and every blocker is named with who fixes it — the server refuses
    // the same set (case-study hand-over gate).
    const message = handOverRefusalMessage(classifyHandOverBlockers(gatesRes.data));
    return message
      ? { ok: false, kind: "blocked", message }
      : { ok: true, valuationRequestId: open.data.id };
  } catch {
    return unverified;
  }
}

type HandOverPriceRead =
  | { ok: true; price: string | null }
  | { ok: false; message: string };

/**
 * The «سعر التقييم» the hand-over sends: the reconciliation's saved final value read fresh from the
 * server, never the typed / autosaved draft figure (r8b handed over 9,830,000 while the final was
 * 9,220,000). `price: null` = nothing to take yet (no open request or no reconciliation) — the
 * draft's own price goes as before. A failed read blocks (the server refuses a mismatch anyway).
 */
export async function readHandOverPriceFromServer(input: {
  token: string | null | undefined;
  propertyId: string | null | undefined;
  /**
   * The open request the gate check just read (null = none) — skips a second
   * `getOpenValuationRequestByProperty`; undefined reads it here.
   */
  valuationRequestId?: string | null;
}): Promise<HandOverPriceRead> {
  const failed: HandOverPriceRead = { ok: false, message: FINAL_VALUE_UNVERIFIED_MESSAGE };
  const token = input.token?.trim();
  const propertyId = input.propertyId?.trim();
  if (!token || !propertyId) return failed;
  try {
    let requestId = input.valuationRequestId;
    if (requestId === undefined) {
      const open = await getOpenValuationRequestByProperty({ token }, propertyId);
      if (!open.ok) return failed;
      requestId = open.data?.id ?? null;
    }
    if (!requestId) return { ok: true, price: null };
    const recon = await getValuationReconciliation({ token }, requestId);
    if (!recon.ok) return recon.kind === "not_found" ? { ok: true, price: null } : failed;
    const final = Number(recon.data.finalOpinionValue);
    return { ok: true, price: Number.isFinite(final) && final > 0 ? String(final) : null };
  } catch {
    return failed;
  }
}
