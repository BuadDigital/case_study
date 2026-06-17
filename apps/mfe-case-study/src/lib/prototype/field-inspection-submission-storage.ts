import {
  getPartyTaskSubmission,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import { resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import {
  createFieldInspectionDraft,
  emptyFieldInspectionPhotos,
  type FieldInspectionAccess,
  type FieldInspectionCondition,
  type FieldInspectionMarketActivity,
  type FieldInspectionPropertyType,
  type FieldInspectionRentalStatus,
  type FieldInspectionSignatoryRole,
  type FieldInspectionSubmission,
  type FieldInspectionSubmissionStatus,
} from "./field-inspection-data";

/** In-memory cache — persistence is via party task submission API. */
const inspectionCache = new Map<string, FieldInspectionSubmission>();

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

function readBoolOrNull(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function readRentalStatus(value: unknown): FieldInspectionRentalStatus {
  if (value === "yes" || value === "no" || value === "unknown") return value;
  return "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return ["", "", ""];
  return value.map((item) => (typeof item === "string" ? item : ""));
}

function readYesNo(value: unknown): FieldInspectionSubmission["hasKitchen"] {
  if (value === "yes" || value === "no") return value;
  return "";
}

const INFATH_PAYLOAD_KEYS = [
  "inspectionDate",
  "facade",
  "streetWidthM",
  "builtAreaSqm",
  "propertyUsage",
  "streetName",
  "mainStreetName",
  "mapLatitude",
  "mapLongitude",
  "roomCount",
  "hallCount",
  "unitCount",
  "bathroomCount",
  "propertyAgeYears",
  "showroomCount",
  "towerCount",
  "wellCount",
  "hasKitchen",
  "hasCarEntrance",
  "hasBasement",
  "hasElevator",
  "hasPool",
  "districtState",
  "availableServices",
  "surroundingAmenities",
  "propertyDescription",
  "districtProsCons",
  "accessRouteDescription",
  "assetNotes",
  "buildingFloors",
  "basementTotalSqm",
  "annexTotalSqm",
  "buildingsTotalSqm",
  "exteriorPhotosPdf",
  "interiorPhotosPdf",
] as const;

function readInfathPayload(
  payload: Record<string, unknown>,
  draft: FieldInspectionSubmission,
): Partial<FieldInspectionSubmission> {
  const yesNoKeys = new Set([
    "hasKitchen",
    "hasCarEntrance",
    "hasBasement",
    "hasElevator",
    "hasPool",
  ]);
  const out: Partial<FieldInspectionSubmission> = {};
  for (const key of INFATH_PAYLOAD_KEYS) {
    const raw = payload[key];
    if (yesNoKeys.has(key)) {
      (out as Record<string, string>)[key] = readYesNo(raw);
    } else {
      (out as Record<string, string>)[key] = readString(raw) || String((draft as unknown as Record<string, string>)[key] ?? "");
    }
  }
  return out;
}

function readPropertyPhotos(
  value: unknown,
): FieldInspectionSubmission["propertyPhotos"] {
  const base = emptyFieldInspectionPhotos();
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof typeof base)[]) {
    base[key] = readString(record[key]);
  }
  return base;
}

function payloadToSubmission(
  dto: PartyTaskSubmissionDto,
  fallback?: Partial<FieldInspectionSubmission>,
): FieldInspectionSubmission {
  const payload = dto.payload ?? {};
  const draft = createFieldInspectionDraft({
    taskId: dto.taskId,
    propertyId: dto.propertyId ?? fallback?.propertyId ?? "",
    poNumber: dto.poNumber ?? fallback?.poNumber ?? "",
    propertyDisplayId: fallback?.propertyDisplayId,
  });

  return {
    ...draft,
    propertyDisplayId:
      readString(payload.propertyDisplayId) || draft.propertyDisplayId,
    propertyType: readString(payload.propertyType) as
      | FieldInspectionPropertyType
      | "",
    areaDistrict: readString(payload.areaDistrict),
    actualAreaSqm: readString(payload.actualAreaSqm),
    structuralCondition: readString(payload.structuralCondition) as
      | FieldInspectionCondition
      | "",
    hasMovableItems: readBoolOrNull(payload.hasMovableItems),
    isCurrentlyRented: readRentalStatus(payload.isCurrentlyRented),
    accessDifficulty: readString(payload.accessDifficulty) as
      | FieldInspectionAccess
      | "",
    avgPricePerSqm: readString(payload.avgPricePerSqm),
    marketActivityLevel: readString(payload.marketActivityLevel) as
      | FieldInspectionMarketActivity
      | "",
    marketNotes: readString(payload.marketNotes),
    responsiblePersonName: readString(payload.responsiblePersonName),
    responsiblePersonRole: readString(payload.responsiblePersonRole) as
      | FieldInspectionSignatoryRole
      | "",
    signedDocumentPhotos: readStringArray(payload.signedDocumentPhotos),
    propertyPhotos: readPropertyPhotos(payload.propertyPhotos),
    generalNotes: readString(payload.generalNotes),
    ...readInfathPayload(payload as Record<string, unknown>, draft),
    status: (dto.status === "submitted"
      ? "submitted"
      : "draft") as FieldInspectionSubmissionStatus,
    submittedAtUtc: dto.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc || draft.updatedAtUtc,
  };
}

function submissionToPayload(
  submission: FieldInspectionSubmission,
): Record<string, unknown> {
  return {
    propertyDisplayId: submission.propertyDisplayId,
    propertyType: submission.propertyType,
    areaDistrict: submission.areaDistrict,
    actualAreaSqm: submission.actualAreaSqm,
    structuralCondition: submission.structuralCondition,
    hasMovableItems: submission.hasMovableItems,
    isCurrentlyRented: submission.isCurrentlyRented,
    accessDifficulty: submission.accessDifficulty,
    avgPricePerSqm: submission.avgPricePerSqm,
    marketActivityLevel: submission.marketActivityLevel,
    marketNotes: submission.marketNotes,
    responsiblePersonName: submission.responsiblePersonName,
    responsiblePersonRole: submission.responsiblePersonRole,
    signedDocumentPhotos: submission.signedDocumentPhotos,
    propertyPhotos: submission.propertyPhotos,
    generalNotes: submission.generalNotes,
    ...Object.fromEntries(
      INFATH_PAYLOAD_KEYS.map((key) => [key, submission[key]]),
    ),
    status: submission.status,
    submittedAtUtc: submission.submittedAtUtc,
    updatedAtUtc: submission.updatedAtUtc,
  };
}

function writeCache(submission: FieldInspectionSubmission): void {
  if (!submission.taskId) return;
  inspectionCache.set(submission.taskId, submission);
  notifyChanged();
}

export function loadFieldInspectionSubmission(
  taskId: string,
): FieldInspectionSubmission | null {
  if (!taskId) return null;
  return inspectionCache.get(taskId) ?? null;
}

export async function fetchFieldInspectionSubmission(
  taskId: string,
): Promise<FieldInspectionSubmission | null> {
  const config = workOrdersApiConfig();
  if (!config) return loadFieldInspectionSubmission(taskId);

  const result = await getPartyTaskSubmission(config, taskId);
  if (!result.ok) {
    if (result.kind === "not_found") return null;
    return loadFieldInspectionSubmission(taskId);
  }

  const submission = payloadToSubmission(result.data);
  writeCache(submission);
  return submission;
}

export async function getOrCreateFieldInspectionDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  propertyDisplayId?: string;
}): Promise<FieldInspectionSubmission | null> {
  const existing = await fetchFieldInspectionSubmission(input.taskId);
  if (existing) {
    if (
      input.propertyDisplayId &&
      !existing.propertyDisplayId.trim()
    ) {
      return updateFieldInspectionDraft(input.taskId, {
        propertyDisplayId: input.propertyDisplayId,
      });
    }
    return existing;
  }

  const draft = createFieldInspectionDraft(input);
  return saveFieldInspectionDraft(draft);
}

export async function saveFieldInspectionDraft(
  submission: FieldInspectionSubmission,
): Promise<FieldInspectionSubmission | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;

  const payload = submissionToPayload({
    ...submission,
    status: submission.status === "submitted" ? "submitted" : "draft",
    updatedAtUtc: new Date().toISOString(),
  });

  const result = await savePartyTaskSubmission(
    config,
    submission.taskId,
    payload,
  );
  if (!result.ok) return null;

  const next = payloadToSubmission(result.data, submission);
  writeCache(next);
  return next;
}

export async function updateFieldInspectionDraft(
  taskId: string,
  patch: Partial<
    Omit<
      FieldInspectionSubmission,
      | "taskId"
      | "propertyId"
      | "poNumber"
      | "status"
      | "submittedAtUtc"
      | "updatedAtUtc"
    >
  >,
): Promise<FieldInspectionSubmission | null> {
  const current =
    loadFieldInspectionSubmission(taskId) ??
    (await fetchFieldInspectionSubmission(taskId));
  if (!current || current.status === "submitted") return current;

  const next: FieldInspectionSubmission = {
    ...current,
    ...patch,
    propertyPhotos: patch.propertyPhotos ?? current.propertyPhotos,
    signedDocumentPhotos:
      patch.signedDocumentPhotos ?? current.signedDocumentPhotos,
    status: "draft",
    updatedAtUtc: new Date().toISOString(),
  };
  return saveFieldInspectionDraft(next);
}

export async function submitFieldInspectionSubmission(
  taskId: string,
): Promise<
  | { ok: true; submission: FieldInspectionSubmission }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, message: "يجب تسجيل الدخول أولاً" };
  }

  const current =
    loadFieldInspectionSubmission(taskId) ??
    (await fetchFieldInspectionSubmission(taskId));
  if (!current) {
    return { ok: false, message: "لا توجد مسودة للإرسال" };
  }
  if (current.status === "submitted") {
    return { ok: true, submission: current };
  }

  const saved = await saveFieldInspectionDraft(current);
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

  const submission = payloadToSubmission(result.data, saved);
  writeCache(submission);
  return { ok: true, submission };
}

export type FieldInspectionSubmissionSnapshot = FieldInspectionSubmission;

export async function loadFieldInspectionSubmissionSnapshot(
  taskId: string,
): Promise<FieldInspectionSubmissionSnapshot | null> {
  return fetchFieldInspectionSubmission(taskId);
}
