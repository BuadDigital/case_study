/**
 * Runtime slot so `@evaluator/mfe` never imports `@case-study/mfe`.
 * Shell registers the impl at app boot; evaluator renders through here.
 *
 * Mirrors `../keys/key-envelope-fees-slot`.
 */

import type { ComponentType } from "react";
import type {
  ComparableEntryDraft,
  ComparableSubjectPin,
} from "../app-data/comparable-entry";

export type ComparablePropertyEntryFieldsProps = {
  draft: ComparableEntryDraft;
  disabled?: boolean;
  showCoordinates?: boolean;
  showDescription?: boolean;
  subjectPin?: ComparableSubjectPin | null;
  onChange: (next: ComparableEntryDraft) => void;
  onLocationConfirmedChange?: (confirmed: boolean) => void;
};

let panel: ComponentType<ComparablePropertyEntryFieldsProps> | null = null;

export function registerComparablePropertyEntryFields(
  next: ComponentType<ComparablePropertyEntryFieldsProps>,
): void {
  panel = next;
}

/** Null until the shell registers (SSR / tests / evaluator loaded standalone). */
export function tryGetComparablePropertyEntryFields(): ComponentType<ComparablePropertyEntryFieldsProps> | null {
  return panel;
}
