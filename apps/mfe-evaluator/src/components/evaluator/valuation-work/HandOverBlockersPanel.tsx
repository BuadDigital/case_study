// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • New file — the panel on «المراجعة النهائية» that lists everything stopping the hand-over before
//         the button is pressed and keeps it on screen after a refusal (the submit's fresh read replaces
//         the loaded gates). Each blocker says who fixes it («يعالجها: …») and links to the appraiser's
//         screen (blockerScreen, by methodologyAlertGroup); the specialist's later work is listed apart
//         as «سيكملها الأخصائي» and does not block.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import type { ValuationIssuanceGatesDto } from "@platform/api-client";
import { cn } from "@platform/ui-kit";

import {
  HANDOVER_BLOCKERS_ID,
  HANDOVER_GATES_READ_EVENT,
  classifyHandOverBlockers,
  type HandOverBlocker,
  type HandOverGatesReadDetail,
} from "../../../lib/evaluator/handover-blockers";
import { Card, CardPad, CardTitle } from "./atoms";
import type { ValuationWorkScreenId } from "./lib/shell-state";
import { methodologyAlertGroup } from "./lib/methodology-alerts";

const SCREEN_LABELS: Record<"market" | "cost" | "income" | "final", string> = {
  market: "طريقة المقارنة",
  cost: "طريقة المقاول",
  income: "أسلوب الدخل",
  final: "رأي القيمة النهائي",
};

/** The appraiser's screen that resolves the blocker, when it is his. */
export function blockerScreen(b: HandOverBlocker): "market" | "cost" | "income" | "final" | null {
  if (b.alertNumber != null) {
    const group = methodologyAlertGroup(b.alertNumber);
    return group === "general" ? "final" : group;
  }
  return b.screen;
}

/**
 * On «المراجعة النهائية»: everything that stops the hand-over, listed before the button is pressed
 * and kept on screen after a refusal (the fresh read of the submit replaces the loaded gates), each
 * with who fixes it. The specialist's later work is listed apart as «سيكملها الأخصائي».
 */
export function HandOverBlockersPanel({
  gates: loadedGates,
  valuationRequestId,
  onGoToScreen,
}: {
  gates: ValuationIssuanceGatesDto | null;
  valuationRequestId: string | null;
  onGoToScreen?: (screen: ValuationWorkScreenId) => void;
}) {
  const [fresh, setFresh] = useState<HandOverGatesReadDetail | null>(null);
  // A newer load from the shell (after a save) supersedes the last submit read.
  const [seenLoaded, setSeenLoaded] = useState(loadedGates);
  if (seenLoaded !== loadedGates) {
    setSeenLoaded(loadedGates);
    setFresh(null);
  }

  useEffect(() => {
    const onRead = (e: Event) => setFresh((e as CustomEvent<HandOverGatesReadDetail>).detail);
    window.addEventListener(HANDOVER_GATES_READ_EVENT, onRead);
    return () => window.removeEventListener(HANDOVER_GATES_READ_EVENT, onRead);
  }, []);

  const gates =
    fresh && fresh.valuationRequestId === valuationRequestId ? fresh.gates : loadedGates;
  if (!gates) return null;

  const all = classifyHandOverBlockers(gates);
  const blocking = all.filter((b) => b.blocksHandOver);
  const deferred = all.filter((b) => !b.blocksHandOver);

  return (
    <Card id={HANDOVER_BLOCKERS_ID}>
      <CardPad>
        <CardTitle>جاهزية تسليم التقييم</CardTitle>
        {blocking.length === 0 ? (
          <p className="m-0 text-[12.5px] font-bold text-[#2f7a4d]" role="status">
            ✓ لا شيء يمنع التسليم من بوابات الإصدار.
          </p>
        ) : (
          <>
            <p className="mb-2 text-[12px] font-semibold text-danger-text" role="alert">
              لا يُسلَّم التقييم قبل معالجة ما يلي ({blocking.length}):
            </p>
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {blocking.map((b, i) => (
                <BlockerRow key={b.key} index={i + 1} blocker={b} onGoToScreen={onGoToScreen} />
              ))}
            </ol>
          </>
        )}
        {deferred.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11.5px] font-semibold text-text-2">
              سيكملها الأخصائي في مسودة التقرير بعد التسليم — لا تمنع التسليم:
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {deferred.map((b) => (
                <li key={b.key} className="rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-[12px] text-text-2">
                  {b.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardPad>
    </Card>
  );
}

function BlockerRow({
  index,
  blocker: b,
  onGoToScreen,
}: {
  index: number;
  blocker: HandOverBlocker;
  onGoToScreen?: (screen: ValuationWorkScreenId) => void;
}) {
  const screen = b.owner === "appraiser" ? blockerScreen(b) : null;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-[8px] border border-red bg-[var(--red-light)] px-3 py-2">
      <span className="text-[12.5px] font-semibold text-heading">
        {index}) {b.text}
      </span>
      <span
        className={cn(
          "rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-bold",
          b.owner === "appraiser" ? "text-red-text" : "text-gold-d",
        )}
      >
        يعالجها: {b.ownerLabel}
      </span>
      {screen && onGoToScreen ? (
        <button
          type="button"
          className="cursor-pointer text-[11.5px] font-bold text-gold-d underline underline-offset-2"
          onClick={() => onGoToScreen(screen)}
        >
          انتقل إلى «{SCREEN_LABELS[screen]}»
        </button>
      ) : null}
    </li>
  );
}
