import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import { deleteFailuresForPo } from "@failures/mfe/lib/failures-repository";
import {
  advanceTaskAfterBourseForProperty,
  advanceTaskAfterEnfath,
  deleteTasksForPo,
  deleteTasksForProperty,
  linkNewPropertyToTaskSlot,
  loadWorkflowTasks,
  syncTaskSlotsForPo,
} from "./tasks-storage";
import type { PriorDeedRegistrationDto } from "@platform/api-client";
import {
  addWorkOrderProperty,
  cancelWorkOrder,
  completePropertyBourseData,
  createWorkOrder,
  deletePoIntakeDraft,
  deleteWorkOrder,
  deleteWorkOrderProperty,
  savePoIntakeDraft,
  stopWorkOrder,
  updateWorkOrderHeader,
  updateWorkOrderProperty,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import {
  bourseCompletionAdvancesTask,
  draftToDto,
  dtoToProperty,
  dtoToRecord,
  poIntakeDraftCache,
  propertyToBourseRequest,
  propertyToDto,
  propertyToEnfathDto,
  shouldCompleteBourseAfterPriorCopy,
  priorDeedToPropertyIntake,
  mergePriorOntoExisting,
  PO_INTAKE_DRAFT_SAVE_FAILED_EVENT,
  type CopyPriorScope,
  type CopyPriorTarget,
  type PoIntakeDraftPayload,
  type StorageError,
  type StorageOk,
} from "./po-intake-model";
import { getPoRecord } from "./po-intake-reads";
import {
  apiErrorMessage,
  notifyWorkOrdersChanged,
  resolveApiError,
  workOrdersApiConfig,
} from "../work-orders-api-config";

export async function savePoRecord(
  record: PoIntakeRecord,
  idempotencyKey?: string,
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
  }, idempotencyKey);

  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors),
      errors: result.errors,
    };
  }

  const saved = dtoToRecord(result.data);
  const slots = await syncTaskSlotsForPo(saved.poNumber);
  if (!slots.ok) {
    return { ok: false, error: slots.error };
  }
  notifyWorkOrdersChanged();
  return { ok: true, data: saved };
}

async function finishBourseIfNeeded(
  poNumber: string,
  propertyId: string,
  draft: PoPropertyIntake,
  prior: PriorDeedRegistrationDto,
  scope: CopyPriorScope,
  primaryResult: StorageOk<PoPropertyIntake>,
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  if (!shouldCompleteBourseAfterPriorCopy(scope, draft, prior)) {
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
  prior: PriorDeedRegistrationDto,
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
  prior: PriorDeedRegistrationDto,
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

export async function completePropertyBourse(
  poNumber: string,
  propertyId: string,
  property: PoPropertyIntake,
  idempotencyKey?: string,
): Promise<StorageOk<PoPropertyIntake> | StorageError> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const [result, tasks] = await Promise.all([
    completePropertyBourseData(
      config,
      poNumber,
      propertyId,
      propertyToBourseRequest(property),
      idempotencyKey,
    ),
    loadWorkflowTasks(),
  ]);
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, result.errors),
      errors: result.errors,
    };
  }

  const saved = dtoToProperty(result.data, poNumber);
  if (bourseCompletionAdvancesTask(saved)) {
    const advanced = await advanceTaskAfterBourseForProperty(
      poNumber,
      propertyId,
      saved,
      tasks,
    );
    if (advanced && !advanced.ok) {
      return { ok: false, error: advanced.error };
    }
  }
  notifyWorkOrdersChanged();
  return { ok: true, data: saved };
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
  const [, failuresDeleted] = await Promise.all([
    deleteTasksForPo(poNumber),
    deleteFailuresForPo(poNumber),
  ]);
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
  const slots = await syncTaskSlotsForPo(record.poNumber);
  if (!slots.ok) {
    return { ok: false, error: slots.error };
  }
  notifyWorkOrdersChanged();
  return { ok: true, data: saved };
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

  let prop = dtoToProperty(result.data, poNumber);

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

  if (options?.assignToTaskId) {
    const advanced = await advanceTaskAfterEnfath(options.assignToTaskId, prop);
    if (!advanced.ok) {
      return { ok: false, error: advanced.error };
    }
  } else {
    const linked = await linkNewPropertyToTaskSlot(poNumber, prop);
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
  return { ok: true, data: dtoToProperty(result.data, poNumber) };
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

function notifyPoDraftSaveFailed(error: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PO_INTAKE_DRAFT_SAVE_FAILED_EVENT, {
      detail: { error },
    }),
  );
}


export function savePoDraft(draft: PoIntakeDraftPayload): void {
  poIntakeDraftCache.memoryDraft = draft;
  if (poIntakeDraftCache.saveTimer) clearTimeout(poIntakeDraftCache.saveTimer);
  poIntakeDraftCache.saveTimer = setTimeout(() => {
    void persistPoDraft(draft);
  }, 400);
}

export async function clearPoDraft(): Promise<void> {
  poIntakeDraftCache.memoryDraft = null;
  poIntakeDraftCache.hydratePromise = null;
  if (poIntakeDraftCache.saveTimer) {
    clearTimeout(poIntakeDraftCache.saveTimer);
    poIntakeDraftCache.saveTimer = null;
  }

  const config = prototypeModulesApiConfig();
  if (config) await deletePoIntakeDraft(config);
}
