"use client";

import type { PropertyDetailMediaGlanceProps } from "@platform/app-shared/evaluator/property-detail-media-glance-slot";
import { tryGetPropertyDetailMediaGlance } from "@platform/app-shared/evaluator/property-detail-media-glance-slot";

/** Renders the case-study media glance via the shell-registered slot. */
export function PropertyDetailMediaGlance(props: PropertyDetailMediaGlanceProps) {
  const Panel = tryGetPropertyDetailMediaGlance();
  if (!Panel) return null;
  return <Panel {...props} />;
}
