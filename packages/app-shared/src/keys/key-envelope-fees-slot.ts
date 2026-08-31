/**
 * Runtime slot so `@case-study/mfe` never imports `@keys/mfe`.
 * Shell registers the impl at app boot; case-study renders through here.
 *
 * Mirrors the bridge pattern in `../party-appraisal/evaluator-runtime-bridge`.
 */

import type { ComponentType } from "react";

export type KeyEnvelopeFeesPanelProps = {
  canCollect: boolean;
  onOpenEnvelope: (envelopeId: string) => void;
  onBack?: () => void;
};

let panel: ComponentType<KeyEnvelopeFeesPanelProps> | null = null;

export function registerKeyEnvelopeFeesPanel(
  next: ComponentType<KeyEnvelopeFeesPanelProps>,
): void {
  panel = next;
}

/** Null until the shell registers (SSR / tests / case-study loaded standalone). */
export function tryGetKeyEnvelopeFeesPanel(): ComponentType<KeyEnvelopeFeesPanelProps> | null {
  return panel;
}
