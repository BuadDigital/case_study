/** Persist specialist-selected valuation print attachment keys (per property). */

import {
  loadSpecialistReportExtrasBag,
  patchSpecialistReportExtras,
} from "@platform/app-shared/storage/specialist-report-extras-sync";
import type { PropertyDetailDocumentEntry } from "./property-detail-documents";

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

/** Infer catalog print key from a property-document entry. */
export function printKeyForPropertyDocument(
  doc: Pick<PropertyDetailDocumentEntry, "id" | "name" | "fileName" | "source">,
): string | null {
  const id = doc.id.toLowerCase();
  const text = `${doc.name} ${doc.fileName} ${doc.source}`.toLowerCase();

  if (
    id.includes("survey") ||
    /رفع مساح|التقرير المساحي|حدود|boundar/.test(text) ||
    doc.source.includes("المكتب الهندسي")
  ) {
    if (/كروكي|site.?letter|خطاب موقع/.test(text) || id.includes("site")) {
      return "zoning-sketch";
    }
    return "survey";
  }
  if (
    id.includes("permit") ||
    /رخصة البناء|building.?permit|رخص/.test(text)
  ) {
    return "building-permit";
  }
  if (
    id.includes("zoning") ||
    id.includes("site") ||
    /كروكي|zoning|خريطة الموقع|site.?map/.test(text)
  ) {
    return "zoning-sketch";
  }
  if (
    id.includes("deed") ||
    id.includes("reg") ||
    id.includes("assignment") ||
    id.includes("delegation") ||
    id.includes("bourse") ||
    /صك|تملك|سجل عقاري|خطاب الإسناد|تفويض/.test(text)
  ) {
    return "deed";
  }
  return null;
}
