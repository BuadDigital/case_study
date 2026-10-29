import { coordsFromLocationMapUrl } from "@platform/app-shared/domain/geo";
import {
  JEDDAH_DEFAULT_LAT,
  JEDDAH_DEFAULT_LNG,
  shouldUseJeddahDefaultCoords,
} from "@platform/app-shared/domain/jeddah-default-coords";
import type { PoPropertyIntake } from "./po-intake-data";
import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import { fillEmptyFeaturesFromBourse } from "./inspector-bourse-prefill";

/**
 * Starts the inspector's map at the point in the initial data's «رابط موقع الخريطة».
 *
 * How it works: when nothing is pinned yet and the draft still holds the blank / Jeddah
 * placeholder, the link's coordinates (inside the Kingdom) become the map's starting point.
 *
 * Edge cases: a pinned location, a point the inspector moved to, a link without coordinates
 * or outside the Kingdom are all left alone; the inspector still has to pin. Fixed 2026-10-28 —
 * the map opened on Jeddah for a Riyadh property whose link carried its coordinates.
 */
export function withMapLinkStartingPoint(
  draft: InspectorWorkspaceDraft,
  property: PoPropertyIntake | null | undefined,
): InspectorWorkspaceDraft {
  if (!property || draft.mapPinned) return draft;
  const placeholder =
    shouldUseJeddahDefaultCoords(draft.mapLatitude, draft.mapLongitude) ||
    (Number(draft.mapLatitude) === Number(JEDDAH_DEFAULT_LAT) &&
      Number(draft.mapLongitude) === Number(JEDDAH_DEFAULT_LNG));
  if (!placeholder) return draft;
  const fromLink = coordsFromLocationMapUrl(property.locationMapUrl);
  if (!fromLink) return draft;
  const lat = fromLink.lat.toFixed(6);
  const lng = fromLink.lng.toFixed(6);
  if (shouldUseJeddahDefaultCoords(lat, lng)) return draft;
  return { ...draft, mapLatitude: lat, mapLongitude: lng };
}

/** Prefill inspector featureValues and scalar fields from Enfath / PO property data. */
export function applyEnfathPrefillToInspectorDraft(
  draft: InspectorWorkspaceDraft,
  property: PoPropertyIntake | null | undefined,
): InspectorWorkspaceDraft {
  if (!property) return draft;

  const withFeatures = fillEmptyFeaturesFromBourse(draft, property);
  let changed = withFeatures !== draft;
  const patch: Partial<InspectorWorkspaceDraft> = changed
    ? { featureValues: withFeatures.featureValues }
    : {};

  if (!draft.propertyDescription.trim()) {
    const parts = [
      property.city.trim(),
      property.district.trim(),
      property.area.trim() ? `${property.area.trim()} م²` : "",
    ].filter(Boolean);
    if (parts.length) {
      patch.propertyDescription = parts.join(" — ");
      changed = true;
    }
  }

  if (!changed) return draft;
  return { ...draft, ...patch };
}

export function inspectorDraftNeedsEnfathPrefill(
  draft: InspectorWorkspaceDraft,
): boolean {
  const hasFeatures = Object.values(draft.featureValues).some((v) => v.trim());
  return (
    !hasFeatures &&
    !draft.propertyDescription.trim()
  );
}
