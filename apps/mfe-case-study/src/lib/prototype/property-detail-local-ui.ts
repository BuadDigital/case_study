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

/** Tabs that start with a red "new" dot until first open (Case Study.html PDNEW). */
export const PROPERTY_DETAIL_NEW_TAB_SEED = [
  "documents",
  "appraisal",
  "log",
] as const;

export function loadSeenPropertyTabs(propertyId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`${SEEN_PREFIX}${propertyId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markPropertyTabSeen(propertyId: string, tabId: string): void {
  if (typeof window === "undefined") return;
  const seen = loadSeenPropertyTabs(propertyId);
  if (seen.has(tabId)) return;
  seen.add(tabId);
  window.localStorage.setItem(
    `${SEEN_PREFIX}${propertyId}`,
    JSON.stringify([...seen]),
  );
}

export function propertyTabHasNewDot(
  propertyId: string,
  tabId: string,
  seen: Set<string>,
): boolean {
  return (
    (PROPERTY_DETAIL_NEW_TAB_SEED as readonly string[]).includes(tabId) &&
    !seen.has(tabId)
  );
}
