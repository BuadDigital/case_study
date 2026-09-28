import type { QueryClient } from "@tanstack/react-query";

/** Shared React Query key for the printed valuation report data bundle. */
export const EVALUATOR_REPORT_OUTPUT_QUERY_KEY = [
  "evaluator-report-output",
] as const;

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
