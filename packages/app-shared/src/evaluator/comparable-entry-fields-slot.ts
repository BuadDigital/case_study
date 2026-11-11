/**
 * Runtime slot so `@evaluator/mfe` never imports `@case-study/mfe`.
 * Shell registers the impl at app boot; evaluator renders through here.
 *
 * Mirrors `../keys/key-envelope-fees-slot`.
 */

import type { ComponentType, ReactNode } from "react";
import type { ComparablePropertyDto } from "@platform/api-client";
import type {
  ComparableEntryDraft,
  ComparableEntryFieldErrors,
  ComparableSubjectPin,
} from "../app-data/comparable-entry";

/**
 * The host browses the bank on the entry map (Omar 2026-11-11: «إضافة مقارن» is the one window
 * for a comparable — a new one, or one chosen from the bank). The host owns the search and the
 * filters; the form draws what it is given and asks the host what a pressed comparable can do.
 */
export type ComparableBankBrowse = {
  /** Above the map: the host's search and filters. */
  toolbar: ReactNode;
  /** The comparables drawn on the map, in place of the ones the form reads around the subject. */
  comparables: readonly ComparablePropertyDto[];
  /** Chosen for this transaction — drawn green. */
  adoptedIds: ReadonlySet<string>;
  /** Frame the drawn pins once per key (a new search). */
  fitPinsKey?: string;
  /** A comparable whose details open by themselves (a search with one hit). */
  autoOpenId?: string | null;
  /** The map came to rest on a new centre. */
  onCenterChange: (lat: number, lng: number) => void;
  /** What can be done with the pressed comparable. */
  action: (comparable: ComparablePropertyDto) => { label: string; busy: boolean; run: () => void };
};

export type ComparablePropertyEntryFieldsProps = {
  draft: ComparableEntryDraft;
  disabled?: boolean;
  showCoordinates?: boolean;
  showDescription?: boolean;
  subjectPin?: ComparableSubjectPin | null;
  fieldErrors?: ComparableEntryFieldErrors;
  onChange: (next: ComparableEntryDraft) => void;
  onLocationConfirmedChange?: (confirmed: boolean) => void;
  /** Search the bank on the entry map and choose from it, beside entering a new comparable. */
  bankBrowse?: ComparableBankBrowse;
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
