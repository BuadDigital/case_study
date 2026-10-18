import {
  jeddahDefaultCoords,
  shouldUseJeddahDefaultCoords,
} from "@platform/app-shared/domain/jeddah-default-coords";
import {
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  type ReturnInspectionRequest,
} from "@platform/api-client";
import { createKeyedWriteQueue } from "@platform/app-shared/lib/keyed-write-queue";
import {
  clearLocalWorkingCopy,
  saveDraftWithOfflineFallback,
  saveLocalWorkingCopy,
  submitWithOfflineFallback,
} from "@platform/app-shared/offline/offline-write";
import {
  acceptPartySubmission,
  returnInspectionWithImpact,
  type PartyWorkMutationResult,
  type ReturnInspectionMutationResult,
} from "@platform/app-shared/app-data/party-submission-api";
import { resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import {
  applyEnfathPrefillToInspectorDraft,
  inspectorDraftNeedsEnfathPrefill,
} from "./inspector-deed-prefill";
import { fillEmptyFeaturesFromBourse } from "./inspector-bourse-prefill";
import {
  createInspectorWorkspaceDraft,
  inspectionCompletionStamp,
  inspectionStampFromNow,
  isInspectorWorkspaceLocked,
  MOVABLES_FEATURE_KEY,
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
  resolveInspectorWorkspacePatch,
  setCache,
  writeCache,
  type InspectorWorkspacePatch,
  type InspectorWorkspacePatchInput,
} from "./inspector-workspace-model";
import { fetchInspectorWorkspace } from "./inspector-workspace-reads";
import { prefillInspectionFromGroup } from "@platform/api-client";

/**
 * Every inspector workspace PUT sends the whole draft with no version token, so the debounce, the
 * map-pin flush, «حفظ», the load-time repair and submit run one at a time per task — otherwise an
 * older PUT landing last on a slow link erases newer fields on the server. See keyed-write-queue.ts.
 */
const inspectorWriteQueue = createKeyedWriteQueue();


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
  // Applied to the draft as it is when the PUT runs — a pin dropped meanwhile is kept.
  return saveInspectorWorkspaceDraft(draft, (latest) =>
    latest === draft || shouldUseJeddahDefaultCoords(latest.mapLatitude, latest.mapLongitude)
      ? { ...latest, mapLatitude: defaults.latitude, mapLongitude: defaults.longitude }
      : latest,
  );
}

type InspectorWorkspaceLoadInput = {
  taskId: string;
  propertyId: string;
  poNumber: string;
  propertyDisplayId?: string;
  property?: import("./po-intake-data").PoPropertyIntake | null;
};

/**
 * «يوجد منقولات» left untouched means «لا»: the report prints «لا يوجد منقولات بالعقار» only for an
 * explicit «لا», so an empty answer would otherwise print a dash. Never over an answer already given.
 */
export function withMovablesDefaultNo(draft: InspectorWorkspaceDraft): InspectorWorkspaceDraft {
  if ((draft.featureValues[MOVABLES_FEATURE_KEY] ?? "").trim()) return draft;
  return {
    ...draft,
    featureValues: { ...draft.featureValues, [MOVABLES_FEATURE_KEY]: "لا" },
  };
}

/** The load-time repair (land sanitize, bourse fill, display id, stamp); the same object when nothing changes. */
function repairLoadedInspectorDraft(
  loaded: InspectorWorkspaceDraft,
  input: InspectorWorkspaceLoadInput,
): InspectorWorkspaceDraft {
  let existing = sanitizeInspectorDraftForLand(loaded, {
    classification: input.property?.classification,
    propertyType: input.property?.propertyType,
  });
  // The bourse already answered the asset type / usage: fill what is still empty — also after the
  // inspector has started — until he submits. Never over something he wrote.
  if (!isInspectorWorkspaceLocked(existing.status)) {
    existing = fillEmptyFeaturesFromBourse(existing, input.property);
    existing = withMovablesDefaultNo(existing);
  }
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
  return Object.keys(patch).length > 0 ? { ...existing, ...patch } : existing;
}

/**
 * Grouped property (decision 2026-10-18): before the first local draft is made, ask the server
 * to start this inspection from the sibling deed's inspection — site inputs and photos. Only
 * online, and only worth a round-trip when there is no draft yet; any failure means "nothing
 * to copy" and the empty draft is built as before.
 */
async function prefillFromGroupSibling(taskId: string): Promise<InspectorWorkspaceDraft | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const config = workOrdersApiConfig();
  if (!config) return null;
  try {
    const res = await prefillInspectionFromGroup(config, taskId);
    if (!res.ok || !res.data.prefilled) return null;
    return await fetchInspectorWorkspace(taskId);
  } catch {
    return null;
  }
}

export async function getOrCreateInspectorWorkspace(
  input: InspectorWorkspaceLoadInput,
): Promise<InspectorWorkspaceDraft | null> {
  let existing =
    (await fetchInspectorWorkspace(input.taskId)) ?? (await prefillFromGroupSibling(input.taskId));
  if (existing) {
    existing = await migrateInspectorDefaultCoordsIfNeeded(existing);
    const repaired = repairLoadedInspectorDraft(existing, input);
    if (repaired !== existing) {
      // Re-applied when the PUT runs, on top of whatever the inspector typed while it waited.
      return saveInspectorWorkspaceDraft(repaired, (latest) =>
        repairLoadedInspectorDraft(latest, input),
      );
    }
    return existing;
  }

  let draft = withMovablesDefaultNo(createInspectorWorkspaceDraft(input));
  if (input.property && inspectorDraftNeedsEnfathPrefill(draft)) {
    draft = applyEnfathPrefillToInspectorDraft(draft, input.property);
  }
  const saved = await saveInspectorWorkspaceDraft(draft);
  return saved;
}

/**
 * Queues one whole-draft PUT for the task. When it RUNS it starts from the cached draft (every edit
 * typed since lands there) unless `draft` is strictly newer, then applies `build`. A save that carries
 * its own change (submit's original map pin, the load-time repair) must pass it as `build`: a change
 * folded into `draft` beforehand is lost when the cache wins.
 */
export function saveInspectorWorkspaceDraft(
  draft: InspectorWorkspaceDraft,
  build?: (latest: InspectorWorkspaceDraft) => InspectorWorkspaceDraft,
): Promise<InspectorWorkspaceDraft> {
  return inspectorWriteQueue.enqueue(draft.taskId, () => {
    const cached = loadInspectorWorkspace(draft.taskId);
    const latest = cached && !isDraftNewerThan(draft, cached) ? cached : draft;
    return putInspectorWorkspaceDraft(build ? build(latest) : latest);
  });
}

/** A draft that replaced `sent` in the cache while its PUT was in flight — newer local edits win. */
function editedSinceSent(sent: InspectorWorkspaceDraft): InspectorWorkspaceDraft | null {
  const cached = loadInspectorWorkspace(sent.taskId);
  return cached && cached !== sent && !isDraftNewerThan(sent, cached) ? cached : null;
}

/** One PUT of the whole draft; only ever run from the write queue. */
async function putInspectorWorkspaceDraft(
  draft: InspectorWorkspaceDraft,
): Promise<InspectorWorkspaceDraft> {
  const config = workOrdersApiConfig();
  const saveStartedAtUtc = new Date().toISOString();
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
  // Before the first await: edits typed while this PUT is in flight build on what it sends (the
  // repair or submit's map pin included), and the response below can tell they came later.
  setCache(nextDraft);

  if (!config) {
    const queued = await saveDraftWithOfflineFallback({
      taskId: draft.taskId,
      kind: "field-inspection",
      payload,
      onlineSave: async () => {
        throw new Error("تعذّر حفظ مسودة المعاينة — يلزم تسجيل الدخول");
      },
    });
    if (queued.queued) {
      const newer = editedSinceSent(nextDraft);
      if (newer) return newer;
      writeCache(nextDraft);
      return nextDraft;
    }
    throw new Error("تعذّر حفظ مسودة المعاينة — يلزم تسجيل الدخول");
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
      const next = payloadToDraft(result.data, nextDraft);
      void clearLocalWorkingCopy("field-inspection", draft.taskId, saveStartedAtUtc);
      // A newer local edit landed while this request was in flight: it stays, and its own save follows.
      if (editedSinceSent(nextDraft)) return;
      writeCache(next);
    },
  });

  if (queued.queued) {
    const newer = editedSinceSent(nextDraft);
    if (newer) return newer;
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
  patchInput: InspectorWorkspacePatchInput,
  options?: { allowWhenSubmitted?: boolean; immediate?: boolean },
): Promise<InspectorWorkspaceDraft | null> {
  const current =
    loadInspectorWorkspace(taskId) ?? (await fetchInspectorWorkspace(taskId));
  if (!current) return null;
  // Built from the cached draft as it is NOW — see InspectorWorkspacePatchInput.
  const patch = resolveInspectorWorkspacePatch(current, patchInput);
  if (current.status === "submitted" && !options?.allowWhenSubmitted) {
    return current;
  }

  // Apply locally first so typing stays instant; network save is debounced.
  // Pin / unpin must flush immediately — leaving the page within the debounce
  // window used to drop `mapPinned` and block «خطاب صحة الموقع».
  const next = mergeInspectorWorkspacePatch(current, patch);
  setCache(next);
  // Spec §3.4: the edit is on the device now — the network save below is debounced.
  if (next.status !== "submitted") {
    void saveLocalWorkingCopy({
      taskId,
      kind: "field-inspection",
      payload: draftToPayload(next),
    });
  }
  if (options?.immediate || Object.prototype.hasOwnProperty.call(patch, "mapPinned")) {
    return flushInspectorWorkspaceSave(taskId);
  }
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
    return { ok: false, message: "يلزم تسجيل الدخول" };
  }
  const current =
    loadInspectorWorkspace(taskId) ?? (await fetchInspectorWorkspace(taskId));
  if (!current) {
    return { ok: false, message: "لا توجد مسودة للإرسال" };
  }
  if (current.status === "submitted") {
    return { ok: true, draft: current };
  }

  // ق-10: stamp the on-site completion now, on the device — a submit queued offline
  // keeps this moment; the server's SubmittedAtUtc records the later upload separately.
  setCache(mergeInspectorWorkspacePatch(current, inspectionCompletionStamp()));
  const flushed = await flushInspectorWorkspaceSave(taskId) ?? current;
  // Queued behind every pending PUT, so none of them lands after the submit.
  return inspectorWriteQueue.enqueue(taskId, () =>
    submitFlushedInspectorWorkspace(config, taskId, flushed, idempotencyKey),
  );
}

async function submitFlushedInspectorWorkspace(
  config: NonNullable<ReturnType<typeof workOrdersApiConfig>>,
  taskId: string,
  flushed: InspectorWorkspaceDraft,
  idempotencyKey: string | undefined,
): Promise<
  | { ok: true; draft: InspectorWorkspaceDraft; queued?: boolean }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  const saved = loadInspectorWorkspace(taskId) ?? flushed;
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

/**
 * The specialist returns the inspection to the inspector together with the affected parties
 * (batch 2C): one server transaction reopens / notifies the picked parties and, when the study
 * report is issued, keeps or reopens it. Refreshes the inspector cache like the old plain reopen.
 */
export async function returnInspectorWorkspace(
  taskId: string,
  request: ReturnInspectionRequest,
  idempotencyKey?: string,
): Promise<ReturnInspectionMutationResult> {
  const returned = await returnInspectionWithImpact(taskId, request, idempotencyKey);
  if (!returned.ok) return returned;
  writeCache(payloadToDraft(returned.data.inspection));
  notifyChanged();
  return returned;
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
