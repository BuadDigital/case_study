"use client";

import { createElement } from "react";
import type { PropertyDetailMediaGlanceProps } from "@platform/app-shared/evaluator/property-detail-media-glance-slot";
import { tryGetPropertyDetailMediaGlance } from "@platform/app-shared/evaluator/property-detail-media-glance-slot";

/** Renders the case-study media glance via the shell-registered slot. */
export function PropertyDetailMediaGlance(props: PropertyDetailMediaGlanceProps) {
  const panel = tryGetPropertyDetailMediaGlance();
  if (!panel) return null;
  // The shell registers one module-level component (stable identity), not one created per render.
  return createElement(panel, props);
}
