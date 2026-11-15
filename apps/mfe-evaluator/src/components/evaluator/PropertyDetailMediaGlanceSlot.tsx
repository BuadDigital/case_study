"use client";

import { createElement } from "react";
import type { PropertyDetailMediaGlanceProps } from "@platform/app-shared/evaluator/property-detail-media-glance-slot";
import { tryGetPropertyDetailMediaGlance } from "@platform/app-shared/evaluator/property-detail-media-glance-slot";

/**
 * Renders the case-study media glance via the shell-registered slot.
 * Edge cases: nothing registered (the evaluator loaded on its own) → the study groups handed in as
 * `beforeFacts` are still drawn, alone.
 */
export function PropertyDetailMediaGlance(props: PropertyDetailMediaGlanceProps) {
  const panel = tryGetPropertyDetailMediaGlance();
  if (!panel) return props.beforeFacts ?? null;
  // The shell registers one module-level component (stable identity), not one created per render.
  return createElement(panel, props);
}
