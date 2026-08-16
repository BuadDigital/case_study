import type {
  AssignmentType,
  PoIntakeRecord,
  PoPropertyIntake,
} from "./po-intake-data";
import { computeBusinessDueDate, emptyProperty, formatPropertyDeedDisplay, hasBourseDetailFields, normalizePropertyIdentifierNumber, parsePropertyIdentifierType, skipsBourseForIdentifier, businessDaysForAssignmentType,} from "./po-intake-data";
import {
  contactsForApi,
} from "../domain/po-intake/property-validation";
import { deleteFailuresForPo } from "@failures/mfe";
import {
  advanceTaskAfterBourseForProperty,
  advanceTaskAfterEnfath,
  deleteTasksForPo,
  deleteTasksForProperty,
  linkNewPropertyToTaskSlot,
  syncTaskSlotsForPo,
  type WorkflowTask,
} from "./tasks-storage";
import type { PropertyRow } from "@platform/app-shared/prototype/constants";
import type { PendingBoursePropertyDto,PriorDeedRegistrationDto,UpdatePropertyBourseRequest,WorkOrderDto,WorkOrderPropertyDto} from "@platform/api-client";
import {
  addWorkOrderProperty,
  cancelWorkOrder,
  completePropertyBourseData,
  createWorkOrder,
  deletePoIntakeDraft,
  deleteWorkOrder,
  deleteWorkOrderProperty,
  findPriorDeed,
  listPriorDeeds,
  getPoIntakeDraft,
  getWorkOrder,
  listPendingBourseProperties,
  savePoIntakeDraft,
  stopWorkOrder,
  updateWorkOrderHeader,
  updateWorkOrderProperty,
  updateWorkOrderPropertyLocationMapUrl,
  workOrderExists,
} from "@platform/api-client";
import { normalizeDeedNumber } from "./deed-number";
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
    clientId: record.clientId?.trim() ?? "",
    reportUserClientIds: record.reportUserClientIds ?? [],
    clientNameAr: record.clientNameAr?.trim() || undefined,
    receivedFromEnfathTime,
    dueDateAt:
      record.dueDateAt ||
      computeBusinessDueDate(
        record.receivedFromEnfathAt,
        receivedFromEnfathTime,
        businessDaysForAssignmentType(record.assignmentType),
      ),
    properties: (record.properties ?? []).map(normalizeProperty),
  };
}

function dtoToProperty(dto: WorkOrderPropertyDto): PoPropertyIntake {
  return normalizeProperty({
    id: String(dto.id ?? ""),
    identifierType: parsePropertyIdentifierType(dto.identifierType),
    deedNumber: dto.deedNumber,
    requestNumber: dto.requestNumber ?? "",
    hasRequestNumber: dto.hasRequestNumber !== false,
    assignmentMandateNumber: dto.assignmentMandateNumber ?? "",
    assignmentMandateDate: dto.assignmentMandateDate ?? "",
    deedDate: dto.deedDate ?? "",
    realEstateRegNumber: dto.realEstateRegNumber ?? "",
    realEstateRegDate: dto.realEstateRegDate ?? "",
    ownerName: dto.ownerName ?? "",
    deedKind: dto.deedKind ?? "",
    suggestedDeedKind: dto.suggestedDeedKind ?? "",
    ownersJson: dto.owners?.length ? JSON.stringify(dto.owners) : "",
    ownershipType: dto.ownershipType ?? "",
    suggestedOwnershipType: dto.suggestedOwnershipType ?? "",
    ownershipTypeIsManual: Boolean(dto.ownershipTypeIsManual),
    restrictionsPresent: dto.restrictionsPresent ?? "",
    restrictionType: dto.restrictionType ?? "",
    restrictionOtherReason: dto.restrictionOtherReason ?? "",
    boundariesAvailability: dto.boundariesAvailability ?? "",
    boundariesExternalDocName: dto.boundariesExternalDocName ?? "",
    northBoundary: dto.northBoundary ?? "",
    northBoundaryLengthM: dto.northBoundaryLengthM ?? "",
    northBoundaryType: dto.northBoundaryType ?? "",
    northFacadeFinishing: dto.northFacadeFinishing ?? "",
    southBoundary: dto.southBoundary ?? "",
    southBoundaryLengthM: dto.southBoundaryLengthM ?? "",
    southBoundaryType: dto.southBoundaryType ?? "",
    southFacadeFinishing: dto.southFacadeFinishing ?? "",
    eastBoundary: dto.eastBoundary ?? "",
    eastBoundaryLengthM: dto.eastBoundaryLengthM ?? "",
    eastBoundaryType: dto.eastBoundaryType ?? "",
    eastFacadeFinishing: dto.eastFacadeFinishing ?? "",
    westBoundary: dto.westBoundary ?? "",
    westBoundaryLengthM: dto.westBoundaryLengthM ?? "",
    westBoundaryType: dto.westBoundaryType ?? "",
    westFacadeFinishing: dto.westFacadeFinishing ?? "",
    city: dto.city ?? "",
    region: dto.region ?? "",
    district: dto.district ?? "",
    deedStatus: dto.deedStatus ?? "",
    area: dto.area ?? "",
    court: dto.court ?? "",
    circuit: dto.circuit ?? "",
    courtId: dto.courtId ?? "",
    circuitId: dto.circuitId ?? "",
    regionId: dto.regionId ?? "",
    cityId: dto.cityId ?? "",
    districtId: "",
    classification: dto.classification ?? "",
    propertyType: dto.propertyType ?? "",
    assignmentDocFileNames: dto.assignmentDocFileNames ?? [],
    delegationLetterFileNames: dto.delegationLetterFileNames ?? [],
    otherDocumentFileNames: dto.otherDocumentFileNames ?? [],
    realEstateRegFileName: dto.realEstateRegFileName ?? "",
    deedOwnershipFileName: dto.deedOwnershipFileName ?? "",
    bourseDeedImageFileName: dto.bourseDeedImageFileName ?? "",
    planNumber: dto.planNumber ?? "",
    planName: dto.planName ?? "",
    plotNumber: dto.plotNumber ?? "",
    blockNumber: dto.blockNumber ?? "",
    locationMapUrl: dto.locationMapUrl ?? "",
    finishingType: dto.finishingType ?? "",
    finishingStructure: dto.finishingStructure ?? "",
    bourseDataCompleted: dto.bourseDataCompleted ?? false,
    isRemoved: Boolean(dto.isRemoved),
    removalReason: dto.removalReason ?? "",
    removedAtUtc: dto.removedAtUtc ?? "",
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
    clientId: dto.clientId ?? "",
    reportUserClientIds: dto.reportUserClientIds ?? [],
    clientNameAr: dto.clientNameAr ?? undefined,
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
      "deed",
    ),
    requestNumber: prop.requestNumber.trim() || undefined,
    hasRequestNumber: prop.hasRequestNumber !== false,
    assignmentMandateNumber: prop.assignmentMandateNumber.trim() || undefined,
    assignmentMandateDate: prop.assignmentMandateDate.trim() || undefined,
    deedDate: prop.deedDate || undefined,
    realEstateRegNumber:
      normalizePropertyIdentifierNumber(
        prop.realEstateRegNumber,
        "real_estate_reg",
      ) || undefined,
    realEstateRegDate: prop.realEstateRegDate.trim() || undefined,
    ownerName: prop.ownerName || undefined,
    deedKind: prop.deedKind || undefined,
    city: prop.city.trim() || undefined,
    region: prop.region.trim() || undefined,
    district: prop.district.trim() || undefined,
    classification: prop.classification.trim() || undefined,
    propertyType: prop.propertyType.trim() || undefined,
    court: prop.court || undefined,
    circuit: prop.circuit || undefined,
    courtId: prop.courtId?.trim() || undefined,
    circuitId: prop.circuitId?.trim() || undefined,
    regionId: prop.regionId?.trim() || undefined,
    cityId: prop.cityId?.trim() || undefined,
    assignmentDocFileNames: prop.assignmentDocFileNames,
    delegationLetterFileNames: prop.delegationLetterFileNames,
    otherDocumentFileNames:
      prop.otherDocumentFileNames.length > 0
        ? prop.otherDocumentFileNames
        : undefined,
    realEstateRegFileName: prop.realEstateRegFileName || undefined,
    deedOwnershipFileName: prop.deedOwnershipFileName || undefined,
    bourseDeedImageFileName: prop.bourseDeedImageFileName || undefined,
    planNumber: prop.planNumber.trim() || undefined,
    planName: prop.planName.trim() || undefined,
    plotNumber: prop.plotNumber.trim() || undefined,
    blockNumber: prop.blockNumber.trim() || undefined,
    locationMapUrl: prop.locationMapUrl.trim() || undefined,
    finishingType: prop.finishingType.trim() || undefined,
    finishingStructure: prop.finishingStructure.trim() || undefined,
    bourseDataCompleted: prop.bourseDataCompleted,
    contacts: contactsForApi(prop.contacts),
  };
}

export function propertyToDto(prop: PoPropertyIntake): WorkOrderPropertyDto {
  return {
    ...propertyToEnfathDto(prop),
    restrictionsPresent: prop.restrictionsPresent || undefined,
    restrictionType: prop.restrictionType || undefined,
    restrictionOtherReason: prop.restrictionOtherReason || undefined,
    boundariesAvailability: prop.boundariesAvailability || undefined,
    boundariesExternalDocName: prop.boundariesExternalDocName || undefined,
    northBoundary: prop.northBoundary || undefined,
    northBoundaryLengthM: prop.northBoundaryLengthM || undefined,
    northBoundaryType: prop.northBoundaryType || undefined,
    northFacadeFinishing: prop.northFacadeFinishing || undefined,
    southBoundary: prop.southBoundary || undefined,
    southBoundaryLengthM: prop.southBoundaryLengthM || undefined,
    southBoundaryType: prop.southBoundaryType || undefined,
    southFacadeFinishing: prop.southFacadeFinishing || undefined,
    eastBoundary: prop.eastBoundary || undefined,
    eastBoundaryLengthM: prop.eastBoundaryLengthM || undefined,
    eastBoundaryType: prop.eastBoundaryType || undefined,
    eastFacadeFinishing: prop.eastFacadeFinishing || undefined,
    westBoundary: prop.westBoundary || undefined,
    westBoundaryLengthM: prop.westBoundaryLengthM || undefined,
    westBoundaryType: prop.westBoundaryType || undefined,
    westFacadeFinishing: prop.westFacadeFinishing || undefined,
    planNumber: prop.planNumber || undefined,
    planName: prop.planName || undefined,
    plotNumber: prop.plotNumber || undefined,
    blockNumber: prop.blockNumber || undefined,
    locationMapUrl: prop.locationMapUrl || undefined,
    finishingType: prop.finishingType || undefined,
    finishingStructure: prop.finishingStructure || undefined,
    deedStatus: prop.deedStatus || undefined,
    area: prop.area || undefined,
    bourseDeedImageFileName: prop.bourseDeedImageFileName || undefined,
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
    region: prop.region.trim() || undefined,
    regionId: prop.regionId.trim() || undefined,
    cityId: prop.cityId.trim() || undefined,
    district: prop.district.trim(),
    classification: prop.classification.trim(),
    propertyType: prop.propertyType.trim(),
    area: prop.area || undefined,
    deedStatus: prop.deedStatus || undefined,
    bourseDeedImageFileName: prop.bourseDeedImageFileName || undefined,
    owners: parseOwnersDraft(prop.ownersJson),
    ownershipType: prop.ownershipTypeIsManual ? prop.ownershipType || undefined : undefined,
    ownershipTypeIsManual: prop.ownershipTypeIsManual,
    restrictionsPresent: prop.restrictionsPresent || undefined,
    restrictionType: prop.restrictionType || undefined,
    restrictionOtherReason: prop.restrictionOtherReason || undefined,
    boundariesAvailability: prop.boundariesAvailability || undefined,
    boundariesExternalDocName: prop.boundariesExternalDocName || undefined,
    northBoundary: prop.northBoundary || undefined,
    northBoundaryLengthM: prop.northBoundaryLengthM || undefined,
    northBoundaryType: prop.northBoundaryType || undefined,
    northFacadeFinishing: prop.northFacadeFinishing || undefined,
    southBoundary: prop.southBoundary || undefined,
    southBoundaryLengthM: prop.southBoundaryLengthM || undefined,
    southBoundaryType: prop.southBoundaryType || undefined,
    southFacadeFinishing: prop.southFacadeFinishing || undefined,
    eastBoundary: prop.eastBoundary || undefined,
    eastBoundaryLengthM: prop.eastBoundaryLengthM || undefined,
    eastBoundaryType: prop.eastBoundaryType || undefined,
    eastFacadeFinishing: prop.eastFacadeFinishing || undefined,
    westBoundary: prop.westBoundary || undefined,
    westBoundaryLengthM: prop.westBoundaryLengthM || undefined,
    westBoundaryType: prop.westBoundaryType || undefined,
    westFacadeFinishing: prop.westFacadeFinishing || undefined,
  };
}

/** §4ج-7 — parse the flat-draft owners JSON into API rows (invalid JSON → undefined). */
export function parseOwnersDraft(
  ownersJson: string,
): { name: string; sharePct?: number | null }[] | undefined {
  const raw = ownersJson.trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { name?: string; sharePct?: number | null }[];
    if (!Array.isArray(parsed)) return undefined;
    const rows = parsed
      .map((o) => ({
        name: String(o?.name ?? "").trim(),
        sharePct: o?.sharePct == null ? null : Number(o.sharePct),
      }))
      .filter((o) => o.name !== "");
    return rows.length > 0 ? rows : undefined;
  } catch {
    return undefined;
  }
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
    clientId: record.clientId.trim(),
    reportUserClientIds: record.reportUserClientIds ?? [],
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
  const slots = await syncTaskSlotsForPo(saved);
  if (!slots.ok) {
    return { ok: false, error: slots.error };
  }
  notifyWorkOrdersChanged();
  return { ok: true, data: saved };
}

export async function poRecordExists(poNumber: string): Promise<boolean> {
  const config = workOrdersApiConfig();
  if (!config) return false;
  const result = await workOrderExists(config, poNumber);
  return result.ok ? result.data : false;
}

function isGuidPropertyId(value: string | undefined | null): value is string {
  const v = value?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

export async function findPriorDeedFull(
  deedNumber: string,
  excludePo?: string,
  excludePropertyId?: string,
): Promise<PriorDeedRegistrationDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const deed = normalizeDeedNumber(deedNumber) || deedNumber.trim();
  if (!deed) return null;
  // Only forward real GUIDs — bad excludePropertyId causes 400 on the API.
  const safeExcludePropertyId = isGuidPropertyId(excludePropertyId)
    ? excludePropertyId.trim()
    : undefined;
  const result = await findPriorDeed(
    config,
    deedNumber.trim() || deed,
    excludePo,
    safeExcludePropertyId,
  );
  if (!result.ok) {
    if (result.kind === "auth") {
      throw new Error("يجب تسجيل الدخول للبحث عن المعاملة السابقة");
    }
    if (result.kind === "forbidden") {
      throw new Error("غير مصرح لك بالبحث عن تسجيل سابق لنفس الصك");
    }
    if (result.kind === "network") {
      throw new Error("تعذّر الاتصال — تحقق من تشغيل الـ API");
    }
    throw new Error("تعذّر البحث عن المعاملة السابقة لنفس رقم الصك");
  }
  return result.data;
}

/** Full prior-study history for a deed (newest first). */
export async function listPriorDeedsFull(
  deedNumber: string,
  excludePo?: string,
  excludePropertyId?: string,
  take = 20,
): Promise<PriorDeedRegistrationDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const deed = deedNumber.trim();
  if (!deed) return [];
  const safeExcludePropertyId = isGuidPropertyId(excludePropertyId)
    ? excludePropertyId.trim()
    : undefined;
  const result = await listPriorDeeds(
    config,
    deed,
    excludePo,
    safeExcludePropertyId,
    take,
  );
  if (!result.ok) {
    if (result.kind === "auth") {
      throw new Error("يجب تسجيل الدخول للبحث عن المعاملة السابقة");
    }
    if (result.kind === "forbidden") {
      throw new Error("غير مصرح لك بالبحث عن تسجيل سابق لنفس الصك");
    }
    if (result.kind === "network") {
      throw new Error("تعذّر الاتصال — تحقق من تشغيل الـ API");
    }
    throw new Error("تعذّر تحميل سجل الدراسات السابقة لنفس رقم الصك");
  }
  return result.data;
}

export type CopyPriorScope = "enfath" | "bourse";

export type CopyPriorTarget =
  | { kind: "property"; propertyId: string }
  | { kind: "empty-slot"; taskId: string };

export type CopyPriorTargetOption = {
  key: string;
  label: string;
  target: CopyPriorTarget;
  hasExistingData: boolean;
};

/** Targets on the current PO: existing properties + empty enfath slots. */
export function buildCopyPriorTargetOptions(
  record: PoIntakeRecord,
  tasks: WorkflowTask[],
): CopyPriorTargetOption[] {
  const po = record.poNumber.trim();
  const options: CopyPriorTargetOption[] = [];

  for (const prop of record.properties) {
    if (prop.isRemoved) continue;
    const deed = formatPropertyDeedDisplay(prop);
    options.push({
      key: `property:${prop.id}`,
      label: deed !== "—" ? deed : `عقار ${prop.id.slice(0, 8)}`,
      target: { kind: "property", propertyId: prop.id },
      hasExistingData: Boolean(
        prop.deedNumber.trim() ||
          prop.ownerName.trim() ||
          prop.requestNumber.trim(),
      ),
    });
  }

  const emptySlots = tasks
    .filter(
      (t) =>
        t.kind === "case-study-property" &&
        t.poNumber.trim() === po &&
        !t.propertyId?.trim(),
    )
    .sort((a, b) => a.propertyOrdinal - b.propertyOrdinal);

  const total = Math.max(
    1,
    record.expectedPropertyCount ?? emptySlots.length,
    ...emptySlots.map((s) => s.propertyOrdinal),
  );

  for (const slot of emptySlots) {
    options.push({
      key: `slot:${slot.id}`,
      label: `خانة ${slot.propertyOrdinal}/${total}`,
      target: { kind: "empty-slot", taskId: slot.id },
      hasExistingData: false,
    });
  }

  return options;
}

/**
 * Full prior-study clone onto the current property slot: every field the prior
 * registration carries (enfath + bourse + document file names). Soft-delete and
 * id stay on the current slot. Bourse stays unconfirmed until this transaction
 * completes its own bourse phase. Callers should also run
 * {@link clonePropertyDocumentsFromPrior} so PDF bytes are re-attached.
 */
export function buildPropertyFromPriorDeed(
  existing: PoPropertyIntake,
  prior: PriorDeedRegistrationDto,
): PoPropertyIntake {
  const deed =
    existing.deedNumber.trim() ||
    (prior.deedNumber ?? "").trim() ||
    "";
  const filled = priorDeedToPropertyIntake(prior, deed, "bourse");
  const priorMandate = (prior.assignmentMandateNumber ?? "").trim();
  const priorRequest = (prior.requestNumber ?? "").trim();
  return {
    ...filled,
    id: existing.id,
    deedNumber: deed || filled.deedNumber,
    requestNumber: priorRequest || filled.requestNumber,
    hasRequestNumber:
      prior.hasRequestNumber === false && !priorRequest
        ? false
        : true,
    assignmentMandateNumber: priorMandate || filled.assignmentMandateNumber,
    assignmentMandateDate:
      (prior.assignmentMandateDate ?? "").trim() || filled.assignmentMandateDate,
    realEstateRegNumber:
      (prior.realEstateRegNumber ?? "").trim() ||
      existing.realEstateRegNumber.trim() ||
      filled.realEstateRegNumber ||
      "",
    realEstateRegDate:
      (prior.realEstateRegDate ?? "").trim() ||
      existing.realEstateRegDate.trim() ||
      filled.realEstateRegDate ||
      "",
    assignmentDocFileNames: listFromPrior(
      prior.assignmentDocFileNames,
      filled.assignmentDocFileNames,
    ),
    delegationLetterFileNames: listFromPrior(
      prior.delegationLetterFileNames,
      filled.delegationLetterFileNames,
    ),
    otherDocumentFileNames: listFromPrior(
      prior.otherDocumentFileNames,
      filled.otherDocumentFileNames,
    ),
    realEstateRegFileName:
      (prior.realEstateRegFileName ?? "").trim() ||
      filled.realEstateRegFileName ||
      "",
    deedOwnershipFileName:
      (prior.deedOwnershipFileName ?? "").trim() ||
      filled.deedOwnershipFileName ||
      "",
    bourseDeedImageFileName:
      (prior.bourseDeedImageFileName ?? "").trim() ||
      filled.bourseDeedImageFileName ||
      "",
    bourseDataCompleted: false,
    isRemoved: existing.isRemoved,
    removalReason: existing.removalReason,
    removedAtUtc: existing.removedAtUtc,
  };
}

function listFromPrior(
  fromPrior: string[] | undefined,
  fallback: string[],
): string[] {
  if (fromPrior?.length) {
    return fromPrior.map((n) => n.trim()).filter(Boolean);
  }
  return fallback;
}

/** Map prior deed lookup into a new property draft for the current PO. */
export function priorDeedToPropertyIntake(
  prior: PriorDeedRegistrationDto,
  deedNumber: string,
  scope: CopyPriorScope,
): PoPropertyIntake {
  const base = emptyProperty();
  const identifierType = parsePropertyIdentifierType(prior.identifierType);
  const contacts =
    prior.contacts?.length &&
    prior.contacts.some((c) => (c.name ?? "").trim() || (c.phone ?? "").trim())
      ? prior.contacts.map((c) => ({
          name: c.name ?? "",
          role: c.role ?? "",
          phone: c.phone ?? "",
        }))
      : base.contacts;

  const assignmentDocs = listFromPrior(prior.assignmentDocFileNames, []);
  const delegationDocs = listFromPrior(prior.delegationLetterFileNames, []);
  const otherDocs = listFromPrior(prior.otherDocumentFileNames, []);
  const regFile = (prior.realEstateRegFileName ?? "").trim();
  const deedOwnershipFile = (prior.deedOwnershipFileName ?? "").trim();
  const bourseDeedImageFile = (prior.bourseDeedImageFileName ?? "").trim();

  const enfath: PoPropertyIntake = {
    ...base,
    identifierType,
    deedNumber: (prior.deedNumber ?? deedNumber).trim() || deedNumber.trim(),
    requestNumber: prior.requestNumber?.trim() ?? "",
    hasRequestNumber: prior.hasRequestNumber !== false,
    assignmentMandateNumber: prior.assignmentMandateNumber?.trim() ?? "",
    assignmentMandateDate: prior.assignmentMandateDate?.trim() ?? "",
    deedDate: prior.deedDate?.trim() ?? "",
    ownerName: prior.ownerName?.trim() ?? "",
    court: prior.court?.trim() ?? "",
    circuit: prior.circuit?.trim() ?? "",
    courtId: prior.courtId?.trim() ?? "",
    circuitId: prior.circuitId?.trim() ?? "",
    planNumber: prior.planNumber?.trim() ?? "",
    planName: prior.planName?.trim() ?? "",
    plotNumber: prior.plotNumber?.trim() ?? "",
    blockNumber: prior.blockNumber?.trim() ?? "",
    locationMapUrl: prior.locationMapUrl?.trim() ?? "",
    finishingType: prior.finishingType?.trim() ?? "",
    finishingStructure: prior.finishingStructure?.trim() ?? "",
    realEstateRegNumber: prior.realEstateRegNumber?.trim() ?? "",
    realEstateRegDate: prior.realEstateRegDate?.trim() ?? "",
    contacts,
    assignmentDocFileNames: assignmentDocs,
    delegationLetterFileNames: delegationDocs,
    otherDocumentFileNames: otherDocs,
    realEstateRegFileName: regFile,
    deedOwnershipFileName: deedOwnershipFile,
    bourseDeedImageFileName: bourseDeedImageFile,
    bourseDataCompleted: false,
  };

  if (scope === "enfath") return enfath;

  return {
    ...enfath,
    city: prior.city?.trim() ?? "",
    region: prior.region?.trim() ?? "",
    regionId: prior.regionId?.trim() ?? "",
    cityId: prior.cityId?.trim() ?? "",
    district: prior.district?.trim() ?? "",
    districtId: "",
    classification: prior.classification?.trim() ?? "",
    propertyType: prior.propertyType?.trim() ?? "",
    area: prior.area?.trim() ?? "",
    deedStatus: prior.deedStatus?.trim() ?? "",
    restrictionsPresent: prior.restrictionsPresent?.trim() ?? "",
    restrictionType: prior.restrictionType?.trim() ?? "",
    restrictionOtherReason: prior.restrictionOtherReason?.trim() ?? "",
    boundariesAvailability: prior.boundariesAvailability?.trim() ?? "",
    boundariesExternalDocName: prior.boundariesExternalDocName?.trim() ?? "",
    northBoundary: prior.northBoundary?.trim() ?? "",
    northBoundaryLengthM: prior.northBoundaryLengthM?.trim() ?? "",
    northBoundaryType: prior.northBoundaryType?.trim() ?? "",
    northFacadeFinishing: prior.northFacadeFinishing?.trim() ?? "",
    southBoundary: prior.southBoundary?.trim() ?? "",
    southBoundaryLengthM: prior.southBoundaryLengthM?.trim() ?? "",
    southBoundaryType: prior.southBoundaryType?.trim() ?? "",
    southFacadeFinishing: prior.southFacadeFinishing?.trim() ?? "",
    eastBoundary: prior.eastBoundary?.trim() ?? "",
    eastBoundaryLengthM: prior.eastBoundaryLengthM?.trim() ?? "",
    eastBoundaryType: prior.eastBoundaryType?.trim() ?? "",
    eastFacadeFinishing: prior.eastFacadeFinishing?.trim() ?? "",
    westBoundary: prior.westBoundary?.trim() ?? "",
    westBoundaryLengthM: prior.westBoundaryLengthM?.trim() ?? "",
    westBoundaryType: prior.westBoundaryType?.trim() ?? "",
    westFacadeFinishing: prior.westFacadeFinishing?.trim() ?? "",
    assignmentDocFileNames: assignmentDocs,
    delegationLetterFileNames: delegationDocs,
    otherDocumentFileNames: otherDocs,
    realEstateRegFileName: regFile,
    deedOwnershipFileName: deedOwnershipFile,
    bourseDeedImageFileName: bourseDeedImageFile,
    bourseDataCompleted: false,
  };
}

function mergePriorOntoExisting(
  existing: PoPropertyIntake,
  draft: PoPropertyIntake,
  scope: CopyPriorScope,
): PoPropertyIntake {
  if (scope === "enfath") {
    return {
      ...existing,
      identifierType: draft.identifierType,
      deedNumber: draft.deedNumber,
      requestNumber: draft.requestNumber,
      hasRequestNumber: draft.hasRequestNumber,
      assignmentMandateNumber: draft.assignmentMandateNumber,
      assignmentMandateDate: draft.assignmentMandateDate,
      deedDate: draft.deedDate,
      ownerName: draft.ownerName,
      court: draft.court,
      circuit: draft.circuit,
      courtId: draft.courtId || existing.courtId,
      circuitId: draft.circuitId || existing.circuitId,
      regionId: draft.regionId || existing.regionId,
      cityId: draft.cityId || existing.cityId,
      planNumber: draft.planNumber,
      plotNumber: draft.plotNumber,
      locationMapUrl: draft.locationMapUrl,
      contacts: draft.contacts,
      assignmentDocFileNames: draft.assignmentDocFileNames,
      delegationLetterFileNames: draft.delegationLetterFileNames,
      otherDocumentFileNames: draft.otherDocumentFileNames,
      realEstateRegFileName: draft.realEstateRegFileName,
      deedOwnershipFileName: draft.deedOwnershipFileName,
      bourseDeedImageFileName: draft.bourseDeedImageFileName,
      realEstateRegNumber: draft.realEstateRegNumber || existing.realEstateRegNumber,
      realEstateRegDate: draft.realEstateRegDate || existing.realEstateRegDate,
    };
  }
  return {
    ...draft,
    id: existing.id,
    courtId: draft.courtId || existing.courtId,
    circuitId: draft.circuitId || existing.circuitId,
    regionId: draft.regionId || existing.regionId,
    cityId: draft.cityId || existing.cityId,
    districtId: draft.districtId || existing.districtId,
    bourseDataCompleted: false,
  };
}

async function finishBourseIfNeeded(
  poNumber: string,
  propertyId: string,
  draft: PoPropertyIntake,
  prior: import("@platform/api-client").PriorDeedRegistrationDto,
  scope: CopyPriorScope,
  primaryResult: StorageOk<PoPropertyIntake>,
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  if (scope !== "bourse") return primaryResult;
  if (skipsBourseForIdentifier(draft.identifierType)) return primaryResult;
  if (!hasBourseDetailFields(draft) && !prior.bourseDataCompleted) {
    return primaryResult;
  }

  const withId: PoPropertyIntake = {
    ...draft,
    id: propertyId,
    bourseDataCompleted: true,
  };
  const completed = await completePropertyBourse(poNumber, propertyId, withId);
  if (!completed.ok) {
    return {
      ok: false,
      error:
        completed.error ||
        "تم نسخ البيانات الأولية، لكن تعذّر إكمال بيانات البورصة",
      errors: completed.errors,
    };
  }
  return completed;
}

/**
 * Copy primary (and optionally bourse) fields from a prior deed onto a target
 * property or empty slot on the current PO.
 */
export async function copyPropertyFromPriorTransaction(
  poNumber: string,
  prior: import("@platform/api-client").PriorDeedRegistrationDto,
  deedNumber: string,
  scope: CopyPriorScope,
  target: CopyPriorTarget,
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  const draft = priorDeedToPropertyIntake(prior, deedNumber, scope);

  if (target.kind === "empty-slot") {
    const added = await addPropertyToPo(poNumber, draft, {
      assignToTaskId: target.taskId,
    });
    if (!added.ok) return added;
    const withDocs = await applyClonedDocuments(
      prior,
      poNumber,
      added.data.id,
      { ...draft, id: added.data.id },
    );
    // Persist cloned file names (and re-echo mandate/request) after attachment clone.
    const saved = await updatePropertyInPo(poNumber, added.data.id, withDocs);
    if (!saved.ok) return saved;
    return finishBourseIfNeeded(
      poNumber,
      added.data.id,
      withDocs,
      prior,
      scope,
      saved,
    );
  }

  const record = await getPoRecord(poNumber);
  const existing = record?.properties.find((p) => p.id === target.propertyId);
  if (!existing) {
    return { ok: false, error: "العقار المستهدف غير موجود في أمر العمل" };
  }
  if (existing.isRemoved) {
    return { ok: false, error: "لا يمكن النسخ إلى عقار محذوف" };
  }

  const merged = mergePriorOntoExisting(existing, draft, scope);
  const withDocs = await applyClonedDocuments(
    prior,
    poNumber,
    target.propertyId,
    { ...merged, id: target.propertyId },
  );
  const updated = await updatePropertyInPo(poNumber, target.propertyId, withDocs);
  if (!updated.ok) return updated;

  return finishBourseIfNeeded(
    poNumber,
    target.propertyId,
    withDocs,
    prior,
    scope,
    updated,
  );
}

async function applyClonedDocuments(
  prior: import("@platform/api-client").PriorDeedRegistrationDto,
  targetPo: string,
  targetPropertyId: string,
  draft: PoPropertyIntake,
): Promise<PoPropertyIntake> {
  const sourcePo = prior.poNumber?.trim() ?? "";
  const sourceId = prior.propertyId?.trim() ?? "";
  if (!sourcePo || !sourceId || !targetPo.trim() || !targetPropertyId.trim()) {
    return draft;
  }
  try {
    const { clonePropertyDocumentsFromPrior } = await import(
      "./assignment-doc-attachments"
    );
    const cloned = await clonePropertyDocumentsFromPrior(
      sourcePo,
      sourceId,
      targetPo,
      targetPropertyId,
    );
    return {
      ...draft,
      assignmentDocFileNames:
        cloned.assignmentDocFileNames.length > 0
          ? cloned.assignmentDocFileNames
          : draft.assignmentDocFileNames,
      delegationLetterFileNames:
        cloned.delegationLetterFileNames.length > 0
          ? cloned.delegationLetterFileNames
          : draft.delegationLetterFileNames,
      otherDocumentFileNames:
        cloned.otherDocumentFileNames.length > 0
          ? cloned.otherDocumentFileNames
          : draft.otherDocumentFileNames,
      realEstateRegFileName:
        cloned.realEstateRegFileName || draft.realEstateRegFileName,
      deedOwnershipFileName:
        cloned.deedOwnershipFileName || draft.deedOwnershipFileName,
      bourseDeedImageFileName:
        cloned.bourseDeedImageFileName || draft.bourseDeedImageFileName,
    };
  } catch {
    return draft;
  }
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
  const advanced = await advanceTaskAfterBourseForProperty(poNumber, propertyId, saved);
  if (advanced && !advanced.ok) {
    return { ok: false, error: advanced.error };
  }
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
  if (!result.ok) {
    if (result.kind === "not_found") return null;
    throw new Error(
      resolveApiError(result.kind, result.errors, "تعذّر تحميل أمر العمل"),
    );
  }
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
  const failuresDeleted = await deleteFailuresForPo(poNumber);
  if (!failuresDeleted) {
    return {
      ok: false,
      error: "تم حذف أمر العمل لكن تعذّر حذف سجلات التعذرات المرتبطة",
    };
  }
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
    clientId: record.clientId.trim(),
    reportUserClientIds: record.reportUserClientIds ?? [],
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
  const syncTarget = full
    ? {
        ...full,
        expectedPropertyCount: saved.expectedPropertyCount,
        assignmentType: saved.assignmentType,
        promulgationDate: saved.promulgationDate,
        assignmentSpecialist: saved.assignmentSpecialist,
        assignmentSpecialistEmail: saved.assignmentSpecialistEmail,
      }
    : { ...record, ...saved, properties: record.properties };
  const slots = await syncTaskSlotsForPo(syncTarget);
  if (!slots.ok) {
    return { ok: false, error: slots.error };
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
    (p) =>
      !p.isRemoved &&
      p.deedNumber.trim() === n &&
      p.id !== excludePropertyId,
  );
}

export async function addPropertyToPo(
  poNumber: string,
  property: PoPropertyIntake,
  options?: { assignToTaskId?: string },
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const provisionalId = property.id?.trim() ?? "";
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

  let prop = dtoToProperty(result.data);

  // Re-clone prior PDFs under the real server property id when auto-fill ran first.
  if (provisionalId && provisionalId !== prop.id) {
    try {
      const { completePendingPriorDocumentClone } = await import(
        "./assignment-doc-attachments"
      );
      const recloned = await completePendingPriorDocumentClone(
        provisionalId,
        poNumber,
        prop.id,
      );
      if (recloned) {
        prop = {
          ...prop,
          assignmentDocFileNames:
            recloned.assignmentDocFileNames.length > 0
              ? recloned.assignmentDocFileNames
              : prop.assignmentDocFileNames,
          delegationLetterFileNames:
            recloned.delegationLetterFileNames.length > 0
              ? recloned.delegationLetterFileNames
              : prop.delegationLetterFileNames,
          otherDocumentFileNames:
            recloned.otherDocumentFileNames.length > 0
              ? recloned.otherDocumentFileNames
              : prop.otherDocumentFileNames,
          realEstateRegFileName:
            recloned.realEstateRegFileName || prop.realEstateRegFileName,
          deedOwnershipFileName:
            recloned.deedOwnershipFileName || prop.deedOwnershipFileName,
          bourseDeedImageFileName:
            recloned.bourseDeedImageFileName || prop.bourseDeedImageFileName,
        };
        const resaved = await updatePropertyInPo(poNumber, prop.id, {
          ...property,
          ...prop,
          id: prop.id,
        });
        if (resaved.ok) prop = resaved.data;
      }
    } catch {
      /* file names from insert DTO still apply */
    }
  }

  const record = await getPoRecord(poNumber);
  if (options?.assignToTaskId) {
    const advanced = await advanceTaskAfterEnfath(options.assignToTaskId, prop);
    if (!advanced.ok) {
      return { ok: false, error: advanced.error };
    }
  } else if (record) {
    const linked = await linkNewPropertyToTaskSlot(record, prop);
    if (linked && !linked.ok) {
      return { ok: false, error: linked.error };
    }
  }
  notifyWorkOrdersChanged();
  return { ok: true, data: prop };
}

export async function removePropertyFromPo(
  poNumber: string,
  propertyId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "سبب الحذف مطلوب" };

  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await deleteWorkOrderProperty(
    config,
    poNumber,
    propertyId,
    trimmed,
  );
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
  if (property.isRemoved) {
    return { ok: false, error: "لا يمكن تعديل عقار محذوف" };
  }
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

/** Informal unlock — inspector/specialist without full property edit rights. */
export async function updatePropertyLocationMapUrlInPo(
  poNumber: string,
  propertyId: string,
  locationMapUrl: string,
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await updateWorkOrderPropertyLocationMapUrl(
    config,
    poNumber,
    propertyId,
    locationMapUrl,
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
  clientId: string;
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
    clientId: draft.clientId,
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
  clientId?: string;
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
    clientId: dto.clientId ?? "",
  };
}

async function persistPoDraft(draft: PoIntakeDraftPayload): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config) {
    notifyPoDraftSaveFailed(apiErrorMessage("auth"));
    return;
  }
  const result = await savePoIntakeDraft(config, draftToDto(draft));
  if (!result.ok) {
    notifyPoDraftSaveFailed(
      apiErrorMessage(result.kind, "تعذّر حفظ مسودة أمر العمل"),
    );
  }
}

export const PO_INTAKE_DRAFT_SAVE_FAILED_EVENT = "po-intake-draft-save-failed";

function notifyPoDraftSaveFailed(error: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PO_INTAKE_DRAFT_SAVE_FAILED_EVENT, {
      detail: { error },
    }),
  );
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
    if (!result.ok) {
      if (result.kind === "not_found") {
        memoryDraft = null;
        return null;
      }
      throw new Error(
        resolveApiError(result.kind, undefined, "تعذّر تحميل مسودة أمر العمل"),
      );
    }
    if (result.data) {
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
      businessDaysForAssignmentType(fields.assignmentType),
    ),
    receivedFromEnfathTime: fields.receivedFromEnfathTime ?? "",
    createdAtUtc: new Date().toISOString(),
  };
}
