"use client";

/**
 * Renders the keys MFE panel supplied by the shell at boot.
 * Case-study must not import `@keys/mfe` (it would re-create the cycle).
 */

import { createElement } from "react";
import {
  tryGetKeyEnvelopeFeesPanel,
  type KeyEnvelopeFeesPanelProps,
} from "@platform/app-shared/keys/key-envelope-fees-slot";

export function KeyEnvelopeFeesPanel(props: KeyEnvelopeFeesPanelProps) {
  const Panel = tryGetKeyEnvelopeFeesPanel();
  if (!Panel) return null;
  // The shell registers one module-level component (stable identity), not one created per render.
  return createElement(Panel, props);
}
