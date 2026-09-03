import type {
  AssignmentType,
  PoIntakeRecord,
  PoPropertyIntake,
} from "./po-intake-data";
import { computeBusinessDueDate, emptyProperty, formatPropertyDeedDisplay, hasBourseDetailFields, normalizePropertyIdentifierNumber, parsePropertyIdentifierType, skipsBourseForIdentifier, businessDaysForAssignmentType,} from "./po-intake-data";
import {
  contactsForApi,
} from "../domain/po-intake/property-validation";
import type { PriorDeedRegistrationDto,UpdatePropertyBourseRequest,WorkOrderDto,WorkOrderPropertyDto} from "@platform/api-client";
import { hydrateSpecialistReportExtrasFromApi } from "@platform/app-shared/storage/specialist-report-extras-sync";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";

const PROPERTY_DEFAULTS = emptyProperty();

export type StorageError = {
  ok: false;
  error: string;
  errors?: Record<string, string>;
};

export type StorageOk<T> = { ok: true; data: T };

export function normalizeProperty(prop: PoPropertyIntake): PoPropertyIntake {
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

export function normalizePoRecord(record: PoIntakeRecord): PoIntakeRecord {
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

export function dtoToProperty(
  dto: WorkOrderPropertyDto,
  poNumber?: string,
): PoPropertyIntake {
  const property = normalizeProperty({
    id: String(dto.id ?? ""),
    referenceNumber: dto.referenceNumber ?? null,
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
    partitionMinutesNumber: dto.partitionMinutesNumber ?? "",
    partitionMinutesDate: dto.partitionMinutesDate ?? "",
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
  if (property.id && poNumber) {
    hydrateSpecialistReportExtrasFromApi(
      property.id,
      poNumber,
      dto.specialistReportExtrasJson,
    );
  }
  return property;
}

export function dtoToRecord(dto: WorkOrderDto): PoIntakeRecord {
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
    properties: dto.properties.map((p) => dtoToProperty(p, dto.poNumber)),
  });
}

/** Map a page of work-order DTOs into intake records. */
export function mapWorkOrderDtosToPoRecords(dtos: WorkOrderDto[]): PoIntakeRecord[] {
  return dtos.map(dtoToRecord);
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
    partitionMinutesNumber: prop.partitionMinutesNumber.trim() || undefined,
    partitionMinutesDate: prop.partitionMinutesDate.trim() || undefined,
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
    partitionMinutesNumber: prop.partitionMinutesNumber || undefined,
    partitionMinutesDate: prop.partitionMinutesDate || undefined,
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


/** parse the flat-draft owners JSON into API rows (invalid JSON → undefined). */
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

export function isGuidPropertyId(value: string | undefined | null): value is string {
  const v = value?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
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
    partitionMinutesNumber: prior.partitionMinutesNumber?.trim() ?? "",
    partitionMinutesDate: prior.partitionMinutesDate?.trim() ?? "",
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

export function mergePriorOntoExisting(
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

/**
 * Bourse gate for a prior-transaction copy: only a bourse-scoped copy of an
 * identifier that goes through bourse, and only when the prior registration
 * actually carries bourse data, completes the bourse phase straight away.
 */
export function shouldCompleteBourseAfterPriorCopy(
  scope: CopyPriorScope,
  draft: PoPropertyIntake,
  prior: PriorDeedRegistrationDto,
): boolean {
  if (scope !== "bourse") return false;
  if (skipsBourseForIdentifier(draft.identifierType)) return false;
  return hasBourseDetailFields(draft) || Boolean(prior.bourseDataCompleted);
}

/**
 * A property whose boundaries are unavailable stays on the bourse stage — the
 * case-study task only moves to party distribution when they are.
 */
export function bourseCompletionAdvancesTask(
  property: PoPropertyIntake,
): boolean {
  return property.boundariesAvailability !== "no";
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

export function draftToDto(draft: PoIntakeDraftPayload) {
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

export function dtoToDraft(dto: {
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

export const PO_INTAKE_DRAFT_SAVE_FAILED_EVENT = "po-intake-draft-save-failed";

/**
 * PO-intake draft cache shared by the read side (hydration) and the write side
 * (debounced save / clear), so neither module has to import the other.
 */
export const poIntakeDraftCache: {
  memoryDraft: PoIntakeDraftPayload | null;
  saveTimer: ReturnType<typeof setTimeout> | null;
  hydratePromise: Promise<PoIntakeDraftPayload | null> | null;
} = {
  memoryDraft: null,
  saveTimer: null,
  hydratePromise: null,
};

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
