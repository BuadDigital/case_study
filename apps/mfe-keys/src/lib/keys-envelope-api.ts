import {
  confirmKeyEnvelopeAssignment,
  confirmKeyEnvelopeHandoff,
  createKeyEnvelope,
  createKeyEnvelopeHandoff,
  deleteKeyEnvelope,
  getKeyEnvelope,
  listKeyEnvelopeFeeReport,
  listKeyEnvelopeLinkedProperties,
  listKeyEnvelopes,
  listPropertyCourtAccess,
  markKeyReceiptFeeCollected,
  uploadAttachment,
  upsertPropertyCourtAccess,
  type CreateKeyEnvelopeHandoffRequest,
  type CreateKeyEnvelopeRequest,
  type KeyEnvelopeDto,
  type PropertyCourtAccessDto,
  type UpsertPropertyCourtAccessRequest,
} from "@platform/api-client";
import { apiErrorMessage, resolveApiError, type MutationResult, } from "@platform/app-shared/prototype/work-orders-api-config";
import { processEvidencePhoto } from "@platform/app-shared/media/process-evidence-photo";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";
import { currentOfflineUserId, isBrowserOffline, uploadAttachmentWithOfflineFallback } from "@platform/app-shared/offline/offline-write";
import { beginOfflineLease, enqueueOutbox, type OutboxKind } from "@platform/offline-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type {
  KeyAssignmentMatchStatus,
  KeyEnvelopeFeeReportRow,
  KeyEnvelopeLinkedProperty,
  KeyEnvelopeRow,
  PropertyCourtAccessRow,
} from "./keys-envelope-types";

function mapEnvelope(dto: KeyEnvelopeDto): KeyEnvelopeRow {
  return {
    id: dto.id,
    requestNumber: dto.requestNumber,
    referenceNumber: dto.referenceNumber ?? null,
    court: dto.court,
    circuit: dto.circuit,
    keysCountLabeled: dto.keysCountLabeled,
    keysCountActual: dto.keysCountActual,
    countMismatch: dto.countMismatch,
    receiptAttachmentId: dto.receiptAttachmentId,
    photoAttachmentId: dto.photoAttachmentId,
    thirdPartyLetterAttachmentId: dto.thirdPartyLetterAttachmentId,
    contactPhones: dto.contactPhones,
    notes: dto.notes,
    receiveScenario: dto.receiveScenario,
    status: dto.status,
    feeGenerated: dto.feeGenerated,
    feeAmountSar: dto.feeAmountSar,
    revenueEntitlementAtUtc: dto.revenueEntitlementAtUtc ?? null,
    createdByName: dto.createdByName,
    createdAtUtc: dto.createdAtUtc,
    operationsTaskId: dto.operationsTaskId ?? null,
    assignments: dto.assignments ?? [],
    handoffs: dto.handoffs ?? [],
    timeline: dto.timeline ?? [],
    linkedProperties: dto.linkedProperties ?? [],
  };
}

function mapAccess(dto: PropertyCourtAccessDto): PropertyCourtAccessRow {
  return { ...dto };
}

function fail(result: { kind: string; message?: string }, fallback: string) {
  return {
    ok: false as const,
    error: result.message ?? resolveApiError(result.kind, undefined, fallback),
  };
}

function pendingEnvelopeStub(
  body: CreateKeyEnvelopeRequest,
  clientId: string,
): KeyEnvelopeRow {
  const now = new Date().toISOString();
  return {
    id: clientId,
    requestNumber: body.requestNumber,
    court: body.court,
    circuit: body.circuit,
    keysCountLabeled: body.keysCountLabeled,
    keysCountActual: body.keysCountActual,
    countMismatch: body.keysCountLabeled !== body.keysCountActual,
    receiptAttachmentId: body.receiptAttachmentId,
    photoAttachmentId: body.photoAttachmentId,
    thirdPartyLetterAttachmentId: body.thirdPartyLetterAttachmentId,
    contactPhones: body.contactPhones,
    notes: body.notes,
    receiveScenario: body.receiveScenario ?? "court",
    status: "reviewer",
    feeGenerated: false,
    feeAmountSar: null,
    revenueEntitlementAtUtc: null,
    createdByName: "",
    createdAtUtc: now,
    operationsTaskId: body.operationsTaskId ?? null,
    assignments: [],
    handoffs: [],
    timeline: [],
    linkedProperties: [],
  };
}

async function enqueueKeyEnvelopeWrite(
  kind: OutboxKind,
  envelopeId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const userId = currentOfflineUserId();
  if (!userId) return false;
  await enqueueOutbox({
    userId,
    kind,
    targetId: envelopeId,
    payloadJson: JSON.stringify({ envelopeId, ...payload }),
  });
  await beginOfflineLease(userId);
  return true;
}

export async function loadKeyEnvelopes(): Promise<KeyEnvelopeRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];
  const result = await listKeyEnvelopes(config);
  if (!result.ok) return [];
  return result.data.map(mapEnvelope);
}

export async function loadKeyEnvelope(
  id: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await getKeyEnvelope(config, id);
  if (!result.ok) return fail(result, "تعذّر تحميل الظرف");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function removeKeyEnvelope(
  id: string,
): Promise<MutationResult<true>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await deleteKeyEnvelope(config, id);
  if (!result.ok) return fail(result, "تعذّر حذف الظرف");
  return { ok: true, data: true };
}

export async function loadKeyEnvelopeFeeReport(): Promise<KeyEnvelopeFeeReportRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];
  const result = await listKeyEnvelopeFeeReport(config);
  if (!result.ok) return [];
  return result.data;
}

export async function loadPropertyCourtAccess(
  requestNumber?: string,
): Promise<PropertyCourtAccessRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];
  const result = await listPropertyCourtAccess(config, requestNumber);
  if (!result.ok) return [];
  return result.data.map(mapAccess);
}

export async function fetchLinkedPropertiesByRequestNumber(
  requestNumber: string,
): Promise<MutationResult<KeyEnvelopeLinkedProperty[]>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const trimmed = requestNumber.trim();
  if (!trimmed) return { ok: false, error: "رقم الطلب مطلوب" };
  const result = await listKeyEnvelopeLinkedProperties(config, trimmed);
  if (!result.ok) return fail(result, "تعذّر تحميل العقارات المرتبطة");
  return { ok: true, data: result.data };
}

const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_BYTES = 1024 * 1024;

export async function uploadEnvelopeAttachment(
  kind:
    | "receipt"
    | "photo"
    | "third-party"
    | "handoff-letter"
    | "enabling"
    | "eviction",
  scopeKey: string,
  file: File,
): Promise<MutationResult<{ id: string; fileName: string }>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const scope =
    kind === "receipt"
      ? "key-envelope-receipt"
      : kind === "photo"
        ? "key-envelope-photo"
        : kind === "third-party"
          ? "key-envelope-third-party"
          : kind === "handoff-letter"
            ? "key-envelope-handoff-letter"
            : kind === "enabling"
              ? "property-enabling-letter"
              : "property-eviction-notice";

  let uploadFile = file;
  let photoMetadata:
    | {
        latitude: number | null;
        longitude: number | null;
        capturedAtUtc: string | null;
      }
    | undefined;

  if (kind === "photo") {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      return {
        ok: false,
        error: "الحجم الأقصى للصورة قبل المعالجة 20 ميجابايت.",
      };
    }
    try {
      const processed = await processEvidencePhoto(file);
      uploadFile = processed.file;
      photoMetadata = {
        latitude: processed.exif.latitude ?? null,
        longitude: processed.exif.longitude ?? null,
        capturedAtUtc: processed.exif.capturedAt ?? null,
      };
    } catch {
      return {
        ok: false,
        error: "تعذّر معالجة الصورة قبل الرفع. حاول بصيغة JPG.",
      };
    }
    if (uploadFile.size > MAX_PROCESSED_IMAGE_BYTES) {
      return {
        ok: false,
        error: "تعذّر ضغط الصورة إلى أقل من 1 ميجابايت.",
      };
    }
  }

  const bytes = await uploadFile.arrayBuffer();
  const offlineUpload = await uploadAttachmentWithOfflineFallback({
    scope,
    scopeKey: scopeKey.trim() || "draft",
    fileName: uploadFile.name,
    contentType: uploadFile.type || "application/octet-stream",
    bytes,
    onlineUpload: async () => {
      if (!config) throw new Error(apiErrorMessage("auth"));
      const upload = await uploadAttachment(config, {
        scope,
        scopeKey: scopeKey.trim() || "draft",
        fileName: uploadFile.name,
        contentType: uploadFile.type || "application/octet-stream",
        contentBase64: await fileToBase64(uploadFile),
        photoMetadata,
      });
      if (!upload.ok) {
        throw new Error(
          resolveApiError(upload.kind, undefined, "تعذّر رفع الملف"),
        );
      }
      return upload.data.id;
    },
  });

  return {
    ok: true,
    data: {
      id: offlineUpload.attachmentId,
      fileName: uploadFile.name,
    },
  };
}

export type CreateEnvelopeInput = {
  requestNumber: string;
  court: string;
  circuit: string;
  keysCountLabeled: number;
  keysCountActual: number;
  receiveScenario: string;
  receiptAttachmentId?: string;
  photoAttachmentId?: string;
  thirdPartyLetterAttachmentId?: string;
  contactPhones?: string;
  notes?: string;
  operationsTaskId?: string;
  assignments?: { deedNumber: string; propertyId?: string }[];
};

export async function registerKeyEnvelope(
  input: CreateEnvelopeInput,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  const body: CreateKeyEnvelopeRequest = {
    requestNumber: input.requestNumber.trim(),
    court: input.court.trim(),
    circuit: input.circuit.trim(),
    keysCountLabeled: input.keysCountLabeled,
    keysCountActual: input.keysCountActual,
    receiveScenario: input.receiveScenario,
    receiptAttachmentId: input.receiptAttachmentId ?? null,
    photoAttachmentId: input.photoAttachmentId ?? null,
    thirdPartyLetterAttachmentId: input.thirdPartyLetterAttachmentId ?? null,
    contactPhones: input.contactPhones?.trim() || null,
    notes: input.notes?.trim() || null,
    operationsTaskId: input.operationsTaskId?.trim() || null,
    assignments: input.assignments?.map((a) => ({
      deedNumber: a.deedNumber,
      propertyId: a.propertyId ?? null,
    })),
  };

  const userId = currentOfflineUserId();
  if ((!config || isBrowserOffline()) && userId) {
    const clientId = `local-pending:${crypto.randomUUID()}`;
    await enqueueOutbox({
      userId,
      kind: "key-envelope-create",
      targetId: clientId,
      payloadJson: JSON.stringify({ ...body, clientEnvelopeId: clientId }),
    });
    await beginOfflineLease(userId);
    return { ok: true, data: pendingEnvelopeStub(body, clientId) };
  }

  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  try {
    const result = await createKeyEnvelope(config, body);
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        const clientId = `local-pending:${crypto.randomUUID()}`;
        await enqueueOutbox({
          userId,
          kind: "key-envelope-create",
          targetId: clientId,
          payloadJson: JSON.stringify({ ...body, clientEnvelopeId: clientId }),
        });
        await beginOfflineLease(userId);
        return { ok: true, data: pendingEnvelopeStub(body, clientId) };
      }
      return fail(result, "تعذّر تسجيل الظرف");
    }
    return { ok: true, data: mapEnvelope(result.data) };
  } catch (err) {
    if (userId) {
      const clientId = `local-pending:${crypto.randomUUID()}`;
      await enqueueOutbox({
        userId,
        kind: "key-envelope-create",
        targetId: clientId,
        payloadJson: JSON.stringify({ ...body, clientEnvelopeId: clientId }),
      });
      await beginOfflineLease(userId);
      return { ok: true, data: pendingEnvelopeStub(body, clientId) };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر تسجيل الظرف",
    };
  }
}

export async function confirmEnvelopeAssignment(
  envelopeId: string,
  assignmentId: string,
  status: KeyAssignmentMatchStatus,
  notes?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  const body = { assignmentId, status, notes: notes ?? null };
  const userId = currentOfflineUserId();
  if ((!config || isBrowserOffline()) && userId) {
    await enqueueKeyEnvelopeWrite(
      "key-envelope-assignment-confirm",
      envelopeId,
      body,
    );
    return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
  }
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  try {
    const result = await confirmKeyEnvelopeAssignment(
      config,
      envelopeId,
      assignmentId,
      { status, notes: notes ?? null },
    );
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        await enqueueKeyEnvelopeWrite(
          "key-envelope-assignment-confirm",
          envelopeId,
          body,
        );
        return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
      }
      return fail(result, "تعذّر تحديث الإسناد");
    }
    return { ok: true, data: mapEnvelope(result.data) };
  } catch (err) {
    if (userId) {
      await enqueueKeyEnvelopeWrite(
        "key-envelope-assignment-confirm",
        envelopeId,
        body,
      );
      return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر تحديث الإسناد",
    };
  }
}

export async function createEnvelopeHandoff(
  envelopeId: string,
  body: CreateKeyEnvelopeHandoffRequest,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  const userId = currentOfflineUserId();
  if ((!config || isBrowserOffline()) && userId) {
    await enqueueKeyEnvelopeWrite("key-envelope-handoff-create", envelopeId, {
      ...body,
    });
    return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
  }
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  try {
    const result = await createKeyEnvelopeHandoff(config, envelopeId, body);
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        await enqueueKeyEnvelopeWrite("key-envelope-handoff-create", envelopeId, {
          ...body,
        });
        return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
      }
      return fail(result, "تعذّر تسجيل المناولة");
    }
    return { ok: true, data: mapEnvelope(result.data) };
  } catch (err) {
    if (userId) {
      await enqueueKeyEnvelopeWrite("key-envelope-handoff-create", envelopeId, {
        ...body,
      });
      return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر تسجيل المناولة",
    };
  }
}

export async function confirmEnvelopeHandoff(
  envelopeId: string,
  handoffId: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  const userId = currentOfflineUserId();
  if ((!config || isBrowserOffline()) && userId) {
    await enqueueKeyEnvelopeWrite("key-envelope-handoff-confirm", envelopeId, {
      handoffId,
    });
    return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
  }
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  try {
    const result = await confirmKeyEnvelopeHandoff(config, envelopeId, handoffId);
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        await enqueueKeyEnvelopeWrite("key-envelope-handoff-confirm", envelopeId, {
          handoffId,
        });
        return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
      }
      return fail(result, "تعذّر تأكيد المناولة");
    }
    return { ok: true, data: mapEnvelope(result.data) };
  } catch (err) {
    if (userId) {
      await enqueueKeyEnvelopeWrite("key-envelope-handoff-confirm", envelopeId, {
        handoffId,
      });
      return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر تأكيد المناولة",
    };
  }
}

export async function markEnvelopeFeeCollected(
  envelopeId: string,
  invoiceReference?: string,
): Promise<MutationResult<KeyEnvelopeFeeReportRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await markKeyReceiptFeeCollected(config, envelopeId, {
    invoiceReference,
  });
  if (!result.ok) return fail(result, "تعذّر تحديث حالة التحصيل");
  return { ok: true, data: result.data };
}

export async function savePropertyCourtAccess(
  body: UpsertPropertyCourtAccessRequest,
): Promise<MutationResult<PropertyCourtAccessRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await upsertPropertyCourtAccess(config, body);
  if (!result.ok) return fail(result, "تعذّر حفظ مسار الدخول");
  return { ok: true, data: mapAccess(result.data) };
}
