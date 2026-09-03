/** Map property documents ↔ report attachment keys (valuation lists). */

import type { PropertyDetailDocumentEntry } from "@case-study/mfe/lib/app-data/property-detail-documents";
import { printKeyForPropertyDocument } from "@case-study/mfe/lib/app-data/valuation-print-attachment-keys";

export { printKeyForPropertyDocument } from "@case-study/mfe/lib/app-data/valuation-print-attachment-keys";

export type ValuationPrintAttachmentRow = {
  key: string;
  name: string;
  isRequired: boolean;
  docs: PropertyDetailDocumentEntry[];
  available: boolean;
  selected: boolean;
};

const FALLBACK_LABELS: Record<string, string> = {
  deed: "صك الملكية",
  survey: "التقرير المساحي",
  "zoning-sketch": "كروكي الموقع / التنظيم",
  "building-permit": "رخصة البناء",
};

export function buildValuationPrintAttachmentRows(input: {
  catalog: { key: string; name: string; isRequired?: boolean }[];
  documents: PropertyDetailDocumentEntry[];
  selectedKeys?: string[];
}): ValuationPrintAttachmentRow[] {
  const selectedKeys = input.selectedKeys ?? [];
  const selected = new Set(selectedKeys);
  const byKey = new Map<string, PropertyDetailDocumentEntry[]>();
  for (const doc of input.documents) {
    const key = printKeyForPropertyDocument(doc);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(doc);
    byKey.set(key, list);
  }

  const catalog =
    input.catalog.length > 0
      ? input.catalog
      : Object.keys(FALLBACK_LABELS).map((key) => ({
          key,
          name: FALLBACK_LABELS[key] ?? key,
          isRequired: false,
        }));

  const rows: ValuationPrintAttachmentRow[] = catalog.map((row) => {
    const docs = byKey.get(row.key) ?? [];
    return {
      key: row.key,
      name: row.name,
      isRequired: Boolean(row.isRequired),
      docs,
      available: docs.length > 0,
      selected: selected.has(row.key),
    };
  });

  for (const key of selected) {
    if (rows.some((r) => r.key === key)) continue;
    const docs = byKey.get(key) ?? [];
    rows.push({
      key,
      name: FALLBACK_LABELS[key] ?? key,
      isRequired: false,
      docs,
      available: docs.length > 0,
      selected: true,
    });
  }

  return rows;
}

/** Default selection when appraiser has not chosen yet. */
export function defaultPrintAttachmentKeys(
  rows: ValuationPrintAttachmentRow[],
): string[] {
  return rows.filter((r) => r.available && r.isRequired).map((r) => r.key);
}
