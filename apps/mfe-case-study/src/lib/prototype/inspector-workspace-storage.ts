import {
  jeddahDefaultCoords,
  shouldUseJeddahDefaultCoords,
} from "@engineering-office/mfe/lib/jeddah-default-coords";
import {
  getPartyTaskSubmission,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import { reopenPartySubmission } from "@platform/app-shared/prototype/party-submission-api";
import { resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import {
  applyEnfathPrefillToInspectorDraft,
  inspectorDraftNeedsEnfathPrefill,
} from "./inspector-enfath-prefill";
import {
  createInspectorWorkspaceDraft,
  INSPECTOR_DEFINED_PHOTOS,
  type InspectorBoundaryKey,
  type InspectorBoundaryMatch,
  type InspectorDefinedPhotoSlot,
  type InspectorFreePhoto,
  type InspectorObservation,
  type InspectorPhotoAttachment,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
  type InspectorWorkspaceStatus,
} from "./inspector-workspace-data";

const workspaceCache = new Map<string, InspectorWorkspaceDraft>();

export const FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT =
  "field-inspection-submission-changed";

function notifyChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT));
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readBoundaryMatches(
  value: unknown,
): Record<InspectorBoundaryKey, InspectorBoundaryMatch> {
  const base = createInspectorWorkspaceDraft({
    taskId: "",
    propertyId: "",
    poNumber: "",
  }).boundaryMatches;
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  for (const key of ["north", "south", "east", "west"] as InspectorBoundaryKey[]) {
    const row = record[key];
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    base[key] = {
      matches: obj.matches !== false,
      mismatchNote: readString(obj.mismatchNote),
    };
  }
  return base;
}

function readPhotoAttachment(value: unknown): InspectorPhotoAttachment | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const fileName = readString(obj.fileName);
  if (!fileName) return null;
  return {
    fileName,
    mimeType: readString(obj.mimeType) || "image/jpeg",
    attachmentId: readString(obj.attachmentId) || undefined,
    sizeBytes:
      typeof obj.sizeBytes === "number" ? obj.sizeBytes : undefined,
  };
}

function readSlotPhoto(value: unknown): InspectorSlotPhoto | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const id = Number(obj.id);
  const fileName = readString(obj.fileName);
  if (!id || !fileName) return null;
  return {
    id,
    approved: readBool(obj.approved),
    fileName,
    mimeType: readString(obj.mimeType) || "image/jpeg",
    attachmentId: readString(obj.attachmentId) || undefined,
    sizeBytes:
      typeof obj.sizeBytes === "number" ? obj.sizeBytes : undefined,
  };
}

function readDefinedPhotos(
  value: unknown,
): Record<string, InspectorDefinedPhotoSlot> {
  const base = createInspectorWorkspaceDraft({
    taskId: "",
    propertyId: "",
    poNumber: "",
  }).definedPhotos;
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  for (const def of INSPECTOR_DEFINED_PHOTOS) {
    const row = record[def.id];
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const photosRaw = Array.isArray(obj.photos) ? obj.photos : [];
    base[def.id] = {
      none: readBool(obj.none),
      photos: photosRaw
        .map((p) => readSlotPhoto(p))
        .filter((p): p is InspectorSlotPhoto => p !== null),
    };
  }
  return base;
}

function readFreePhotos(value: unknown): InspectorFreePhoto[] {
  if (!Array.isArray(value)) return [];
  const out: InspectorFreePhoto[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const id = Number(obj.id);
    const fileName = readString(obj.fileName);
    if (!id || !fileName) continue;
    const attachmentId = readString(obj.attachmentId);
    const photo: InspectorFreePhoto = {
      id,
      category: readString(obj.category) || null,
      approved: readBool(obj.approved),
      fileName,
      mimeType: readString(obj.mimeType) || "image/jpeg",
      sizeBytes:
        typeof obj.sizeBytes === "number" ? obj.sizeBytes : undefined,
    };
    if (attachmentId) photo.attachmentId = attachmentId;
    out.push(photo);
  }
  return out;
}

function readObservations(value: unknown): InspectorObservation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const obj = row as Record<string, unknown>;
      const id = readString(obj.id);
      if (!id) return null;
      const legacyAttached = readBool(obj.photoAttached);
      const photo =
        readPhotoAttachment(obj.photo) ??
        (legacyAttached ? null : null);
      return {
        id,
        category: readString(obj.category),
        text: readString(obj.text),
        photo,
      };
    })
    .filter((o): o is InspectorObservation => o !== null);
}

function readRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = readString(raw);
  }
  return out;
}

function readBoolRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = readBool(raw);
  }
  return out;
}

function readFeaturePhotoAttachments(
  value: unknown,
  legacyBools: Record<string, boolean>,
): Record<string, InspectorPhotoAttachment | null> {
  const out: Record<string, InspectorPhotoAttachment | null> = {};
  if (value && typeof value === "object") {
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      out[key] = readPhotoAttachment(raw);
    }
  }
  for (const [key, attached] of Object.entries(legacyBools)) {
    if (attached && !out[key]) {
      out[key] = null;
    }
  }
  return out;
}

function readComponentPhotoAttachments(
  value: unknown,
): InspectorWorkspaceDraft["componentPhotoAttachments"] {
  const base = createInspectorWorkspaceDraft({
    taskId: "",
    propertyId: "",
    poNumber: "",
  }).componentPhotoAttachments;
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  return {
    showroom: readPhotoAttachment(record.showroom),
    well: readPhotoAttachment(record.well),
  };
}

function resolveInspectorMapCoords(
  latitude: string,
  longitude: string,
  fallback: Pick<InspectorWorkspaceDraft, "mapLatitude" | "mapLongitude">,
): Pick<InspectorWorkspaceDraft, "mapLatitude" | "mapLongitude"> {
  if (shouldUseJeddahDefaultCoords(latitude, longitude)) {
    const defaults = jeddahDefaultCoords();
    return {
      mapLatitude: defaults.latitude,
      mapLongitude: defaults.longitude,
    };
  }
  return {
    mapLatitude: latitude.trim() || fallback.mapLatitude,
    mapLongitude: longitude.trim() || fallback.mapLongitude,
  };
}

async function migrateInspectorDefaultCoordsIfNeeded(
  draft: InspectorWorkspaceDraft,
  rawCoords?: { latitude: string; longitude: string },
): Promise<InspectorWorkspaceDraft> {
  if (draft.status === "submitted") return draft;
  const lat = rawCoords?.latitude ?? draft.mapLatitude;
  const lng = rawCoords?.longitude ?? draft.mapLongitude;
  if (!shouldUseJeddahDefaultCoords(lat, lng)) {
    return draft;
  }
  const defaults = jeddahDefaultCoords();
  const next: InspectorWorkspaceDraft = {
    ...draft,
    mapLatitude: defaults.latitude,
    mapLongitude: defaults.longitude,
  };
  const saved = await saveInspectorWorkspaceDraft(next);
  return saved ?? next;
}

function payloadToDraft(
  dto: PartyTaskSubmissionDto,
  fallback?: Partial<InspectorWorkspaceDraft>,
): InspectorWorkspaceDraft {
  const payload = dto.payload ?? {};
  const draft = createInspectorWorkspaceDraft({
    taskId: dto.taskId,
    propertyId: dto.propertyId ?? fallback?.propertyId ?? "",
    poNumber: dto.poNumber ?? fallback?.poNumber ?? "",
    propertyDisplayId: fallback?.propertyDisplayId,
  });

  const annex = readString(payload.hasAnnex);
  const mapCoords = resolveInspectorMapCoords(
    readString(payload.mapLatitude),
    readString(payload.mapLongitude),
    draft,
  );
  return {
    ...draft,
    propertyDisplayId:
      readString(payload.propertyDisplayId) || draft.propertyDisplayId,
    inspectionDate: readString(payload.inspectionDate) || draft.inspectionDate,
    inspectionTime: readString(payload.inspectionTime) || draft.inspectionTime,
    ...mapCoords,
    featureValues: readRecord(payload.featureValues),
    featurePhotoAttachments: readFeaturePhotoAttachments(
      payload.featurePhotoAttachments,
      readBoolRecord(payload.featurePhotos),
    ),
    componentPhotoAttachments: readComponentPhotoAttachments(
      payload.componentPhotoAttachments ?? payload.componentPhotos,
    ),
    streetName: readString(payload.streetName),
    mainStreetName: readString(payload.mainStreetName),
    streetWidthM: readString(payload.streetWidthM),
    accessRouteDescription: readString(payload.accessRouteDescription),
    roomCount: readString(payload.roomCount),
    hallCount: readString(payload.hallCount),
    unitCount: readString(payload.unitCount),
    bathroomCount: readString(payload.bathroomCount),
    showroomCount: readString(payload.showroomCount),
    wellCount: readString(payload.wellCount),
    propertyAgeYears: readString(payload.propertyAgeYears),
    buildLicenseNumber: readString(payload.buildLicenseNumber),
    hasAnnex:
      annex === "نعم" || annex === "لا" ? annex : ("" as "" | "نعم" | "لا"),
    boundaryMatches: readBoundaryMatches(payload.boundaryMatches),
    services: readStringArray(payload.services),
    amenities: readStringArray(payload.amenities),
    propertyDescription: readString(payload.propertyDescription),
    districtProsCons: readString(payload.districtProsCons),
    assetNotes: readString(payload.assetNotes),
    definedPhotos: readDefinedPhotos(payload.definedPhotos),
    freePhotos: readFreePhotos(payload.freePhotos),
    observations: readObservations(payload.observations),
    inspectionConfirmed: readBool(payload.inspectionConfirmed),
    status: (dto.status === "submitted"
      ? "submitted"
      : dto.status === "reopened"
        ? "reopened"
        : "draft") as InspectorWorkspaceStatus,
    returnNote:
      readString(payload.returnNote) ||
      (typeof dto.returnNote === "string" ? dto.returnNote : undefined),
    submittedAtUtc: dto.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc || draft.updatedAtUtc,
  };
}

function draftToPayload(
  draft: InspectorWorkspaceDraft,
): Record<string, unknown> {
  return {
    propertyDisplayId: draft.propertyDisplayId,
    inspectionDate: draft.inspectionDate,
    inspectionTime: draft.inspectionTime,
    mapLatitude: draft.mapLatitude,
    mapLongitude: draft.mapLongitude,
    featureValues: draft.featureValues,
    featurePhotoAttachments: draft.featurePhotoAttachments,
    componentPhotoAttachments: draft.componentPhotoAttachments,
    streetName: draft.streetName,
    mainStreetName: draft.mainStreetName,
    streetWidthM: draft.streetWidthM,
    accessRouteDescription: draft.accessRouteDescription,
    roomCount: draft.roomCount,
    hallCount: draft.hallCount,
    unitCount: draft.unitCount,
    bathroomCount: draft.bathroomCount,
    showroomCount: draft.showroomCount,
    wellCount: draft.wellCount,
    propertyAgeYears: draft.propertyAgeYears,
    buildLicenseNumber: draft.buildLicenseNumber,
    hasAnnex: draft.hasAnnex,
    boundaryMatches: draft.boundaryMatches,
    services: draft.services,
    amenities: draft.amenities,
    propertyDescription: draft.propertyDescription,
    districtProsCons: draft.districtProsCons,
    assetNotes: draft.assetNotes,
    definedPhotos: draft.definedPhotos,
    freePhotos: draft.freePhotos,
    observations: draft.observations,
    inspectionConfirmed: draft.inspectionConfirmed,
    status: draft.status,
    returnNote: draft.returnNote ?? "",
    submittedAtUtc: draft.submittedAtUtc,
    updatedAtUtc: draft.updatedAtUtc,
  };
}

function setCache(draft: InspectorWorkspaceDraft): void {
  if (!draft.taskId) return;
  workspaceCache.set(draft.taskId, draft);
}

/** Updates cache and notifies listeners — use only after user-facing writes. */
function writeCache(draft: InspectorWorkspaceDraft): void {
  setCache(draft);
  notifyChanged();
}

export function loadInspectorWorkspace(
  taskId: string,
): InspectorWorkspaceDraft | null {
  if (!taskId) return null;
  return workspaceCache.get(taskId) ?? null;
}

export async function fetchInspectorWorkspace(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  const config = workOrdersApiConfig();
  if (!config) return loadInspectorWorkspace(taskId);

  const result = await getPartyTaskSubmission(config, taskId);
  if (!result.ok) {
    if (result.kind === "not_found") return null;
    return loadInspectorWorkspace(taskId);
  }

  let draft = payloadToDraft(result.data);
  const payload = result.data.payload ?? {};
  draft = await migrateInspectorDefaultCoordsIfNeeded(draft, {
    latitude: readString(payload.mapLatitude),
    longitude: readString(payload.mapLongitude),
  });
  setCache(draft);
  return draft;
}

export async function getOrCreateInspectorWorkspace(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  propertyDisplayId?: string;
  property?: import("./po-intake-data").PoPropertyIntake | null;
}): Promise<InspectorWorkspaceDraft | null> {
  let existing = await fetchInspectorWorkspace(input.taskId);
  if (existing) {
    existing = await migrateInspectorDefaultCoordsIfNeeded(existing);
    if (input.propertyDisplayId && !existing.propertyDisplayId.trim()) {
      return updateInspectorWorkspace(input.taskId, {
        propertyDisplayId: input.propertyDisplayId,
      });
    }
    return existing;
  }

  let draft = createInspectorWorkspaceDraft(input);
  if (input.property && inspectorDraftNeedsEnfathPrefill(draft)) {
    draft = applyEnfathPrefillToInspectorDraft(draft, input.property);
  }
  return saveInspectorWorkspaceDraft(draft);
}

export async function saveInspectorWorkspaceDraft(
  draft: InspectorWorkspaceDraft,
): Promise<InspectorWorkspaceDraft | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;

  const payload = draftToPayload({
    ...draft,
    status:
      draft.status === "submitted"
        ? "submitted"
        : draft.status === "reopened"
          ? "reopened"
          : "draft",
    updatedAtUtc: new Date().toISOString(),
  });

  const result = await savePartyTaskSubmission(
    config,
    draft.taskId,
    payload,
  );
  if (!result.ok) return null;

  const next = payloadToDraft(result.data, draft);
  writeCache(next);
  return next;
}

export async function updateInspectorWorkspace(
  taskId: string,
  patch: Partial<
    Omit<
      InspectorWorkspaceDraft,
      | "taskId"
      | "propertyId"
      | "poNumber"
      | "status"
      | "submittedAtUtc"
      | "updatedAtUtc"
    >
  >,
): Promise<InspectorWorkspaceDraft | null> {
  const current =
    loadInspectorWorkspace(taskId) ?? (await fetchInspectorWorkspace(taskId));
  if (!current || current.status === "submitted") return current;

  const next: InspectorWorkspaceDraft = {
    ...current,
    ...patch,
    definedPhotos: patch.definedPhotos ?? current.definedPhotos,
    freePhotos: patch.freePhotos ?? current.freePhotos,
    observations: patch.observations ?? current.observations,
    boundaryMatches: patch.boundaryMatches ?? current.boundaryMatches,
    featureValues: patch.featureValues ?? current.featureValues,
    featurePhotoAttachments:
      patch.featurePhotoAttachments ?? current.featurePhotoAttachments,
    componentPhotoAttachments:
      patch.componentPhotoAttachments ?? current.componentPhotoAttachments,
    services: patch.services ?? current.services,
    amenities: patch.amenities ?? current.amenities,
    status: current.status === "reopened" ? "reopened" : "draft",
    updatedAtUtc: new Date().toISOString(),
  };
  return saveInspectorWorkspaceDraft(next);
}

export async function submitInspectorWorkspace(
  taskId: string,
): Promise<
  | { ok: true; draft: InspectorWorkspaceDraft }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, message: "يجب تسجيل الدخول أولاً" };
  }

  const current =
    loadInspectorWorkspace(taskId) ?? (await fetchInspectorWorkspace(taskId));
  if (!current) {
    return { ok: false, message: "لا توجد مسودة للإرسال" };
  }
  if (current.status === "submitted") {
    return { ok: true, draft: current };
  }

  const saved = await saveInspectorWorkspaceDraft(current);
  if (!saved) {
    return { ok: false, message: "تعذّر حفظ المسودة قبل الإرسال" };
  }

  const result = await submitPartyTaskSubmission(config, taskId);
  if (!result.ok) {
    return {
      ok: false,
      message: resolveApiError(result.kind, result.errors),
      errors: result.errors,
    };
  }

  const draft = payloadToDraft(result.data, saved);
  writeCache(draft);
  return { ok: true, draft };
}

export async function reopenInspectorWorkspace(
  taskId: string,
  returnNote: string,
): Promise<InspectorWorkspaceDraft | null> {
  const dto = await reopenPartySubmission(taskId, returnNote);
  if (!dto) return null;
  const next = payloadToDraft(dto);
  writeCache(next);
  return next;
}

export type InspectorWorkspaceSnapshot = InspectorWorkspaceDraft;

export async function loadInspectorWorkspaceSnapshot(
  taskId: string,
): Promise<InspectorWorkspaceSnapshot | null> {
  return fetchInspectorWorkspace(taskId);
}

export const loadFieldInspectionSubmission = loadInspectorWorkspace;
export const fetchFieldInspectionSubmission = fetchInspectorWorkspace;
export const loadFieldInspectionSubmissionSnapshot =
  loadInspectorWorkspaceSnapshot;
