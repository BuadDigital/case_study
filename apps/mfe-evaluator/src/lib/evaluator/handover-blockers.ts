// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • New file — classifies failing hard gates and blocking alerts by who fixes them (appraiser, «سيكملها
//         الأخصائي بعد التسليم», specialist, value documents, administration) and the appraiser's screen;
//         `required_attachments` does not block. Mirrors server AppraisalHandOverGateRules.
//  • handOverRefusalMessage numbers every blocker with its owner; announceHandOverGatesRead lets
//         «المراجعة النهائية» show the gates the refusal read.
// Round 2 (1b19bedc)
//  • Alert 16 (m16_weights_not_100) is not listed again when a weights gate already fails — the weights
//         item showed twice.
//  • B    Comment only: `adjustment_rationales_*` gates (rationale under 10 characters) fall to the appraiser
//         and route by their suffix through the existing rules.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Which issuance gates hold up the appraiser's hand-over («اعتماد التقييم وإرسال») and who fixes
 * each. Mirrors the server rule `AppraisalHandOverGateRules` (case-study hand-over): every failing
 * hard gate and blocking methodology alert refuses the hand-over, except what the case specialist
 * completes AFTER it (the report attachments — deed copy, survey document), shown as «سيكملها الأخصائي».
 * Pure: no React, no I/O.
 */
import type { ValuationIssuanceGatesDto } from "@platform/api-client";
import { HANDOVER_GATES_READ_EVENT } from "@platform/app-shared/events/app-events";

export type HandOverBlockerOwner =
  | "appraiser"
  | "specialist_after_handover"
  | "specialist"
  | "value_documents"
  | "administration";

/** The appraiser's screen that fixes a gate (null = not his, or an alert — its screen follows its group). */
export type HandOverBlockerScreen = "market" | "cost" | "final" | null;

export type HandOverBlocker = {
  key: string;
  code: string;
  text: string;
  owner: HandOverBlockerOwner;
  ownerLabel: string;
  blocksHandOver: boolean;
  screen: HandOverBlockerScreen;
  /** Methodology alerts only — the screen that resolves it follows `methodologyAlertGroup`. */
  alertNumber?: number;
};

export const HANDOVER_OWNER_LABELS: Record<HandOverBlockerOwner, string> = {
  appraiser: "المقيّم",
  specialist_after_handover: "سيكملها الأخصائي بعد التسليم",
  specialist: "أخصائي دراسة الحالة",
  value_documents: "أخصائي دراسة الحالة يعتمد المستند، أو يُزال استخدامه",
  administration: "إدارة المنشأة (اعتمادات المقيّمين)",
};

/** Gates the specialist fills in his report draft after the hand-over. */
const SPECIALIST_AFTER_HANDOVER_CODES = new Set(["required_attachments"]);

/** The «المراجعة النهائية» blockers card — a refused hand-over scrolls to it. */
export const HANDOVER_BLOCKERS_ID = "handover-blockers";

export const HANDOVER_REFUSED_PREFIX = "لا يُسلَّم التقييم قبل معالجة ما يلي: ";

function ownerOf(code: string): HandOverBlockerOwner {
  const c = code.trim().toLowerCase();
  if (SPECIALIST_AFTER_HANDOVER_CODES.has(c)) return "specialist_after_handover";
  if (c === "credentials" || c === "participant_credentials") return "administration";
  if (c === "deed_nature_match" || c === "study_report_issued") return "specialist";
  if (c === "value_documents") return "value_documents";
  return "appraiser";
}

function screenOfGate(code: string): HandOverBlockerScreen {
  const c = code.trim().toLowerCase();
  if (c.endsWith("_land_within_cost") || c === "cost_land_estimate_complete") return "cost";
  // The buildings' ages (2026-11-10 gate) are entered on the cost screen — it had no link (2026-11-11).
  if (c === "cost_depreciation_complete") return "cost";
  if (c.endsWith("_market")) return "market";
  if (c === "reconciliation_weights" || c === "final_opinion") return "final";
  return null;
}

/**
 * The place a blocker is fixed at, on its screen (Omar 2026-11-11: «يوجّهه على المكان») — the ids
 * of the control to land on, most exact first, then the block that holds it.
 *
 * How it works: a methodology alert lands on its own row in the screen's alerts panel (its
 * rationale box when it asks for one); a gate lands on the table or field its text is about — the
 * comparables bank, the adjustments table, the land estimate, the buildings' ages, the
 * reconciliation table.
 * Edge cases: a blocker that is not the appraiser's, or one with no place of its own, has none —
 * its link then only opens the screen.
 */
export function blockerTargetIds(b: Pick<HandOverBlocker, "code" | "owner" | "alertNumber">): string[] {
  if (b.owner !== "appraiser") return [];
  if (b.alertNumber != null) return [`alert-override-${b.code}`, `methodology-alert-${b.code}`];
  const c = b.code.trim().toLowerCase();
  if (c === "cost_depreciation_complete") return ["cost-ages-missing-hint", "cost-age"];
  if (c.endsWith("_land_within_cost") || c === "cost_land_estimate_complete") return ["cost-land-bank"];
  if (c.startsWith("comparable_weights")) return ["mx-adjustments", "mx-bank"];
  if (c.endsWith("_market")) return ["mx-bank"];
  // The reconciliation table is the wide screen's; on a phone the rationale box under it is the place.
  if (c === "reconciliation_weights" || c === "final_opinion") return ["final-recon", "final-methods-rationale"];
  return [];
}

function textOf(detail: string | null | undefined, label: string): string {
  return detail?.trim() || label.trim();
}

/** A weights gate — the comparable weights of either table, or the approach shares. */
function isWeightsGate(code: string): boolean {
  const c = code.trim().toLowerCase();
  return c === "reconciliation_weights" || c.startsWith("comparable_weights");
}

/** Alert 16 «مجموع الأوزان النسبية ≠ 100٪» — it repeats the weights gates. */
const WEIGHTS_ALERT_CODE = "m16_weights_not_100";

/**
 * Every failing hard gate and blocking alert, in the gates' order, each with its owner. Alert 16
 * is not listed again when a weights gate already fails (round 2: the weights item showed twice).
 * (The round-2 `adjustment_rationales_*` gate was removed on 2026-11-02 — adjustment and weight
 * rationales are optional notes.)
 */
export function classifyHandOverBlockers(
  gates: Pick<ValuationIssuanceGatesDto, "gates" | "methodologyAlerts">,
): HandOverBlocker[] {
  const list: HandOverBlocker[] = [];
  for (const g of gates.gates ?? []) {
    if (!g.isHard || g.passed) continue;
    const owner = ownerOf(g.code);
    list.push({
      key: `gate:${g.code}`,
      code: g.code,
      text: textOf(g.detailAr, g.labelAr),
      owner,
      ownerLabel: HANDOVER_OWNER_LABELS[owner],
      blocksHandOver: owner !== "specialist_after_handover",
      screen: owner === "appraiser" ? screenOfGate(g.code) : null,
    });
  }
  const weightsGateFails = list.some((b) => isWeightsGate(b.code));
  for (const a of gates.methodologyAlerts ?? []) {
    if (!a.blocksIssuance) continue;
    if (weightsGateFails && a.code.trim().toLowerCase() === WEIGHTS_ALERT_CODE) continue;
    list.push({
      key: `alert:${a.code}`,
      code: a.code,
      text: textOf(a.detailAr, `${a.number}. ${a.labelAr}`),
      owner: "appraiser",
      ownerLabel: HANDOVER_OWNER_LABELS.appraiser,
      blocksHandOver: true,
      screen: null,
      alertNumber: a.number,
    });
  }
  return list;
}

/** The refusal text — every blocker that holds the hand-over, numbered in Latin digits. */
export function handOverRefusalMessage(blockers: HandOverBlocker[]): string | null {
  const blocking = blockers.filter((b) => b.blocksHandOver);
  if (blocking.length === 0) return null;
  return (
    HANDOVER_REFUSED_PREFIX +
    blocking
      .map((b, i) => `${i + 1}) ${b.text} — يعالجها: ${b.ownerLabel}`)
      .join("؛ ")
  );
}

export type HandOverGatesReadDetail = {
  valuationRequestId: string;
  gates: ValuationIssuanceGatesDto;
};

export function announceHandOverGatesRead(detail: HandOverGatesReadDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<HandOverGatesReadDetail>(HANDOVER_GATES_READ_EVENT, { detail }));
}
