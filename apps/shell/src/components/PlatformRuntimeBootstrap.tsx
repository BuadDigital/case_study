"use client";

import { useEffect } from "react";
import { ensureEvaluatorRuntimeBridgeRegistered } from "@evaluator/mfe/extensions/register-evaluator-runtime-bridge";
import { hydrateDomainStore } from "@platform/app-shared/storage/browser-domain-store";

// Sync registration before any case-study queue/detail code runs.
ensureEvaluatorRuntimeBridgeRegistered();

/** Hydrates domain IndexedDB once per app session. */
export function PlatformRuntimeBootstrap() {
  useEffect(() => {
    void hydrateDomainStore();
  }, []);
  return null;
}
