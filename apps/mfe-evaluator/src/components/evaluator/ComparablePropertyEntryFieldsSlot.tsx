"use client";

import type { ComparablePropertyEntryFieldsProps } from "@platform/app-shared/evaluator/comparable-entry-fields-slot";
import { tryGetComparablePropertyEntryFields } from "@platform/app-shared/evaluator/comparable-entry-fields-slot";

/** Renders the case-study comparable entry form via the shell-registered slot. */
export function ComparablePropertyEntryFields(
  props: ComparablePropertyEntryFieldsProps,
) {
  const Panel = tryGetComparablePropertyEntryFields();
  if (!Panel) return null;
  return <Panel {...props} />;
}
