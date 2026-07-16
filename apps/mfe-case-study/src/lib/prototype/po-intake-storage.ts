import type {
  AssignmentType,
  PoIntakeRecord,
  PoPropertyIntake,
} from "./po-intake-data";
import { classificationRequiresSurvey, computeBusinessDueDate, emptyProperty, formatPropertyDeedDisplay, hasBourseDetailFields, normalizePropertyIdentifierNumber, parsePropertyIdentifierType, skipsBourseForIdentifier,} from "./po-intake-data";
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
  type WorkflowTask,
} from "./tasks-storage";
import {
  resolvePropertyStatusFromTasks,
  resolvePropertyTrackStagesFromTasks,
} from "./property-list-status";
import type { PropertyRow } from "@platform/app-shared/prototype/constants";
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
  updateWorkOrderPropertyLocationMapUrl,
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
    requestNumber: dto.requestNumber ?? "",
    assignmentMandateNumber: dto.assignmentMandateNumber ?? "",
    assignmentMandateDate: dto.assignmentMandateDate ?? "",
    deedDate: dto.deedDate ?? "",
    ownerName: dto.ownerName ?? "",
    restrictionsPresent: dto.restrictionsPresent ?? "",
    restrictionType: dto.restrictionType ?? "",
    restrictionOtherReason: dto.restrictionOtherReason ?? "",
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
    assignmentDocFileNames: dto.assignmentDocFileNames ?? [],
    delegationLetterFileNames: dto.delegationLetterFileNames ?? [],
    otherDocumentFileNames: dto.otherDocumentFileNames ?? [],
    realEstateRegFileName: dto.realEstateRegFileName ?? "",
    planNumber: dto.planNumber ?? "",
    plotNumber: dto.plotNumber ?? "",
    locationMapUrl: dto.locationMapUrl ?? "",
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
    requestNumber: prop.requestNumber.trim() || undefined,
    assignmentMandateNumber: prop.assignmentMandateNumber.trim() || undefined,
    assignmentMandateDate: prop.assignmentMandateDate.trim() || undefined,
    deedDate: prop.deedDate || undefined,
    ownerName: prop.ownerName || undefined,
    city: prop.city.trim() || undefined,
    district: prop.district.trim() || undefined,
    classification: prop.classification.trim() || undefined,
    propertyType: prop.propertyType.trim() || undefined,
    court: prop.court || undefined,
    circuit: prop.circuit || undefined,
    assignmentDocFileNames: prop.assignmentDocFileNames,
    delegationLetterFileNames: prop.delegationLetterFileNames,
    otherDocumentFileNames:
      prop.otherDocumentFileNames.length > 0
        ? prop.otherDocumentFileNames
        : undefined,
    realEstateRegFileName: prop.realEstateRegFileName || undefined,
    planNumber: prop.planNumber.trim() || undefined,
    plotNumber: prop.plotNumber.trim() || undefined,
    locationMapUrl: prop.locationMapUrl.trim() || undefined,
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
    southBoundary: prop.southBoundary || undefined,
    southBoundaryLengthM: prop.southBoundaryLengthM || undefined,
    eastBoundary: prop.eastBoundary || undefined,
    eastBoundaryLengthM: prop.eastBoundaryLengthM || undefined,
    westBoundary: prop.westBoundary || undefined,
    westBoundaryLengthM: prop.westBoundaryLengthM || undefined,
    planNumber: prop.planNumber || undefined,
    plotNumber: prop.plotNumber || undefined,
    locationMapUrl: prop.locationMapUrl || undefined,
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
    restrictionType: prop.restrictionType || undefined,
    restrictionOtherReason: prop.restrictionOtherReason || undefined,
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

export async function findPriorDeedFull(
  deedNumber: string,
  excludePo?: string,
  excludePropertyId?: string,
): Promise<import("@platform/api-client").PriorDeedRegistrationDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await findPriorDeed(
    config,
    deedNumber,
    excludePo,
    excludePropertyId,
  );
  if (!result.ok || !result.data) return null;
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

/** Map prior deed lookup into a new property draft for the current PO. */
export function priorDeedToPropertyIntake(
  prior: import("@platform/api-client").PriorDeedRegistrationDto,
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

  const enfath: PoPropertyIntake = {
    ...base,
    identifierType,
    deedNumber: (prior.deedNumber ?? deedNumber).trim() || deedNumber.trim(),
    requestNumber: prior.requestNumber?.trim() ?? "",
    assignmentMandateNumber: prior.assignmentMandateNumber?.trim() ?? "",
    assignmentMandateDate: prior.assignmentMandateDate?.trim() ?? "",
    deedDate: prior.deedDate?.trim() ?? "",
    ownerName: prior.ownerName?.trim() ?? "",
    court: prior.court?.trim() ?? "",
    circuit: prior.circuit?.trim() ?? "",
    planNumber: prior.planNumber?.trim() ?? "",
    plotNumber: prior.plotNumber?.trim() ?? "",
    locationMapUrl: prior.locationMapUrl?.trim() ?? "",
    contacts,
    bourseDataCompleted: false,
  };

  if (scope === "enfath") return enfath;

  return {
    ...enfath,
    city: prior.city?.trim() ?? "",
    district: prior.district?.trim() ?? "",
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
    southBoundary: prior.southBoundary?.trim() ?? "",
    southBoundaryLengthM: prior.southBoundaryLengthM?.trim() ?? "",
    eastBoundary: prior.eastBoundary?.trim() ?? "",
    eastBoundaryLengthM: prior.eastBoundaryLengthM?.trim() ?? "",
    westBoundary: prior.westBoundary?.trim() ?? "",
    westBoundaryLengthM: prior.westBoundaryLengthM?.trim() ?? "",
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
      assignmentMandateNumber: draft.assignmentMandateNumber,
      assignmentMandateDate: draft.assignmentMandateDate,
      deedDate: draft.deedDate,
      ownerName: draft.ownerName,
      court: draft.court,
      circuit: draft.circuit,
      planNumber: draft.planNumber,
      plotNumber: draft.plotNumber,
      locationMapUrl: draft.locationMapUrl,
      contacts: draft.contacts,
    };
  }
  return {
    ...draft,
    id: existing.id,
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
    return finishBourseIfNeeded(
      poNumber,
      added.data.id,
      { ...draft, id: added.data.id },
      prior,
      scope,
      added,
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
  const updated = await updatePropertyInPo(poNumber, target.propertyId, merged);
  if (!updated.ok) return updated;

  return finishBourseIfNeeded(
    poNumber,
    target.propertyId,
    { ...merged, id: target.propertyId },
    prior,
    scope,
    updated,
  );
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
  tasks: WorkflowTask[] = [],
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

  const fromTasks = resolvePropertyStatusFromTasks(
    record.poNumber,
    prop.id,
    tasks,
  );
  const tracks = resolvePropertyTrackStagesFromTasks(
    record.poNumber,
    prop.id,
    tasks,
  );

  const status: PropertyRow["status"] = boursePending
    ? "progress"
    : isFailed
      ? "fail"
      : incomplete
        ? "incomplete"
        : fromTasks ??
          (underVerification ? "progress" : "new");

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
      : (tracks.survey ??
        (priorSurveyWaived(prop, priorByDeed) ? "done" : "new")),
    val: tracks.val ?? "new",
    study: boursePending
      ? "progress"
      : (tracks.study ??
        (underVerification ? "progress" : "new")),
    status,
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
    ),
    receivedFromEnfathTime: fields.receivedFromEnfathTime ?? "",
    createdAtUtc: new Date().toISOString(),
  };
}
