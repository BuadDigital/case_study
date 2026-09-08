/**
 * Runtime slot so `@evaluator/mfe` never imports `@case-study/mfe`.
 * Shell registers the impl at app boot; evaluator renders through here.
 *
 * Mirrors `../keys/key-envelope-fees-slot`.
 */

import type { ComponentType } from "react";
import type { PoPropertyIntake } from "../app-data/po-intake-property-model";
import type { PropertyDetailDocumentEntry } from "../app-data/property-detail-document-types";

export type PropertyDetailMediaGlanceProps = {
  property?: PoPropertyIntake | null;
  primaryPhoto?: PropertyDetailDocumentEntry | null;
  inspectorDescription?: string;
  latitude?: string | null;
  longitude?: string | null;
  showCoordinates?: boolean;
  valueBasisLabel?: string | null;
  valuePremiseLabel?: string | null;
  valuationPurposeLabel?: string | null;
  reportUsersLabel?: string | null;
};

let panel: ComponentType<PropertyDetailMediaGlanceProps> | null = null;

export function registerPropertyDetailMediaGlance(
  next: ComponentType<PropertyDetailMediaGlanceProps>,
): void {
  panel = next;
}

/** Null until the shell registers (SSR / tests / evaluator loaded standalone). */
export function tryGetPropertyDetailMediaGlance(): ComponentType<PropertyDetailMediaGlanceProps> | null {
  return panel;
}
