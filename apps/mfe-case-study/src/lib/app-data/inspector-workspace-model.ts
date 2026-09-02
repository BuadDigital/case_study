import {
  jeddahDefaultCoords,
  shouldUseJeddahDefaultCoords,
} from "@platform/app-shared/domain/jeddah-default-coords";
import type { PartyTaskSubmissionDto } from "@platform/api-client";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/app-data/party-submission-changed-event";
import {
  composeAccessRouteDescription,
  computeBuildingsTotalSqm,
  createInspectorWorkspaceDraft,
  sanitizeInspectorDraftForLand,
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

export function notifyChanged(): void {
  dispatchPartySubmissionChanged(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT);
}

export function readString(value: unknown): string {
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
      facade: readString(obj.facade),
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
  const base: Record<string, InspectorDefinedPhotoSlot> = {};
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  for (const [slotId, row] of Object.entries(record)) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const photosRaw = Array.isArray(obj.photos) ? obj.photos : [];
    base[slotId] = {
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
    const uploadedByRaw = readString(obj.uploadedBy);
    const uploadedBy =
      uploadedByRaw === "specialist" || uploadedByRaw === "inspector"
        ? uploadedByRaw
        : undefined;
    const photo: InspectorFreePhoto = {
      id,
      category: readString(obj.category) || null,
      approved: readBool(obj.approved),
      fileName,
      mimeType: readString(obj.mimeType) || "image/jpeg",
      sizeBytes:
        typeof obj.sizeBytes === "number" ? obj.sizeBytes : undefined,
    };
    if (uploadedBy) photo.uploadedBy = uploadedBy;
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
      const photo = readPhotoAttachment(obj.photo);
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

export function payloadToDraft(
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
  const mapped: InspectorWorkspaceDraft = {
    ...draft,
    propertyDisplayId:
      readString(payload.propertyDisplayId) || draft.propertyDisplayId,
    inspectionDate: readString(payload.inspectionDate),
    inspectionTime: readString(payload.inspectionTime),
    ...mapCoords,
    inspectorMapLatitude: readString(payload.inspectorMapLatitude),
    inspectorMapLongitude: readString(payload.inspectorMapLongitude),
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
    accessContactName: readString(payload.accessContactName),
    accessContactPhone: readString(payload.accessContactPhone),
    accessContactRole: readString(payload.accessContactRole),
    accessRouteDescription:
      readString(payload.accessRouteDescription) ||
      composeAccessRouteDescription({
        name: readString(payload.accessContactName),
        phone: readString(payload.accessContactPhone),
        role: readString(payload.accessContactRole),
      }),
    roomCount: readString(payload.roomCount),
    hallCount: readString(payload.hallCount),
    unitCount: readString(payload.unitCount),
    bathroomCount: readString(payload.bathroomCount),
    showroomCount: readString(payload.showroomCount),
    wellCount: readString(payload.wellCount),
    towerCount: readString(payload.towerCount),
    builtArea: readString(payload.builtArea),
    buildingFloors: readString(payload.buildingFloors),
    basementTotal: readString(payload.basementTotal),
    annexTotal: readString(payload.annexTotal),
    annexUpperCount: readString(payload.annexUpperCount),
    annexGroundCount: readString(payload.annexGroundCount),
    buildingsTotal: readString(payload.buildingsTotal),
    propertyAgeYears: readString(payload.propertyAgeYears),
    buildLicenseNumber: readString(payload.buildLicenseNumber),
    buildLicenseDate: readString(payload.buildLicenseDate),
    vacantLand: Boolean(payload.vacantLand),
    keyAvailable: Boolean(payload.keyAvailable),
    clientDeclarationSigned: Boolean(payload.clientDeclarationSigned),
    declarationPhoneSatisfied: Boolean(payload.declarationPhoneSatisfied),
    hasAnnex:
      annex === "نعم" || annex === "لا" ? annex : ("" as "" | "نعم" | "لا"),
    jacuzziCount: readString(payload.jacuzziCount),
    diningCount: readString(payload.diningCount),
    majlisCount: readString(payload.majlisCount),
    maidRoomCount: readString(payload.maidRoomCount),
    guardRoomCount: readString(payload.guardRoomCount),
    parkingCount: readString(payload.parkingCount),
    playgroundCount: readString(payload.playgroundCount),
    storeCount: readString(payload.storeCount),
    electricityMeterCount: readString(payload.electricityMeterCount),
    electricityMeterNumbers: readString(payload.electricityMeterNumbers),
    waterMeterCount: readString(payload.waterMeterCount),
    waterMeterNumbers: readString(payload.waterMeterNumbers),
    hasViolations: (() => {
      const v = readString(payload.hasViolations);
      return v === "نعم" || v === "لا" ? v : ("" as "" | "نعم" | "لا");
    })(),
    violationsCount: readString(payload.violationsCount),
    violationsDescription: readString(payload.violationsDescription),
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
    acceptedAtUtc: dto.acceptedAtUtc ?? null,
    acceptedByName: dto.acceptedByName ?? null,
    updatedAtUtc: dto.updatedAtUtc || draft.updatedAtUtc,
  };
  return sanitizeInspectorDraftForLand({
    ...mapped,
    buildingsTotal: computeBuildingsTotalSqm(
      mapped.builtArea,
      mapped.basementTotal,
      mapped.annexTotal,
    ),
  });
}

export function draftToPayload(
  draft: InspectorWorkspaceDraft,
): Record<string, unknown> {
  const clean = sanitizeInspectorDraftForLand(draft);
  return {
    propertyDisplayId: clean.propertyDisplayId,
    inspectionDate: draft.inspectionDate,
    inspectionTime: draft.inspectionTime,
    mapLatitude: draft.mapLatitude,
    mapLongitude: draft.mapLongitude,
    inspectorMapLatitude: draft.inspectorMapLatitude,
    inspectorMapLongitude: draft.inspectorMapLongitude,
    featureValues: clean.featureValues,
    featurePhotoAttachments: clean.featurePhotoAttachments,
    componentPhotoAttachments: draft.componentPhotoAttachments,
    streetName: draft.streetName,
    mainStreetName: draft.mainStreetName,
    streetWidthM: draft.streetWidthM,
    accessContactName: draft.accessContactName,
    accessContactPhone: draft.accessContactPhone,
    accessContactRole: draft.accessContactRole,
    accessRouteDescription:
      draft.accessRouteDescription.trim() ||
      composeAccessRouteDescription({
        name: draft.accessContactName,
        phone: draft.accessContactPhone,
        role: draft.accessContactRole,
      }),
    roomCount: draft.roomCount,
    hallCount: draft.hallCount,
    unitCount: draft.unitCount,
    bathroomCount: draft.bathroomCount,
    showroomCount: draft.showroomCount,
    wellCount: draft.wellCount,
    towerCount: draft.towerCount,
    builtArea: draft.builtArea,
    buildingFloors: draft.buildingFloors,
    basementTotal: draft.basementTotal,
    annexTotal: draft.annexTotal,
    annexUpperCount: draft.annexUpperCount,
    annexGroundCount: draft.annexGroundCount,
    buildingsTotal: draft.buildingsTotal,
    propertyAgeYears: draft.propertyAgeYears,
    buildLicenseNumber: draft.buildLicenseNumber,
    buildLicenseDate: draft.buildLicenseDate,
    vacantLand: draft.vacantLand,
    keyAvailable: draft.keyAvailable,
    clientDeclarationSigned: draft.clientDeclarationSigned,
    declarationPhoneSatisfied: draft.declarationPhoneSatisfied,
    hasAnnex: draft.hasAnnex,
    jacuzziCount: draft.jacuzziCount,
    diningCount: draft.diningCount,
    majlisCount: draft.majlisCount,
    maidRoomCount: draft.maidRoomCount,
    guardRoomCount: draft.guardRoomCount,
    parkingCount: draft.parkingCount,
    playgroundCount: draft.playgroundCount,
    storeCount: draft.storeCount,
    electricityMeterCount: draft.electricityMeterCount,
    electricityMeterNumbers: draft.electricityMeterNumbers,
    waterMeterCount: draft.waterMeterCount,
    waterMeterNumbers: draft.waterMeterNumbers,
    hasViolations: draft.hasViolations,
    violationsCount: draft.violationsCount,
    violationsDescription: draft.violationsDescription,
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

export function setCache(draft: InspectorWorkspaceDraft): void {
  if (!draft.taskId) return;
  workspaceCache.set(draft.taskId, draft);
}

/** Updates cache and notifies listeners — use only after user-facing writes. */
export function writeCache(draft: InspectorWorkspaceDraft): void {
  setCache(draft);
  notifyChanged();
}

export function loadInspectorWorkspace(
  taskId: string,
): InspectorWorkspaceDraft | null {
  if (!taskId) return null;
  return workspaceCache.get(taskId) ?? null;
}

export type InspectorWorkspacePatch = Partial<
  Omit<
    InspectorWorkspaceDraft,
    | "taskId"
    | "propertyId"
    | "poNumber"
    | "status"
    | "submittedAtUtc"
    | "updatedAtUtc"
  >
>;

/** Merge a field patch into a draft (shared by UI optimistic updates + persistence). */
export function mergeInspectorWorkspacePatch(
  current: InspectorWorkspaceDraft,
  patch: InspectorWorkspacePatch,
): InspectorWorkspaceDraft {
  const merged: InspectorWorkspaceDraft = {
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
    buildingsTotal: computeBuildingsTotalSqm(
      patch.builtArea ?? current.builtArea,
      patch.basementTotal ?? current.basementTotal,
      patch.annexTotal ?? current.annexTotal,
    ),
    // Keep package workflow status: specialist may correct a submitted inspection
    // without reopening it; inspector edits only happen on draft/reopened.
    status:
      current.status === "submitted"
        ? "submitted"
        : current.status === "reopened"
          ? "reopened"
          : "draft",
    updatedAtUtc: new Date().toISOString(),
  };
  return merged;
}

/** True when the cached draft carries a newer edit than the incoming one. */
export function isDraftNewerThan(
  local: InspectorWorkspaceDraft,
  incoming: InspectorWorkspaceDraft,
): boolean {
  const localTs = Date.parse(local.updatedAtUtc);
  const incomingTs = Date.parse(incoming.updatedAtUtc);
  if (Number.isFinite(localTs) && Number.isFinite(incomingTs)) {
    return localTs > incomingTs;
  }
  return false;
}

export type InspectorWorkspaceSnapshot = InspectorWorkspaceDraft;
