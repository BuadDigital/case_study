import type { QueryClient } from "@tanstack/react-query";

/** Shared React Query key for the printed valuation report data bundle. */
export const EVALUATOR_REPORT_OUTPUT_QUERY_KEY = [
  "evaluator-report-output",
] as const;

/** What one report fill is keyed on — the property and the tasks that feed it. */
export type EvaluatorReportOutputScope = {
  propertyId: string | null | undefined;
  poNumber: string;
  inspectionTaskId: string | null | undefined;
  surveyTaskId: string | null | undefined;
};

export function evaluatorReportOutputQueryKey(scope: EvaluatorReportOutputScope) {
  return [
    ...EVALUATOR_REPORT_OUTPUT_QUERY_KEY,
    scope.propertyId ?? "",
    scope.poNumber,
    scope.inspectionTaskId ?? "",
    scope.surveyTaskId ?? "",
  ] as const;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Mark the report fill stale (and refetch if the output tab is mounted).
 * Debounced so rapid comparable-cell saves do not stampede the bundle.
 */
export function scheduleInvalidateEvaluatorReportOutput(
  queryClient: QueryClient,
  delayMs = 450,
): void {
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void queryClient.invalidateQueries({
      queryKey: EVALUATOR_REPORT_OUTPUT_QUERY_KEY,
    });
  }, delayMs);
}

/**
 * Opening «تقرير التقييم»: pull a fresh fill, unless the hover prefetch fetched it
 * moments ago (or is still fetching) and no save has invalidated it since —
 * refetching then would only repeat the same request.
 */
export function refreshEvaluatorReportOutputOnOpen(
  queryClient: QueryClient,
  scope: EvaluatorReportOutputScope,
  freshMs = 10_000,
): void {
  const state = queryClient
    .getQueryCache()
    .find({ queryKey: evaluatorReportOutputQueryKey(scope), exact: true })?.state;
  const justFetched =
    state != null &&
    !state.isInvalidated &&
    (state.fetchStatus === "fetching" ||
      Date.now() - state.dataUpdatedAt < freshMs);
  if (!justFetched) invalidateEvaluatorReportOutput(queryClient);
}

/** Immediate drop — use after a single intentional save (final opinion, ESG, settings). */
export function invalidateEvaluatorReportOutput(
  queryClient: QueryClient,
): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void queryClient.invalidateQueries({
    queryKey: EVALUATOR_REPORT_OUTPUT_QUERY_KEY,
  });
}
