"use client";

import { useCallback, useRef, useState } from "react";
import {
  loadRowAttentionSeenMap,
  saveRowAttentionSeenMap,
  type RowAttentionSeenMap,
} from "./row-attention-model";

/** Per-tab seen-state for queue rows, backed by localStorage. */
export function useRowAttentionSeenMap() {
  const [seen, setSeen] = useState<RowAttentionSeenMap>(() => loadRowAttentionSeenMap());
  const seenRef = useRef(seen);
  seenRef.current = seen;

  const markSeen = useCallback((taskId: string, fingerprint: string) => {
    if (seenRef.current[taskId] === fingerprint) return;
    const next = { ...seenRef.current, [taskId]: fingerprint };
    seenRef.current = next;
    setSeen(next);
    saveRowAttentionSeenMap(next);
  }, []);

  return [seen, markSeen] as const;
}
