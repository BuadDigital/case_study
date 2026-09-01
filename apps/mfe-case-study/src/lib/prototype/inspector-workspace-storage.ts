import {
  jeddahDefaultCoords,
  shouldUseJeddahDefaultCoords,
} from "@platform/app-shared/domain/jeddah-default-coords";
import {
  isPersistedPartyTaskSubmission,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import {
  saveDraftWithOfflineFallback,
  submitWithOfflineFallback,
  loadQueuedDraftPayload,
} from "@platform/app-shared/offline/offline-write";
import { reopenPartySubmission, acceptPartySubmission, fetchPartySubmission, type PartyWorkMutationResult } from "@platform/app-shared/prototype/party-submission-api";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/prototype/party-submission-changed-event";
import { resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import {
  applyEnfathPrefillToInspectorDraft,
  inspectorDraftNeedsEnfathPrefill,
} from "./inspector-enfath-prefill";
import {
  composeAccessRouteDescription,
  computeBuildingsTotalSqm,
  createInspectorWorkspaceDraft,
  inspectionStampFromNow,
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

function notifyChanged(): void {
  dispatchPartySubmissionChanged(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT);
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
  return saved;
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
  const mapped: InspectorWorkspaceDraft = {
    ...draft,
    propertyDisplayId:
      readString(payload.propertyDisplayId) || draft.propertyDisplayId,
    inspectionDate: readString(payload.inspectionDate),
    inspectionTime: readString(payload.inspectionTime),
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

function draftToPayload(
  draft: InspectorWorkspaceDraft,
): Record<string, unknown> {
  const clean = sanitizeInspectorDraftForLand(draft);
  return {
    propertyDisplayId: clean.propertyDisplayId,
    inspectionDate: draft.inspectionDate,
    inspectionTime: draft.inspectionTime,
    mapLatitude: draft.mapLatitude,
    mapLongitude: draft.mapLongitude,
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
  let submission: PartyTaskSubmissionDto | null = null;
  try {
    submission = await fetchPartySubmission(taskId);
  } catch {
    submission = null;
  }

  if (!submission || !isPersistedPartyTaskSubmission(submission)) {
    const queued = await loadQueuedDraftPayload<Record<string, unknown>>(
      "field-inspection",
      taskId,
    );
    if (queued) {
      const local: PartyTaskSubmissionDto = {
        taskId,
        kind: "field-inspection",
        status: "draft",
        payload: queued,
        updatedAtUtc: new Date().toISOString(),
      };
      const draft = payloadToDraft(local);
      setCache(draft);
      return draft;
    }
    return submission ? payloadToDraft(submission) : loadInspectorWorkspace(taskId);
  }

  let draft = payloadToDraft(submission);
  const payload = submission.payload ?? {};
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
    const beforeSanitize = existing;
    existing = sanitizeInspectorDraftForLand(existing, {
      classification: input.property?.classification,
      propertyType: input.property?.propertyType,
    });
    const stamp = inspectionStampFromNow();
    const patch: Partial<InspectorWorkspaceDraft> = {};
    if (input.propertyDisplayId && !existing.propertyDisplayId.trim()) {
      patch.propertyDisplayId = input.propertyDisplayId;
    }
    if (!existing.inspectionDate.trim()) {
      patch.inspectionDate = stamp.inspectionDate;
    }
    if (!existing.inspectionTime.trim()) {
      patch.inspectionTime = stamp.inspectionTime;
    }
    if (existing !== beforeSanitize || Object.keys(patch).length > 0) {
      return saveInspectorWorkspaceDraft({ ...existing, ...patch });
    }
    return existing;
  }

  let draft = createInspectorWorkspaceDraft(input);
  if (input.property && inspectorDraftNeedsEnfathPrefill(draft)) {
    draft = applyEnfathPrefillToInspectorDraft(draft, input.property);
  }
  const saved = await saveInspectorWorkspaceDraft(draft);
  return saved;
}

export async function saveInspectorWorkspaceDraft(
  draft: InspectorWorkspaceDraft,
): Promise<InspectorWorkspaceDraft> {
  const config = workOrdersApiConfig();
  const nextDraft = sanitizeInspectorDraftForLand({
    ...draft,
    status:
      draft.status === "submitted"
        ? "submitted"
        : draft.status === "reopened"
          ? "reopened"
          : "draft",
    updatedAtUtc: new Date().toISOString(),
  });
  const payload = draftToPayload(nextDraft);

  if (!config) {
    const queued = await saveDraftWithOfflineFallback({
      taskId: draft.taskId,
      kind: "field-inspection",
      payload,
      onlineSave: async () => {
        throw new Error("تعذّر حفظ مسودة المعاينة — تحقق من تسجيل الدخول");
      },
    });
    if (queued.queued) {
      const cached = loadInspectorWorkspace(draft.taskId);
      if (cached && isDraftNewerThan(cached, nextDraft)) {
        return cached;
      }
      writeCache(nextDraft);
      return nextDraft;
    }
    throw new Error("تعذّر حفظ مسودة المعاينة — تحقق من تسجيل الدخول");
  }

  const queued = await saveDraftWithOfflineFallback({
    taskId: draft.taskId,
    kind: "field-inspection",
    payload,
    onlineSave: async () => {
      const result = await savePartyTaskSubmission(
        config,
        draft.taskId,
        payload,
      );
      if (!result.ok) {
        const err = new Error(
          resolveApiError(result.kind, result.errors, "تعذّر حفظ مسودة المعاينة"),
        ) as Error & { offlineQueueable?: boolean; errors?: Record<string, string> };
        if (result.kind !== "network" && result.kind !== "server") {
          err.offlineQueueable = false;
        }
        if (result.errors) {
          err.errors = result.errors as Record<string, string>;
        }
        throw err;
      }
      const next = payloadToDraft(result.data, draft);
      const cached = loadInspectorWorkspace(draft.taskId);
      // A newer local edit may have landed while this request was in flight.
      if (cached && isDraftNewerThan(cached, draft)) {
        return;
      }
      writeCache(next);
    },
  });

  if (queued.queued) {
    const cached = loadInspectorWorkspace(draft.taskId);
    if (cached && isDraftNewerThan(cached, nextDraft)) {
      return cached;
    }
    writeCache(nextDraft);
    return nextDraft;
  }

  return loadInspectorWorkspace(draft.taskId) ?? nextDraft;
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
    status: current.status === "reopened" ? "reopened" : "draft",
    updatedAtUtc: new Date().toISOString(),
  };
  return merged;
}

const SAVE_DEBOUNCE_MS = 400;
const saveDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const saveDebounceWaiters = new Map<
  string,
  Array<{
    resolve: (draft: InspectorWorkspaceDraft) => void;
    reject: (err: unknown) => void;
  }>
>();

function clearSaveDebounce(taskId: string): void {
  const timer = saveDebounceTimers.get(taskId);
  if (timer) clearTimeout(timer);
  saveDebounceTimers.delete(taskId);
}

/** Flush pending debounced saves so submit / navigation persist the latest keystrokes. */
async function flushInspectorWorkspaceSave(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  clearSaveDebounce(taskId);
  const waiters = saveDebounceWaiters.get(taskId) ?? [];
  saveDebounceWaiters.delete(taskId);
  const draft = loadInspectorWorkspace(taskId);
  if (!draft) {
    for (const w of waiters) {
      w.reject(new Error("لا توجد مسودة للحفظ"));
    }
    return null;
  }
  if (draft.status === "submitted") {
    for (const w of waiters) w.resolve(draft);
    return draft;
  }
  try {
    const saved = await saveInspectorWorkspaceDraft(draft);
    for (const w of waiters) w.resolve(saved);
    return saved;
  } catch (err) {
    for (const w of waiters) w.reject(err);
    throw err;
  }
}

function scheduleDebouncedSave(
  taskId: string,
): Promise<InspectorWorkspaceDraft> {
  return new Promise((resolve, reject) => {
    const waiters = saveDebounceWaiters.get(taskId) ?? [];
    waiters.push({ resolve, reject });
    saveDebounceWaiters.set(taskId, waiters);
    clearSaveDebounce(taskId);
    saveDebounceTimers.set(
      taskId,
      setTimeout(() => {
        saveDebounceTimers.delete(taskId);
        const pending = saveDebounceWaiters.get(taskId) ?? [];
        saveDebounceWaiters.delete(taskId);
        const draft = loadInspectorWorkspace(taskId);
        if (!draft) {
          for (const w of pending) {
            w.reject(new Error("لا توجد مسودة للحفظ"));
          }
          return;
        }
        void saveInspectorWorkspaceDraft(draft).then(
          (saved) => {
            for (const w of pending) w.resolve(saved);
          },
          (err: unknown) => {
            for (const w of pending) w.reject(err);
          },
        );
      }, SAVE_DEBOUNCE_MS),
    );
  });
}

function isDraftNewerThan(
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

export async function updateInspectorWorkspace(
  taskId: string,
  patch: InspectorWorkspacePatch,
): Promise<InspectorWorkspaceDraft | null> {
  const current =
    loadInspectorWorkspace(taskId) ?? (await fetchInspectorWorkspace(taskId));
  if (!current || current.status === "submitted") return current;

  // Apply locally first so typing stays instant; network save is debounced.
  const next = mergeInspectorWorkspacePatch(current, patch);
  setCache(next);
  return scheduleDebouncedSave(taskId);
}

export async function submitInspectorWorkspace(
  taskId: string,
): Promise<
  | { ok: true; draft: InspectorWorkspaceDraft; queued?: boolean }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  // Cheap session check before a network fetch that would be wasted without a session (async-cheap-condition-before-await).
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

  const saved = await flushInspectorWorkspaceSave(taskId) ?? current;
  const payload = draftToPayload(saved);

  try {
    const queued = await submitWithOfflineFallback({
      taskId,
      kind: "field-inspection",
      payload,
      onlineSubmit: async () => {
        const result = await submitPartyTaskSubmission(config, taskId);
        if (!result.ok) {
          const message = resolveApiError(result.kind, result.errors);
          const err = new Error(message) as Error & {
            errors?: Record<string, string>;
            offlineQueueable?: boolean;
          };
          err.errors = result.errors;
          if (result.kind !== "network" && result.kind !== "server") {
            err.offlineQueueable = false;
          }
          throw err;
        }
        const draft = payloadToDraft(result.data, saved);
        writeCache(draft);
      },
    });

    if (queued.queued) {
      const pending: InspectorWorkspaceDraft = {
        ...saved,
        status: "draft",
        updatedAtUtc: new Date().toISOString(),
      };
      writeCache(pending);
      return { ok: true, draft: pending, queued: true };
    }

    return {
      ok: true,
      draft: loadInspectorWorkspace(taskId) ?? saved,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "تعذّر إرسال المعاينة";
    const errors =
      err && typeof err === "object" && "errors" in err
        ? (err as { errors?: Record<string, string> }).errors
        : undefined;
    return { ok: false, message, errors };
  }
}

export async function reopenInspectorWorkspace(
  taskId: string,
  returnNote: string,
): Promise<PartyWorkMutationResult<InspectorWorkspaceDraft>> {
  const reopened = await reopenPartySubmission(taskId, returnNote);
  if (!reopened.ok) return { ok: false, error: reopened.error };
  const next = payloadToDraft(reopened.data);
  writeCache(next);
  notifyChanged();
  return { ok: true, data: next };
}

/** Specialist acceptance — stamps AcceptedAtUtc so data may feed Infath. */
export async function acceptInspectorWorkspace(
  taskId: string,
): Promise<PartyWorkMutationResult<InspectorWorkspaceDraft>> {
  const accepted = await acceptPartySubmission(taskId);
  if (!accepted.ok) return { ok: false, error: accepted.error };
  const next = payloadToDraft(accepted.data);
  writeCache(next);
  notifyChanged();
  return { ok: true, data: next };
}

export type InspectorWorkspaceSnapshot = InspectorWorkspaceDraft;

export async function loadInspectorWorkspaceSnapshot(
  taskId: string,
): Promise<InspectorWorkspaceSnapshot | null> {
  return fetchInspectorWorkspace(taskId);
}
