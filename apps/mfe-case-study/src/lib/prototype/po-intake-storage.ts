import type {
  AssignmentType,
  PoIntakeRecord,
  PoPropertyIntake,
} from "./po-intake-data";
import { classificationRequiresSurvey, computeBusinessDueDate, emptyProperty, normalizePropertyIdentifierNumber, parsePropertyIdentifierType,} from "./po-intake-data";
import {
  contactsForApi,
  propertyHasIncompleteContact,
} from "../domain/po-intake/property-validation";
import { deleteFailuresForPo, getPropertyFailure } from "@failures/mfe";
import {
  advanceTaskAfterBourseForProperty,
  advanceTaskAfterEnfath,
  deleteTasksForPo,
  deleteTasksForProperty,
  linkNewPropertyToTaskSlot,
  syncTaskSlotsForPo,
} from "./tasks-storage";
import type { PoRow, PropertyRow } from "@platform/app-shared/prototype/constants";
import type { PendingBoursePropertyDto,UpdatePropertyBourseRequest,WorkOrderDto,WorkOrderPropertyDto} from "@platform/api-client";
import {
  addWorkOrderProperty,
  cancelWorkOrder,
  completePropertyBourseData,
  createWorkOrder,
  deletePoIntakeDraft,
  deleteWorkOrder,
  deleteWorkOrderProperty,
  findPriorDeed,
  getPoIntakeDraft,
  getWorkOrder,
  listPendingBourseProperties,
  listWorkOrders,
  savePoIntakeDraft,
  stopWorkOrder,
  updateWorkOrderHeader,
  updateWorkOrderProperty,
  workOrderExists,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import {
  loadPoListRows,
  loadPropertyListItems,
  loadWorkOrderDtos,
  type PropertyListItem,
} from "@platform/app-shared/prototype/work-orders-read";
export { loadPoListRows, loadPropertyListItems, type PropertyListItem };
import {
  apiErrorMessage,
  notifyWorkOrdersChanged,
  resolveApiError,
  workOrdersApiConfig,
} from "../work-orders-api-config";

let memoryDraft: PoIntakeDraftPayload | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hydratePromise: Promise<PoIntakeDraftPayload | null> | null = null;

const PROPERTY_DEFAULTS = emptyProperty();

export type StorageError = {
  ok: false;
  error: string;
  errors?: Record<string, string>;
};

export type StorageOk<T> = { ok: true; data: T };

function normalizeProperty(prop: PoPropertyIntake): PoPropertyIntake {
  return {
    ...PROPERTY_DEFAULTS,
    ...prop,
    id: String(prop.id),
    contacts: prop.contacts?.length
      ? prop.contacts.map((c) => ({
          name: c.name ?? "",
          role: c.role ?? "",
          phone: c.phone ?? "",
        }))
      : [{ name: "", role: "", phone: "" }],
  };
}

function normalizePoRecord(record: PoIntakeRecord): PoIntakeRecord {
  const receivedFromEnfathTime = record.receivedFromEnfathTime ?? "";
  return {
    ...record,
    id: String(record.id),
    propertiesRegion: record.propertiesRegion ?? "",
    workOrderDescription: record.workOrderDescription ?? "",
    receivedFromEnfathTime,
    dueDateAt:
      record.dueDateAt ||
      computeBusinessDueDate(record.receivedFromEnfathAt, receivedFromEnfathTime),
    properties: (record.properties ?? []).map(normalizeProperty),
  };
}

function dtoToProperty(dto: WorkOrderPropertyDto): PoPropertyIntake {
  return normalizeProperty({
    id: String(dto.id ?? ""),
    identifierType: parsePropertyIdentifierType(dto.identifierType),
    deedNumber: dto.deedNumber,
    taskNumber: dto.taskNumber ?? "",
    deedDate: dto.deedDate ?? "",
    ownerName: dto.ownerName ?? "",
    restrictionsPresent: dto.restrictionsPresent ?? "",
    boundariesAvailability: dto.boundariesAvailability ?? "",
    boundariesExternalDocName: dto.boundariesExternalDocName ?? "",
    northBoundary: dto.northBoundary ?? "",
    northBoundaryLengthM: dto.northBoundaryLengthM ?? "",
    southBoundary: dto.southBoundary ?? "",
    southBoundaryLengthM: dto.southBoundaryLengthM ?? "",
    eastBoundary: dto.eastBoundary ?? "",
    eastBoundaryLengthM: dto.eastBoundaryLengthM ?? "",
    westBoundary: dto.westBoundary ?? "",
    westBoundaryLengthM: dto.westBoundaryLengthM ?? "",
    city: dto.city ?? "",
    district: dto.district ?? "",
    deedStatus: dto.deedStatus ?? "",
    area: dto.area ?? "",
    court: dto.court ?? "",
    circuit: dto.circuit ?? "",
    classification: dto.classification ?? "",
    propertyType: dto.propertyType ?? "",
    assignmentDocFileName: dto.assignmentDocFileName ?? "",
    delegationLetterFileName: dto.delegationLetterFileName ?? "",
    otherDocumentFileNames: dto.otherDocumentFileNames ?? [],
    realEstateRegFileName: dto.realEstateRegFileName ?? "",
    buildLicenseNumber: dto.buildLicenseNumber ?? "",
    subdivisionRecordNumber: dto.subdivisionRecordNumber ?? "",
    bourseDataCompleted: dto.bourseDataCompleted ?? false,
    contacts: (dto.contacts ?? []).map((c) => ({
      name: c.name ?? "",
      role: c.role ?? "",
      phone: c.phone ?? "",
    })),
  });
}

function dtoToRecord(dto: WorkOrderDto): PoIntakeRecord {
  return normalizePoRecord({
    id: String(dto.id),
    poNumber: dto.poNumber,
    assignmentType: dto.assignmentType as AssignmentType,
    promulgationDate: dto.promulgationDate,
    receivedFromEnfathAt: dto.receivedFromEnfathAt,
    receivedFromEnfathTime: dto.receivedFromEnfathTime ?? "",
    assignmentSpecialist: dto.assignmentSpecialist ?? "",
    assignmentSpecialistEmail: dto.assignmentSpecialistEmail ?? "",
    expectedPropertyCount: dto.expectedPropertyCount ?? 1,
    propertiesRegion: dto.propertiesRegion ?? "",
    workOrderDescription: dto.workOrderDescription ?? "",
    dueDateAt: dto.dueDateAt,
    createdAtUtc: dto.createdAtUtc,
    properties: dto.properties.map(dtoToProperty),
  });
}

export function propertyToEnfathDto(
  prop: PoPropertyIntake,
  options?: { forInsert?: boolean },
): WorkOrderPropertyDto {
  return {
    ...(options?.forInsert ? {} : { id: prop.id || undefined }),
    identifierType: prop.identifierType,
    deedNumber: normalizePropertyIdentifierNumber(
      prop.deedNumber,
      prop.identifierType,
    ),
    taskNumber: prop.taskNumber.trim() || undefined,
    deedDate: prop.deedDate || undefined,
    ownerName: prop.ownerName || undefined,
    city: prop.city.trim() || undefined,
    district: prop.district.trim() || undefined,
    classification: prop.classification.trim() || undefined,
    propertyType: prop.propertyType.trim() || undefined,
    court: prop.court || undefined,
    circuit: prop.circuit || undefined,
    assignmentDocFileName: prop.assignmentDocFileName || undefined,
    delegationLetterFileName: prop.delegationLetterFileName || undefined,
    otherDocumentFileNames:
      prop.otherDocumentFileNames.length > 0
        ? prop.otherDocumentFileNames
        : undefined,
    realEstateRegFileName: prop.realEstateRegFileName || undefined,
    bourseDataCompleted: prop.bourseDataCompleted,
    contacts: contactsForApi(prop.contacts),
  };
}

export function propertyToDto(prop: PoPropertyIntake): WorkOrderPropertyDto {
  return {
    ...propertyToEnfathDto(prop),
    restrictionsPresent: prop.restrictionsPresent || undefined,
    boundariesAvailability: prop.boundariesAvailability || undefined,
    boundariesExternalDocName: prop.boundariesExternalDocName || undefined,
    northBoundary: prop.northBoundary || undefined,
    northBoundaryLengthM: prop.northBoundaryLengthM || undefined,
    southBoundary: prop.southBoundary || undefined,
    southBoundaryLengthM: prop.southBoundaryLengthM || undefined,
    eastBoundary: prop.eastBoundary || undefined,
    eastBoundaryLengthM: prop.eastBoundaryLengthM || undefined,
    westBoundary: prop.westBoundary || undefined,
    westBoundaryLengthM: prop.westBoundaryLengthM || undefined,
    buildLicenseNumber: prop.buildLicenseNumber || undefined,
    subdivisionRecordNumber: prop.subdivisionRecordNumber || undefined,
    deedStatus: prop.deedStatus || undefined,
    area: prop.area || undefined,
    city: prop.city.trim(),
    district: prop.district.trim(),
    classification: prop.classification.trim(),
    propertyType: prop.propertyType.trim(),
  };
}

export function propertyToBourseRequest(
  prop: PoPropertyIntake,
): UpdatePropertyBourseRequest {
  return {
    city: prop.city.trim(),
    district: prop.district.trim(),
    classification: prop.classification.trim(),
    propertyType: prop.propertyType.trim(),
    area: prop.area || undefined,
    deedStatus: prop.deedStatus || undefined,
    restrictionsPresent: prop.restrictionsPresent || undefined,
    boundariesAvailability: prop.boundariesAvailability || undefined,
    boundariesExternalDocName: prop.boundariesExternalDocName || undefined,
    northBoundary: prop.northBoundary || undefined,
    northBoundaryLengthM: prop.northBoundaryLengthM || undefined,
    southBoundary: prop.southBoundary || undefined,
    southBoundaryLengthM: prop.southBoundaryLengthM || undefined,
    eastBoundary: prop.eastBoundary || undefined,
    eastBoundaryLengthM: prop.eastBoundaryLengthM || undefined,
    westBoundary: prop.westBoundary || undefined,
    westBoundaryLengthM: prop.westBoundaryLengthM || undefined,
    buildLicenseNumber: prop.buildLicenseNumber || undefined,
    subdivisionRecordNumber: prop.subdivisionRecordNumber || undefined,
  };
}

function priorSurveyWaived(
  prop: PoPropertyIntake,
  priorByDeed: Map<string, string>,
): boolean {
  if (!classificationRequiresSurvey(prop.classification)) return true;
  const n = prop.deedNumber.trim();
  if (!n) return false;
  return priorByDeed.has(n);
}

export async function loadPoRecords(): Promise<PoIntakeRecord[]> {
  const dtos = await loadWorkOrderDtos();
  return mapWorkOrderDtosToPoRecords(dtos);
}

export function mapWorkOrderDtosToPoRecords(dtos: WorkOrderDto[]): PoIntakeRecord[] {
  return dtos.map(dtoToRecord);
}

export async function savePoRecord(
  record: PoIntakeRecord,
): Promise<StorageOk<PoIntakeRecord> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }

  const result = await createWorkOrder(config, {
    poNumber: record.poNumber.trim(),
    assignmentType: record.assignmentType,
    promulgationDate: record.promulgationDate,
    receivedFromEnfathTime: record.receivedFromEnfathTime || undefined,
    assignmentSpecialist: record.assignmentSpecialist.trim() || undefined,
    assignmentSpecialistEmail: record.assignmentSpecialistEmail.trim() || undefined,
    expectedPropertyCount: record.expectedPropertyCount,
    propertiesRegion: record.propertiesRegion.trim() || undefined,
    workOrderDescription: record.workOrderDescription.trim() || undefined,
    properties: record.properties.map((p) =>
      propertyToEnfathDto(p, { forInsert: true }),
    ),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors),
      errors: result.errors,
    };
  }

  const saved = dtoToRecord(result.data);
  await syncTaskSlotsForPo(saved);
  notifyWorkOrdersChanged();
  return { ok: true, data: saved };
}

export async function poRecordExists(poNumber: string): Promise<boolean> {
  const config = workOrdersApiConfig();
  if (!config) return false;
  const result = await workOrderExists(config, poNumber);
  return result.ok ? result.data : false;
}

export function poRecordToListRow(record: PoIntakeRecord): PoRow {
  const registered = record.properties.length;
  const expected = record.expectedPropertyCount ?? registered;
  return {
    id: record.poNumber,
    type: record.assignmentType ?? "—",
    count: expected,
    registered,
    done: 0,
    status:
      registered >= expected && expected > 0
        ? "completed"
        : registered > 0
          ? "under_study"
          : "new",
    date: record.receivedFromEnfathAt,
    dueDate: record.dueDateAt,
    specialist: record.assignmentSpecialist,
    createdAtUtc: new Date().toISOString(),
  };
}

export async function findPriorDeedFull(
  deedNumber: string,
  excludePo?: string,
): Promise<import("@platform/api-client").PriorDeedRegistrationDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await findPriorDeed(config, deedNumber, excludePo);
  if (!result.ok || !result.data) return null;
  return result.data;
}

function propertyRowId(poNumber: string, prop: PoPropertyIntake): string {
  const deed = prop.deedNumber.trim();
  if (deed) return deed;
  return `${poNumber}-${prop.id.slice(0, 8)}`;
}

export function poPropertyToPropertyRow(
  record: PoIntakeRecord,
  prop: PoPropertyIntake,
  priorByDeed: Map<string, string>,
): PropertyRow {
  const failure = getPropertyFailure(record.poNumber, prop.id);
  const boursePending = !prop.bourseDataCompleted;
  const underVerification = prop.deedStatus === "قيد التحقق";
  const isFailed =
    failure?.status === "approved" || prop.deedStatus === "موقوف";
  const incomplete = propertyHasIncompleteContact(prop);
  const area = boursePending
    ? "بانتظار البورصة"
    : prop.district
      ? `${prop.city} · ${prop.district}`
      : prop.city || "—";

  return {
    id: propertyRowId(record.poNumber, prop),
    po: record.poNumber,
    area,
    type: boursePending
      ? "—"
      : prop.propertyType || prop.classification || "—",
    key: false,
    survey: boursePending
      ? "new"
      : priorSurveyWaived(prop, priorByDeed)
        ? "done"
        : "new",
    val: "new",
    study: boursePending
      ? "progress"
      : underVerification
        ? "progress"
        : "new",
    status: boursePending
      ? "progress"
      : isFailed
        ? "fail"
        : incomplete
          ? "incomplete"
          : underVerification
            ? "progress"
            : "new",
    specialist: record.assignmentSpecialist,
  };
}

export async function loadPendingBourseItems(): Promise<
  PendingBoursePropertyDto[]
> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listPendingBourseProperties(config);
  return result.ok ? result.data : [];
}

export async function completePropertyBourse(
  poNumber: string,
  propertyId: string,
  property: PoPropertyIntake,
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await completePropertyBourseData(
    config,
    poNumber,
    propertyId,
    propertyToBourseRequest(property),
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors),
      errors: result.errors,
    };
  }

  const saved = dtoToProperty(result.data);
  await advanceTaskAfterBourseForProperty(poNumber, propertyId, saved);
  notifyWorkOrdersChanged();
  return { ok: true, data: saved };
}

export async function loadPropertyRows(): Promise<PropertyRow[]> {
  const items = await loadPropertyListItems();
  return items.map(({ row }) => row);
}

export async function getPoRecord(
  poNumber: string,
): Promise<PoIntakeRecord | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await getWorkOrder(config, poNumber);
  if (!result.ok) return null;
  return dtoToRecord(result.data);
}

export async function deletePoRecord(
  poNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await deleteWorkOrder(config, poNumber);
  if (!result.ok) {
    return {
      ok: false,
      error: result.message ?? apiErrorMessage(result.kind),
    };
  }
  await deleteTasksForPo(poNumber);
  await deleteFailuresForPo(poNumber);
  notifyWorkOrdersChanged();
  return { ok: true };
}

export async function cancelPoRecord(
  poNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await cancelWorkOrder(config, poNumber);
  if (!result.ok) {
    return {
      ok: false,
      error: result.message ?? apiErrorMessage(result.kind),
    };
  }
  notifyWorkOrdersChanged();
  return { ok: true };
}

export async function stopPoRecord(
  poNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await stopWorkOrder(config, poNumber);
  if (!result.ok) {
    return {
      ok: false,
      error: result.message ?? apiErrorMessage(result.kind),
    };
  }
  notifyWorkOrdersChanged();
  return { ok: true };
}

export async function updatePoRecord(
  record: PoIntakeRecord,
): Promise<StorageOk<PoIntakeRecord> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await updateWorkOrderHeader(config, record.poNumber, {
    assignmentType: record.assignmentType,
    promulgationDate: record.promulgationDate,
    receivedFromEnfathTime: record.receivedFromEnfathTime || undefined,
    assignmentSpecialist: record.assignmentSpecialist.trim() || undefined,
    assignmentSpecialistEmail: record.assignmentSpecialistEmail.trim() || undefined,
    expectedPropertyCount: record.expectedPropertyCount,
    propertiesRegion: record.propertiesRegion.trim() || undefined,
    workOrderDescription: record.workOrderDescription.trim() || undefined,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors, "تعذّر حفظ التعديلات"),
      errors: result.errors,
    };
  }

  const saved = dtoToRecord(result.data);
  const full = await getPoRecord(record.poNumber);
  if (full) {
    await syncTaskSlotsForPo({
      ...full,
      expectedPropertyCount: saved.expectedPropertyCount,
      assignmentType: saved.assignmentType,
      promulgationDate: saved.promulgationDate,
      assignmentSpecialist: saved.assignmentSpecialist,
      assignmentSpecialistEmail: saved.assignmentSpecialistEmail,
    });
  } else {
    await syncTaskSlotsForPo({ ...record, ...saved, properties: record.properties });
  }
  notifyWorkOrdersChanged();
  return { ok: true, data: saved };
}

export async function findPropertyInRecord(
  poNumber: string,
  propertyId: string,
): Promise<{ record: PoIntakeRecord; property: PoPropertyIntake } | null> {
  const record = await getPoRecord(poNumber);
  if (!record) return null;
  const property = record.properties.find((p) => p.id === propertyId);
  if (!property) return null;
  return { record, property };
}

export async function deedExistsInPo(
  poNumber: string,
  deedNumber: string,
  excludePropertyId?: string,
): Promise<boolean> {
  const record = await getPoRecord(poNumber);
  if (!record) return false;
  const n = deedNumber.trim();
  return record.properties.some(
    (p) => p.deedNumber.trim() === n && p.id !== excludePropertyId,
  );
}

export async function addPropertyToPo(
  poNumber: string,
  property: PoPropertyIntake,
  options?: { assignToTaskId?: string },
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await addWorkOrderProperty(
    config,
    poNumber,
    propertyToEnfathDto(property, { forInsert: true }),
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors),
      errors: result.errors,
    };
  }

  const prop = dtoToProperty(result.data);
  const record = await getPoRecord(poNumber);
  if (options?.assignToTaskId) {
    await advanceTaskAfterEnfath(options.assignToTaskId, prop);
  } else if (record) {
    await linkNewPropertyToTaskSlot(record, prop);
  }
  notifyWorkOrdersChanged();
  return { ok: true, data: prop };
}

export async function removePropertyFromPo(
  poNumber: string,
  propertyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await deleteWorkOrderProperty(config, poNumber, propertyId);
  if (!result.ok) {
    return {
      ok: false,
      error: result.message ?? apiErrorMessage(result.kind),
    };
  }
  const record = await getPoRecord(poNumber);
  await deleteTasksForProperty(
    poNumber,
    propertyId,
    record?.expectedPropertyCount ?? 1,
  );
  notifyWorkOrdersChanged();
  return { ok: true };
}

export async function updatePropertyInPo(
  poNumber: string,
  propertyId: string,
  property: PoPropertyIntake,
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const dto = property.bourseDataCompleted
    ? propertyToDto({ ...property, id: propertyId })
    : propertyToEnfathDto({ ...property, id: propertyId });

  const result = await updateWorkOrderProperty(
    config,
    poNumber,
    propertyId,
    dto,
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors),
      errors: result.errors,
    };
  }

  notifyWorkOrdersChanged();
  return { ok: true, data: dtoToProperty(result.data) };
}

export type PoIntakeDraftPayload = {
  step: number;
  poNumber: string;
  assignmentType: PoIntakeRecord["assignmentType"] | "";
  promulgationDate: string;
  assignmentSpecialist: string;
  assignmentSpecialistEmail: string;
  expectedPropertyCount: number;
  propertiesRegion: string;
  workOrderDescription: string;
};

function draftToDto(draft: PoIntakeDraftPayload) {
  return {
    step: draft.step,
    poNumber: draft.poNumber,
    assignmentType: draft.assignmentType,
    promulgationDate: draft.promulgationDate,
    assignmentSpecialist: draft.assignmentSpecialist,
    assignmentSpecialistEmail: draft.assignmentSpecialistEmail,
    expectedPropertyCount: draft.expectedPropertyCount,
    propertiesRegion: draft.propertiesRegion,
    workOrderDescription: draft.workOrderDescription,
  };
}

function dtoToDraft(dto: {
  step?: number;
  poNumber?: string;
  assignmentType?: string;
  promulgationDate?: string;
  assignmentSpecialist?: string;
  assignmentSpecialistEmail?: string;
  expectedPropertyCount?: number;
  propertiesRegion?: string;
  workOrderDescription?: string;
}): PoIntakeDraftPayload {
  return {
    step: dto.step ?? 1,
    poNumber: dto.poNumber ?? "",
    assignmentType: (dto.assignmentType ?? "") as PoIntakeDraftPayload["assignmentType"],
    promulgationDate: dto.promulgationDate ?? "",
    assignmentSpecialist: dto.assignmentSpecialist ?? "",
    assignmentSpecialistEmail: dto.assignmentSpecialistEmail ?? "",
    expectedPropertyCount:
      dto.expectedPropertyCount && dto.expectedPropertyCount > 0
        ? dto.expectedPropertyCount
        : 1,
    propertiesRegion: dto.propertiesRegion ?? "",
    workOrderDescription: dto.workOrderDescription ?? "",
  };
}

async function persistPoDraft(draft: PoIntakeDraftPayload): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config) return;
  await savePoIntakeDraft(config, draftToDto(draft));
}

/** Load draft from in-memory cache (call hydratePoDraft first). */
export function loadPoDraft(): PoIntakeDraftPayload | null {
  return memoryDraft;
}

/** Fetch server draft into in-memory cache. */
export async function hydratePoDraft(): Promise<PoIntakeDraftPayload | null> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const config = prototypeModulesApiConfig();
    if (!config) {
      memoryDraft = null;
      return null;
    }

    const result = await getPoIntakeDraft(config);
    if (result.ok && result.data) {
      memoryDraft = dtoToDraft(result.data);
      return memoryDraft;
    }

    memoryDraft = null;
    return null;
  })();

  return hydratePromise;
}

export function savePoDraft(draft: PoIntakeDraftPayload): void {
  memoryDraft = draft;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persistPoDraft(draft);
  }, 400);
}

export async function clearPoDraft(): Promise<void> {
  memoryDraft = null;
  hydratePromise = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const config = prototypeModulesApiConfig();
  if (config) await deletePoIntakeDraft(config);
}

export function resetPoIntakeDraftClientCache(): void {
  memoryDraft = null;
  hydratePromise = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

export function buildPoRecord(
  fields: Omit<
    PoIntakeRecord,
    | "id"
    | "dueDateAt"
    | "receivedFromEnfathAt"
    | "receivedFromEnfathTime"
    | "createdAtUtc"
  > & {
    id?: string;
    receivedFromEnfathAt?: string;
    receivedFromEnfathTime?: string;
  },
): PoIntakeRecord {
  const received =
    fields.receivedFromEnfathAt?.trim() || fields.promulgationDate;
  return {
    id:
      fields.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `po-${Date.now()}`),
    ...fields,
    properties: fields.properties ?? [],
    receivedFromEnfathAt: received,
    dueDateAt: computeBusinessDueDate(
      received,
      fields.receivedFromEnfathTime ?? "",
    ),
    receivedFromEnfathTime: fields.receivedFromEnfathTime ?? "",
    createdAtUtc: new Date().toISOString(),
  };
}
