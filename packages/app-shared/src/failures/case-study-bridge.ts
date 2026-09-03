/**
 * Runtime bridge so `@failures/mfe` never imports `@case-study/mfe`.
 * Shell registers the impl at app boot; failures calls through here.
 *
 * Mirrors `../party-appraisal/evaluator-runtime-bridge`.
 */

import type { FailureRecord } from "./failures-types";

export type SuspendPropertyResult =
  | { ok: true }
  | { ok: false; error: string };

/** Only the PO fields consumers outside case-study read. */
export type PoRecordRef = {
  poNumber: string;
  assignmentSpecialist?: string;
};

export type FailuresCaseStudyBridge = {
  suspendPropertyTransaction: (input: {
    failure: FailureRecord;
    supervisorNote: string;
  }) => Promise<SuspendPropertyResult>;
  /** React hook — the registered impl is stable for the app's lifetime. */
  usePoRecords: () => { data?: PoRecordRef[] };
};

let bridge: FailuresCaseStudyBridge | null = null;

export function registerFailuresCaseStudyBridge(
  next: FailuresCaseStudyBridge,
): void {
  bridge = next;
}

export function getFailuresCaseStudyBridge(): FailuresCaseStudyBridge {
  if (!bridge) {
    throw new Error(
      "Failures/case-study bridge is not registered. Wire it from the shell at boot.",
    );
  }
  return bridge;
}

/** Empty list until the shell registers (SSR / tests). */
export function usePoRecordsViaBridge(): { data?: PoRecordRef[] } {
  return bridge ? bridge.usePoRecords() : { data: [] };
}
