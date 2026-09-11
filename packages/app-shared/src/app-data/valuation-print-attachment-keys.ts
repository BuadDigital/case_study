/** Map a property-document entry onto a report attachment key (valuation list `attachments`). */

export type PrintAttachmentDocRef = {
  id: string;
  name: string;
  fileName: string;
  source: string;
  /** Governed registry type (`property-document-types.ts`) — decides when present. */
  documentTypeKey?: string;
};

/** Report attachment keys that have a place in the printed valuation report. */
export const REPORT_PRINTABLE_ATTACHMENT_KEYS: readonly string[] = [
  "deed",
  "survey",
  "zoning-sketch",
  "building-permit",
];

/**
 * Registry document type → report attachment key; null when the type is not printed.
 * The bourse deed image and the real-estate registry stand in for the deed; assignment
 * and delegation letters never do.
 */
export function printKeyForDocumentType(
  documentTypeKey: string | null | undefined,
): string | null {
  switch ((documentTypeKey ?? "").trim().toLowerCase()) {
    case "deed":
    case "bourse-deed":
    case "real-estate-registry":
      return "deed";
    case "survey":
      return "survey";
    case "zoning-sketch":
      return "zoning-sketch";
    case "building-permit":
      return "building-permit";
    default:
      return null;
  }
}

export function printKeyForPropertyDocument(
  doc: Pick<PrintAttachmentDocRef, "id" | "name" | "fileName" | "source"> & {
    documentTypeKey?: string;
  },
): string | null {
  if (doc.documentTypeKey?.trim()) return printKeyForDocumentType(doc.documentTypeKey);

  // Entries without a stored type (older callers) fall back to their names.
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
    id.includes("bourse") ||
    /صك|تملك|سجل عقاري/.test(text)
  ) {
    return "deed";
  }
  return null;
}
