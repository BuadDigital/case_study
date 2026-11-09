import type { InfathUploadAttachment } from "./infath-upload-types";

/**
 * The upload package's gaps (Omar 2026-11-08: «تجهيز المعاملة للرفع» refuses while one is missing) — the
 * names of the rows still missing, the keys proof included once the keys were received.
 * Edge cases: rows the transaction has no such file for («لا يوجد رفع مساحي», «لا ينطبق — أرض») never count.
 */
export function uploadPackageGaps(attachments: readonly InfathUploadAttachment[]): string[] {
  return attachments
    .filter((a) => a.status === "missing" || a.status === "conditional")
    .map((a) => a.name);
}

/**
 * Pure rules of the specialist's Enfaz handover card (batch 2C, wire (f)): when the «تسجيل الرفع على
 * إنفاذ» button is live, what blocks it, and what the «إعادة من إنفاذ» dialog needs before it submits.
 */
import type { EnfazReturnRequest, TransactionStateDto } from "@platform/api-client";

export const ENFAZ_RETURN_REASON_MIN_LENGTH = 10;

type EnfazCardState = {
  /** The handover stamp is set. */
  handedOver: boolean;
  handedOverAtUtc: string | null;
  /**
   * The accountant marked the deed «جاهز للفوترة» — its figures are on Enfaz, so it is not taken back.
   * How it works: true only when the deed is handed over AND the server sent a non-blank
   * `billingReadyAtUtc`. Edge cases: a mark without a handover stamp (inconsistent data) is ignored; a
   * missing state (still loading, or an older server without the field) reads false, so the return
   * button keeps showing and the server's own refusal stays the safety net.
   */
  billingReady: boolean;
  /** Why the handover is refused now — always empty once handed over. */
  blockReasons: string[];
  /** «تجهيز المعاملة للرفع» is done (Omar 2026-11-08) — the deed sits in the upload queue. */
  readyForUpload: boolean;
  /** «تجهيز» is live: nothing blocks, the server allows the upload, not prepared yet. */
  canPrepareUpload: boolean;
  /** The confirm button is live: nothing blocks, the server allows it, and the deed was prepared. */
  canConfirmHandover: boolean;
};

export function enfazCardState(
  state: TransactionStateDto | null | undefined,
): EnfazCardState {
  const handedOverAtUtc = state?.enfazHandoverAtUtc?.trim() || null;
  const handedOver = Boolean(handedOverAtUtc);
  const blockReasons = handedOver
    ? []
    : (state?.enfazBlockReasonsAr ?? []).map((r) => r.trim()).filter(Boolean);
  const allowed =
    Boolean(state) && !handedOver && blockReasons.length === 0 && state?.allowsEnfazHandover === true;
  const readyForUpload = Boolean(state?.readyForUploadAtUtc?.trim());
  return {
    handedOver,
    handedOverAtUtc,
    billingReady: handedOver && Boolean(state?.billingReadyAtUtc?.trim()),
    blockReasons,
    readyForUpload,
    canPrepareUpload: allowed && !readyForUpload,
    canConfirmHandover: allowed && readyForUpload,
  };
}

type TransactionReopenPlan =
  | { ok: false; field: "reason" | "choice" | "reference"; error: string }
  | { ok: true; request: EnfazReturnRequest };

/**
 * «إعادة فتح المعاملة» (Omar 2026-11-05): the form checked before it is sent.
 *
 * How it works: a trimmed reason of at least 10 characters; Enfaz as the source needs its reference;
 * at least one of the study report, the valuation report or field work (which reopens the study).
 * Edge cases: the reference is dropped for an internal reopening; the server re-checks everything.
 */
export function planTransactionReopen(args: {
  source: "enfaz" | "internal";
  enfazReference: string;
  reason: string;
  reopenStudy: boolean;
  reopenValuation: boolean;
  needsFieldWork: boolean;
}): TransactionReopenPlan {
  const reason = args.reason.trim();
  if (!reason) {
    return { ok: false, field: "reason", error: "سبب إعادة الفتح إلزامي." };
  }
  if (reason.length < ENFAZ_RETURN_REASON_MIN_LENGTH) {
    return {
      ok: false,
      field: "reason",
      error: `سبب إعادة الفتح ${ENFAZ_RETURN_REASON_MIN_LENGTH} أحرف على الأقل.`,
    };
  }
  const enfazReference = args.enfazReference.trim();
  if (args.source === "enfaz" && !enfazReference) {
    return { ok: false, field: "reference", error: "اكتب رقم ملاحظة إنفاذ أو مرجعها." };
  }
  if (!args.reopenStudy && !args.reopenValuation && !args.needsFieldWork) {
    return {
      ok: false,
      field: "choice",
      error: "اختر ما تتأثر به: تقرير الدراسة أو تقرير التقييم أو عمل ميداني.",
    };
  }
  return {
    ok: true,
    request: {
      reason,
      source: args.source,
      ...(args.source === "enfaz" ? { enfazReference } : {}),
      reopenStudy: args.reopenStudy || args.needsFieldWork,
      reopenValuation: args.reopenValuation,
      needsFieldWork: args.needsFieldWork,
    },
  };
}

type EnfazStageTone = "teal" | "amber" | "gray";

/** Badge tone of one stage row of the grid (status keys: not_started / in_progress / waiting_on_party / completed). */
export function enfazStageTone(status: string): EnfazStageTone {
  if (status === "completed") return "teal";
  if (status === "in_progress" || status === "waiting_on_party") return "amber";
  return "gray";
}

/**
 * Short badge wording for the narrow property rail. The server label stays the full
 * sentence («معلق بانتظار طرف») and is kept as the row tooltip.
 */
export function enfazStageShortStatus(status: string, serverLabel: string): string {
  if (status === "waiting_on_party") return "بانتظار طرف";
  if (status === "not_started") return "لم يبدأ";
  return serverLabel;
}
