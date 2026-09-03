"use client";

/**
 * Registers the key-envelope fees panel into `@platform/app-shared` so
 * `@case-study/mfe` never imports `@keys/mfe` directly.
 * Call once from the shell at boot.
 */

import { registerKeyEnvelopeFeesPanel } from "@platform/app-shared/keys/key-envelope-fees-slot";
import { KeyEnvelopeFeesPanel } from "../components/KeyEnvelopeFeesPanel";

let registered = false;

export function ensureKeyEnvelopeFeesPanelRegistered(): void {
  if (registered) return;
  registered = true;
  registerKeyEnvelopeFeesPanel(KeyEnvelopeFeesPanel);
}
