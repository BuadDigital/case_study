"use client";

import { useCallback, useState } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import {
  loadRowAttentionSeenMap,
  saveRowAttentionSeenMap,
  type RowAttentionSeenMap,
} from "./row-attention-model";

/** Per-tab seen-state for queue rows, backed by localStorage. */
export function useRowAttentionSeenMap() {
  const [seen, setSeen] = useState<RowAttentionSeenMap>(() => loadRowAttentionSeenMap());
  const seenRef = useLatestRef(seen);

  const markSeen = useCallback((taskId: string, fingerprint: string) => {
    if (seenRef.current[taskId] === fingerprint) return;
    const next = { ...seenRef.current, [taskId]: fingerprint };
    seenRef.current = next;
    setSeen(next);
    saveRowAttentionSeenMap(next);
  }, [seenRef]);

  return [seen, markSeen] as const;
}
