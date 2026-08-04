import {
  getPartyTaskSubmission,
  listPartyTaskSubmissions,
  acceptPartyTaskSubmission,
  reopenPartyTaskSubmission,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import {
  saveDraftWithOfflineFallback,
  submitWithOfflineFallback,
  loadQueuedDraftPayload,
} from "../offline/offline-write";
import {
  apiErrorMessage,
  mutationFromApiResult,
  resolveApiError,
  workOrdersApiConfig,
  type MutationResult,
} from "@platform/app-shared/prototype/work-orders-api-config";

/** In-memory cache keyed by workflow task id — queue filters read synchronously. */
const submissionCache = new Map<string, PartyTaskSubmissionDto>();

export function getCachedPartySubmission(
  taskId: string,
): PartyTaskSubmissionDto | null {
  return submissionCache.get(taskId) ?? null;
}

export function setCachedPartySubmission(
  dto: PartyTaskSubmissionDto | null,
  taskId: string,
): void {
  if (dto) submissionCache.set(taskId, dto);
  else submissionCache.delete(taskId);
}

function detectSubmissionKind(
  payload: Record<string, unknown>,
): "field-inspection" | "government-review" {
  if (
    payload.slotPhotos != null ||
    payload.freePhotos != null ||
    payload.boundaryMatches != null ||
    payload.mapLatitude != null
  ) {
    return "field-inspection";
  }
  return "government-review";
}

export async function fetchPartySubmission(
  taskId: string,
): Promise<PartyTaskSubmissionDto | null> {
  const config = workOrdersApiConfig();
  if (!config) {
    const queued = await loadQueuedDraftPayload<Record<string, unknown>>(
      "government-review",
      taskId,
    );
    const fieldQueued =
      queued ??
      (await loadQueuedDraftPayload<Record<string, unknown>>(
        "field-inspection",
        taskId,
      ));
    if (fieldQueued) {
      const kind = detectSubmissionKind(fieldQueued);
      const local: PartyTaskSubmissionDto = {
        taskId,
        kind,
        status: "draft",
        payload: fieldQueued,
        updatedAtUtc: new Date().toISOString(),
      };
      setCachedPartySubmission(local, taskId);
      return local;
    }
    return getCachedPartySubmission(taskId);
  }
  const result = await getPartyTaskSubmission(config, taskId);
  if (result.ok) {
    setCachedPartySubmission(result.data, taskId);
    return result.data;
  }
  if (result.kind === "not_found" || result.kind === "network") {
    const queuedGov = await loadQueuedDraftPayload<Record<string, unknown>>(
      "government-review",
      taskId,
    );
    const queued =
      queuedGov ??
      (await loadQueuedDraftPayload<Record<string, unknown>>(
        "field-inspection",
        taskId,
      ));
    if (queued) {
      const local: PartyTaskSubmissionDto = {
        taskId,
        kind: detectSubmissionKind(queued),
        status: "draft",
        payload: queued,
        updatedAtUtc: new Date().toISOString(),
      };
      setCachedPartySubmission(local, taskId);
      return local;
    }
  }
  if (result.kind === "not_found") {
    setCachedPartySubmission(null, taskId);
    return null;
  }
  throw new Error(
    resolveApiError(result.kind, result.errors, "تعذّر تحميل مسودة المهمة"),
  );
}

export async function persistPartySubmissionPayload(
  taskId: string,
  payload: Record<string, unknown>,
): Promise<PartySubmissionMutationResult> {
  const kind = detectSubmissionKind(payload);
  const config = workOrdersApiConfig();
  if (!config) {
    const queued = await saveDraftWithOfflineFallback({
      taskId,
      kind,
      payload,
      onlineSave: async () => {
        throw new Error(apiErrorMessage("auth"));
      },
    });
    if (queued.queued) {
      const now = new Date().toISOString();
      const local: PartyTaskSubmissionDto = {
        taskId,
        kind,
        status: "draft",
        payload,
        updatedAtUtc: now,
      };
      setCachedPartySubmission(local, taskId);
      return { ok: true, data: local };
    }
    return { ok: false, error: apiErrorMessage("auth") };
  }

  try {
    const queued = await saveDraftWithOfflineFallback({
      taskId,
      kind,
      payload,
      onlineSave: async () => {
        const result = await savePartyTaskSubmission(config, taskId, payload);
        if (!result.ok) {
          const err = new Error(
            resolveApiError(result.kind, result.errors, "تعذّر حفظ مسودة المهمة"),
          ) as Error & { offlineQueueable?: boolean };
          if (result.kind !== "network" && result.kind !== "server") {
            err.offlineQueueable = false;
          }
          throw err;
        }
        setCachedPartySubmission(result.data, taskId);
      },
    });
    if (queued.queued) {
      const now = new Date().toISOString();
      const local: PartyTaskSubmissionDto = {
        taskId,
        kind,
        status: "draft",
        payload,
        updatedAtUtc: now,
      };
      setCachedPartySubmission(local, taskId);
      return { ok: true, data: local };
    }
    return {
      ok: true,
      data: getCachedPartySubmission(taskId)!,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر حفظ مسودة المهمة",
    };
  }
}

export type PartySubmissionMutationResult =
  MutationResult<PartyTaskSubmissionDto>;

export type PartyWorkMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function submitPartySubmission(
  taskId: string,
): Promise<PartySubmissionMutationResult> {
  const config = workOrdersApiConfig();
  const cached = getCachedPartySubmission(taskId);
  if (!config) {
    if (cached) {
      const queued = await submitWithOfflineFallback({
        taskId,
        kind: "government-review",
        payload: cached.payload ?? {},
        onlineSubmit: async () => {
          throw new Error(apiErrorMessage("auth"));
        },
      });
      if (queued.queued) return { ok: true, data: cached };
    }
    return { ok: false, error: apiErrorMessage("auth") };
  }

  try {
    const queued = await submitWithOfflineFallback({
      taskId,
      kind: "government-review",
      payload: cached?.payload ?? {},
      onlineSubmit: async () => {
        const result = await submitPartyTaskSubmission(config, taskId);
        if (!result.ok) {
          const err = new Error(
            resolveApiError(result.kind, result.errors, "تعذّر إرسال مهمة الطرف"),
          ) as Error & { offlineQueueable?: boolean };
          if (result.kind !== "network" && result.kind !== "server") {
            err.offlineQueueable = false;
          }
          throw err;
        }
        setCachedPartySubmission(result.data, taskId);
      },
    });
    if (queued.queued) {
      return {
        ok: true,
        data: cached ?? {
          taskId,
          kind: "government-review",
          status: "draft",
          payload: {},
          updatedAtUtc: new Date().toISOString(),
        },
      };
    }
    return {
      ok: true,
      data: getCachedPartySubmission(taskId)!,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر إرسال مهمة الطرف",
    };
  }
}

export async function reopenPartySubmission(
  taskId: string,
  returnNote: string,
): Promise<PartySubmissionMutationResult> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await reopenPartyTaskSubmission(config, taskId, returnNote);
  const mapped = mutationFromApiResult(result, "تعذّر إعادة فتح مهمة الطرف");
  if (mapped.ok) setCachedPartySubmission(mapped.data, taskId);
  return mapped;
}

export async function acceptPartySubmission(
  taskId: string,
): Promise<PartySubmissionMutationResult> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await acceptPartyTaskSubmission(config, taskId);
  const mapped = mutationFromApiResult(result, "تعذّر قبول مخرجات المهمة");
  if (mapped.ok) setCachedPartySubmission(mapped.data, taskId);
  return mapped;
}

export function payloadFromDto<T extends Record<string, unknown>>(
  dto: PartyTaskSubmissionDto,
): T {
  return dto.payload as T;
}

/** Stable cache key for a set of workflow task ids (order-independent). */
export function partySubmissionTaskIdsKey(taskIds: string[]): string {
  return [...new Set(taskIds.map((id) => id.trim()).filter(Boolean))]
    .sort()
    .join("\0");
}

let prefetchInflight: Promise<void> | null = null;
let prefetchInflightKey = "";

/** The list endpoint caps one request at 500 task ids and drops the rest. */
const PARTY_SUBMISSION_LIST_CHUNK = 500;

function chunkTaskIds(ids: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    batches.push(ids.slice(i, i + size));
  }
  return batches;
}

export async function prefetchPartySubmissionsForTasks(
  taskIds: string[],
): Promise<void> {
  const config = workOrdersApiConfig();
  if (!config) return;

  const key = partySubmissionTaskIdsKey(taskIds);
  if (!key) return;

  if (prefetchInflight && prefetchInflightKey === key) {
    return prefetchInflight;
  }

  const ids = key.split("\0");
  prefetchInflightKey = key;
  prefetchInflight = (async () => {
    if (ids.length === 1) {
      await fetchPartySubmission(ids[0]!);
      return;
    }

    // Batch, then clear only once every batch is in — a partial pass would
    // evict live submissions for the ids the server never looked at.
    const returned = new Set<string>();
    for (const batch of chunkTaskIds(ids, PARTY_SUBMISSION_LIST_CHUNK)) {
      const result = await listPartyTaskSubmissions(config, batch);
      if (!result.ok) {
        throw new Error(
          resolveApiError(result.kind, result.errors, "تعذّر تحميل مسودات المهام"),
        );
      }
      for (const dto of result.data) {
        setCachedPartySubmission(dto, dto.taskId);
        returned.add(dto.taskId);
      }
    }

    for (const id of ids) {
      if (!returned.has(id)) setCachedPartySubmission(null, id);
    }
  })().finally(() => {
    prefetchInflight = null;
    prefetchInflightKey = "";
  });

  return prefetchInflight;
}
