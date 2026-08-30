import {
  downloadAttachmentBlob,
  getAttachmentMeta,
  listAttachmentsForProperty,
  type FileAttachmentMetaDto,
  type PrototypeModulesApiConfig,
} from "@platform/api-client";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import { blobToDataUrl } from "@platform/app-shared/media/file-encoding";

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

/**
 * Field inspection photos are tied to the task id, not the property — for-property
 * (property-id prefix) does not see them. The inspector draft holds the same attachment ids,
 * so collect them from there to fill §34 slots.
 */
export function collectInspectorPhotoAttachmentIds(
  inspector: InspectorWorkspaceDraft | null | undefined,
): string[] {
  if (!inspector) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string | null | undefined) => {
    const t = (id ?? "").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  // Documented feature photos first (facade, building condition…) — most representative of the property.
  const features = inspector.featurePhotoAttachments ?? {};
  const featureOrder = [
    "facade",
    "assetSubject",
    "buildState",
    "propertyUsage",
    "kitchen",
    "carEntrance",
  ];
  for (const key of featureOrder) push(features[key]?.attachmentId);
  for (const key of Object.keys(features)) push(features[key]?.attachmentId);

  for (const slot of Object.values(inspector.definedPhotos ?? {})) {
    if (!slot || slot.none) continue;
    for (const photo of slot.photos ?? []) {
      if (photo.approved !== false) push(photo.attachmentId);
    }
  }
  for (const photo of inspector.freePhotos ?? []) {
    if (photo.approved !== false) push(photo.attachmentId);
  }
  for (const comp of Object.values(inspector.componentPhotoAttachments ?? {})) {
    push(comp?.attachmentId);
  }
  for (const obs of inspector.observations ?? []) {
    push(obs.photo?.attachmentId);
  }
  return out;
}

export async function loadValuationReportPrintAttachments(
  config: PrototypeModulesApiConfig,
  propertyId: string,
  hasStructures: boolean,
  extras?: {
    /** Inspection photo ids from the inspector draft — complete the §34 slot budget. */
    inspectorPhotoIds?: string[];
  },
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

  // Finish the photo budget from task-linked inspection photos (invisible to for-property).
  const budget = photoBudget(hasStructures);
  const havePhoto = new Set(photos.map((row) => row.id));
  const inspectorIds = (extras?.inspectorPhotoIds ?? []).filter(
    (photoId) => !havePhoto.has(photoId),
  );
  if (photos.length < budget && inspectorIds.length) {
    const metas = await Promise.all(
      inspectorIds
        .slice(0, budget - photos.length)
        .map((photoId) => getAttachmentMeta(config, photoId)),
    );
    for (const meta of metas) {
      if (meta.ok && photos.length < budget && !havePhoto.has(meta.data.id)) {
        havePhoto.add(meta.data.id);
        photos.push(meta.data);
      }
    }
  }

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
