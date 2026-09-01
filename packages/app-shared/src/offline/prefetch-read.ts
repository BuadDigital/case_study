import {
  getPrefetch,
  savePrefetch,
  type OfflinePrefetchRecord,
} from "@platform/offline-client";
import { currentOfflineUserId } from "./offline-write";

export const WORKFLOW_TASKS_PREFETCH_ID = (userId: string) => `tasks:${userId}`;
export const OPS_TASKS_PREFETCH_ID = (userId: string) => `ops-tasks:${userId}`;
export const PARTY_SUBMISSIONS_PREFETCH_ID = (userId: string) =>
  `party-submissions:${userId}`;
export const BASIC_DOCS_PREFETCH_ID = (userId: string) => `docs:${userId}`;

export const BASIC_DOC_PREFETCH_SCOPES = [
  { kind: "deed", scope: "property-deed-ownership" },
  { kind: "decree", scope: "property-decree" },
  { kind: "delegation", scope: "property-delegation" },
  { kind: "registry", scope: "property-registry" },
  { kind: "boundaries", scope: "property-boundaries" },
] as const;

export type BasicDocPrefetchEntry = {
  attachmentId: string;
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType: string;
  poNumber: string;
  propertyId: string;
  kind: string;
};

export async function readPrefetchedJson<T>(
  prefetchId: string,
): Promise<T | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  const row = await getPrefetch(userId, prefetchId);
  if (!row) return null;
  try {
    return JSON.parse(row.payloadJson) as T;
  } catch {
    return null;
  }
}

export async function readPrefetchedWorkflowTasks<
  T extends Record<string, unknown>,
>(): Promise<T[] | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  const parsed = await readPrefetchedJson<{ tasks?: T[] }>(
    WORKFLOW_TASKS_PREFETCH_ID(userId),
  );
  return parsed?.tasks ?? null;
}

export async function readPrefetchedOperationsTasks<
  T extends Record<string, unknown>,
>(): Promise<T[] | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  const parsed = await readPrefetchedJson<{ tasks?: T[] }>(
    OPS_TASKS_PREFETCH_ID(userId),
  );
  return parsed?.tasks ?? null;
}

export async function savePrefetchedOperationsTasks<
  T extends Record<string, unknown>,
>(tasks: T[]): Promise<void> {
  const userId = currentOfflineUserId();
  if (!userId) return;
  const record: OfflinePrefetchRecord = {
    id: OPS_TASKS_PREFETCH_ID(userId),
    userId,
    kind: "operations-tasks",
    payloadJson: JSON.stringify({ tasks }),
    updatedAtUtc: new Date().toISOString(),
  };
  await savePrefetch(record);
}

export async function mergePrefetchedOperationsTaskPatch<
  T extends Record<string, unknown>,
>(taskId: string, patch: Record<string, unknown>): Promise<T | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  const tasks = (await readPrefetchedOperationsTasks<T>()) ?? [];
  const index = tasks.findIndex((task) => String(task.id ?? "") === taskId);
  if (index < 0) return null;
  const merged = { ...tasks[index]!, ...patch, id: taskId } as T;
  const next = [...tasks];
  next[index] = merged;
  await savePrefetchedOperationsTasks(next);
  return merged;
}

export async function readPrefetchedPartySubmissions(): Promise<
  Record<string, unknown> | null
> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  return readPrefetchedJson<Record<string, unknown>>(
    PARTY_SUBMISSIONS_PREFETCH_ID(userId),
  );
}

export async function readPrefetchedBasicDocMap(): Promise<
  BasicDocPrefetchEntry[] | null
> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  const parsed = await readPrefetchedJson<{ entries?: BasicDocPrefetchEntry[] }>(
    BASIC_DOCS_PREFETCH_ID(userId),
  );
  return parsed?.entries ?? null;
}
