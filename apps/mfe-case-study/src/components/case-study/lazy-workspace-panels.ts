"use client";

import { useEffect } from "react";
import { preloadableLazy, whenIdle } from "@platform/ui-kit";

const appraisalTab = preloadableLazy(() =>
  import("../po-intake/PropertyDetailAppraisalTab").then(
    (m) => m.PropertyDetailAppraisalTab,
  ),
);

/** «مدخلات التقييم» body — render inside <Suspense>. */
export const PropertyDetailAppraisalTab = appraisalTab.Component;

export function preloadValuationPanel(): void {
  void appraisalTab.preload();
}

/**
 * Download the valuation tab's code while the specialist reads the study form, so
 * opening «مدخلات التقييم» shows no loading box. Code only — no data is fetched.
 */
export function usePreloadWorkspacePanels(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    return whenIdle(preloadValuationPanel);
  }, [ready]);
}
