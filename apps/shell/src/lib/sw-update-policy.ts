/**
 * When a new build may replace the running one (decision 2026-10-19: no «تحديث الآن» banner —
 * the update applies on its own at a moment nobody is typing).
 *
 * Moments:
 * - "load": the page has just loaded and a newer worker is already waiting — nothing is on
 *   screen yet, so switch at once.
 * - "navigation": the employee moved to another screen; whatever they were editing is saved
 *   or left behind, so the next page can be the new build.
 * - "hidden": the tab went to the background; the reload happens while nobody is looking.
 *
 * Never while offline outbox items are still pending: the reload would interrupt the sync.
 */
export type SwUpdateMoment = "load" | "navigation" | "hidden";

export function shouldApplyUpdate(input: {
  moment: SwUpdateMoment;
  pendingOfflineItems: number;
}): boolean {
  if (input.pendingOfflineItems > 0) return false;
  return input.moment === "load" || input.moment === "navigation" || input.moment === "hidden";
}
