/**
 * Which screen shows (and resolves) each methodology alert. Every triggered alert must appear on
 * one screen: a soft alert that needs an acknowledgement or a rationale blocks issuance until it is
 * resolved — the cost alerts (e.g. 13 developer profit, 14 indirect rates) used to appear nowhere.
 */
export type MethodologyAlertGroup = "market" | "cost" | "income" | "general";

/**
 * Market: 11 non-vacant comparables for vacant land, 15/16/19 adoption & weights, 17 large (net or
 * gross) adjustments, 22 «تشتّت المقارنات», 23 comparable dated after the valuation date,
 * 24 comparable category ≠ subject. Cost: 1–9, 12–14, 25 depreciation above 90٪.
 * Income (D17): 26 cap rate outside 4–12٪, 27 expenses above 50٪ of EGI, 28 NOI ≤ 0.
 */
const MARKET_ALERT_NUMBERS = new Set([11, 15, 16, 17, 19, 22, 23, 24]);
const COST_ALERT_NUMBERS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 25]);
const INCOME_ALERT_NUMBERS = new Set([26, 27, 28]);

export function methodologyAlertGroup(number: number): MethodologyAlertGroup {
  if (MARKET_ALERT_NUMBERS.has(number)) return "market";
  if (COST_ALERT_NUMBERS.has(number)) return "cost";
  if (INCOME_ALERT_NUMBERS.has(number)) return "income";
  return "general";
}
