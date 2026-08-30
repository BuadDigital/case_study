/** Search-scope notes filled by the case specialist — mirrored read-only to the appraiser. */

import {
  loadSpecialistReportExtrasBag,
  patchSpecialistReportExtras,
} from "@platform/app-shared/storage/specialist-report-extras-sync";

export const VALUATION_SPECIALIST_SEARCH_SCOPE_CHANGED_EVENT =
  "ejadah-valuation-specialist-search-scope-changed";

export function loadSpecialistSearchScopeNotes(
  propertyId: string | null | undefined,
): string {
  const id = (propertyId ?? "").trim();
  if (!id || typeof window === "undefined") return "";
  return loadSpecialistReportExtrasBag(id).searchScopeNotes ?? "";
}

export function saveSpecialistSearchScopeNotes(
  propertyId: string,
  notes: string,
): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  patchSpecialistReportExtras(id, { searchScopeNotes: notes });
  window.dispatchEvent(
    new CustomEvent(VALUATION_SPECIALIST_SEARCH_SCOPE_CHANGED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}
