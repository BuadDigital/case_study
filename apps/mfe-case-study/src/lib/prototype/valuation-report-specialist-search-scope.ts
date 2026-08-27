/** Search-scope notes filled by the case specialist — mirrored read-only to the appraiser. */

const STORAGE_PREFIX = "ejadah.valuation-specialist-search-scope.v1:";

export const VALUATION_SPECIALIST_SEARCH_SCOPE_CHANGED_EVENT =
  "ejadah-valuation-specialist-search-scope-changed";

function storageKey(propertyId: string): string {
  return `${STORAGE_PREFIX}${propertyId.trim()}`;
}

export function loadSpecialistSearchScopeNotes(
  propertyId: string | null | undefined,
): string {
  const id = (propertyId ?? "").trim();
  if (!id || typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function saveSpecialistSearchScopeNotes(
  propertyId: string,
  notes: string,
): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(id), notes);
  window.dispatchEvent(
    new CustomEvent(VALUATION_SPECIALIST_SEARCH_SCOPE_CHANGED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}
