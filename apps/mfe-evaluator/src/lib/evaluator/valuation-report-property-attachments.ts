/** Map مستندات العقار ↔ مفاتيح مرفقات التقرير (قوائم التقييم). */

import type { PropertyDetailDocumentEntry } from "@case-study/mfe/lib/prototype/property-detail-documents";
import {
  loadSpecialistPrintAttachmentKeys,
  printKeyForPropertyDocument,
} from "@case-study/mfe/lib/prototype/valuation-print-attachment-keys";

export {
  loadSpecialistPrintAttachmentKeys,
  saveSpecialistPrintAttachmentKeys,
  printKeyForPropertyDocument,
  VALUATION_PRINT_KEYS_CHANGED_EVENT,
} from "@case-study/mfe/lib/prototype/valuation-print-attachment-keys";

export type ValuationPrintAttachmentRow = {
  key: string;
  name: string;
  isRequired: boolean;
  docs: PropertyDetailDocumentEntry[];
  available: boolean;
  specialistSelected: boolean;
};

export function buildValuationPrintAttachmentRows(input: {
  catalog: { key: string; name: string; isRequired?: boolean }[];
  documents: PropertyDetailDocumentEntry[];
  specialistKeys?: string[];
  propertyId?: string | null;
}): ValuationPrintAttachmentRow[] {
  const specialistKeys =
    input.specialistKeys ??
    loadSpecialistPrintAttachmentKeys(input.propertyId);
  const specialist = new Set(specialistKeys);
  const byKey = new Map<string, PropertyDetailDocumentEntry[]>();
  for (const doc of input.documents) {
    const key = printKeyForPropertyDocument(doc);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(doc);
    byKey.set(key, list);
  }

  const rows: ValuationPrintAttachmentRow[] = input.catalog.map((row) => {
    const docs = byKey.get(row.key) ?? [];
    return {
      key: row.key,
      name: row.name,
      isRequired: Boolean(row.isRequired),
      docs,
      available: docs.length > 0,
      specialistSelected: specialist.has(row.key),
    };
  });

  for (const key of specialist) {
    if (rows.some((r) => r.key === key)) continue;
    const docs = byKey.get(key) ?? [];
    rows.push({
      key,
      name: key,
      isRequired: false,
      docs,
      available: docs.length > 0,
      specialistSelected: true,
    });
  }

  return rows;
}

/** Default selection when appraiser has not chosen yet. */
export function defaultPrintAttachmentKeys(
  rows: ValuationPrintAttachmentRow[],
): string[] {
  const specialist = rows.filter((r) => r.specialistSelected).map((r) => r.key);
  if (specialist.length) return specialist;
  return rows.filter((r) => r.available && r.isRequired).map((r) => r.key);
}
