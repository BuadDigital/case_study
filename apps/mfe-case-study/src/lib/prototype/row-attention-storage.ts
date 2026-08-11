"use client";

import { useCallback, useState } from "react";
import type { WorkflowTask } from "./tasks-storage";

const SEEN_KEY = "row-attention-seen";

export type RowAttentionSeenMap = Record<string, string>;

function loadSeenMap(): RowAttentionSeenMap {
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

function saveSeenMap(map: RowAttentionSeenMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    // storage full/unavailable — dot just re-lights next render, non-fatal.
  }
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

/** Per-tab seen-state for queue rows, backed by localStorage. */
export function useRowAttentionSeenMap() {
  const [seen, setSeen] = useState<RowAttentionSeenMap>(() => loadSeenMap());

  const markSeen = useCallback((taskId: string, fingerprint: string) => {
    setSeen((prev) => {
      if (prev[taskId] === fingerprint) return prev;
      const next = { ...prev, [taskId]: fingerprint };
      saveSeenMap(next);
      return next;
    });
  }, []);

  return [seen, markSeen] as const;
}
