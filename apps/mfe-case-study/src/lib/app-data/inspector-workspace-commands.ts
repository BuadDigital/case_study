import {
  jeddahDefaultCoords,
  shouldUseJeddahDefaultCoords,
} from "@platform/app-shared/domain/jeddah-default-coords";
import {
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
} from "@platform/api-client";
import {
  saveDraftWithOfflineFallback,
  submitWithOfflineFallback,
} from "@platform/app-shared/offline/offline-write";
import {
  acceptPartySubmission,
  reopenPartySubmission,
  type PartyWorkMutationResult,
} from "@platform/app-shared/app-data/party-submission-api";
import { resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import {
  applyEnfathPrefillToInspectorDraft,
  inspectorDraftNeedsEnfathPrefill,
} from "./inspector-enfath-prefill";
import {
  createInspectorWorkspaceDraft,
  inspectionStampFromNow,
  sanitizeInspectorDraftForLand,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";
import {
  draftToPayload,
  isDraftNewerThan,
  loadInspectorWorkspace,
  mergeInspectorWorkspacePatch,
  notifyChanged,
  payloadToDraft,
  setCache,
  writeCache,
  type InspectorWorkspacePatch,
} from "./inspector-workspace-model";
import { fetchInspectorWorkspace } from "./inspector-workspace-reads";

/** Repair legacy/blank inspector coordinates by persisting the Jeddah defaults. */
export async function migrateInspectorDefaultCoordsIfNeeded(
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

export async function updateInspectorWorkspace(
  taskId: string,
  patch: InspectorWorkspacePatch,
  options?: { allowWhenSubmitted?: boolean },
): Promise<InspectorWorkspaceDraft | null> {
  const current =
    loadInspectorWorkspace(taskId) ?? (await fetchInspectorWorkspace(taskId));
  if (!current) return null;
  if (current.status === "submitted" && !options?.allowWhenSubmitted) {
    return current;
  }

  // Apply locally first so typing stays instant; network save is debounced.
  const next = mergeInspectorWorkspacePatch(current, patch);
  setCache(next);
  return scheduleDebouncedSave(taskId);
}

export async function submitInspectorWorkspace(
  taskId: string,
  idempotencyKey?: string,
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
      idempotencyKey,
      onlineSubmit: async () => {
        const result = await submitPartyTaskSubmission(config, taskId, idempotencyKey);
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
  idempotencyKey?: string,
): Promise<PartyWorkMutationResult<InspectorWorkspaceDraft>> {
  const accepted = await acceptPartySubmission(taskId, idempotencyKey);
  if (!accepted.ok) return { ok: false, error: accepted.error };
  const next = payloadToDraft(accepted.data);
  writeCache(next);
  notifyChanged();
  return { ok: true, data: next };
}
