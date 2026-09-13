import {
  getAttachmentMeta,
  listAttachmentsForProperty,
  type FileAttachmentMetaDto,
  type PrototypeModulesApiConfig,
} from "@platform/api-client";
import { downloadAttachmentBlobOnce } from "@platform/app-shared/app-data/attachment-blob-cache";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { pdfBlobToFirstPageDataUrl } from "@platform/app-shared/media/pdf-first-page-preview";
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

function isPdfAttachment(row: FileAttachmentMetaDto): boolean {
  return (
    row.contentType.toLowerCase().includes("pdf") ||
    row.fileName.toLowerCase().endsWith(".pdf")
  );
}

async function toSlot(
  config: PrototypeModulesApiConfig,
  row: FileAttachmentMetaDto,
  typeKey: string,
): Promise<ValuationReportSlotAttachment | null> {
  // Shared per-id cache: the inspector photo previews on the same screen already downloaded these.
  const blobRes = await downloadAttachmentBlobOnce(config, row.id);
  if (!blobRes.ok) return null;
  const captured = slashCaptureDate(row.photoMetadata?.capturedAtUtc);
  const label = attachmentLabelAr(typeKey);
  const labelAr = captured ? `${label} — ${captured}` : label;

  // Rasterize PDF page 1 so §35/§36 actually show in the report (iframes hang print).
  if (isPdfAttachment(row)) {
    const preview = await pdfBlobToFirstPageDataUrl(blobRes.data, 1.75);
    if (preview) {
      return {
        attachmentId: row.id,
        url: preview,
        contentType: "image/jpeg",
        fileName: row.fileName,
        labelAr,
        isImage: true,
        capturedAtDisplay: captured || undefined,
      };
    }
  }

  const url = await blobToDataUrl(blobRes.data);
  const isImage = row.contentType.toLowerCase().startsWith("image/");
  return {
    attachmentId: row.id,
    url,
    contentType: row.contentType,
    fileName: row.fileName,
    labelAr,
    isImage,
    capturedAtDisplay: captured || undefined,
  };
}

/** Engineering survey PDFs are scoped to the survey task id — not `<po>:<propertyId>`. */
export function surveyReportAttachmentIdFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) return null;
  const att = payload.surveyReportAttachment;
  if (!att || typeof att !== "object") return null;
  const id = String(
    (att as { attachmentId?: unknown }).attachmentId ?? "",
  ).trim();
  return id || null;
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

/**
 * The needle for `GET /api/attachments/for-property`. The endpoint matches
 * `scopeKey == needle` or `scopeKey startsWith needle + ":"`, and property
 * documents (deed, decree, registry, boundaries…) are keyed
 * `<poNumber>:<propertyId>` by the property library
 * (`assignment-doc-attachments.ts`), so the bare property id sees none of
 * them. Without a PO number the bare id is all there is.
 */
export function propertyAttachmentScopeKey(
  poNumber: string | null | undefined,
  propertyId: string,
): string {
  const id = propertyId.trim();
  const po = (poNumber ?? "").trim();
  if (!id) return "";
  return po ? `${po}:${id}` : id;
}

export async function loadValuationReportPrintAttachments(
  config: PrototypeModulesApiConfig,
  target: { poNumber: string | null | undefined; propertyId: string },
  hasStructures: boolean,
  extras?: {
    /** Inspection photo ids from the inspector draft — complete the §34 slot budget. */
    inspectorPhotoIds?: string[];
    /**
     * Survey-report attachment ids from the engineering-office submission
     * (`scopeKey` = survey task id — invisible to for-property).
     */
    surveyAttachmentIds?: string[];
    /** Preferred attachment ids chosen on final review (deed / survey / site-map). */
    preferredAttachmentIds?: Partial<
      Record<"deed" | "survey" | "site-map", string>
    > & {
      /** Ordered ids for photo-1…N; empty string keeps that slot blank. */
      photoSlotIds?: string[];
      /**
       * When true, do not fall back to the first available deed/survey/photo —
       * only the preferred ids (or blanks) are used.
       */
      strict?: boolean;
    };
  },
): Promise<{
  photos: Array<ValuationReportSlotAttachment | null>;
  survey: ValuationReportSlotAttachment | null;
  deed: ValuationReportSlotAttachment | null;
  siteMap: ValuationReportSlotAttachment | null;
}> {
  const empty = {
    photos: [] as Array<ValuationReportSlotAttachment | null>,
    survey: null as ValuationReportSlotAttachment | null,
    deed: null as ValuationReportSlotAttachment | null,
    siteMap: null as ValuationReportSlotAttachment | null,
  };
  const scopeKey = propertyAttachmentScopeKey(target.poNumber, target.propertyId);
  if (!scopeKey) return empty;

  const listed = await listAttachmentsForProperty(config, scopeKey);
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

  const haveSurvey = new Set(survey.map((row) => row.id));
  const surveyIds = (extras?.surveyAttachmentIds ?? []).filter(
    (id) => !haveSurvey.has(id),
  );
  if (survey.length === 0 && surveyIds.length) {
    const metas = await Promise.all(
      surveyIds.map((id) => getAttachmentMeta(config, id)),
    );
    for (const meta of metas) {
      if (meta.ok && !haveSurvey.has(meta.data.id)) {
        haveSurvey.add(meta.data.id);
        survey.push(meta.data);
        break;
      }
    }
  }

  const preferred = extras?.preferredAttachmentIds ?? {};
  const strict = preferred.strict === true;

  const pick = (
    rows: FileAttachmentMetaDto[],
    preferredId: string | undefined,
  ): FileAttachmentMetaDto | undefined => {
    const id = (preferredId ?? "").trim();
    if (strict) {
      if (!id) return undefined;
      return rows.find((row) => row.id === id);
    }
    if (!rows.length) return undefined;
    if (!id) return rows[0];
    return rows.find((row) => row.id === id) ?? rows[0];
  };

  async function ensurePreferred(
    rows: FileAttachmentMetaDto[],
    preferredId: string | undefined,
  ): Promise<FileAttachmentMetaDto[]> {
    const id = (preferredId ?? "").trim();
    if (!id || rows.some((row) => row.id === id)) return rows;
    const meta = await getAttachmentMeta(config, id);
    if (!meta.ok) return rows;
    return [meta.data, ...rows];
  }

  async function slotFromId(
    id: string | undefined,
    typeKey: string,
  ): Promise<ValuationReportSlotAttachment | null> {
    const trimmed = (id ?? "").trim();
    if (!trimmed) return null;
    const known = [...photos, ...survey, ...deed, ...siteMaps].find(
      (row) => row.id === trimmed,
    );
    if (known) return toSlot(config, known, typeKey);
    const meta = await getAttachmentMeta(config, trimmed);
    if (!meta.ok) return null;
    return toSlot(config, meta.data, typeKey);
  }

  const photoSlotsTask: Promise<Array<ValuationReportSlotAttachment | null>> =
    Array.isArray(preferred.photoSlotIds)
      ? Promise.all(preferred.photoSlotIds.map((id) => slotFromId(id, "photo")))
      : Promise.all(photos.map((row) => toSlot(config, row, "photo"))).then(
          (slots) =>
            slots.filter((x): x is ValuationReportSlotAttachment => Boolean(x)),
        );

  async function documentSlot(
    rows: FileAttachmentMetaDto[],
    preferredId: string | undefined,
    typeKey: string,
  ): Promise<ValuationReportSlotAttachment | null> {
    const chosen = pick(await ensurePreferred(rows, preferredId), preferredId);
    return chosen ? toSlot(config, chosen, typeKey) : null;
  }

  // Photos, survey, deed and site map download side by side — each used to wait for the previous one.
  const [photoSlots, surveySlot, deedSlot, siteMapSlot] = await Promise.all([
    photoSlotsTask,
    documentSlot(survey, preferred.survey, "survey"),
    documentSlot(deed, preferred.deed, "deed"),
    documentSlot(siteMaps, preferred["site-map"], "site-map"),
  ]);

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

/** Fills `{{reportDate}}` in org report text; with no date yet the "({{reportDate}})" aside is dropped. */
export function applyReportDateToken(
  text: string | null | undefined,
  reportDateSlash: string,
): string {
  const source = text ?? "";
  if (reportDateSlash) return source.replaceAll("{{reportDate}}", reportDateSlash);
  return source.replace(/\s*\(\{\{reportDate\}\}\)/g, "").replaceAll("{{reportDate}}", "");
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
