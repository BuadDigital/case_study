"use client";

import { createElement } from "react";
import type { ComparablePropertyEntryFieldsProps } from "@platform/app-shared/evaluator/comparable-entry-fields-slot";
import { tryGetComparablePropertyEntryFields } from "@platform/app-shared/evaluator/comparable-entry-fields-slot";

/** Renders the case-study comparable entry form via the shell-registered slot. */
export function ComparablePropertyEntryFields(
  props: ComparablePropertyEntryFieldsProps,
) {
  const panel = tryGetComparablePropertyEntryFields();
  if (!panel) return null;
  // The shell registers one module-level component (stable identity), not one created per render.
  return createElement(panel, props);
}
