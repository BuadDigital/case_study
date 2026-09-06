/**
 * Replays the offline outbox against the API. Each handler maps one outbox
 * kind to its API call; failure classification (purge on auth rejection,
 * terminal vs. retryable) lives in `offline-sync-state`.
 */
import { syncOfflineQueue } from "@platform/app-shared/offline/offline-write";
import {
  purgeOfflineData,
  type OfflineSyncDeps,
} from "@platform/offline-client";
import {
  listAttachments,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  uploadAttachment,
  createKeyEnvelope,
  addKeyEnvelopeAssignment,
  confirmKeyEnvelopeAssignment,
  createKeyEnvelopeHandoff,
  confirmKeyEnvelopeHandoff,
  patchOperationsTask,
  addOperationsTaskComment,
  upsertPropertyCourtAccess,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { workOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";
import {
  arrayBufferToBase64,
  invalidPayloadFailure,
  isAuthRejected,
  matchExistingAttachment,
  parseReplayPayload,
  replayFailure,
  unauthenticatedReplayFailure,
  type ReplayFailure,
} from "@/components/offline-sync-state";

/** Purges the local store when the API rejected the session, then classifies. */
async function fail(
  userId: string,
  kind: string | undefined,
  error: string,
  validationTerminal = false,
): Promise<ReplayFailure> {
  if (isAuthRejected(kind)) {
    await purgeOfflineData(userId, "auth-rejected");
  }
  return replayFailure(kind, error, { validationTerminal });
}

function buildReplayDeps(userId: string): OfflineSyncDeps {
  const modulesConfig = prototypeModulesApiConfig();
  const workOrdersConfig = workOrdersApiConfig();
  return {
    uploadAttachment: async (input) => {
      if (!modulesConfig) return unauthenticatedReplayFailure();
      try {
        const existing = await listAttachments(
          modulesConfig,
          input.scope,
          input.scopeKey,
        );
        if (existing.ok) {
          const match = matchExistingAttachment(existing.data, {
            fileName: input.fileName,
            byteLength: input.bytes.byteLength,
          });
          if (match?.id) return { ok: true, attachmentId: match.id };
        }
      } catch {
        /* continue to upload */
      }
      const upload = await uploadAttachment(modulesConfig, {
        scope: input.scope,
        scopeKey: input.scopeKey,
        fileName: input.fileName,
        contentType: input.contentType,
        contentBase64: arrayBufferToBase64(input.bytes),
      });
      if (!upload.ok) return fail(userId, upload.kind, "تعذّر رفع المرفق");
      return { ok: true, attachmentId: upload.data.id };
    },
    saveSubmission: async (input) => {
      if (!workOrdersConfig) return unauthenticatedReplayFailure();
      const payload = parseReplayPayload<Record<string, unknown>>(
        input.payloadJson,
      );
      if (!payload) return invalidPayloadFailure("مسودة غير صالحة");
      const saveResult = await savePartyTaskSubmission(
        workOrdersConfig,
        input.taskId,
        payload,
      );
      if (!saveResult.ok) {
        return fail(userId, saveResult.kind, "تعذّر حفظ المسودة", true);
      }
      return { ok: true };
    },
    submitSubmission: async (input) => {
      if (!workOrdersConfig) return unauthenticatedReplayFailure();
      const submitResult = await submitPartyTaskSubmission(
        workOrdersConfig,
        input.taskId,
        input.idempotencyKey,
      );
      if (!submitResult.ok) {
        return fail(userId, submitResult.kind, "تعذّر إرسال المهمة", true);
      }
      return { ok: true };
    },
    patchOperationsTask: async (input) => {
      if (!workOrdersConfig) return unauthenticatedReplayFailure();
      const body = parseReplayPayload<Parameters<typeof patchOperationsTask>[2]>(
        input.bodyJson,
      );
      if (!body) return invalidPayloadFailure("بيانات مهمة غير صالحة");
      const result = await patchOperationsTask(
        workOrdersConfig,
        input.taskId,
        body,
      );
      if (!result.ok) {
        return fail(userId, result.kind, "تعذّر تحديث المهمة", true);
      }
      return { ok: true };
    },
    addOperationsTaskComment: async (input) => {
      if (!workOrdersConfig) return unauthenticatedReplayFailure();
      const payload = parseReplayPayload<{
        text?: string;
        kind?: string;
        files?: Parameters<typeof addOperationsTaskComment>[4];
      }>(input.payloadJson);
      if (!payload) return invalidPayloadFailure("بيانات تعليق غير صالحة");
      const result = await addOperationsTaskComment(
        workOrdersConfig,
        input.taskId,
        payload.text ?? "",
        payload.kind,
        payload.files,
      );
      if (!result.ok) {
        return fail(userId, result.kind, "تعذّر إضافة التعليق", true);
      }
      return { ok: true };
    },
    upsertPropertyCourtAccess: async (input) => {
      if (!modulesConfig) return unauthenticatedReplayFailure();
      const body = parseReplayPayload<
        Parameters<typeof upsertPropertyCourtAccess>[1]
      >(input.bodyJson);
      if (!body) return invalidPayloadFailure("بيانات مسار الدخول غير صالحة");
      const result = await upsertPropertyCourtAccess(modulesConfig, body);
      if (!result.ok) return fail(userId, result.kind, "تعذّر حفظ مسار الدخول");
      return { ok: true };
    },
    createKeyEnvelope: async (input) => {
      if (!modulesConfig) return unauthenticatedReplayFailure();
      const parsed = parseReplayPayload<Record<string, unknown>>(input.bodyJson);
      if (!parsed) return invalidPayloadFailure("بيانات ظرف غير صالحة");
      const { clientEnvelopeId: _clientId, ...rest } = parsed;
      const body = rest as Parameters<typeof createKeyEnvelope>[1];
      const createResult = await createKeyEnvelope(
        modulesConfig,
        body,
        input.idempotencyKey,
      );
      if (!createResult.ok) {
        return fail(userId, createResult.kind, "تعذّر تسجيل الظرف");
      }
      return { ok: true, envelopeId: createResult.data.id };
    },
    addKeyEnvelopeAssignment: async (input) => {
      if (!modulesConfig) return unauthenticatedReplayFailure();
      const payload = parseReplayPayload<{
        deedNumber?: string;
        propertyId?: string | null;
      }>(input.payloadJson);
      if (!payload) return invalidPayloadFailure("بيانات إسناد غير صالحة");
      if (!payload.deedNumber?.trim()) {
        return invalidPayloadFailure("رقم الصك مطلوب");
      }
      const result = await addKeyEnvelopeAssignment(
        modulesConfig,
        input.envelopeId,
        {
          deedNumber: payload.deedNumber,
          propertyId: payload.propertyId ?? null,
        },
      );
      if (!result.ok) return fail(userId, result.kind, "تعذّر إضافة الإسناد");
      return { ok: true };
    },
    confirmKeyEnvelopeAssignment: async (input) => {
      if (!modulesConfig) return unauthenticatedReplayFailure();
      const payload = parseReplayPayload<{
        assignmentId?: string;
        status?: string;
        notes?: string | null;
      }>(input.payloadJson);
      if (!payload) return invalidPayloadFailure("بيانات تأكيد غير صالحة");
      if (!payload.assignmentId || !payload.status) {
        return invalidPayloadFailure("بيانات تأكيد ناقصة");
      }
      const result = await confirmKeyEnvelopeAssignment(
        modulesConfig,
        input.envelopeId,
        payload.assignmentId,
        { status: payload.status, notes: payload.notes ?? null },
        input.idempotencyKey,
      );
      if (!result.ok) return fail(userId, result.kind, "تعذّر تأكيد الإسناد");
      return { ok: true };
    },
    createKeyEnvelopeHandoff: async (input) => {
      if (!modulesConfig) return unauthenticatedReplayFailure();
      const parsed = parseReplayPayload<Record<string, unknown>>(
        input.payloadJson,
      );
      if (!parsed) return invalidPayloadFailure("بيانات مناولة غير صالحة");
      const { envelopeId: _e, ...rest } = parsed;
      const payload = rest as Parameters<typeof createKeyEnvelopeHandoff>[2];
      const result = await createKeyEnvelopeHandoff(
        modulesConfig,
        input.envelopeId,
        payload,
        input.idempotencyKey,
      );
      if (!result.ok) return fail(userId, result.kind, "تعذّر تسجيل المناولة");
      return { ok: true };
    },
    confirmKeyEnvelopeHandoff: async (input) => {
      if (!modulesConfig) return unauthenticatedReplayFailure();
      const payload = parseReplayPayload<{ handoffId?: string }>(
        input.payloadJson,
      );
      if (!payload) return invalidPayloadFailure("بيانات تأكيد غير صالحة");
      if (!payload.handoffId) {
        return invalidPayloadFailure("معرّف المناولة مطلوب");
      }
      const result = await confirmKeyEnvelopeHandoff(
        modulesConfig,
        input.envelopeId,
        payload.handoffId,
        input.idempotencyKey,
      );
      if (!result.ok) return fail(userId, result.kind, "تعذّر تأكيد المناولة");
      return { ok: true };
    },
  };
}

/** One silent pass over the outbox for the signed-in field user. */
export async function replayOfflineQueue(userId: string): Promise<void> {
  const result = await syncOfflineQueue(buildReplayDeps(userId));
  void result;
}
