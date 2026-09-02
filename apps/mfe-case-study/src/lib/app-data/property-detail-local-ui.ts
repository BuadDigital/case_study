const SEEN_PREFIX = "pd-seen-tabs:";

/** tabId → activity fingerprint last dismissed by opening the tab. */
export type SeenPropertyTabMap = Record<string, string>;

export function loadSeenPropertyTabFingerprints(
  propertyId: string,
): SeenPropertyTabMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${SEEN_PREFIX}${propertyId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // New format: { tabId: fingerprint }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: SeenPropertyTabMap = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string" && v.length > 0) out[k] = v;
      }
      return out;
    }
    // Legacy format was string[] of tab ids — drop so activity fingerprints re-evaluate.
    return {};
  } catch {
    return {};
  }
}

export function markPropertyTabSeen(
  propertyId: string,
  tabId: string,
  fingerprint?: string | null,
): void {
  if (typeof window === "undefined") return;
  const token = (fingerprint ?? "").trim();
  if (!token) return;
  const seen = loadSeenPropertyTabFingerprints(propertyId);
  if (seen[tabId] === token) return;
  seen[tabId] = token;
  window.localStorage.setItem(
    `${SEEN_PREFIX}${propertyId}`,
    JSON.stringify(seen),
  );
}

/**
 * Red “new” dot when the tab has an activity fingerprint that the user has
 * not dismissed by opening that tab (for this fingerprint version).
 */
export function propertyTabHasNewDot(
  tabId: string,
  fingerprint: string | null | undefined,
  seen: SeenPropertyTabMap,
): boolean {
  const token = (fingerprint ?? "").trim();
  if (!token) return false;
  return seen[tabId] !== token;
}
