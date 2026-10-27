/**
 * Pure rules of the specialist's Enfaz handover card (batch 2C, wire (f)): when the «تسجيل الرفع على
 * إنفاذ» button is live, what blocks it, and what the «إعادة من إنفاذ» dialog needs before it submits.
 */
import type { TransactionStateDto } from "@platform/api-client";

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
  /** The confirm button is live: nothing blocks and the server says the handover is allowed. */
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
  return {
    handedOver,
    handedOverAtUtc,
    billingReady: handedOver && Boolean(state?.billingReadyAtUtc?.trim()),
    blockReasons,
    canConfirmHandover:
      Boolean(state) &&
      !handedOver &&
      blockReasons.length === 0 &&
      state?.allowsEnfazHandover === true,
  };
}

type EnfazReturnPlan =
  | { ok: false; field: "reason" | "choice"; error: string }
  | {
      ok: true;
      request: { reason: string; reopenStudy: boolean; reopenValuation: boolean };
    };

/** «إعادة من إنفاذ»: a reason of at least 10 characters and at least one of the two reopen choices. */
export function planEnfazReturn(args: {
  reason: string;
  reopenStudy: boolean;
  reopenValuation: boolean;
}): EnfazReturnPlan {
  const reason = args.reason.trim();
  if (!reason) {
    return { ok: false, field: "reason", error: "سبب الإعادة من إنفاذ إلزامي." };
  }
  if (reason.length < ENFAZ_RETURN_REASON_MIN_LENGTH) {
    return {
      ok: false,
      field: "reason",
      error: `سبب الإعادة ${ENFAZ_RETURN_REASON_MIN_LENGTH} أحرف على الأقل.`,
    };
  }
  if (!args.reopenStudy && !args.reopenValuation) {
    return {
      ok: false,
      field: "choice",
      error: "اختر ما يُعاد فتحه: تقرير الدراسة أو التقييم (أو كليهما).",
    };
  }
  return {
    ok: true,
    request: {
      reason,
      reopenStudy: args.reopenStudy,
      reopenValuation: args.reopenValuation,
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
