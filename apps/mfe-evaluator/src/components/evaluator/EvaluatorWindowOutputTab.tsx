"use client";

import dynamic from "next/dynamic";
import type { QueryClient } from "@tanstack/react-query";
import { ValuationReportLoading } from "./ValuationReportLoading";
import type { prefetchValuationReportOutput } from "./EvaluatorValuationReportOutputTab";

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

/** Code and data together — for the moment the pointer reaches the report tab. */
export const prefetchValuationReportOutputTab = (
  queryClient: QueryClient,
  input: Parameters<typeof prefetchValuationReportOutput>[1],
) =>
  void import("./EvaluatorValuationReportOutputTab").then((m) =>
    m.prefetchValuationReportOutput(queryClient, input),
  );
