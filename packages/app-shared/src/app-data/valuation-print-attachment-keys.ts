/** Infer catalog print key from a property-document entry. */

export type PrintAttachmentDocRef = {
  id: string;
  name: string;
  fileName: string;
  source: string;
};

export function printKeyForPropertyDocument(
  doc: Pick<PrintAttachmentDocRef, "id" | "name" | "fileName" | "source">,
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
