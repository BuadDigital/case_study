import {
  downloadAttachmentBlob,
  listAttachmentsForProperty,
  type FileAttachmentMetaDto,
  type PrototypeModulesApiConfig,
} from "@platform/api-client";

/** Mirrors backend `AttachmentPrintRules` for client-side report fill. */
export function attachmentTypeKeyFromScope(scope: string | null | undefined): string | null {
  const s = (scope ?? "").trim().toLowerCase();
  if (!s) return null;
  if (
    s === "property-decree" ||
    s === "property-deed-ownership" ||
    s === "property-registry" ||
    s === "property-delegation" ||
    s === "property-bourse-deed"
  ) {
    return "deed";
  }
  if (s === "engineering-survey-report" || s === "property-boundaries") {
    return "survey";
  }
  if (s === "field-inspection-photo") return "photo";
  if (s === "engineering-site-letter") return "site-map";
  if (s.includes("photo")) return "photo";
  if (s.includes("deed") || s.includes("decree") || s.includes("registry")) {
    return "deed";
  }
  if (s.includes("survey") || s.includes("boundar")) return "survey";
  if (s.includes("map") || s.includes("permit") || s.includes("zoning")) {
    return "site-map";
  }
  return null;
}

export function attachmentLabelAr(typeKey: string | null | undefined): string {
  switch ((typeKey ?? "").trim().toLowerCase()) {
    case "deed":
      return "الصك";
    case "survey":
      return "الرفع المساحي";
    case "photo":
    case "photos":
    case "property-photo":
      return "صور العقار";
    case "zoning-sketch":
      return "الكروكي التنظيمي";
    case "building-permit":
      return "رخصة المباني";
    case "site-map":
    case "map":
      return "خريطة الموقع";
    default:
      return (typeKey ?? "").trim() || "مرفق";
  }
}

export function photoBudget(hasStructures: boolean): number {
  return hasStructures ? 12 : 6;
}

export type ValuationReportSlotAttachment = {
  attachmentId: string;
  url: string;
  contentType: string;
  fileName: string;
  labelAr: string;
  isImage: boolean;
  capturedAtDisplay?: string;
};

function slashCaptureDate(iso: string | null | undefined): string {
  const t = (iso ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function classifyRows(
  rows: FileAttachmentMetaDto[],
  hasStructures: boolean,
): {
  photos: FileAttachmentMetaDto[];
  survey: FileAttachmentMetaDto[];
  deed: FileAttachmentMetaDto[];
  siteMaps: FileAttachmentMetaDto[];
} {
  const ordered = [...rows].sort((a, b) =>
    a.createdAtUtc.localeCompare(b.createdAtUtc),
  );
  const photos: FileAttachmentMetaDto[] = [];
  const survey: FileAttachmentMetaDto[] = [];
  const deed: FileAttachmentMetaDto[] = [];
  const siteMaps: FileAttachmentMetaDto[] = [];
  const budget = photoBudget(hasStructures);

  for (const row of ordered) {
    const typeKey = attachmentTypeKeyFromScope(row.scope);
    if (!typeKey) continue;
    if (typeKey === "photo" || typeKey === "photos" || typeKey === "property-photo") {
      if (photos.length < budget) photos.push(row);
      continue;
    }
    if (typeKey === "survey") {
      survey.push(row);
      continue;
    }
    if (typeKey === "deed") {
      deed.push(row);
      continue;
    }
    if (
      typeKey === "site-map" ||
      typeKey === "map" ||
      typeKey === "zoning-sketch" ||
      typeKey === "building-permit"
    ) {
      siteMaps.push(row);
    }
  }

  if (
    photos.length === 0 &&
    survey.length === 0 &&
    deed.length === 0 &&
    siteMaps.length === 0
  ) {
    const images = ordered
      .filter((a) => a.contentType.toLowerCase().startsWith("image/"))
      .slice(0, budget);
    return { photos: images, survey, deed, siteMaps };
  }

  return { photos, survey, deed, siteMaps };
}

async function toSlot(
  config: PrototypeModulesApiConfig,
  row: FileAttachmentMetaDto,
  typeKey: string,
): Promise<ValuationReportSlotAttachment | null> {
  const blobRes = await downloadAttachmentBlob(config, row.id);
  if (!blobRes.ok) return null;
  const url = await blobToDataUrl(blobRes.data);
  const isImage = row.contentType.toLowerCase().startsWith("image/");
  const captured = slashCaptureDate(row.photoMetadata?.capturedAtUtc);
  const label = attachmentLabelAr(typeKey);
  return {
    attachmentId: row.id,
    url,
    contentType: row.contentType,
    fileName: row.fileName,
    labelAr: captured ? `${label} — ${captured}` : label,
    isImage,
    capturedAtDisplay: captured || undefined,
  };
}

export async function loadValuationReportPrintAttachments(
  config: PrototypeModulesApiConfig,
  propertyId: string,
  hasStructures: boolean,
): Promise<{
  photos: ValuationReportSlotAttachment[];
  survey: ValuationReportSlotAttachment | null;
  deed: ValuationReportSlotAttachment | null;
  siteMap: ValuationReportSlotAttachment | null;
}> {
  const empty = {
    photos: [] as ValuationReportSlotAttachment[],
    survey: null as ValuationReportSlotAttachment | null,
    deed: null as ValuationReportSlotAttachment | null,
    siteMap: null as ValuationReportSlotAttachment | null,
  };
  const id = propertyId.trim();
  if (!id) return empty;

  const listed = await listAttachmentsForProperty(config, id);
  if (!listed.ok) return empty;

  const { photos, survey, deed, siteMaps } = classifyRows(
    listed.data,
    hasStructures,
  );

  const photoSlots = (
    await Promise.all(photos.map((row) => toSlot(config, row, "photo")))
  ).filter((x): x is ValuationReportSlotAttachment => Boolean(x));

  const surveySlot = survey[0]
    ? await toSlot(config, survey[0], "survey")
    : null;
  const deedSlot = deed[0] ? await toSlot(config, deed[0], "deed") : null;
  const siteMapSlot = siteMaps[0]
    ? await toSlot(config, siteMaps[0], "site-map")
    : null;

  return {
    photos: photoSlots,
    survey: surveySlot,
    deed: deedSlot,
    siteMap: siteMapSlot,
  };
}

export function linesFromOrgText(
  text: string | null | undefined,
): string[] {
  return (text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function pairsFromOrgLines(
  text: string | null | undefined,
): Array<{ term: string; text: string }> {
  return (text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(": ");
      if (colon < 0) return { term: line, text: "" };
      return {
        term: line.slice(0, colon).trim(),
        text: line.slice(colon + 2).trim(),
      };
    });
}
