"use client";

/**
 * Registers case-study helpers into `@platform/app-shared` so
 * `@failures/mfe` never imports `@case-study/mfe` directly.
 * Call once from the shell at boot.
 */

import { registerFailuresCaseStudyBridge } from "@platform/app-shared/failures/case-study-bridge";
import { suspendPropertyTransaction } from "../lib/app-data/suspend-property-transaction";
import { usePoRecordsQuery } from "../query/case-study-queries";

let registered = false;

export function ensureFailuresCaseStudyBridgeRegistered(): void {
  if (registered) return;
  registered = true;
  registerFailuresCaseStudyBridge({
    suspendPropertyTransaction,
    usePoRecords: usePoRecordsQuery,
  });
}
