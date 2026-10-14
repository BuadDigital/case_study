import { roundHalfAwayFromZero } from "@platform/app-shared/format/money";

/** The server's WeightSumTolerance (MarketApproachRules / ReconciliationRules). */
export const WEIGHT_SUM_TOLERANCE = 0.05;

/**
 * True when weights sum to 100 within ±0.05 — the server's rule, so 99.95 and 100.05 pass
 * and 99.5 does not. Float noise (33.33 + 33.33 + 33.34 = 99.99999…) is cleaned first.
 */
export function weightsSumTo100(sum: number): boolean {
  return Math.abs(roundHalfAwayFromZero(sum - 100, 9)) <= WEIGHT_SUM_TOLERANCE;
}
