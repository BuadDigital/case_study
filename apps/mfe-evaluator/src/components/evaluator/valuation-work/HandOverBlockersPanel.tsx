// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • New file — the panel on «المراجعة النهائية» that lists everything stopping the hand-over before
//         the button is pressed and keeps it on screen after a refusal (the submit's fresh read replaces
//         the loaded gates). Each blocker says who fixes it («يعالجها: …») and links to the appraiser's
//         screen (blockerScreen, by methodologyAlertGroup); the specialist's later work is listed apart
//         as «سيكملها الأخصائي» and does not block.
// Look (Omar 2026-11-11: «الحقل واللون والإطار غير مريح للعين»)
//  • The blockers are rows of ONE bordered list on the page's surface instead of a red box each:
//         a small numbered mark, the text, who fixes it as a badge, and the link at the row's end.
//         Red stays on the heading line and the number only.
// Guidance instead of red (Omar 2026-11-11: «بدل ما يطلعله أحمر، يوجّهه على المكان»)
//  • No red at all: an amber mark on the heading, plain numbers. Each of the appraiser's blockers
//         leads to the place it is fixed at — the link opens the section and lands on the field or
//         table itself (`blockerTargetIds`), which pulses once in gold so he sees where.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import type { ValuationIssuanceGatesDto } from "@platform/api-client";
import { guidePulseRingClass, scheduleScrollToFirstFormField } from "@platform/app-shared/form-ux";
import { Badge, Note } from "@platform/ui-kit";

import {
  HANDOVER_BLOCKERS_ID,
  blockerTargetIds,
  classifyHandOverBlockers,
  type HandOverBlocker,
  type HandOverGatesReadDetail,
} from "../../../lib/evaluator/handover-blockers";
import { Card, CardPad, CardTitle } from "./atoms";
import { SCROLL_DELAY_MS } from "./ValuationWorkErrors";
import type { ValuationWorkNavAvailability, ValuationWorkScreenId } from "./lib/shell-state";
import { methodologyAlertGroup } from "./lib/methodology-alerts";
import { HANDOVER_GATES_READ_EVENT } from "@platform/app-shared/events/app-events";

const SCREEN_LABELS: Record<"basic" | "market" | "cost" | "final", string> = {
  basic: "أساليب وطرق التقييم",
  market: "طريقة المقارنة",
  cost: "طريقة المقاول",
  final: "رأي القيمة النهائي",
};

/** The appraiser's screen that resolves the blocker, when it is his. */
export function blockerScreen(b: HandOverBlocker): "market" | "cost" | "final" | null {
  if (b.alertNumber != null) {
    const group = methodologyAlertGroup(b.alertNumber);
    return group === "general" ? "final" : group;
  }
  return b.screen;
}

/** Where a blocker's link leads: the section to open, its name on the link, and the place inside it. */
export type BlockerPlace = {
  screen: "basic" | "market" | "cost" | "final";
  label: string;
  targetIds: string[];
};

/**
 * The place a blocker's link leads to (Omar 2026-11-11: «يوجّهه على المكان»), or null when it is
 * not the appraiser's to fix.
 *
 * How it works: the blocker's own screen and the field or table on it (`blockerTargetIds`).
 * Edge cases / fixed 2026-11-11: while the approaches are not chosen yet, the market and cost
 * sections are not on the page at all, yet the server already lists their blockers (it assumes
 * the default approaches) — the link named a section that did not exist and did nothing. It now
 * leads to «أساليب وطرق التقييم», where choosing the approaches brings those sections. The same
 * before «بدء التقييم» (`started` false): every work section then only says «لم يبدأ التقييم بعد»,
 * so each of his blockers leads to the start. `nav` unknown (not passed) → the blocker's own
 * screen, as before.
 */
export function blockerPlace(
  b: HandOverBlocker,
  nav?: ValuationWorkNavAvailability,
  started = true,
): BlockerPlace | null {
  const screen = b.owner === "appraiser" ? blockerScreen(b) : null;
  if (!screen) return null;
  if (!started || (screen !== "final" && nav && !nav[screen])) {
    return { screen: "basic", label: SCREEN_LABELS.basic, targetIds: ["as-approaches"] };
  }
  return { screen, label: SCREEN_LABELS[screen], targetIds: blockerTargetIds(b) };
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
  nav,
  started = true,
}: {
  gates: ValuationIssuanceGatesDto | null;
  valuationRequestId: string | null;
  onGoToScreen?: (screen: ValuationWorkScreenId) => void;
  /** Which approach sections are on the page — a blocker of one that is not leads to the approaches. */
  nav?: ValuationWorkNavAvailability;
  /** «بدء التقييم» succeeded — before it, every blocker of his leads to the approaches section. */
  started?: boolean;
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
          <Note tone="success" className="mb-0 font-bold" role="status">
            ✓ لا شيء يمنع التسليم من بوابات الإصدار.
          </Note>
        ) : (
          <>
            <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-bold text-heading" role="alert">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
              لا يُسلَّم التقييم قبل معالجة ما يلي ({blocking.length}):
            </p>
            <ol className={LIST_CLASS}>
              {blocking.map((b, i) => (
                <BlockerRow
                  key={b.key}
                  index={i + 1}
                  blocker={b}
                  place={blockerPlace(b, nav, started)}
                  onGoToScreen={onGoToScreen}
                />
              ))}
            </ol>
          </>
        )}
        {deferred.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-text-2">
              سيكملها الأخصائي في مسودة التقرير بعد التسليم — لا تمنع التسليم:
            </p>
            <ul className={LIST_CLASS}>
              {deferred.map((b) => (
                <li key={b.key} className={`${ROW_CLASS} text-[12.5px] text-text-2`}>
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-border-md" />
                  <span className="min-w-0 flex-1 leading-relaxed">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardPad>
    </Card>
  );
}

/**
 * How long a link keeps looking for its place (× 50ms): a section opened for the first time loads its
 * body first, which took longer than the save-error budget on a first visit (seen 2026-11-11).
 */
const LANDING_RETRIES = 80;

/** One bordered list on the page's surface; its rows are parted by thin rules. */
const LIST_CLASS =
  "m-0 list-none divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-surface p-0";
const ROW_CLASS = "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5";
// On a wide screen a blocker's parts sit in columns, so «يعالجها» and the links line up down the list.
const BLOCKER_ROW_CLASS = `${ROW_CLASS} lg:grid lg:grid-cols-[22px_minmax(0,1fr)_170px_190px]`;

/**
 * One thing that stops the hand-over: its number, what it is, who fixes it, and — when it is the
 * appraiser's — the link to the screen that resolves it.
 *
 * How it works: the appraiser's own blockers carry an amber badge (his to do), the others a grey one
 * (they wait for someone else); on a wide screen the badge and the link each keep a column, on a
 * narrow one they wrap under the text. The link opens the blocker's section, then scrolls to the
 * field or table that fixes it and pulses it once in gold (`blockerPlace`, the screens' own «انتقل
 * للحقل» helper).
 * Edge cases: a blocker with no place of its own only opens its section; the place is looked for
 * again for a moment, as the section may still be opening.
 */
function BlockerRow({
  index,
  blocker: b,
  place,
  onGoToScreen,
}: {
  index: number;
  blocker: HandOverBlocker;
  place: BlockerPlace | null;
  onGoToScreen?: (screen: ValuationWorkScreenId) => void;
}) {
  return (
    <li className={BLOCKER_ROW_CLASS}>
      <span
        aria-hidden
        className="grid size-[22px] shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-[11px] font-bold tabular-nums text-heading"
      >
        {index}
      </span>
      <span className="min-w-[220px] flex-1 text-[12.5px] leading-relaxed text-heading">{b.text}</span>
      <Badge
        tone={b.owner === "appraiser" ? "warning" : "default"}
        className="justify-self-start px-2 py-0.5 text-[10.5px]"
      >
        يعالجها: {b.ownerLabel}
      </Badge>
      {place && onGoToScreen ? (
        <button
          type="button"
          className="cursor-pointer justify-self-start rounded-md border-none bg-transparent px-1.5 py-0.5 text-start text-[11.5px] font-bold text-gold-d hover:bg-row-hover hover:underline"
          onClick={() => {
            onGoToScreen(place.screen);
            scheduleScrollToFirstFormField(place.targetIds, SCROLL_DELAY_MS, {
              retries: LANDING_RETRIES,
              // Gold, not the invalid red: he is being led to a place, not told off.
              pulseClass: guidePulseRingClass,
            });
          }}
        >
          انتقل إلى «{place.label}»
          <span aria-hidden> ←</span>
        </button>
      ) : null}
    </li>
  );
}
