"use client";

import { useEffect } from "react";
import { preloadableLazy, whenIdle } from "@platform/ui-kit";

const adjustmentsMatrix = preloadableLazy(() =>
  import("./AdjustmentsMatrix").then((m) => m.AdjustmentsMatrix),
);
const costApproachSection = preloadableLazy(() =>
  import("./CostApproachSection").then((m) => m.CostApproachSection),
);
const finalOpinionSection = preloadableLazy(() =>
  import("./FinalOpinionSection").then((m) => m.FinalOpinionSection),
);

export const AdjustmentsMatrix = adjustmentsMatrix.Component;
export const CostApproachSection = costApproachSection.Component;
export const FinalOpinionSection = finalOpinionSection.Component;

function preloadLaterWorkScreens() {
  void adjustmentsMatrix.preload();
  void costApproachSection.preload();
  void finalOpinionSection.preload();
}

/**
 * Download the later screens' code while the appraiser reads the first one, so
 * opening «طريقة المقارنة» / «طريقة المقاول» / «رأي القيمة» shows no loading skeleton.
 */
export function usePreloadLaterWorkScreens(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    return whenIdle(preloadLaterWorkScreens);
  }, [ready]);
}
