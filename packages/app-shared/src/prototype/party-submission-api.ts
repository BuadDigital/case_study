import {
  getPartyTaskSubmission,
  listPartyTaskSubmissions,
  reopenPartyTaskSubmission,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
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

export async function fetchPartySubmission(
  taskId: string,
): Promise<PartyTaskSubmissionDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return getCachedPartySubmission(taskId);
  const result = await getPartyTaskSubmission(config, taskId);
  if (result.ok) {
    setCachedPartySubmission(result.data, taskId);
    return result.data;
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
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await savePartyTaskSubmission(config, taskId, payload);
  const mapped = mutationFromApiResult(result, "تعذّر حفظ مسودة المهمة");
  if (mapped.ok) setCachedPartySubmission(mapped.data, taskId);
  return mapped;
}

export type PartySubmissionMutationResult =
  MutationResult<PartyTaskSubmissionDto>;

export async function submitPartySubmission(
  taskId: string,
): Promise<PartySubmissionMutationResult> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await submitPartyTaskSubmission(config, taskId);
  const mapped = mutationFromApiResult(result, "تعذّر إرسال مهمة الطرف");
  if (mapped.ok) setCachedPartySubmission(mapped.data, taskId);
  return mapped;
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

    const result = await listPartyTaskSubmissions(config, ids);
    if (result.ok) {
      const returned = new Set(result.data.map((dto) => dto.taskId));
      for (const dto of result.data) setCachedPartySubmission(dto, dto.taskId);
      for (const id of ids) {
        if (!returned.has(id)) setCachedPartySubmission(null, id);
      }
      return;
    }

    throw new Error(
      resolveApiError(result.kind, result.errors, "تعذّر تحميل مسودات المهام"),
    );
  })().finally(() => {
    prefetchInflight = null;
    prefetchInflightKey = "";
  });

  return prefetchInflight;
}
