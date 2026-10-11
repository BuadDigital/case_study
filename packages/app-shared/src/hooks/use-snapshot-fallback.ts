"use client";

import { useSyncExternalStore } from "react";
import {
  isSnapshotFallbackActive,
  subscribeSnapshotFallback,
} from "../offline/snapshot-fallback";

/** True while a read shows the downloaded copy because the server failed. */
export function useSnapshotFallbackActive(): boolean {
  return useSyncExternalStore(
    subscribeSnapshotFallback,
    isSnapshotFallbackActive,
    () => false,
  );
}
