"use client";

import dynamic from "next/dynamic";
import { ValuationReportLoading } from "./ValuationReportLoading";

export const EvaluatorValuationReportOutputTabLazy = dynamic(
  () =>
    import("./EvaluatorValuationReportOutputTab").then(
      (m) => m.EvaluatorValuationReportOutputTab,
    ),
  {
    ssr: false,
    // Same line the tab shows while its data loads — one loader, not two in a row.
    loading: () => <ValuationReportLoading />,
  },
);

export const preloadValuationReportOutputTab = () =>
  void import("./EvaluatorValuationReportOutputTab");
