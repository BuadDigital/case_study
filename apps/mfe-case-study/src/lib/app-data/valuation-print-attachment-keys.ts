/** Persist specialist-selected valuation print attachment keys (per property). */

import {
  loadSpecialistReportExtrasBag,
  patchSpecialistReportExtras,
} from "@platform/app-shared/storage/specialist-report-extras-sync";

export {
  printKeyForPropertyDocument,
  type PrintAttachmentDocRef,
} from "@platform/app-shared/app-data/valuation-print-attachment-keys";

export function loadSpecialistPrintAttachmentKeys(
  propertyId: string | null | undefined,
): string[] {
  const id = (propertyId ?? "").trim();
  if (!id || typeof window === "undefined") return [];
  const parsed = loadSpecialistReportExtrasBag(id).printKeys;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

export function saveSpecialistPrintAttachmentKeys(
  propertyId: string,
  keys: string[],
): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  patchSpecialistReportExtras(id, { printKeys: unique });
  window.dispatchEvent(
    new CustomEvent(VALUATION_PRINT_KEYS_CHANGED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}

export const VALUATION_PRINT_KEYS_CHANGED_EVENT =
  "ejadah-valuation-print-keys-changed";
