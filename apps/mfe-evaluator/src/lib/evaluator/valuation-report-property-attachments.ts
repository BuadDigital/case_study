/** Map property documents ↔ report attachment keys (valuation lists). */

import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import {
  REPORT_PRINTABLE_ATTACHMENT_KEYS,
  printKeyForPropertyDocument,
} from "@platform/app-shared/app-data/valuation-print-attachment-keys";
import { findPropertyDocumentType } from "@platform/app-shared/domain/property-documents/property-document-types";

export { printKeyForPropertyDocument } from "@platform/app-shared/app-data/valuation-print-attachment-keys";

export type ValuationPrintAttachmentRow = {
  key: string;
  name: string;
  isRequired: boolean;
  docs: PropertyDetailDocumentEntry[];
  available: boolean;
  selected: boolean;
  /**
   * Has a place in the printed report — the valuer can select and order it. Other governed
   * document types on the property are listed read-only for reference.
   */
  printable: boolean;
};

/** Admin rows outside the document registry keep their old selectable behaviour. */
function isPrintableAttachmentKey(key: string): boolean {
  return (
    REPORT_PRINTABLE_ATTACHMENT_KEYS.includes(key) || !findPropertyDocumentType(key)
  );
}

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
    // Printable documents group under their report key (bourse deed → deed); other typed
    // documents under their own type so the valuer can still read them.
    const key = printKeyForPropertyDocument(doc) ?? doc.documentTypeKey?.trim() ?? null;
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

  const rows: ValuationPrintAttachmentRow[] = catalog
    // Non-printable document types appear only once something of that type is on file.
    .filter((row) => isPrintableAttachmentKey(row.key) || byKey.has(row.key))
    .map((row) => {
      const docs = byKey.get(row.key) ?? [];
      const printable = isPrintableAttachmentKey(row.key);
      return {
        key: row.key,
        name: row.name,
        isRequired: Boolean(row.isRequired),
        docs,
        available: docs.length > 0,
        selected: printable && selected.has(row.key),
        printable,
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
      printable: true,
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

/** HTML v3 attachment slot ids used in the final-review editor. */
export const REPORT_PHOTO_SLOT_IDS = Array.from(
  { length: 12 },
  (_, i) => `photo-${i + 1}`,
) as string[];

export const REPORT_SURVEY_SLOT_ID = "survey-report";
export const REPORT_DEED_SLOT_ID = "deed";

export const REPORT_PHOTO_SLOT_PLACEHOLDERS: Record<string, string> = {
  "photo-1": "واجهة أمامية",
  "photo-2": "واجهة خلفية",
  "photo-3": "جانبية يمنى",
  "photo-4": "جانبية يسرى",
  "photo-5": "مجلس",
  "photo-6": "صالة",
  "photo-7": "مطبخ",
  "photo-8": "غرفة نوم رئيسية",
  "photo-9": "دورة مياه",
  "photo-10": "ملحق علوي",
  "photo-11": "السور والمدخل",
  "photo-12": "الحوش",
};

export function reportPhotoSlotCount(isLand: boolean): number {
  return isLand ? 6 : 12;
}

export function printDocSelectionValue(doc: {
  id: string;
  attachmentId?: string;
}): string {
  return (doc.attachmentId ?? doc.id).trim();
}

/** Reorder a key within a print-attachment order list (↑ / ↓). */
export function movePrintAttachmentKey(
  keys: string[],
  key: string,
  direction: -1 | 1,
): string[] {
  const i = keys.indexOf(key);
  if (i < 0) return keys;
  const j = i + direction;
  if (j < 0 || j >= keys.length) return keys;
  const next = [...keys];
  const a = next[i]!;
  const b = next[j]!;
  next[i] = b;
  next[j] = a;
  return next;
}

/** Merge catalog keys with a saved order (unknown keys append at end). */
export function resolvePrintAttachmentOrder(
  catalogKeys: string[],
  savedOrder: string[] | null | undefined,
): string[] {
  const saved = savedOrder ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of saved) {
    if (!catalogKeys.includes(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of catalogKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Report template sections that host a single print attachment slot. */
export const PRINT_ATTACHMENT_REPORT_SECTIONS: Record<
  string,
  { sec: string; slotId: string }
> = {
  survey: { sec: "35", slotId: "survey-report" },
  deed: { sec: "36", slotId: "deed" },
};

/** Whether a print-attachment type should appear in the report. */
export function isPrintAttachmentIncluded(
  printAttachmentKeys: string[] | null | undefined,
  key: string,
): boolean {
  const keys = printAttachmentKeys ?? [];
  if (keys.length === 0) return true;
  return keys.includes(key);
}

export type ReportSlotCandidate = {
  id: string;
  name: string;
  fileName: string;
  source: string;
  kind: "pdf" | "file" | "image";
  dataUrl?: string;
  attachmentId?: string;
};

function toCandidate(doc: PropertyDetailDocumentEntry): ReportSlotCandidate | null {
  const id = printDocSelectionValue(doc);
  if (!id) return null;
  return {
    id,
    name: doc.name,
    fileName: doc.fileName,
    source: doc.source,
    kind: doc.kind,
    dataUrl: doc.dataUrl,
    attachmentId: doc.attachmentId,
  };
}

/** Candidates allowed into a given HTML report slot. */
export function candidatesForReportSlot(
  slotId: string,
  documents: PropertyDetailDocumentEntry[],
): ReportSlotCandidate[] {
  const out: ReportSlotCandidate[] = [];
  const seen = new Set<string>();
  for (const doc of documents) {
    const printKey = printKeyForPropertyDocument(doc);
    const isPhotoSlot = slotId.startsWith("photo-");
    let ok = false;
    if (slotId === REPORT_DEED_SLOT_ID) ok = printKey === "deed";
    else if (slotId === REPORT_SURVEY_SLOT_ID) ok = printKey === "survey";
    else if (isPhotoSlot) {
      ok =
        doc.kind === "image" ||
        Boolean(doc.inspectionPhoto) ||
        /photo|صورة|معاينة/i.test(`${doc.name} ${doc.source}`);
    }
    if (!ok) continue;
    const cand = toCandidate(doc);
    if (!cand || seen.has(cand.id)) continue;
    seen.add(cand.id);
    out.push(cand);
  }
  return out;
}

export function findReportSlotCandidate(
  documents: PropertyDetailDocumentEntry[],
  assignmentId: string | null | undefined,
): ReportSlotCandidate | null {
  const id = (assignmentId ?? "").trim();
  if (!id) return null;
  for (const doc of documents) {
    if (printDocSelectionValue(doc) === id) return toCandidate(doc);
  }
  return null;
}
