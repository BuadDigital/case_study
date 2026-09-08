/** Market-approach methodology alerts (Q-4 + comparable weights / adoption). */
export const MARKET_METHODOLOGY_ALERT_NUMBERS = new Set([15, 16, 17, 19, 20]);

export function isMarketMethodologyAlert(number: number): boolean {
  return MARKET_METHODOLOGY_ALERT_NUMBERS.has(number);
}
