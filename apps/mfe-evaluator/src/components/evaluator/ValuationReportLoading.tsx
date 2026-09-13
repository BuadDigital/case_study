"use client";

import { Spinner } from "@platform/ui-kit";

/**
 * The one loading state for the valuation report: shown while the report code downloads and
 * again while its data loads, so the appraiser sees a single «جاري تجهيز» instead of two
 * different loaders in a row. Keep this file light — it is the `dynamic()` fallback.
 */
export function ValuationReportLoading() {
  return (
    <div
      className="flex items-center gap-2 py-8 text-[13px] text-text-3"
      role="status"
      aria-busy
    >
      <Spinner />
      <span>جاري تجهيز تقرير التقييم…</span>
    </div>
  );
}
