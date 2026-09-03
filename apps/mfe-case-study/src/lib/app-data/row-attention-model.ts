import type { WorkflowTask } from "./tasks-model";

const SEEN_KEY = "row-attention-seen";

export type RowAttentionSeenMap = Record<string, string>;

export function loadRowAttentionSeenMap(): RowAttentionSeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: RowAttentionSeenMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Entry cap — the map used to grow without bound for every task ever opened (client-localstorage-schema). */
const MAX_SEEN_ENTRIES = 600;

function pruneSeenMap(map: RowAttentionSeenMap): RowAttentionSeenMap {
  const entries = Object.entries(map);
  if (entries.length <= MAX_SEEN_ENTRIES) return map;
  // Approximate ordering by fingerprint (embeds a timestamp in the middle) — a wrong eviction
  // only costs re-lighting an attention dot; the important part is the cap itself.
  entries.sort((a, b) => a[1].localeCompare(b[1]));
  return Object.fromEntries(entries.slice(entries.length - MAX_SEEN_ENTRIES));
}

function writeSeenMap(map: RowAttentionSeenMap): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(pruneSeenMap(map)));
  } catch {
    // storage full/unavailable — dot just re-lights next render, non-fatal.
  }
}

// Sort + serialize + write are deferred to idle time: clicking the row starts a navigation
// path in the same moment (js-request-idle-callback).
let pendingSeenMap: RowAttentionSeenMap | null = null;
let cancelPendingFlush: (() => void) | null = null;
let flushBound = false;

function flushSeenMap(): void {
  cancelPendingFlush?.();
  cancelPendingFlush = null;
  const map = pendingSeenMap;
  if (!map) return;
  pendingSeenMap = null;
  writeSeenMap(map);
}

function bindFlushOnHide(): void {
  if (flushBound) return;
  flushBound = true;
  window.addEventListener("pagehide", flushSeenMap);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSeenMap();
  });
}

export function saveRowAttentionSeenMap(map: RowAttentionSeenMap): void {
  if (typeof window === "undefined") return;
  bindFlushOnHide();
  // Consecutive writes are coalesced — the map is a full snapshot so the latest is enough.
  pendingSeenMap = map;
  if (cancelPendingFlush) return;
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(flushSeenMap, { timeout: 2_000 });
    cancelPendingFlush = () => cancelIdleCallback(id);
    return;
  }
  const id = setTimeout(flushSeenMap, 250);
  cancelPendingFlush = () => clearTimeout(id);
}

/**
 * Fingerprint of a queue row's "needs a look" state — Outlook-style: a new
 * task, a status change, or a badge change (return / reply / new action)
 * all produce a different fingerprint, which re-lights the dot until the
 * row is opened again.
 */
export function buildRowAttentionFingerprint(
  task: Pick<WorkflowTask, "status" | "updatedAt" | "createdAt">,
  badgeClassName?: string,
): string {
  const stamp = (task.updatedAt || task.createdAt || "").trim();
  return `${task.status}:${stamp}:${badgeClassName ?? ""}`;
}

export function rowHasAttentionDot(
  taskId: string,
  fingerprint: string,
  seen: RowAttentionSeenMap,
): boolean {
  return seen[taskId] !== fingerprint;
}
