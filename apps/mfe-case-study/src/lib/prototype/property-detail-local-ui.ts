const STORAGE_PREFIX = "pd-notes:";

export function propertyNotesStorageKey(
  poNumber: string,
  propertyId: string,
): string {
  return `${STORAGE_PREFIX}${poNumber.trim()}:${propertyId}`;
}

export type PropertyNoteReply = {
  id: string;
  text: string;
  at: string;
  author: string;
};

export type PropertyNoteEntry = {
  id: string;
  text: string;
  at: string;
  author: string;
  replies?: PropertyNoteReply[];
};

export function loadPropertyNotes(
  poNumber: string,
  propertyId: string,
): PropertyNoteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      propertyNotesStorageKey(poNumber, propertyId),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PropertyNoteEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePropertyNotes(
  poNumber: string,
  propertyId: string,
  notes: PropertyNoteEntry[],
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    propertyNotesStorageKey(poNumber, propertyId),
    JSON.stringify(notes),
  );
}

const SEEN_PREFIX = "pd-seen-tabs:";

/** tabId → activity fingerprint last dismissed by opening the tab. */
export type SeenPropertyTabMap = Record<string, string>;

/**
 * @deprecated Static seed is no longer used — activity is event-driven.
 * Kept for any external imports during transition.
 */
export const PROPERTY_DETAIL_NEW_TAB_SEED = [
  "documents",
  "appraisal",
  "log",
] as const;

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

/** @deprecated Prefer loadSeenPropertyTabFingerprints. */
export function loadSeenPropertyTabs(propertyId: string): Set<string> {
  return new Set(Object.keys(loadSeenPropertyTabFingerprints(propertyId)));
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
